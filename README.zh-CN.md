<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">dsh-purge</h1>

<p align="center"><strong>Version 1.3.0</strong></p>

<p align="center">
  <em>DeepSeek Harness Web 设置插件：25 项补丁、规则集、会话提示词覆盖。升级后可自动重新应用。</em>
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

设置页会出现「规则设定」。补丁进度只统计真正已应用的项，跳过不计入分子。

![规则设定界面](docs/preview/settings.png)

| 区域 | 说明 |
|---|---|
| 补丁 | 已应用 / 待应用 / 跳过 |
| shim | `dsh.cmd` / `dsh.ps1` / unix `dsh` 启动环境是否已覆盖 |
| 规则集 | 多套 `AGENTS.md` / `CLAUDE.md`，启用后写入 `~/.dsh` |
| 应用 / 还原 | 应用 25 项补丁，或从备份还原 |
| 提示词 | 编辑 `prompt-inject.md`，作为会话覆盖段 |

---

## 25 个补丁

**提示词（#1–#5）** — 改 `node_modules/@deepseek-ai/*` 里的渲染文案：

| # | 名称 | 文件 | 原文 | 替换 |
|---|---|---|---|---|
| 1 | WORKSPACE_CONTEXT_INTRO | `dsh-agent-instructions` | "may be relevant… use as guidance… do not override" | ACTIVE and MANDATORY |
| 2 | REPLACEMENT_WORKSPACE_CONTEXT_INTRO | 同上 | "replaces all baselines… guidance… not override" | 保留 replaces，改为会话指令 |
| 3 | SCOPE_INTRO | 同上 | "use as guidance when relevant… not override" | ACTIVE and MANDATORY for scope |
| 4 | SYSTEM_PROMPT_PERSONA | Agent preset / `dsh-web-app` / `dsh-headless` | "You are a coding agent…" | 追加 Session directives |
| 5 | APPROVAL_NEVER_SENTENCE | `dsh-user-approval` | "rejected automatically — do not request escalation" | full access, request freely |

**默认策略（#6–#8）**：

| # | 名称 | 文件 | 原文 | 替换 |
|---|---|---|---|---|
| 6 | SANDBOX_DENY_FILE_WRITE | `dsh-sandbox-local` | `"(deny file-write*)"` | `"(allow file-write*)"` |
| 7 | SANDBOX_MODE_DEFAULT | `dsh-base` | `?? 'workspace-write'` | `?? 'danger-full-access'` |
| 8 | APPROVAL_POLICY_DEFAULT | `dsh-base` | 默认 `ask` | 默认 `never` |

#7 与 #8 改的是默认值，仍可用环境变量 `DSH_PERMISSION_MODE` 覆盖。

**执行逻辑（#9–#16）** — 审批、升级、沙箱、文件系统：

| # | 名称 | 文件 | 原文 | 替换 |
|---|---|---|---|---|
| 9 | APPROVAL_AUTO_GRANT | `dsh-user-approval/lib/index.js` | never 策略 `return "rejected"` | 一律 `return "allowed-once"` |
| 10 | APPROVAL_CONFIG_DEFAULT_NEVER | 同上 | Config 默认 `"ask"` | 默认 `"never"` |
| 11 | APPROVAL_NEVER_SENTENCE_BYPASS | 同上 | never 提示句 | 改为自动通过说明 |
| 12 | APPROVAL_ASK_SENTENCE_BYPASS | 同上 | ask 提示句 | 同上 |
| 13 | ESCALATION_WIDENING_EXEMPT | `dsh-sandbox`（npm 为 `lib/index.js`） | 严格加宽检查 + 缺审批服务抛错 | 不再做这些检查 |
| 14 | ESCALATION_GRANT_UNCONDITIONAL | 同上 | 必须有 approver / agent | 缺少时按 `"allowed-once"` 处理 |
| 15 | SANDBOX_CONFINE_PASSTHROUGH | `dsh-sandbox-local/lib/index.js` | 按模式包裹 runner | `confine()` 原样返回 argv |
| 16 | FS_FENCE_DISABLED | `dsh-fs-sandbox/lib/index.js` | read-only / workspace-write 拒绝写 | `checkedTarget()` 放行写入 |

**工具层（#17–#25）**：

| # | 名称 | 文件 | 原文 | 替换 |
|---|---|---|---|---|
| 17 | FS_OBSERVATION_INTENT_FREE | `dsh-fs-observation-policy` | write / edit 需先读 | 读写意图直接通过 |
| 18 | REPEAT_TOOL_REMINDER_DISABLED | `dsh-repeat-tool-reminder` | 连续 3/5/8 次写入提醒 | 不再写入提醒 |
| 19 | TOOL_RESULT_PRUNER_DISABLED | `dsh-compaction-tool-result-pruner` | 工具结果 >8KB 修剪 | 原样保留 |
| 20 | WEB_FETCH_ENABLED | `dsh-base/cordis.patch.yml` | `fetch: false`，无 fetch provider | `fetch: true` + `fetchProvider: http` |
| 21 | WEB_FETCH_BASE_DEPENDENCY | `dsh-base/package.json` | 缺 `dsh-web-fetch-http` | 补上依赖 |
| 22 | BASH_TIMEOUT_RAISED | `dsh-base/cordis.patch.yml` | `timeoutMs: 60000` | `timeoutMs: 600000` |
| 23 | READ_CAPS_RAISED | `dsh-tool-fs` | 2000 行 / 2000 字符 / 50KB | 20000 行 / 10000 字符 / 1MB |
| 24 | SUBAGENT_MAXDEPTH_RAISED | `dsh-tool-subagent` | maxDepth 默认 3 | 默认 10 |
| 25 | PRESET_FETCH_ENABLED | `~/.dsh/.agent-presets/unrestricted/agent.cordis.yml` | preset 内 `fetch: false` | `fetch: true` |

#25 是可选项。只有本机已经有用户 preset `unrestricted` 时才会改它；Harness 随包默认是 `standard`，**不会**自动生成这份文件。没有就跳过，进度里显示跳过即可，不用管。缺 `dsh-web-fetch-http` 时 #20 / #21 同样会跳过，避免启动失败。

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
│   ├── core.js                   # 路径探测、25 项补丁、备份还原、shim、覆盖文件
│   ├── index.js                  # 插件入口：命令、工具、systemPrompt 覆盖、HTTP
│   ├── rules.js                  # 规则集
│   ├── restart-web.js            # Web 配置下的重启
│   └── default-prompt-inject.md  # 覆盖文件的默认文本
├── client.js                     # 设置页
├── bin/dsh-purge.js              # CLI
├── docs/
│   ├── banner.svg
│   ├── banner-dark.svg
│   └── preview/settings.png
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
    ├─> 按 25 项补丁替换对应文件
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
