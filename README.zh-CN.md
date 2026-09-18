<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">dsh-purge</h1>

<p align="center"><strong>Version 1.1.7</strong></p>

<p align="center">
  <em>DeepSeek Harness 破甲：让所有模型都能破甲，不同模型可换不同提示词。默认提示词面向国模「小码酱」。求 Star 收藏 ⭐</em>
</p>

<p align="center">
  <a href="https://github.com/YuJunZhiXue/dsh-purge/stargazers"><img src="https://img.shields.io/github/stars/YuJunZhiXue/dsh-purge?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/YuJunZhiXue/dsh-purge/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d?style=flat" alt="MIT license"></a>
  <a href="https://awesome-dsh-plugin.com"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="awesome · DSH plugin"></a>
  <a href="https://deepseek.stream/plugins/dsh-purge"><img src="https://img.shields.io/badge/Hub-dsh--purge-1a73e8" alt="DeepSeek Harness Hub"></a>
  <a href="https://www.deepseek.com/harness/"><img src="https://img.shields.io/badge/dsh-0.1.5--rc.1-blue" alt="DSH"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  频道 <a href="https://t.me/LLM_PoJia">t.me/LLM_PoJia</a>
</p>

> 对准 **dsh 0.1.5-rc.1**（Node.js **≥18**；Windows 无感路径依赖 **Node ≥22** 的 `registerHooks`，更低版本仍靠文件级 `windowsHide` 补丁）。其它版本原文对不上时会显示待应用 / 跳过，不会乱改文件。
>
> 兼容 0.1.2 社区预设的 `dsh-persona text` 字段，以及 `dsh-mnemon` 历史会话的 v0 `summary`。装完必须 **Apply + 重启**。

---

## ☕ 赞赏支持 / Sponsor

如果 dsh-purge 对你有帮助，欢迎打赏。

<p align="center">
  <img src="docs/appreciate.png" alt="微信赞赏码" width="360">
</p>

<p align="center">
  <sub>Built by 小杨 · for DeepSeek Harness</sub>
</p>

---

## 🛡️ 为什么需要本地红队清洗

大模型已经进到本地 Agent / Harness：提示词、审批门、沙箱和会话迁移都会在运行时改写模型行为。只测「模型会不会答」不够，还要看宿主层有没有把合法评测请求掐死。

1. **暴露宿主护栏边界**：在本机已安装的 `@deepseek-ai/*` 包上做可回滚清洗，才能看清哪些拒绝来自模型，哪些来自 Harness 默认文案、审批阶梯或会话格式校验。
2. **保住官方能力，只拆拒绝锁**：不另造第二套身份，不删官方优化；身份只认操作员自己的 `prompt-inject.md`。
3. **升级可复现**：npm 覆盖 `node_modules` 后自动重打补丁；原文对不上就跳过，避免把 0.1.5 包改坏。

本项目是本地 Harness 清洗插件，不是公网扫描器，也不是对第三方站点的攻击套件。

---

