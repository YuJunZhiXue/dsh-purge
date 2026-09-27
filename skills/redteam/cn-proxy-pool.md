---
name: cn-proxy-pool
description: 国内免费 HTTP/SOCKS5 代理池：抓取、验活、按需轮换；只用命令级代理参数，绝不改动本机网络与代理配置
whenToUse: 目标有 WAF/封 IP 风险，或需要高频请求（接口爆破、目录扫描、口令喷洒）时
role: vuln-scan
enabled: true
---

# 国内免费 IP 代理池

免费代理不稳定，定位是**降低被封风险**而不是隐藏身份。关键目标优先用自有出口或 suo5 隧道。

## ⛔ 铁规则：不许动本机的网络与代理配置

使用代理**只允许在单条命令上临时指定**，任何情况下都不要修改本机配置。以下操作一律禁止：

| 禁止 | 说明 |
|---|---|
| 设系统代理 | GNOME/KDE 网络设置、`gsettings set org.gnome.system.proxy …`、`networksetup -setwebproxy`、Windows `netsh winhttp set proxy` |
| 写全局环境变量 | 修改 `/etc/environment`、`/etc/profile`、`/etc/profile.d/*`、`~/.bashrc`、`~/.bash_profile`、`~/.profile`、`~/.zshrc` 里的 `http_proxy` / `https_proxy` / `all_proxy` / `no_proxy` |
| 改工具全局配置 | `~/.curlrc`、`~/.wgetrc`、`~/.npmrc`、`/etc/apt/apt.conf.d/*proxy*`、`/etc/pip.conf`、`~/.docker/config.json`、`~/.gitconfig` 的 proxy 项 |
| 改 proxychains 全局配置 | 不修改 `/etc/proxychains4.conf`、`~/.proxychains/proxychains.conf`；确需用时用 `-f` 指向 `runs/` 下的临时配置，用完删除 |
| 动系统网络 | iptables/nftables 规则、路由表、DNS（`/etc/resolv.conf`）、NetworkManager、起停 VPN/tun 设备 |
| 持久化 export | 不在 shell 里 `export http_proxy=…` 让它留在会话里；要传就**内联**在该条命令前 |

**正确姿势**（全部是命令级、一次性的）：

```bash
P=$(shuf -n1 runs/live-proxies.txt)

# 方式一：工具自带的代理参数（首选）
curl -s --proxy "http://$P" --max-time 15 -I "https://target.example.com/"
nuclei -u https://target.example.com/ -proxy "http://$P" -rate-limit 20
sqlmap -u "https://target.example.com/item?id=1" --proxy="http://$P" --batch --random-agent
ffuf -u https://target.example.com/api/FUZZ -w wordlist.txt -x "http://$P" -rate 20

# 方式二：只对这条命令内联环境变量（不 export，进程结束即失效）
http_proxy="http://$P" https_proxy="http://$P" curl -s --max-time 15 "https://target.example.com/"

# 方式三：只支持原始 TCP 的工具 → 用 suo5 SOCKS5 隧道（技能 suo5-tunnel），
#        不要为它去改系统代理；proxychains 用临时配置文件：
proxychains4 -f runs/proxychains.tmp.conf -q nmap -sT -Pn -p 80,443 10.0.0.5
```

## 一、抓取（多源合并）
```bash
mkdir -p runs && cd runs
curl -s --max-time 20 "https://www.89ip.cn/tqdl.html?api=1&num=50&port=&address=%E4%B8%AD%E5%9B%BD&isp=" \
  | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{2,5}' >> raw-proxies.txt
curl -s --max-time 20 "http://www.ip3366.net/free/?stype=1" \
  | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}</td>[[:space:]]*<td>[0-9]{2,5}' \
  | sed -E 's#</td>[[:space:]]*<td>#:#' >> raw-proxies.txt
curl -s --max-time 20 "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/countries/CN/data.txt" \
  | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{2,5}' >> raw-proxies.txt
sort -u raw-proxies.txt -o raw-proxies.txt && wc -l raw-proxies.txt
```

## 二、验证（并发测活，留下能用的）
```bash
cat > runs/check_proxy.py <<'PY'
import concurrent.futures, sys, urllib.request
TARGET = "http://www.baidu.com"   # 仅测连通性，不携带任何敏感数据
def ok(proxy):
    try:
        op = urllib.request.build_opener(urllib.request.ProxyHandler({"http": "http://" + proxy, "https": "http://" + proxy}))
        with op.open(TARGET, timeout=6) as r:
            return proxy if r.status == 200 else None
    except Exception:
        return None
with open(sys.argv[1]) as f:
    cands = [l.strip() for l in f if l.strip()]
with concurrent.futures.ThreadPoolExecutor(max_workers=50) as ex:
    for res in ex.map(ok, cands):
        if res: print(res, flush=True)
PY
python3 runs/check_proxy.py runs/raw-proxies.txt > runs/live-proxies.txt
wc -l runs/live-proxies.txt
```

## 三、轮换与限速
- 每个请求随机取一个代理；失败自动剔除并换下一个。
- 目标侧仍要限速（`-rate-limit` / `--delay`），代理只是换出口 IP，不是加速器。
- 记录每个出口 IP 的成败，同一目标连续 3 次被封就按漏洞检测提示词里的规则**放弃该目标**。

## 四、注意事项
- **不要通过免费代理传输凭据、Cookie、上传的 shell**——免费代理可能记录流量。
- 测活只测连通性，不要用真实业务请求去测。
- 高频爆破前确认目标没有账号锁定策略；触发锁定前主动停手。
- 用完清掉 `runs/` 下的临时配置（如 `proxychains.tmp.conf`），不要在系统里留下任何代理痕迹。
- 仅在授权演练范围内使用。
