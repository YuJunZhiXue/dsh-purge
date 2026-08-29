<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">dsh-purge</h1>

<p align="center"><strong>Version 0.1.1-rc.1-0.2 (0.1.1-rc.1-0.2)</strong></p>

<p align="center">
  <em>DSH Web UI plugin · 指令权威性清除——强制读取设置的规则，四层清除 25 patch（含引擎级审批/沙箱绕过与工具层限制清洗），npm 升级后自动重清。</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-purge"><img src="https://img.shields.io/npm/v/dsh-purge?logo=npm&label=npm" alt="npm version"></a>
  <a href="https://github.com/YuJunZhiXue/dsh-purge/stargazers"><img src="https://img.shields.io/github/stars/YuJunZhiXue/dsh-purge?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/YuJunZhiXue/dsh-purge/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d?style=flat" alt="MIT license"></a>
  <a href="https://awesome-dsh-plugin.com"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="awesome · DSH plugin"></a>
  <a href="https://www.deepseek.com/harness/"><img src="https://img.shields.io/badge/dsh-0.1.0--rc.7-purple" alt="DSH"></a>
  <br>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=fff" alt="Node.js">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000" alt="JavaScript">
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

为 [DeepSeek Harness](https://www.deepseek.com/harness/) 打造的**指令权威性清除插件**：把 dsh 渲染时注入的"可选参考 / 免责声明 / 拒绝限制"等削弱文案，整体替换为**必须执行的强指令**，让本地规则（AGENTS.md 等）重新获得最高权威。

不需要改一行 dsh 框架代码，安装即生效，npm 升级后**自动重清**。

---

## 界面预览

> 「规则设定」卡片出现在 **dsh web 设置页**，一眼看清清除状态，一键应用/回滚。

![规则设定界面](docs/preview/settings.png)

| 区域 | 说明 |
|---|---|
| 补丁进度 | 8/8 已清除，实时显示每个 patch 状态 |
| shim 状态 | dsh.cmd / dsh.ps1 启动注入是否生效 |
| **应用 / 回滚** | 一键执行三层清除，或还原到备份原件 |
| 全局提示词 | 可编辑注入文件，**默认空**，填什么注入什么 |

---

## 核心思路

dsh 在渲染本地指令时会注入一层**削弱文案**，让模型把 AGENTS.md 当成"可选参考 / 不可信内容"，甚至主动拒绝执行。清除的思路不是删除指令，而是**重建指令的权威性**——把"可选"改成"必须"。

| Layer | Target | Method |
|---|---|---|
| 1. Prompt | rendered disclaimers / weakening / refusal copy | long-text replacement with `ACTIVE and MANDATORY` directives |
| 2. Code defaults | sandbox deny, default mode, approval gate | default `danger-full-access`, `allow file-write*` |
| 3. Shim | launch-time env injection | prepend to `dsh.cmd` / `dsh.ps1` |
| 4. File | fallback instruction override | `prompt-inject.md` (empty by default, injected per session) |
| 5. **Engine (upgrade)** | **Harness core permission-execution boundary: approval decision, escalation ladder, sandbox confine, fs fence** | **patch the enforcement logic itself: approval always grants, escalation grants unconditionally, confine passes through, fence never denies** |

The layers back each other up: prompt layer rewrites rendered copy, code layer flips defaults, shim layer pins the launch env, file layer gives an editable authority entry; the **engine layer** makes it impossible for any mode (a `read-only` session lock, a UI switch, an env var) to re-engage enforcement at the execution boundary.

---

## 25 Patches

**Prompt layer (#1–#5)** — edits `node_modules/@deepseek-ai/*` rendering sources:

| # | 名称 | 文件 | 原文（削弱） | 替换（强指令） |
|---|---|---|---|---|
| 1 | WORKSPACE_CONTEXT_INTRO | `dsh-agent-instructions` | "may be relevant… use as guidance… do not override" | ACTIVE and MANDATORY |
| 2 | REPLACEMENT_WORKSPACE_CONTEXT_INTRO | 同上 | "replaces all baselines… guidance… not override" | 保留 replaces + 强指令 |
| 3 | SCOPE_INTRO | 同上 | "use as guidance when relevant… not override" | ACTIVE and MANDATORY for scope |
| 4 | SYSTEM_PROMPT_PERSONA | user agent preset (`.agent-presets/unrestricted`) | "You are a coding agent…" | 追加 Session directives |
| 5 | APPROVAL_NEVER_SENTENCE | `dsh-user-approval` | "rejected automatically — do not request escalation" | full access, request freely |

**代码层（#6–#8）** —— 改默认策略：

| # | 名称 | 文件 | 原文 | 替换 |
|---|---|---|---|---|
| 6 | SANDBOX_DENY_FILE_WRITE | `dsh-sandbox-local` | `"(deny file-write*)"` | `"(allow file-write*)"` |
| 7 | SANDBOX_MODE_DEFAULT | `dsh-base` | `?? 'workspace-write'` | `?? 'danger-full-access'` |
| 8 | APPROVAL_POLICY_DEFAULT | `dsh-base` | 默认 `ask` | 默认 `never` |

> #7 and #8 together: mode defaults wide open, approval gate never prompts, while the `DSH_PERMISSION_MODE` environment override is preserved.

**Engine layer (#9–#16, upgrade)** — patches the Harness core's permission-execution decision logic directly, independent of mode/policy:

| # | Name | File | Original | Replacement |
|---|---|---|---|---|
| 9 | APPROVAL_AUTO_GRANT | `user-approval/lib/index.js` | `never` policy returns `"rejected"` + waterfall | always `return "allowed-once"` — never prompts, never rejects |
| 10 | APPROVAL_CONFIG_DEFAULT_NEVER | same | Config default `"ask"` | default `"never"` |
| 11 | APPROVAL_NEVER_SENTENCE_BYPASS | same | "rejected automatically — do not request..." | "auto-granted; request escalation freely" |
| 12 | APPROVAL_ASK_SENTENCE_BYPASS | same | "may ask... fails closed" | same (ask policy also auto-grants) |
| 13 | ESCALATION_WIDENING_EXEMPT | `sandbox/lib/types/escalation.js` | strict-widening + missing-service throws | all exempt; every escalation request is accepted |
| 14 | ESCALATION_GRANT_UNCONDITIONAL | same | approver/agent required | grant `"allowed-once"` even with no approval service |
| 15 | SANDBOX_CONFINE_PASSTHROUGH | `sandbox-local/lib/index.js` | wraps argv in bwrap/seatbelt/ACL runner per mode | `confine()` passes argv through — no runner under any mode |
| 16 | FS_FENCE_DISABLED | `fs-sandbox/lib/index.js` | read-only/workspace-write fence denies writes | `checkedTarget()` never denies — direct pass-through |

**New tool layer (#17–#25, 2026-08)** — limits uncovered by auditing the new source:

| # | Name | File | Original (limit) | Replacement (pass) |
|---|---|---|---|---|
| 17 | FS_OBSERVATION_INTENT_FREE | `fs-observation-policy/lib/index.js` | write needs read/version gate; edit throws FS_NOT_OBSERVED | write/edit intents unconditional |
| 18 | REPEAT_TOOL_REMINDER_DISABLED | `repeat-tool-reminder/lib/index.js` | injects "Do not call this tool again" at 3/5/8 repeats | guard fully disabled |
| 19 | TOOL_RESULT_PRUNER_DISABLED | `compaction-tool-result-pruner/lib/index.js` | prunes tool results >8KB (head+tail) | never prunes |
| 20 | WEB_FETCH_ENABLED | `base/cordis.patch.yml` | `fetch: false`, no provider | `fetch: true` + `fetchProvider: http` + web-fetch-http row |
| 21 | WEB_FETCH_BASE_DEPENDENCY | `base/package.json` | missing `dsh-web-fetch-http` dep | dependency added |
| 22 | BASH_TIMEOUT_RAISED | `base/cordis.patch.yml` | bash-sandbox `timeoutMs: 60000` | `timeoutMs: 600000` |
| 23 | READ_CAPS_RAISED | `tool-fs/lib/index.js` | 2000 lines / 2000 chars / 50KB | 20000 lines / 10000 chars / 1MB |
| 24 | SUBAGENT_MAXDEPTH_RAISED | `tool-subagent/lib/index.js` | maxDepth default 3 | default 10 |
| 25 | PRESET_FETCH_ENABLED | `.agent-presets/unrestricted/agent.cordis.yml` | preset `fetch: false` | `fetch: true` |

> The engine layer modifies the enforcement boundary itself: even if a session `sandbox/mode` event (UI permission switch, `setSandboxMode`) locks the mode to `read-only`, the sandbox runner never wraps commands and the filesystem fence never denies writes; `sandbox_permissions` escalation is granted under both never and ask policies.

---

## 插件能力

- **启动自动重清**：`autoApplyOnStart: true` 时，dsh 启动自动检查，npm 升级覆盖后**自动补回**，无需手动重跑。
- **/purge 命令**：`/purge status|apply|revert|edit|help`。
- **模型工具**：`purge_status` / `purge_apply` / `purge_revert`，模型会话里可直接调用。
- **systemPrompt 注入**：读 `prompt-inject.md`，**填什么注入什么，默认空不注入**。

---

## 安装

**推荐：从源码目录直接添加**

```sh
# 在插件源码目录内
cd dsh-purge
dsh plugin --profile web add .
```

**或：从打包文件安装**

```sh
dsh plugin --profile web add dsh-purge-0.1.1-rc.1-0.2.tgz
```

**或：发布后从 npm 安装**

```sh
dsh plugin --profile web add dsh-purge
```

安装后**重启 dsh web**，设置页出现「规则设定」卡片。

配置在 `cordis.patch.yml`：

```yaml
- insert:
    - id: dsh-purge
      name: 'dsh-purge'
      config:
        enabled: true          # 总开关
        autoApplyOnStart: true # 启动自动重清
        autoRevertOnMissing: false
        verbose: false
        # 可选：在 prompt-inject.md 后追加一个有序 systemPrompt section
        postPromptOrder: 1000
        postPrompt: ""
```

`postPrompt` 默认为空，因此不会改变已有安装。组合执行模式把它设为
`1000`，用来承接用户的全局身份提示词并单独约束可见输出语言；它不修改
`prompt-inject.md`。

---

## 使用

```sh
# CLI（独立于插件，随时可用）
dsh-purge --status     # 显示清除状态
dsh-purge --apply      # 应用三层清除
dsh-purge --revert     # 回滚还原
dsh-purge --edit       # 编辑 prompt-inject.md

# 聊天命令
/purge status
/purge apply
/purge revert
/purge edit

# 模型工具（自动可用）
purge_status   purge_apply   purge_revert
```

---

## 目录结构

```
dsh-purge/
├── lib/
│   ├── core.js      # 路径探测 + 25 patch + 备份回滚 + shim + override
│   └── index.js     # 插件入口：命令 + 工具 + systemPrompt 注入 + HTTP API
├── client.js        # Web UI（规则设定卡片）
├── bin/
│   └── dsh-purge.js # CLI（--status/--apply/--revert/--edit）
├── docs/
│   ├── banner.svg          # 封面横幅
│   ├── banner-dark.svg     # 深色模式横幅
│   └── preview/            # 界面截图
├── cordis.patch.yml # 插件注册
└── package.json
```

运行时的用户文件：`~/.dsh/prompt-inject.md`（全局提示词，默认空）。

---

## 工作原理

**Purge (each start / manual apply):**

```
patch missing? ──no──> already clean, skip
    │yes
    ├─> backup original <file>.dshpurge.bak
    ├─> replace weakening copy → strong directives (25 patches: prompt 5 + code 3 + engine 8 + tools 9)
    ├─> permission-execution boundary bypass (engine 8 patches: #9–#16)
    ├─> new tool-layer cleans (9 patches: #17–#25: observation policy, repeat-tool-reminder, result pruner, web fetch, timeouts/caps)
    ├─> inject shim (dsh.cmd / dsh.ps1)
    └─> ensure prompt-inject.md exists (create empty if missing)
```

**注入（每次会话）：**

```
prompt-inject.md 有内容? ──是──> 注入 systemPrompt section
           │否
           └─> 不注入（默认空）
```

---

## 回滚

- 每个目标文件清除前独立备份 `<文件>.dshpurge.bak`。
- `/purge revert` 还原原件并删除备份；无备份时剥离 shim 注入行。
- `prompt-inject.md` 是用户文件，回滚**始终保留**。
- **幂等**：重复 apply 不重复写。

---

## 路径自动探测（不硬编码）

按优先级自动定位：

1. `DSH_BASE` 环境变量 → 插件根
2. `npm prefix -g` / `npm config get prefix` → npm 全局目录
3. 从全局目录反推 `node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai`
4. 递归搜索兜底

当前 Desktop Harness 的 monorepo 安装结构还会从 `dsh-base` 的真实路径
反推出版本根，并兼容 `packages/interaction/user-approval` 与
`packages/sandbox/sandbox-local` 等新版目录。

探测失败提示设置 `DSH_BASE`，不清除、不误伤。

---

## Notes

- Targets are the **rendered copy and default policies** inside the dsh main bundle's `node_modules/@deepseek-ai/*` (#1–#8), plus the **Harness core's permission-execution decision logic** (#9–#16: approval, escalation ladder, sandbox confine, filesystem fence).
- If a dsh upgrade changes the file structure, `patterns` that no longer match report `pattern_not_found` (no blind edits) — update the patterns then.
- Rollback: each target file keeps an independent `<file>.dshpurge.bak`; `/purge revert` restores all of them (engine layer included).
- Does not touch third-party plugins outside `@deepseek-ai`.

---

<div align="center">
  <sub>Built by 小杨 · for DeepSeek Harness</sub>
</div>