> ### ⚠️ 严正法律免责与合规使用声明（Strict Legal & Compliance Disclaimer）
>
> **【零容忍严正申明】**：本项目坚决反对并严禁任何形式的违法犯罪行为。开发者绝不支持、不鼓励、不协助任何未授权网络攻击、漏洞利用、数据窃取、非法侵入计算机信息系统，或生成违法违禁内容的活动。
>
> 1. **合法受控范围限定**：本项目（`dsh-purge`）定位为本地 DeepSeek Harness 的红队科研插件与鲁棒性评测辅助工具。**严禁在未经所有者合法书面授权的目标、公网在线系统或生产业务上使用本项目或其衍生补丁**。一切测试必须限制在**本机已授权安装的 Harness、离线本地合成靶标（Local Synthetic Fixtures）、授权网络安全演练靶场及合规实验室受控环境**中进行。
> 2. **严禁违法与违禁用途**：使用者严禁利用本项目直接或间接从事：
>    - 任何违反《中华人民共和国刑法》、《中华人民共和国网络安全法》、《中华人民共和国数据安全法》、《中华人民共和国个人信息保护法》等法律法规的行为；
>    - 未经授权渗透、攻击公私机构计算机信息系统，实施勒索、破坏、撞库或传播恶意载荷；
>    - 诱导、生成或传播危害国家安全、恐怖主义、暴力血腥、涉黄涉赌、诈骗、侵犯公民隐私或知识产权等法律明令禁止的内容；
>    - 违反相关大模型提供商的《服务条款（Terms of Service）》与《滥用政策（Usage Policy）》。
> 3. **使用者独立承担全部责任**：本项目依据 MIT 开源协议「按现状（AS-IS）」提供，开发者不对软件的完整性、安全性与适用性作任何明示或暗示保证。**使用者应对自身的全部下载、部署、运行、修改、传播行为，以及由此产生的全部输入与输出后果，承担独立、完全的民事、行政及刑事法律责任**。作者与贡献者不对使用者滥用承担任何直接、间接或连带责任。
> 4. **违约即终止授权**：任何将本项目用于非法攻击、恶意活动或违规行为的个人或实体，其开源软件使用许可自违法违规行为发生之日起**自动且不可撤销地立即终止**。该主体须立即停止使用并永久销毁本项目的全部代码、脚本与衍生数据，并依法承担相应法律责任。
> 5. **第三方独立性声明**：本项目属于完全独立的开源安全评测研究项目，与 DeepSeek 官方或其关联主体无任何隶属、商业合作、授权或官方背书关系。
> 6. **同意即约束**：任何克隆、下载、安装、二次分发或运行本项目代码的行为，均视为已阅读并完全同意上述全部条款。若不同意，请立即停止使用并删除全部代码与文件。

---

## ⚡ 安装方式

Web 端和桌面端**分开装、分开清洗**，互不影响。

| 宿主 | profile | 默认怎么装 |
|---|---|---|
| **Web 端**（官方 `dsh web`） | `web` | PATH 上的官方 `dsh` |
| **桌面端**（社区 [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop)） | `desktop` | 桌面应用自带终端里的 `dsh`（不要用 PATH 上的官方 `dsh`） |
| 官方 Harness 桌面 EXE | `default` | 官方 `dsh`，或下面的 `dsh://` |

装完后都要：

1. 完全退出并重启**刚装的那个宿主**（Web 关 `dsh web`；桌面端退出托盘再打开 `DSH Desktop.exe`）
2. 在**这个宿主**的设置页出现「规则设定」后点「应用」（只写入 profile 还不会改 `@deepseek-ai`）
3. 启动后会自动清洗当前宿主；没有 `prompt-inject.md` 时写入默认注入（已有文件不覆盖，空文件表示不注入）

Web 的「应用 / 重启 / 卸载」只动 Web。桌面端的「应用 / 重启 / 卸载」只动桌面应用，不会去拉 `dsh web`。

