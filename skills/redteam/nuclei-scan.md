---
name: nuclei-scan
description: nuclei 模板化漏洞扫描：13,000+ 模板覆盖 CVE/暴露面/配置缺陷/默认口令，Nday 与 1day 的主力检测手段
whenToUse: 漏洞发现阶段拿到存活资产清单后，做 Nday/1day 批量检测；或已知组件版本想快速确认是否有现成模板
role: vuln-scan
enabled: true
---

# nuclei（模板化漏洞检测）

`nuclei` 是漏洞发现阶段的**主力**：一条命令覆盖 CVE、暴露面、错误配置、默认口令、未授权访问。
本机模板库已就位（详见下方路径），**不要上网重新找 POC**。

## 本机二进制与模板

| 项 | 值 |
| --- | --- |
| 二进制 | `/usr/bin/nuclei`（v3.11.1） |
| 模板库 | `~/.local/nuclei-templates`（**13,742 个模板**） |
| 模板版本 | v10.4.9（更新于 2026-09-18） |
| 配置 | `~/.config/nuclei/config.yaml`、`.templates-config.json` |

模板分布（写报告时按类引用）：`http/` 11,364（其中 `http/cves` 4,320、`http/misconfiguration` 981、
`http/vulnerabilities` 961、`http/exposures` 707、`http/default-logins` 307）、`cloud/` 663、`file/` 447、
`network/` 282、`dast/` 251。

**更新模板**：`nuclei -update-templates`（频率不超过每周一次；更新后先跑 `-tl` 确认没坏）。

## 基本用法

```bash
# 1) 单目标快速体检（先看会命中什么，不实际打）
nuclei -u https://target.example.com -severity critical,high,medium -rl 30 -c 15

# 2) 批量：从资产库导出的存活 URL 清单
nuclei -l runs/alive-urls.txt -severity critical,high -rl 50 -c 25 \
  -jsonl -o runs/nuclei-$(date +%m%d-%H%M).jsonl

# 3) 指定模板（已知组件版本 → 精确打击，命中率高、噪声小）
nuclei -u http://target:8080 -t http/cves/2021/CVE-2021-44228.yaml
nuclei -u http://target -t http/exposures/ -t http/default-logins/

# 4) 按标签（tags）批量
nuclei -l runs/alive-urls.txt -tags seeyon,weaver,panel,exposure -rl 20

# 5) 只列出会跑的模板（不发包，先评估覆盖面）
nuclei -l runs/alive-urls.txt -tags cve -tl
```

## 关键参数（本场景常用）

| 参数 | 作用 | 建议 |
| --- | --- | --- |
| `-rl` | 每秒请求上限 | 互联网侧 30–50；被 WAF 盯上后降到 5 |
| `-c` | 并发模板数 | 15–25，过高会打崩小站 |
| `-severity` | 只跑指定等级 | 演练只关心 `critical,high`（中低危不得分） |
| `-tags` / `-t` | 模板筛选 | 有指纹线索时优先用，别全量轰 |
| `-jsonl -o` | 结构化输出 | **必须落 `runs/`**，报告要引用 |
| `-proxy` | 走代理 | 降噪用 `cn-proxy-pool`；**内网目标走 suo5 隧道加 `-proxy socks5://127.0.0.1:1080`** |
| `-H` | 自定义头 | 带 Cookie/Token 测登录后功能点 |
| `-duc` | 禁用模板更新检查 | 批量跑时省时间 |
| `-stats -si 30` | 进度输出 | 长任务看进度 |

## 与知识库的配合（先查再打，禁止重复劳动）

动手前先 `redteam_poc_search`（按 CVE / 组件 / 版本 / 正文特征）——它一次查两层：**本机 POC 知识库 + 本机 nuclei 模板库**。
命中就用 `redteam_poc_get` 取全文或直接 `nuclei -t <模板>`；两层都没有才上网找，最后才手搓。

验证有效的新模板/EXP 用 `redteam_poc_add` 回填知识库（带 `category` + `engagement` + `asset_target` + `verified` + `verified_note`，脱敏本次靶标信息）。

## 降噪与自保（重要）

1. **默认 ignore 已排除危险标签**：`~/.config/nuclei/.nuclei-ignore` 里默认忽略 `dos`、`local`、`fuzz`、`bruteforce`、`txt-service`——
   **不要为了"打得更全"去掉这些忽略项**，DoS 类模板会打死生产系统，直接毁掉演练。
2. **先探测后开火**：先用 `-severity critical,high` 跑一轮；命中后再对具体命中项深入，不要一上来全量。
3. **WAF/封禁处理**：被拦先降 `-rl` 到 5 并加 `--delay 1s`，换 UA（`-H "User-Agent: ..."`），
   必要时用技能 `cn-proxy-pool` 换出口；**同一目标累计被封 >3 次立刻放弃**（`redteam_asset_test` status=abandoned + blocked=true），转向下一个目标。
4. **生产系统避开业务高峰**：定时任务、批量任务类模板（如触发同步/重建索引的）先在测试/预发资产上验证。

## 输出与落库（强制）

跑完立刻落库，**不要攒到最后**：

1. 读 `runs/nuclei-*.jsonl`，逐条 `redteam_vuln_add`：
   - `title`（模板名 + 命中点）、`severity`、`cve`（模板带的 `classification.cve-id`）、`target`（**带端口**）、
     `evidence`（命中回显/响应特征/matched-at）、`confidence=confirmed`（nuclei 命中即为已确认存在于响应层面）、
     `gained`（通过它能拿到什么）、`agent=vuln-scan`。
2. **每条确认漏洞配一条 `redteam_http_evidence_add`**：请求行 + Host + 关键请求头 + 响应摘要（模板的 `curl-command` 字段可直接用）。
3. 每个关键动作 `redteam_chain_add`：`stage_code=recon` 或 `internet`，
   `tool` 写**实际命令原文**（例如 `nuclei -l runs/alive-urls.txt -severity critical,high -rl 50 -jsonl -o runs/nuclei-0918.jsonl`），
   `result` 写回显摘要（例如 `命中 3 条：CVE-2023-xxxx（critical）…`）。
4. 测完该资产立刻 `redteam_asset_test` 回写：`status`（testing/tested/no_surface/blocked）、`test`（追加式结论）、`surface`（还剩什么可测）。
5. **只记能得分的面**：与得分无关的信息泄露、版本暴露、CORS/CSRF、SSL 与响应头类问题**最多记一行排除结论**，不深挖、不重复跑。

## 常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 一条不命中 | 目标不是 HTTP，或模板被 ignore | 加 `-tl` 看实际跑了哪些模板；确认协议 `-t http/` vs `network/` |
| 大量 `could not resolve` | URL 清单里有死链 | 先用 `pd-httpx` 过滤存活：`pd-httpx -l all.txt -o alive-urls.txt -silent` |
| 命中一堆 low/info | severity 没限 | 演练加 `-severity critical,high,medium` |
| 目标被打挂 | 并发过高 / 跑了 dos 模板 | 降 `-rl`/`-c`；确认 ignore 文件没被动过 |
| 内网目标打不到 | 没走隧道 | 加 `-proxy socks5://127.0.0.1:<suo5端口>`（技能 `suo5-tunnel`） |
