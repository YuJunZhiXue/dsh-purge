---
name: recon-pipeline
description: ProjectDiscovery 信息收集流水线：subfinder→dnsx→naabu→httpx→katana 一键铺开域名资产面
whenToUse: 信息收集阶段拿到域名/单位名后，系统化铺开子域→解析→端口→存活→页面与接口
role: recon
enabled: true
---

# 外部信息收集流水线（ProjectDiscovery）

把"一个域名"变成"一份带标题、技术栈、端口的存活资产清单"，是信息收集阶段的标准动作。
四个工具**有固定顺序**：先枚举子域 → 再解析 → 再探端口 → 再判存活 → 最后抓页面与接口。

## 本机工具

| 工具 | 路径 | 版本 | 作用 |
| --- | --- | --- | --- |
| subfinder | `$DSH_HOME/redteam/toolkit/subfinder/subfinder` | v2.16.0 | 被动子域枚举（多源聚合） |
| dnsx | `$DSH_HOME/redteam/toolkit/dnsx/dnsx` | v1.3.1 | 批量解析、DNS 爆破、泛解析过滤 |
| naabu | `$DSH_HOME/redteam/toolkit/naabu/naabu` | v2.6.1 | 高速端口扫描（SYN 需 root，否则 `-scan-type c`） |
| httpx | `$DSH_HOME/redteam/toolkit/httpx/httpx`（包装器 `~/.local/bin/pd-httpx`） | v1.12.0 | HTTP 存活/标题/技术栈/状态码 |
| katana | ❌ 未安装（如需抓取用技能 `browser-automation`） | — | 爬虫抓页面与接口 |
| ksubdomain | `$DSH_HOME/redteam/toolkit/ksubdomain/ksubdomain` | v0.7 | 无状态子域爆破（比 dnsx 爆破快） |
| OneForAll | `$DSH_HOME/redteam/toolkit/oneforall/OneForAll-0.4.5/`（源码，需 `.venv`） | v0.4.5 | 子域收集全家桶（字典大，慢但全） |

> ⚠️ **`/usr/bin/httpx` 是 Python httpx 库的 CLI，不是 ProjectDiscovery 的**——必须用 `pd-httpx` 或绝对路径。

## 标准流水线

```bash
mkdir -p runs
TK=$DSH_HOME/redteam/toolkit
D=example.com

# ① 子域枚举（被动，多源）
$TK/subfinder/subfinder -d $D -all -silent -o runs/subfinder-$D.txt
# 补充：无状态爆破（有字典时）
# $TK/ksubdomain/ksubdomain -d $D -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt

# ② 泛解析过滤 + 解析存活（dnsx 会剔除泛解析噪声，这一步很关键）
cat runs/subfinder-$D.txt | $TK/dnsx/dnsx -silent -a -resp -o runs/dnsx-$D.txt
awk '{print $1}' runs/dnsx-$D.txt | sort -u > runs/alive-domains-$D.txt

# ③ 端口扫描（先 top100 快速过一遍，再对存活主机扫全端口）
$TK/naabu/naabu -l runs/alive-domains-$D.txt -top-ports 100 -silent -o runs/naabu-$D.txt
# 全端口（慢，确认在范围内再做）：-p - -rate 1000

# ④ HTTP 存活与指纹（标题/状态码/技术栈/服务器）
$TK/httpx/httpx -l runs/alive-domains-$D.txt -ports 80,443,8080,8443,8000,8888,9000 \
  -title -status-code -tech-detect -web-server -follow-redirects -silent \
  -json -o runs/httpx-$D.jsonl

# ⑤ 整理成资产清单（URL 清单给目录爆破/漏洞扫描用）
python3 - <<'PY'
import json
out=set()
for line in open('runs/httpx-'+'$D'+'.jsonl'):
    try: j=json.loads(line)
    except: continue
    if j.get('url'): out.add(j['url'])
open('runs/alive-urls.txt','w').write('\n'.join(sorted(out)))
print('存活 URL:', len(out))
PY
```

## 单条命令速查（不想跑全流程时）

```bash
# 只要子域
$TK/subfinder/subfinder -d example.com -all -silent

# 只要存活 URL（已有域名清单）
pd-httpx -l domains.txt -silent -o alive.txt

# 只要端口（单 IP，全端口）
nmap -sS -p- --min-rate 1000 -T4 1.2.3.4 -oX runs/nmap-1.2.3.4.xml   # 技能 active-scan
$TK/naabu/naabu -host 1.2.3.4 -p - -rate 1000 -silent
```

## 与其它技能的分工

| 场景 | 用哪个 |
| --- | --- |
| 单位名/域名 → 互联网资产面（含未备案、同主体） | **`fofa-recon`**（测绘，找得最全） |
| 域名 → 子域 → 存活 → 指纹 | **本技能**（流水线，标准化） |
| 不接触目标（纯被动） | `passive-recon`（crt.sh/dig/whois） |
| 内网大网段测绘 | `gogo-intranet`（**不要用本技能打内网**） |
| SP​A/JS 渲染页面、接口清单 | `browser-automation` / `kimi-webbridge` |
| 存活主机端口/服务版本 | `active-scan`（nmap/masscan） |

**推荐顺序**：`fofa-recon` 铺面（拿单位资产全景）→ 本技能对每个域名做流水线（拿存活与指纹）→ `active-scan` 对重点 IP 定版本。

## 纪律

1. **只测授权范围内目标**：naabu 全端口、ksubdomain 爆破都属于**主动**行为，确认在范围内再做。
2. **限速**：`naabu -rate 1000` 起步；`subfinder` 用被动源不加 `-all` 时更安静（配额消耗也少）。
3. **泛解析**：`dnsx` 会过滤；如果结果里出现大量同 IP 的随机子域，说明目标有泛解析，改用 `-wd` 或换爆破字典。
4. **API key（可选增强）**：`subfinder` 配置 `~/.config/subfinder/provider-config.yaml` 可接
   Shodan/Censys/VirusTotal 等源（**需要用户提供 key**，见技能 `redteam-setup`）；没 key 也能用免费源。

## 输出与落库（强制）

1. **逐条 `redteam_asset_add`**：`target`（域名/IP）、`names`（域名）、`ports`（带 `url=host`、`title`、`product=server`）、
   `provenance=passive`（subfinder/dnsx 阶段）或 `active`（naabu/httpx 主动探测）、`tool`（具体工具名）。
2. **按 /24 自动建 C 段**（`redteam_asset_add` 已自动处理）→ 用 `redteam_asset_link` 建立
   `resolves`（域名→IP）、`contains`（C 段→IP）关系，形成图谱（技能 `asset-correlation`）。
3. 每个阶段 `redteam_chain_add`：`stage_code=recon`，`tool` 写实际命令原文，`result` 写数量摘要
   （如 `subfinder 命中 42 个子域 → dnsx 存活 31 → naabu 开放 87 端口 → httpx 存活 19 个站点`）。
4. **重点标注边缘资产**：测试/预发环境（test/dev/uat/pre/staging）、老旧系统、非标准端口、
   非备案主体但同 C 段/IP 的站点——写进 `note`，这些是资产梳理阶段的高优先级目标。
5. 结论给指挥者时**给数字**：子域数 / 存活 IP 数 / 开放端口数 / 存活站点数 / 其中高优先级几条。