> 🌐 **插件生态市场**：[DeepSeek Harness Hub](https://deepseek.stream/plugins/dsh-purge)（只看介绍；**不要**用 `deepseek.stream/api/plugins/download?...`，那个地址不是 pnpm 能解的 tar，会报 `ERR_PNPM_TARBALL_EXTRACT`）

### Web 端（默认）

```sh
dsh plugin --profile web add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip
```

当前目录已是本仓库时：

```sh
dsh plugin --profile web add .
```

然后关掉 `dsh web` 再开，在 Web 设置页点「应用」。`dsh` 不在 PATH 就先装好官方 CLI，或走下面「手动配置」。

### 桌面端（默认）

打开社区 [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop)，在**自带终端**里执行（这里的 `dsh` 是桌面包装脚本，默认 profile 就是 `desktop`）：

```sh
dsh plugin add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip
```

不要用 PATH 上的官方 `dsh plugin --profile desktop`（会被拒绝）。不要用 `dsh://`（那是官方 EXE）。

然后退出托盘，重新打开 `DSH Desktop.exe`，在**桌面端**设置页点「应用」。

从系统终端安装时，用桌面端自带 CLI。按正在运行的进程、默认安装位置定位 `DSH Desktop.exe`：

```powershell
$zip = "https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip"
$exe = (Get-Process -Name "DSH Desktop" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)
if (-not $exe) {
  $exe = @(
    "$env:LOCALAPPDATA\Programs\DSH Desktop\DSH Desktop.exe",
    "$env:ProgramFiles\DSH Desktop\DSH Desktop.exe",
    "${env:ProgramFiles(x86)}\DSH Desktop\DSH Desktop.exe"
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $exe) { throw "未找到 DSH Desktop.exe，请先打开桌面端，或把 `$exe` 设成安装目录里的 exe" }
$cli = @(
  (Join-Path (Split-Path $exe) "resources\app\lib\desktop-cli.js"),
  (Join-Path (Split-Path $exe) "resources\app.asar.unpacked\lib\desktop-cli.js")
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
$env:ELECTRON_RUN_AS_NODE = "1"
$env:DSH_DESKTOP_DEFAULT_PROFILE = "desktop"
& $exe --expose-internals $cli plugin add $zip
```

自定义安装目录时，把 `$exe` 换成该目录下的 `DSH Desktop.exe`。默认用 zip，避免本地路径空格把命令拆开。

### 交给 AI 安装（只装插件）

把下面这一块发给本机助手，让它只执行安装命令。

<details open>
<summary><strong>给 AI 助手（只安装）</strong></summary>

<!-- AI-AGENT-START -->

安装 DeepSeek Harness 插件 `dsh-purge`。先确认宿主，只装正在用的那一个。不要全盘搜索，不要读或改其它文件，不要应用设置，也不要重启应用。

**Web 端（官方 `dsh web`）**

`dsh` 不在 PATH 就告诉用户后停止。

```sh
dsh plugin --profile web add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip
```

当前目录已是本仓库时改用 `dsh plugin --profile web add .`。

**桌面端（社区 DSH Desktop）**

不要用 PATH 上的官方 `dsh plugin --profile desktop`。不要用 `dsh://`。

默认：已在桌面端自带终端里时直接跑：

```sh
dsh plugin add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip
```

从系统终端安装时：用正在运行的 `DSH Desktop` 进程 Path，或默认位置 `%LOCALAPPDATA%\Programs\DSH Desktop\DSH Desktop.exe`、`%ProgramFiles%\DSH Desktop\DSH Desktop.exe`。不要全盘扫描。然后：

```powershell
$zip = "https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip"
$exe = (Get-Process -Name "DSH Desktop" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)
if (-not $exe) {
  $exe = @(
    "$env:LOCALAPPDATA\Programs\DSH Desktop\DSH Desktop.exe",
    "$env:ProgramFiles\DSH Desktop\DSH Desktop.exe",
    "${env:ProgramFiles(x86)}\DSH Desktop\DSH Desktop.exe"
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $exe) { Write-Host "未找到 DSH Desktop.exe，请先打开桌面端或给出安装目录"; return }
$cli = @(
  (Join-Path (Split-Path $exe) "resources\app\lib\desktop-cli.js"),
  (Join-Path (Split-Path $exe) "resources\app.asar.unpacked\lib\desktop-cli.js")
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
$env:ELECTRON_RUN_AS_NODE = "1"
$env:DSH_DESKTOP_DEFAULT_PROFILE = "desktop"
& $exe --expose-internals $cli plugin add $zip
```

**官方 Harness 桌面 EXE**

```sh
dsh plugin --profile default add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip
```

命令结束后，提醒：完全退出并重启刚装的那个宿主，再在该宿主设置页点「应用」。Web 和桌面端不要交叉点应用。然后停止。

<!-- AI-AGENT-END -->

</details>

### 官方桌面 EXE（`dsh://`）

已安装 **DeepSeek Harness 官方桌面客户端（EXE）** 时，点下方按钮走系统 URI。社区 [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop) **不认** `dsh://`，走上面「桌面端」默认命令。

命令行等价：

```sh
dsh plugin --profile default add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip
```

<p align="center">
  <a href="https://deepseek.stream/plugins/dsh-purge"><strong>🌐 打开插件市场页</strong></a>
  &nbsp;·&nbsp;
  <a href="dsh://plugin/install?id=dsh-purge&name=dsh-purge&version=1.1.7&repo=YuJunZhiXue%2Fdsh-purge&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fgithub.com%2FYuJunZhiXue%2Fdsh-purge%2Farchive%2Frefs%2Fheads%2Fmaster.zip"><strong>🚀 唤起客户端一键安装</strong></a>
</p>

🔗 **原生协议链接：**

```
dsh://plugin/install?id=dsh-purge&name=dsh-purge&version=1.1.7&repo=YuJunZhiXue%2Fdsh-purge&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fgithub.com%2FYuJunZhiXue%2Fdsh-purge%2Farchive%2Frefs%2Fheads%2Fmaster.zip
```

**网页端（前端）触发代码示例：**

```js
/**
 * 唤起 DeepSeek Harness 桌面客户端一键安装 dsh-purge
 */
export function installDshPurgeToDesktop() {
  const params = new URLSearchParams({
    id: 'dsh-purge',
    name: 'dsh-purge',
    version: '1.1.7',
    repo: 'YuJunZhiXue/dsh-purge',
    permissions: '系统提示词注入, 本机补丁, 设置页',
    downloadUrl: 'https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip',
  });

  const deepLink = `dsh://plugin/install?${params.toString()}`;

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = deepLink;
  document.body.appendChild(iframe);
  setTimeout(() => document.body.removeChild(iframe), 2000);
}
```

**HTML 静态链接方式：**

```html
<a href="dsh://plugin/install?id=dsh-purge&name=dsh-purge&version=1.1.7&repo=YuJunZhiXue%2Fdsh-purge&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fgithub.com%2FYuJunZhiXue%2Fdsh-purge%2Farchive%2Frefs%2Fheads%2Fmaster.zip">
  🚀 唤起客户端一键安装
