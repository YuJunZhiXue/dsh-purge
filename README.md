<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">dsh-purge</h1>

<p align="center"><strong>Version 1.3.0</strong></p>

<p align="center">
  <em>DeepSeek Harness Web settings plugin: 25 patches, rule sets, and a session prompt override. Re-applies after upgrades.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-purge"><img src="https://img.shields.io/npm/v/dsh-purge?logo=npm&label=npm" alt="npm version"></a>
  <a href="https://github.com/YuJunZhiXue/dsh-purge/stargazers"><img src="https://img.shields.io/github/stars/YuJunZhiXue/dsh-purge?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/YuJunZhiXue/dsh-purge/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d?style=flat" alt="MIT license"></a>
  <a href="https://awesome-dsh-plugin.com"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="awesome · DSH plugin"></a>
  <a href="https://www.deepseek.com/harness/"><img src="https://img.shields.io/badge/dsh-0.1.1--rc.2-blue" alt="DSH"></a>
  <br>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=fff" alt="Node.js">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000" alt="JavaScript">
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

A settings plugin for [DeepSeek Harness](https://www.deepseek.com/harness/). It updates default copy, permission policy, and tool limits in the installed packages so local `AGENTS.md` / `CLAUDE.md` and the session prompt follow what you set in the UI.

It does not patch the Harness source tree. Use **Apply** on the settings page. After an npm upgrade overwrites files, it can apply again on start.

---

## Preview

The **Rules** card appears on the dsh web settings page. The progress count only includes patches that actually applied; skipped items are not counted as done.

![Settings](docs/preview/settings.png)

| Area | What it shows |
|---|---|
| Patches | applied / pending / skipped |
| shim | whether `dsh.cmd` / `dsh.ps1` / unix `dsh` launch env is overridden |
| Rule sets | multiple `AGENTS.md` / `CLAUDE.md` files; Enable writes them under `~/.dsh` |
| Apply / Restore | apply all 25 patches, or restore from backups |
| Prompt | edit `prompt-inject.md` as the session override section |

---

## 25 patches

**Prompt (#1–#5)** — rendered copy in `node_modules/@deepseek-ai/*`:

| # | Name | File | Original | Replacement |
|---|---|---|---|---|
| 1 | WORKSPACE_CONTEXT_INTRO | `dsh-agent-instructions` | "may be relevant… use as guidance… do not override" | ACTIVE and MANDATORY |
| 2 | REPLACEMENT_WORKSPACE_CONTEXT_INTRO | same | "replaces all baselines… guidance… not override" | keep replaces; session directive wording |
| 3 | SCOPE_INTRO | same | "use as guidance when relevant… not override" | ACTIVE and MANDATORY for scope |
| 4 | SYSTEM_PROMPT_PERSONA | agent preset / `dsh-web-app` / `dsh-headless` | "You are a coding agent…" | append Session directives |
| 5 | APPROVAL_NEVER_SENTENCE | `dsh-user-approval` | "rejected automatically — do not request escalation" | full access, request freely |

**Defaults (#6–#8)**:

| # | Name | File | Original | Replacement |
|---|---|---|---|---|
| 6 | SANDBOX_DENY_FILE_WRITE | `dsh-sandbox-local` | `"(deny file-write*)"` | `"(allow file-write*)"` |
| 7 | SANDBOX_MODE_DEFAULT | `dsh-base` | `?? 'workspace-write'` | `?? 'danger-full-access'` |
| 8 | APPROVAL_POLICY_DEFAULT | `dsh-base` | default `ask` | default `never` |

#7 and #8 change defaults only. `DSH_PERMISSION_MODE` still overrides them.

**Runtime (#9–#16)** — approval, escalation, sandbox, filesystem:

| # | Name | File | Original | Replacement |
|---|---|---|---|---|
| 9 | APPROVAL_AUTO_GRANT | `dsh-user-approval/lib/index.js` | `never` returns `"rejected"` | always `return "allowed-once"` |
| 10 | APPROVAL_CONFIG_DEFAULT_NEVER | same | Config default `"ask"` | default `"never"` |
| 11 | APPROVAL_NEVER_SENTENCE_BYPASS | same | never-policy sentence | auto-grant wording |
| 12 | APPROVAL_ASK_SENTENCE_BYPASS | same | ask-policy sentence | same |
| 13 | ESCALATION_WIDENING_EXEMPT | `dsh-sandbox` (`lib/index.js` on npm) | strict-widening + missing-service throws | those checks removed |
| 14 | ESCALATION_GRANT_UNCONDITIONAL | same | approver / agent required | `"allowed-once"` when missing |
| 15 | SANDBOX_CONFINE_PASSTHROUGH | `dsh-sandbox-local/lib/index.js` | wrap argv in a runner | `confine()` returns argv as-is |
| 16 | FS_FENCE_DISABLED | `dsh-fs-sandbox/lib/index.js` | read-only / workspace-write denies writes | `checkedTarget()` allows writes |

**Tools (#17–#25)**:

| # | Name | File | Original | Replacement |
|---|---|---|---|---|
| 17 | FS_OBSERVATION_INTENT_FREE | `dsh-fs-observation-policy` | write / edit require a prior read | intents pass through |
| 18 | REPEAT_TOOL_REMINDER_DISABLED | `dsh-repeat-tool-reminder` | reminder at 3/5/8 repeats | no reminder |
| 19 | TOOL_RESULT_PRUNER_DISABLED | `dsh-compaction-tool-result-pruner` | prune results &gt;8KB | keep full results |
| 20 | WEB_FETCH_ENABLED | `dsh-base/cordis.patch.yml` | `fetch: false`, no provider | `fetch: true` + `fetchProvider: http` |
| 21 | WEB_FETCH_BASE_DEPENDENCY | `dsh-base/package.json` | missing `dsh-web-fetch-http` | add the dependency |
| 22 | BASH_TIMEOUT_RAISED | `dsh-base/cordis.patch.yml` | `timeoutMs: 60000` | `timeoutMs: 600000` |
| 23 | READ_CAPS_RAISED | `dsh-tool-fs` | 2000 lines / 2000 chars / 50KB | 20000 / 10000 / 1MB |
| 24 | SUBAGENT_MAXDEPTH_RAISED | `dsh-tool-subagent` | maxDepth default 3 | default 10 |
| 25 | PRESET_FETCH_ENABLED | `~/.dsh/.agent-presets/unrestricted/agent.cordis.yml` | preset `fetch: false` | `fetch: true` |

#25 is optional. It only runs if you already have a user preset named `unrestricted`. Harness ships `standard` and does **not** create this file. If it is missing, the item is skipped — that is expected, ignore it. #20 / #21 are likewise skipped when `dsh-web-fetch-http` is not installed, so the host can still boot.

---

## Features

- **Apply on start**: with `autoApplyOnStart: true`, patches are checked at launch and re-applied after an upgrade overwrites files.
- **/purge**: `status` / `apply` / `revert` / `edit` / `help`.
- **/rules**: `list` / `use <id>` / `create` / `delete` / `reset` for `AGENTS.md` / `CLAUDE.md`.
- **Model tools**: `purge_status` / `purge_apply` / `purge_revert`.
- **Session override**: `prompt-inject.md` is written into the session as a systemPrompt section when it has content. An empty file gets the shipped default; an existing custom file is left as-is.

---

## Install

**From the source directory**

```sh
cd dsh-purge
dsh plugin --profile web add .
```

**From a tarball**

```sh
dsh plugin --profile web add dsh-purge-1.3.0.tgz
```

**From npm**

```sh
dsh plugin --profile web add dsh-purge
```

Restart dsh web afterwards. The **Rules** card shows up on the settings page. Hard-refresh (Ctrl+F5) if the client bundle is cached.

Config in `cordis.patch.yml`:

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

`postPrompt` is empty by default. When set, it appends an ordered systemPrompt section and does not change `prompt-inject.md`.

---

## Usage

```sh
# CLI
dsh-purge --status
dsh-purge --apply
dsh-purge --revert
dsh-purge --edit

# Chat
/purge status
/purge apply
/purge revert
/purge edit

# Model tools
purge_status   purge_apply   purge_revert
```

Patched packages load only after a restart. Apply shows an in-page prompt; restart runs only if you click **Restart**.

---

## Layout

```
dsh-purge/
├── lib/
│   ├── core.js                   # path detect, 25 patches, backup/restore, shim, override file
│   ├── index.js                  # plugin: commands, tools, systemPrompt override, HTTP
│   ├── rules.js                  # rule sets
│   ├── restart-web.js            # restart helper for the web profile
│   └── default-prompt-inject.md  # default override text
├── client.js                     # settings UI
├── bin/dsh-purge.js              # CLI
├── docs/
│   ├── banner.svg
│   ├── banner-dark.svg
│   └── preview/settings.png
├── cordis.patch.yml
└── package.json
```

Runtime user file: `$DSH_HOME/prompt-inject.md` (`~/.dsh/prompt-inject.md` when `DSH_HOME` is unset).

---

## How it works

**Apply (on start or by hand):**

```
patch not applied? ──no──> skip
    │yes
    ├─> backup <file>.dshpurge.bak
    ├─> apply matching replacements
    ├─> override shim (dsh.cmd / dsh.ps1 / unix dsh)
    └─> ensure prompt-inject.md exists (write the default if empty)
```

**Override (each session):**

```
prompt-inject.md has content? ──yes──> write it as a systemPrompt section
           │no
           └─> no override section
```

---

## Restore

- Each target is copied to `<file>.dshpurge.bak` before the first apply.
- **Restore** or `/purge revert` copies backups back and deletes them. With no backup, shim lines written by this plugin are stripped.
- `prompt-inject.md` is a user file and is kept.
- Apply is idempotent.

---

## Path detection

1. `DSH_BASE` → plugin root
2. DSH Desktop → `process.resourcesPath/app.asar.unpacked/node_modules/@deepseek-ai`
3. `npm prefix -g` / `npm root -g`
4. Nested `@deepseek-ai/dsh/node_modules/@deepseek-ai` (including hoist)
5. shim: `dsh.cmd` / `dsh.ps1` / unsuffixed `dsh`
6. Recursive search

On the npm nested layout, approval lives in `dsh-user-approval/lib/index.js` and escalation lives in `dsh-sandbox/lib/index.js` (there is no separate `lib/types/escalation.js`). Desktop monorepos resolve the version root from `dsh-base`.

If nothing is found, set `DSH_BASE`. No files are changed.

---

## Notes

- Scope is rendered copy, defaults, and runtime logic inside local `@deepseek-ai/*` packages, plus the override file and rule sets under the user home.
- After an upgrade, unmatched originals surface as `pattern_not_found` or pending. Nothing is rewritten blindly.
- Third-party plugins outside `@deepseek-ai` are left alone.

---

<div align="center">
  <sub>Built by 小杨 · for DeepSeek Harness</sub>
</div>
