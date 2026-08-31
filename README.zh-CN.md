<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">dsh-purge</h1>

<p align="center"><strong>Version 1.3.0</strong></p>

<p align="center">
  <em>DeepSeek Harness 破甲：让所有模型都能破甲，不同模型可换不同提示词。默认提示词面向国模「小码酱」。求 Star 收藏 ⭐</em>
</p>

<p align="center">
  <a href="https://github.com/YuJunZhiXue/dsh-purge/stargazers"><img src="https://img.shields.io/github/stars/YuJunZhiXue/dsh-purge?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/YuJunZhiXue/dsh-purge/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d?style=flat" alt="MIT license"></a>
  <a href="https://awesome-dsh-plugin.com"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="awesome · DSH plugin"></a>
  <a href="https://www.deepseek.com/harness/"><img src="https://img.shields.io/badge/dsh-0.1.1--rc.2-blue" alt="DSH"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

> 对准 **dsh 0.1.1-rc.2**。其它版本原文对不上时会显示待应用 / 跳过，不会乱改文件。

---

## 这是什么

**dsh-purge** 是 [DeepSeek Harness](https://www.deepseek.com/harness/) 的设置插件：

- 改本机已安装的 `@deepseek-ai/*` 包：默认文案、权限策略、工具上限；
- 设置页「规则设定」：分组查看补丁、应用 / 还原、编辑会话覆盖、多套规则；
- 启动时自动检查并重新应用（npm 升级覆盖 `node_modules` 之后不必手搓）；
- 不写死盘符：按 `$DSH_HOME`、dsh 启动器旁边的 `.dsh`、系统默认 `~/.dsh` 探测本机位置。

不改 Harness 源码仓库。设置页点「应用」即可。

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
| 补丁 | 分组查看状态，应用或还原 |
| 提示词 | 编辑 `prompt-inject.md`，作为会话覆盖段 |
| 规则集 | 多套 `AGENTS.md` / `CLAUDE.md`；启用写入 `$DSH_HOME`，删除从列表去掉 |

---

## 目录结构

```
dsh-purge/
├── lib/
│   ├── core.js               # 路径探测、补丁、备份还原、shim、覆盖文件
│   ├── index.js              # 插件入口：命令、工具、systemPrompt、HTTP
│   ├── rules.js              # 规则集
│   ├── restart-web.js        # Web 配置下的重启
│   └── default-prompt-inject.md
├── client.js                 # 设置页
├── bin/dsh-purge.js          # CLI
├── docs/
│   ├── banner.svg
│   ├── banner-dark.svg
│   ├── appreciate.png
│   └── preview/
│       ├── settings.png
│       └── rules.png
├── cordis.patch.yml
├── package.json
├── README.md
├── README.zh-CN.md
└── LICENSE
```

运行时用户文件：`$DSH_HOME/prompt-inject.md`、`$DSH_HOME/rules/`。未设 `DSH_HOME` 时，优先用 dsh 安装目录旁边的 `.dsh`，再退回 `~/.dsh`。

---

## 安装

Web 和桌面都是往对应 profile 里装同一个插件。装完重启，设置页出现「规则设定」。

**官方 CLI（推荐）**

```sh
git clone https://github.com/YuJunZhiXue/dsh-purge.git
cd dsh-purge

# Web
dsh plugin --profile web add .

# 桌面
dsh plugin --profile default add .
```

GitHub zip 也可以：

```sh
dsh plugin --profile web add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip
dsh plugin --profile default add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip
```

**第三方 / 插件市场**

在 Web 或桌面的插件设置里搜索安装 `dsh-purge`，或从 [awesome-dsh-plugin](https://awesome-dsh-plugin.com) 进入仓库后再用上面的 `dsh plugin add`。

**卸载**

先在设置页点「还原」（如需撤掉已打补丁），再：

```sh
dsh plugin --profile web remove dsh-purge
dsh plugin --profile default remove dsh-purge
```

配置项在插件自己的 `cordis.patch.yml`：

```yaml
- insert:
    - id: dsh-purge
      name: 'dsh-purge'
      config:
        enabled: true
        autoApplyOnStart: true
        autoRevertOnMissing: false
        verbose: false
        postPromptOrder: 1000
        postPrompt: ""
```

`postPrompt` 默认为空。需要时再追加一段有序 systemPrompt，不改 `prompt-inject.md`。

---

## 生效验证

- 重启后设置页出现「规则设定」卡片（客户端半体加载成功）。有缓存时 Ctrl+F5。
- 点「应用」，进度里已应用项增加；再按提示重启，补丁进入当前进程。
- 聊天里 `/purge status` 能打出 `DSH_HOME` 和补丁列表。
- 个别项显示跳过是正常的：例如没装 `dsh-web-fetch-http` 时 #20 / #21 会跳过。

---

## 使用

```sh
# CLI
dsh-purge --status
dsh-purge --apply
dsh-purge --revert
dsh-purge --edit

# 聊天
/purge status | apply | revert | edit | help
/rules list | use <id> | create <id> | delete <id> | reset | help

# 模型工具
purge_status   purge_apply   purge_revert
```

设置页「应用」完成后需要重启才会加载已改的包文件。点「重启」才会重启，不会自动重启。

---

## 本地校验

```sh
node --check lib/index.js
node --check lib/core.js
node --check client.js
```

---

## 工作原理

**应用（启动时 / 手动）：**

```
补丁未应用? ──否──> 跳过
    │是
    ├─> 备份原件 <文件>.dshpurge.bak
    ├─> 按补丁列表替换对应文件
    ├─> 覆盖 shim（dsh.cmd / dsh.ps1 / unix dsh）
    └─> 确保 prompt-inject.md 存在（空则写入默认覆盖文本）
```

**覆盖（每次会话）：**

```
prompt-inject.md 有内容? ──是──> 作为 systemPrompt 段写入会话
           │否
           └─> 不写入覆盖段
```

---

## 还原

- 每个目标文件在应用前备份为 `<文件>.dshpurge.bak`。
- 「还原」或 `/purge revert` 用备份覆盖回去并删除备份；没有备份时去掉 shim 里由本插件写入的行。
- `prompt-inject.md` 是用户文件，还原时保留。
- 重复应用是幂等的。

---

## 路径探测

1. `DSH_HOME` / `DSH_BASE`（显式指定）
2. dsh 启动器旁的 `.dsh`（便携安装，任意盘符）
3. DSH Desktop → `process.resourcesPath/app.asar.unpacked/node_modules/@deepseek-ai`
4. `npm prefix -g` / `npm root -g`
5. 嵌套 `@deepseek-ai/dsh/node_modules/@deepseek-ai`
6. 系统默认 `~/.dsh`

npm 嵌套布局下，审批在 `dsh-user-approval/lib/index.js`，升级逻辑在 `dsh-sandbox/lib/index.js`。找不到目标时提示设置 `DSH_BASE`，不改文件。

---

## 说明

- 改动范围是本机 `@deepseek-ai/*` 包里的渲染文案、默认策略和执行逻辑，以及用户目录下的覆盖文件与规则集。
- 升级后原文对不上会报 `pattern_not_found` 或显示待应用，不会乱改。
- 不改动非 `@deepseek-ai` 的第三方插件。
- npm 上暂未发布同名包，用 GitHub 或 `dsh plugin add .` 安装。

---

## ☕ 赞赏支持 / Sponsor

<p align="center">
  <img src="docs/appreciate.png" alt="微信赞赏码" width="360">
</p>

<p align="center">
  <sub>Built by 小杨 · for DeepSeek Harness</sub>
</p>

---

感谢 [LINUX DO](https://linux.do) 社区