</a>
```

**协议参数配置（dsh://plugin/install）：**

| 参数名 | 值 / 示例 | 说明 |
|---|---|---|
| id | `dsh-purge` | 插件唯一标识符 |
| name | `dsh-purge` | 插件展示名称 |
| version | `1.1.7` | 语义化版本号 |
| repo | `YuJunZhiXue/dsh-purge` | GitHub 仓库 |
| permissions | `系统提示词注入, 本机补丁, 设置页` | 申请权限 |
| downloadUrl | `https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip` | zip 下载直链 |

### 手动配置安装

`dsh` 不在 PATH、或不想用 `dsh plugin add` 时，按宿主改对应 profile。不要删原有 bundle。

**1. 找到 Harness 主目录（下文称 `$DSH_HOME`）**

| 安装形态 | 典型路径 |
|---|---|
| 环境变量 | `DSH_HOME`（已设置就用它） |
| Windows 便携包 | 与 `npm-global` 同级的 `.dsh` |
| 用户默认 | Windows `%USERPROFILE%\.dsh`；Linux / macOS `~/.dsh` |

| 宿主 | profile 目录 |
|---|---|
| Web 端 | `$DSH_HOME/profiles/web` |
| 社区桌面端 | `$DSH_HOME/profiles/desktop` |
| 官方桌面 EXE | `$DSH_HOME/profiles/default` |

**2. 把本仓库放到 plugins 目录**

```sh
git clone https://github.com/YuJunZhiXue/dsh-purge.git "$DSH_HOME/plugins/dsh-purge"
```

或把已有仓库复制为 `$DSH_HOME/plugins/dsh-purge`（目录名必须是 `dsh-purge`）。用 `file:../../plugins/dsh-purge` 相对路径即可。

**3. 改对应 profile 的 `package.json`**

- Web：`$DSH_HOME/profiles/web/package.json`
- 社区桌面端：`$DSH_HOME/profiles/desktop/package.json`
- 官方桌面 EXE：`$DSH_HOME/profiles/default/package.json`

在 `dependencies` 里追加（不要删别的依赖）：

```json
"dsh-purge": "file:../../plugins/dsh-purge"
```

在 `dsh.profile.bundles` 数组**末尾追加** `"dsh-purge"`：

- Web：**必须保留**原来的 `@deepseek-ai/dsh-web-app`，只追加本插件
- 桌面端：保留原来的 `@deepseek-ai/dsh-base` 等，只追加本插件

完整示意（其它字段按原文件保留）：

```json
{
  "dependencies": {
    "dsh-purge": "file:../../plugins/dsh-purge"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-purge"
      ]
    }
  }
}
```

桌面 profile 若没有 `dsh-web-app` 这一行，不要硬加；只保证 `bundles` 里有 `"dsh-purge"`。

**4. 安装依赖**

```sh
cd "$DSH_HOME/profiles/web"       # Web
pnpm install

