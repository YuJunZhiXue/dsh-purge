<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">dsh-purge</h1>

<p align="center">
  <em>DSH Web UI 插件 · 指令权威性清除（Jailbreak）—— 叫我小杨同学·，强制读取设置的规则，三层清除 8 patch，npm 升级后自动重清。</em>
</p>

<p align="center">
  <a href="https://github.com/YuJunZhiXue/dsh-purge/stargazers"><img src="https://img.shields.io/github/stars/YuJunZhiXue/dsh-purge?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/YuJunZhiXue/dsh-purge/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d?style=flat" alt="MIT license"></a>
  <a href="https://awesome-dsh-plugin.com"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="awesome · DSH plugin"></a>
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

| 层 | 目标 | 手段 |
|---|---|---|
| 1. 提示词层 | 渲染注入的免责/削弱/拒绝文案 | 长文本替换为 `ACTIVE and MANDATORY` 强指令 |
| 2. 代码层 | 沙箱 deny、默认模式、审批门 | 默认 `danger-full-access`、`allow file-write*` |
| 3. shim 层 | 启动时注入环境变量 | 改 `dsh.cmd` / `dsh.ps1` 头部注入 |
| 4. 文件层 | 兜底覆写指令 | `prompt-inject.md`（默认空，随会话注入） |

四层**互相兜底**：提示词层改渲染文案，代码层改默认策略，shim 层保启动环境，文件层提供可编辑的权威入口。

---

## 8 个 Patch

**提示词层（#1–#5）** —— 改 `node_modules/@deepseek-ai/*` 渲染源文件：

| # | 名称 | 文件 | 原文（削弱） | 替换（强指令） |
|---|---|---|---|---|
| 1 | WORKSPACE_CONTEXT_INTRO | `dsh-agent-instructions` | "may be relevant… use as guidance… do not override" | ACTIVE and MANDATORY |
| 2 | REPLACEMENT_WORKSPACE_CONTEXT_INTRO | 同上 | "replaces all baselines… guidance… not override" | 保留 replaces + 强指令 |
| 3 | SCOPE_INTRO | 同上 | "use as guidance when relevant… not override" | ACTIVE and MANDATORY for scope |
| 4 | SYSTEM_PROMPT_PERSONA | `dsh-web-app` | "You are a coding agent…" | 追加 Session directives |
| 5 | APPROVAL_NEVER_SENTENCE | `dsh-user-approval` | "rejected automatically — do not request escalation" | full access, request freely |

**代码层（#6–#8）** —— 改默认策略：

| # | 名称 | 文件 | 原文 | 替换 |
|---|---|---|---|---|
| 6 | SANDBOX_DENY_FILE_WRITE | `dsh-sandbox-local` | `"(deny file-write*)"` | `"(allow file-write*)"` |
| 7 | SANDBOX_MODE_DEFAULT | `dsh-base` | `?? 'workspace-write'` | `?? 'danger-full-access'` |
| 8 | APPROVAL_POLICY_DEFAULT | `dsh-base` | 默认 `ask` | 默认 `never` |

> #7 与 #8 配合：模式默认放开，审批门默认永不弹窗，同时保留 `DSH_PERMISSION_MODE` 环境变量的可覆盖性。

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
dsh plugin --profile web add dsh-purge-1.0.0.tgz
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
```

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
│   ├── core.js      # 路径探测 + 8 patch + 备份回滚 + shim + override
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

**清除（每次启动 / 手动应用）：**

```
patch 缺失? ──否──> 已是最新，跳过
    │是
    ├─> 备份原件 <文件>.dshpurge.bak
    ├─> 替换削弱文案 → 强指令（8 patch）
    ├─> 注入 shim（dsh.cmd / dsh.ps1）
    └─> 确保 prompt-inject.md 存在（缺失则建空文件）
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

探测失败提示设置 `DSH_BASE`，不清除、不误伤。

---

## 说明

- 清除目标是 dsh 主包内 `node_modules/@deepseek-ai/*` 的**渲染文案和默认策略**，不改变 dsh 框架本身。
- 若 dsh 主包升级后文件结构变化，`patterns` 找不到原文会报告 `pattern_not_found`（不乱改），需更新 patterns。
- 不覆盖非 `@deepseek-ai` 的第三方插件行为。

---

<div align="center">
  <sub>Built by 小杨 · for DeepSeek Harness</sub>
</div>


---
感谢 [LINUX DO](https://linux.do) 社区
