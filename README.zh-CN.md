<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">dsh-purge</h1>

<p align="center"><strong>Version 1.3.0</strong></p>

<p align="center">
  <em>DeepSeek Harness Web 设置插件：补丁、规则集、会话提示词覆盖。升级后可自动重新应用。</em>
</p>

<p align="center">
  <a href="https://github.com/YuJunZhiXue/dsh-purge/stargazers"><img src="https://img.shields.io/github/stars/YuJunZhiXue/dsh-purge?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/YuJunZhiXue/dsh-purge/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d?style=flat" alt="MIT license"></a>
  <a href="https://awesome-dsh-plugin.com"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="awesome · DSH plugin"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

[DeepSeek Harness](https://www.deepseek.com/harness/) 的设置插件。它改的是本机已安装包里的默认文案、权限策略和工具上限，让本地 `AGENTS.md` / `CLAUDE.md` 与会话提示词按你在设置页里的选择生效。

不改 Harness 源码仓库。设置页点「应用」即可；npm 升级覆盖文件后，可自动再应用一遍。

---

## 界面预览

设置页会出现「规则设定」。白 / 墨可切换。补丁按组展开，进度只计已应用的项。规则集在上方列表启用或删除，下方编辑正文。

**补丁**

![补丁](docs/preview/settings.png)

**规则集**

![规则集](docs/preview/rules.png)

| 区域 | 说明 |
|---|---|
| 白 / 墨 | 设置卡片外观 |
| 补丁 | 分组查看状态，应用或还原 |
| 提示词 | 编辑 `prompt-inject.md`，作为会话覆盖段 |
| 规则集 | 多套 `AGENTS.md` / `CLAUDE.md`；启用写入 `~/.dsh`，删除从列表去掉 |

---

## 功能

- **启动自动应用**：`autoApplyOnStart: true` 时，启动检查补丁；升级覆盖后会再应用。
- **/purge**：`status` / `apply` / `revert` / `edit` / `help`。
- **/rules**：`list` / `use <id>` / `create` / `delete` / `reset`，切换 `AGENTS.md` / `CLAUDE.md`。
- **模型工具**：`purge_status` / `purge_apply` / `purge_revert`。
- **会话覆盖**：读 `prompt-inject.md`，有内容则作为 systemPrompt 段写入会话。文件为空时写入一份默认文本，已有自定义内容不会被覆盖。

---

## 安装

**推荐：从源码目录添加**

```sh
cd dsh-purge
dsh plugin --profile web add .
```

**或：从打包文件**

```sh
dsh plugin --profile web add dsh-purge-1.3.0.tgz
```

**或：从 npm**

```sh
dsh plugin --profile web add dsh-purge
```

安装后重启 dsh web，设置页出现「规则设定」。客户端有缓存时请 Ctrl+F5。

配置在 `cordis.patch.yml`：

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

`postPrompt` 默认为空。需要时可以再追加一段有序 systemPrompt，不改 `prompt-inject.md`。

---

## 使用

```sh
# CLI
dsh-purge --status
dsh-purge --apply
dsh-purge --revert
dsh-purge --edit

# 聊天
/purge status
/purge apply
/purge revert
/purge edit

# 模型工具
purge_status   purge_apply   purge_revert
```

设置页「应用」完成后需要重启才会加载已改的包文件。点「重启」才会重启，不会自动重启。

---

## 目录结构

```
dsh-purge/
├── lib/
│   ├── core.js                   # 路径探测、补丁、备份还原、shim、覆盖文件
│   ├── index.js                  # 插件入口：命令、工具、systemPrompt 覆盖、HTTP
│   ├── rules.js                  # 规则集
│   ├── restart-web.js            # Web 配置下的重启
│   └── default-prompt-inject.md  # 覆盖文件的默认文本
├── client.js                     # 设置页
├── bin/dsh-purge.js              # CLI
├── docs/
│   ├── banner.svg
│   ├── banner-dark.svg
│   └── preview/
│       ├── settings.png
│       └── rules.png
├── cordis.patch.yml
└── package.json
```

运行时用户文件：`$DSH_HOME/prompt-inject.md`（未设 `DSH_HOME` 时为 `~/.dsh/prompt-inject.md`）。

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

1. `DSH_BASE` → 插件根
2. DSH Desktop → `process.resourcesPath/app.asar.unpacked/node_modules/@deepseek-ai`
3. `npm prefix -g` / `npm root -g`
4. 从全局目录解析 `@deepseek-ai/dsh/node_modules/@deepseek-ai`（含 hoist）
5. shim：`dsh.cmd` / `dsh.ps1` / 无后缀 `dsh`
6. 递归搜索

npm 嵌套布局下，审批在 `dsh-user-approval/lib/index.js`，升级逻辑在 `dsh-sandbox/lib/index.js`（没有单独的 `lib/types/escalation.js`）。Desktop monorepo 会从 `dsh-base` 反推版本根。

找不到目标时提示设置 `DSH_BASE`，不改文件。

---

## 说明

- 改动范围是本机 `@deepseek-ai/*` 包里的渲染文案、默认策略和执行逻辑，以及用户目录下的覆盖文件与规则集。
- 升级后原文对不上会报 `pattern_not_found` 或显示待应用，不会乱改。
- 不改动非 `@deepseek-ai` 的第三方插件。

---

<div align="center">
  <sub>Built by 小杨 · for DeepSeek Harness</sub>
</div>

---

感谢 [LINUX DO](https://linux.do) 社区