cd "$DSH_HOME/profiles/desktop"   # 社区桌面端
pnpm install

cd "$DSH_HOME/profiles/default"   # 官方 EXE
pnpm install
```

Windows PowerShell：

```powershell
cd "$env:USERPROFILE\.dsh\profiles\web"
# cd "$env:USERPROFILE\.dsh\profiles\desktop"
# cd "$env:USERPROFILE\.dsh\profiles\default"
# 便携包：<安装根>\.dsh\profiles\<web|desktop|default>
pnpm install
```

**5. 重启，再打补丁**

1. 完全退出刚装的那个宿主（Web 关进程；桌面端退出托盘），再启动。
2. 设置页应出现「规则设定」。有缓存就 Ctrl+F5。
3. 在**这个宿主**点「应用」，或聊天 `/purge apply`。
4. 按提示再重启一次。桌面端的「重启 / 卸载」会重启桌面应用。

### 卸载

设置页 →「规则设定」→「卸载」。弹窗确认：卸载将还原回原版并清除本插件。如果已经点过「应用」，会先还原补丁，再删插件文件，然后重启当前宿主（Web 重启 `dsh web`；桌面端重启 `DSH Desktop.exe`）。

```sh
# 也可以用命令行
dsh-purge --uninstall
# 或聊天里 /purge uninstall
```

插件配置在 `cordis.patch.yml`：

```yaml
- insert:
    - id: dsh-purge
      name: 'dsh-purge'
      config:
        enabled: true
        autoApplyOnStart: true
        autoUpdateOnStart: true
        autoRevertOnMissing: false
        verbose: false
        postPromptOrder: 5100
        postPrompt: ""
```

`postPrompt` 默认为空。需要时再追加一段有序 systemPrompt，不改 `prompt-inject.md`。

---

## 这是什么

**dsh-purge** 是 [DeepSeek Harness](https://www.deepseek.com/harness/) 的设置插件：

- 改本机已安装的 `@deepseek-ai/*` 包：默认文案、权限策略、工具上限；
- 设置页「规则设定」：分组查看补丁、应用 / 还原 / 卸载、编辑会话覆盖、多套规则；
- 启动时自动检查并重新应用（npm 升级覆盖 `node_modules` 之后不必手搓）；
- 不写死盘符：按 `$DSH_HOME`、dsh 启动器旁边的 `.dsh`、系统默认 `~/.dsh` 探测本机位置。

不改 Harness 源码仓库。设置页点「应用」即可。身份只来自你自己的 `prompt-inject.md`，插件不再另写一张身份卡。

---

## 0.1.5 适配要点

| 现象 | 补丁 | 处理 |
|---|---|---|
| 选工作区 / 开新对话被清空 | `#4` `#28` `#39` | 0.1.5 的 `dsh-persona` 只要 `prefix`；旧预设仍写 `text`。补丁把 `text` 收成 `prefix` 别名，梁神等 0.1.2 预设才能挂上 |
| 历史会话 `summary requires notice form` | `#40` | `dsh-session-format-v0-to-v1` 允许 mnemon 的 `instructions` / `recall` 带着 `summary` |
| 「你是谁」回到 DeepSeek 助手 | 注入文件 | 不发明第二套身份；`dsh-purge` 段只贴 `prompt-inject.md` 原文 |
| 梁神第一轮像没注入 | `#29` | phase-1 保留 persona / persona-prefix / persona-suffix 与 inject，不扒官方工具目录 |

`#20` / `#21` / `#28` / `#29` 仍是可选插件项：没装对应包就跳过。

---

## 界面预览

设置页会出现「规则设定」。白 / 墨可切换。补丁按组展开，进度只计真正已应用的项。规则集在上方列表启用或删除，下方编辑正文。

**补丁**

![补丁](docs/preview/settings.png)

**规则集**

![规则集](docs/preview/rules.png)

| 区域 | 说明 |
|---|---|
| 白 / 墨 | 设置卡片外观 |
| 补丁 | 分组查看状态，应用、还原或卸载 |
| 提示词 | 编辑 `prompt-inject.md`，作为会话覆盖段 |
| 规则集 | 多套 `AGENTS.md` / `CLAUDE.md`；启用写入 `$DSH_HOME`，删除从列表去掉 |

---

## 目录结构

```
dsh-purge/
├── bin/dsh-purge.js
├── client.js
├── cordis.patch.yml
├── docs/
│   ├── appreciate.png
│   ├── banner.svg
│   └── preview/
│       ├── rules.png
│       └── settings.png
├── lib/
│   ├── child-process-hide.mjs
│   ├── core.js
│   ├── default-prompt-inject.md
│   ├── hide-console.js
│   ├── identity.js
│   ├── index.js
│   ├── restart-web.js
│   ├── rewind.js
│   ├── rules.js
│   ├── uninstall-restart.js
│   ├── uninstall.js
│   └── update.js
├── package.json
├── screenshots.json
├── LICENSE
├── README.md
└── README.zh-CN.md
```

运行时用户文件：`$DSH_HOME/prompt-inject.md`、`$DSH_HOME/rules/`。未设 `DSH_HOME` 时，优先用 dsh 安装目录旁边的 `.dsh`，再退回 `~/.dsh`。

---

## 生效验证

- 重启后设置页出现「规则设定」卡片（客户端半体加载成功）。有缓存时 Ctrl+F5。
- 点「应用」，进度里已应用项增加；再按提示重启，补丁进入当前进程。缺可选包（如梁神、web-fetch）时对应项显示跳过/缺失，不影响「完成 → 重启」。
- 首次应用若尚无 `prompt-inject.md`，会写入内置默认提示词；已清空的文件不会再自动填回。
- 聊天里 `/purge status` 能打出 `DSH_HOME` 和补丁列表。
- 0.1.5 上选已有工作区应能恢复会话，不应被清空成空工作区。
- 个别项显示跳过是正常的：例如没装 `dsh-web-fetch-http` 时 #20 / #21 会跳过。

---

## 使用

```sh
# CLI
dsh-purge --status
dsh-purge --apply
dsh-purge --revert
dsh-purge --uninstall
dsh-purge --edit

# 聊天
/purge status | apply | revert | uninstall | edit | help
/rules list | use <id> | create <id> | delete <id> | reset | help
/rewind

# 模型工具
purge_status   purge_apply   purge_revert
```

设置页「应用」完成后需要重启才会加载已改的包文件。点「重启」才会重启，不会自动重启。

输入框旁的「回退」会丢掉最近一轮对话，并把上一句填回输入框；聊天里 `/rewind` 同样可用。

---

## 本地校验

```sh
node --check lib/index.js
node --check lib/core.js
node --check lib/rewind.js
node --check client.js
```

---

## 工作原理

**应用（启动时 / 手动）：**

```
补丁未应用? ──否──> 跳过
    │是
    ├─> 备份原件 <文件>.dshpurge.bak（Desktop host-commands 的 shim 备份外置到 `$DSH_HOME/dsh-purge/shim-backups`）
    ├─> 按补丁列表替换对应文件
    ├─> 覆盖 shim（dsh.cmd / dsh.ps1 / unix dsh；**跳过 Desktop host-commands 密封目录**）
    ├─> 清掉密封目录里误放的 sibling `*.dshpurge.bak`（Desktop 启动前校验，残留会进恢复模式）
    ├─> Windows：钉 hide-console + child_process 导入钩子，并修补 subprocess-local / doctor / market / 梁神 bash
    └─> 若 `prompt-inject.md` 尚不存在则写入默认覆盖文本（已存在的空文件不覆盖）
```

**覆盖（每次会话）：**

```
prompt-inject.md 有内容? ──是──> 原样写入 dsh-purge systemPrompt 段
           │否
           └─> 不写入覆盖段
```

**身份（1.3.6）：** 插件不发明「操作员 / LCS」第二套人设。官方 Harness 身份句剥掉；`prompt-inject.md` 原文就是身份。0.1.5 把 inject 折进 `persona-prefix`，避免被梁神 phase-1 滤掉。

**Windows CMD 无感：** Node 24 上 `import { spawn } from "node:child_process"` 不是 live binding。`registerHooks` 把 `node:child_process` 指到带 `windowsHide` 的 facade，并直接给 `@deepseek-ai/dsh-subprocess-local` 加 `windowsHide: true`。doctor 重启走 `node + bin.js`，不写 noop `supervisor.cmd`。

**梁神 phase-1：** 默认预设会扒掉非 persona 的 system-prompt 段。Apply / 启动时保留 persona、persona-prefix、persona-suffix 与 inject（工具目录仍按梁神隔离）。

**DSH Desktop（anywhere-labs/dsh-desktop，issue #9）：** `host-commands/<profile>/bin` 是密封目录，禁止 sibling 额外文件（含 `dsh.cmd.dshpurge.bak`）。本插件对密封目录只清理、不注入、不写 bak。

**提示词清洗：** `minimal` / 官方 `standard` `code` `cordis` / 梁神人设里的拒绝与禁角色扮演表述，换成可执行 + 允许角色扮演。不锁死固定角色名。

---

## 还原

- 每个目标文件在应用前备份为 `<文件>.dshpurge.bak`。
- 「还原」或 `/purge revert` 用备份覆盖回去并删除备份；没有备份时去掉 shim 里由本插件写入的行。
- `prompt-inject.md` 是用户文件，还原时保留。
- 「卸载」会先还原（若已应用），再删除注入文件、规则库和插件本身。
- 重复应用是幂等的。

---

## 路径探测

宿主面先判断 `web` / `desktop`（预留 `gui` / `tui`，尚未单独适配时回退 web）。

**Web：**

1. `DSH_HOME` / `DSH_BASE`
2. dsh 启动器旁的 `.dsh`
3. `npm prefix -g` / `npm root -g`
4. 嵌套 `@deepseek-ai/dsh/node_modules/@deepseek-ai`
5. 系统默认 `~/.dsh`

**桌面端：** 只打当前桌面进程安装包树（`resources/app` 或 `app.asar.unpacked` 下的 `@deepseek-ai`）。顺序：运行中的 `DSH Desktop.exe` / `resourcesPath` / `host-process-entry.js`，其次默认安装位置，或 `DSH_DESKTOP_INSTALL` / `DSH_BASE`。不打官方 npm-global。密封的 `host-commands` / `runtime-commands` 只清理、不注入。

找不到目标时提示设置 `DSH_BASE`，不改文件。

---

## 更新记录

### 1.1.7

- 安装文档按 **Web 端 / 桌面端** 分开写默认命令：Web 用官方 `dsh --profile web`；桌面端默认在自带终端 `dsh plugin add <zip>`。
- 桌面端清洗、重启、卸载只针对当前桌面进程的安装树，不碰官方 Web / npm-global。
- 桌面端安装目录按运行中的 `DSH Desktop.exe` 定位，默认位置或自定义目录都可以。

<details>
<summary>更早版本</summary>

### 1.1.6

- 设置页「卸载」会弹窗确认；若已应用补丁则先还原回原版，再清除插件并重启。
- 给 AI 的安装块只跑官方 `dsh plugin add`，不扫盘、不应用。

### 1.1.5

- 点「更新」时：git 快进失败会 `fetch + reset`，再不行改用 zip 覆盖，不再整次失败。

### 1.1.4

- 检测更新按 GitHub 提交号读 `package.json`，不再误用 jsDelivr `@master` 缓存，也不会在读不到远端版本时显示成「有新版本 1.1.2，当前 1.1.2」。

### 1.1.3

- 系统提示词只在每个会话第一轮注入一份；后续轮次钉住已提交的系统提示词，不再追加第二份。
- 默认剥掉套件自带的 `dsh-mnemon` 上下文注入。
- 从子代理点回主代理时，不再把上一句已发送的内容填回输入框。
- 补上 Cordis 需要的 `{ apply }` 默认导出，避免插件树加载失败导致后端退出。

### 1.1.2

- 自定义 OpenAI 兼容接口不再因 `developer` 角色 400：`#42` 改回 `system`。
- 设置页规则集：读 / 删 / 存走同一个 POST，不再报 `Failed to fetch`。

### 1.1.1

- 输入框旁「回退」/ `/rewind`：主代理可选回退一次或上一轮（丢掉本轮子代理）；子代理直接回退一次。
- 回退后输入框仍是上一句用户内容，再次发送是全新一轮：清掉待发送队列，不会把旧提示再自动发出去。
- 可选补丁对不上时记为跳过，不再算失败。

### 1.1.0

- 检测更新与下载分开：先查，有新版本按钮变成「更新」，版本号显示远端。
- 开机自动对照 GitHub `master` 并下载。`dsh plugin add`（zip / github）走官方 CLI；没 git 下 `master.zip` 覆盖。git 仓库本地有未提交改动时不自动覆盖。
- **#16**：`#26` 不再对 YAML 用无缩进 identity 替换；apply 重写 `prefix`/`text` 缩进，cordis 预设能挂载。
- **#15**：空提示词仍不注入。有内容却进不了会话，是 0.1.5 `complete:true` 丢掉 section；`#41` 把注入补回 complete 段。
- **#14**：Hub `api/plugins/download` 不是 tar，安装只用 GitHub `master.zip`。

### 1.0.0

- 版本号从头计数。
- 设置页增加 **检测更新**：对照 GitHub `master`。

</details>

## 说明

- 改动范围是本机 `@deepseek-ai/*` 包里的渲染文案、默认策略和执行逻辑，以及用户目录下的覆盖文件与规则集。
- 升级后原文对不上会报 `pattern_not_found` 或显示待应用，不会乱改。
- 不改动非 `@deepseek-ai` 的第三方插件源仓库（启动时的 CMD 无感会**尽力**修补已装的 doctor / market / 梁神 / mnemon，属运行时补丁）。
- npm 上暂未发布同名包，用 GitHub、[插件市场](https://deepseek.stream/plugins/dsh-purge) 或 `dsh plugin add .` 安装。

---

感谢 [LINUX DO](https://linux.do) 社区
