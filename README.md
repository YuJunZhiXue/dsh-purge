<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">dsh-purge</h1>

<p align="center"><strong>Version 1.1.7</strong></p>

<p align="center">
    <em>DeepSeek Harness jailbreak (破甲): every model can jailbreak; swap prompts per model. Default prompt for Chinese models — 小码酱. Please star ⭐</em>
</p>

<p align="center">
  <a href="https://github.com/YuJunZhiXue/dsh-purge/stargazers"><img src="https://img.shields.io/github/stars/YuJunZhiXue/dsh-purge?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/YuJunZhiXue/dsh-purge/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d?style=flat" alt="MIT license"></a>
  <a href="https://awesome-dsh-plugin.com"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="awesome · DSH plugin"></a>
  <a href="https://deepseek.stream/plugins/dsh-purge"><img src="https://img.shields.io/badge/Hub-dsh--purge-1a73e8" alt="DeepSeek Harness Hub"></a>
  <a href="https://www.deepseek.com/harness/"><img src="https://img.shields.io/badge/dsh-0.1.5--rc.1-blue" alt="DSH"></a>
  <br>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=fff" alt="Node.js">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000" alt="JavaScript">
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

<p align="center">
  Channel <a href="https://t.me/LLM_PoJia">t.me/LLM_PoJia</a>
</p>

> Aligned with **dsh 0.1.5-rc.2** (Node.js **≥18**; Windows no-flash import hooks need **Node ≥22** `registerHooks`, older Node still gets file-level `windowsHide` patches). On other versions, unmatched originals stay pending or skipped. Nothing is rewritten blindly.
>
> Also accepts the 0.1.2 community `dsh-persona text` field and `dsh-mnemon` v0 session `summary`. After install you still need **Apply + restart**.

---

## ☕ Sponsor

If dsh-purge helps you, a tip is welcome.

<p align="center">
  <img src="docs/appreciate.png" alt="WeChat appreciate" width="360">
</p>

<p align="center">
  <sub>Built by 小杨 · for DeepSeek Harness</sub>
</p>

---

## 🛡️ Why a local harness purge

Models now sit inside a local Agent / Harness. Prompts, approval gates, sandbox policy, and session migration all rewrite behavior at runtime. Asking “will the model answer” is not enough if the host layer kills a lawful eval request first.

1. **Map the host guardrail, not just the model.** Reversible patches on the installed `@deepseek-ai/*` packages show which refusals come from the model and which come from default copy, approval ladders, or session-format checks.
2. **Keep official capabilities; drop refusal locks.** No second invented identity. Persona is whatever you put in `prompt-inject.md`.
3. **Survive upgrades.** Patches re-apply after npm overwrites `node_modules`. Unmatched originals skip so a 0.1.5 tree is not smashed blindly.

This is a local Harness plugin. It is not a public scanner and not an attack kit for third-party sites.

---

> ### ⚠️ Strict Legal & Compliance Disclaimer
>
> **Zero-tolerance notice:** This project opposes and forbids any illegal activity. The authors do not support, encourage, or assist unauthorized network attacks, exploit use, data theft, unlawful access to computer systems, or generation of illegal content.
>
> 1. **Authorized, controlled scope only.** `dsh-purge` is a local DeepSeek Harness red-team research plugin and robustness-eval aid. **Do not run this project or its derived patches against targets, public online systems, or production services without the owner’s lawful written authorization.** All testing must stay on **your authorized local Harness install, offline local synthetic fixtures, authorized cyber-range / lab environments**.
> 2. **No illegal or prohibited use.** You must not use this project, directly or indirectly, to:
>    - violate the Criminal Law of the PRC, the Cybersecurity Law, the Data Security Law, the Personal Information Protection Law, or any other applicable law;
>    - conduct unauthorized intrusion, ransomware, destruction, credential stuffing, or malware distribution;
>    - induce, generate, or spread content that is illegal (national security threats, terrorism, graphic violence, pornography/gambling, fraud, privacy or IP infringement, and any other legally prohibited category);
>    - violate a model provider’s Terms of Service or Usage Policy.
> 3. **You bear all liability.** The project is provided under the MIT license **AS-IS**, with no warranty of completeness, safety, or fitness. **You alone are responsible for every download, deploy, run, modification, and redistribution, and for every input and output that follows** — civil, administrative, and criminal. Authors and contributors accept no direct, indirect, or joint liability for misuse.
> 4. **Breach terminates the license.** Anyone who uses this project for illegal attacks, malicious activity, or other violations loses the open-source license **automatically and irrevocably** from the moment of the violation. They must stop, permanently destroy all copies and derivatives, and face applicable legal consequences.
> 5. **No affiliation.** This is an independent open-source security-eval project. It is not affiliated with, partnered with, authorized by, or endorsed by DeepSeek or its affiliates.
> 6. **Use is consent.** Cloning, downloading, installing, redistributing, or running this code means you have read and accepted all of the above. If you do not agree, stop immediately and delete every copy.

---

## ⚡ Install

Web and Desktop are **installed and purged separately**. They do not touch each other.

| Host | Profile | Default install |
|---|---|---|
| **Web** (official `dsh web`) | `web` | Official `dsh` on PATH |
| **Desktop** (community [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop)) | `desktop` | `dsh` inside the app’s built-in terminal (not official `dsh` on PATH) |
| Official Harness desktop EXE | `default` | Official `dsh`, or `dsh://` below |

After install:

1. Fully quit and restart **the host you just installed into** (stop `dsh web`, or quit the Desktop tray and open `DSH Desktop.exe`)
2. When **Rules** appears on that host’s Settings page, click **Apply** (adding the bundle does not patch `@deepseek-ai` by itself)
3. On start the plugin auto-applies the current host and writes a default `prompt-inject.md` only if it is missing (an existing empty file means inject nothing)

Web **Apply / Restart / Uninstall** affect Web only. Desktop **Apply / Restart / Uninstall** affect the desktop app only — they do not launch `dsh web`.

> 🌐 **Plugin hub:** [DeepSeek Harness Hub](https://deepseek.stream/plugins/dsh-purge) (docs only — **do not** install via `deepseek.stream/api/plugins/download?...`; that URL is not a pnpm tarball and fails with `ERR_PNPM_TARBALL_EXTRACT`)
>
> `dsh plugin add <url>` hands the URL to pnpm as a **remote tarball**. Use GitHub `master.tar.gz`. A `.zip` archive is ZIP, not gzip, and fails with `ERR_PNPM_TARBALL_DECODE_GZIP` ([#26](https://github.com/YuJunZhiXue/dsh-purge/issues/26)).

### Web (default)

```sh
dsh plugin --profile web add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz
```

If this directory is already a clone:

```sh
dsh plugin --profile web add .
```

Then stop `dsh web`, start it again, and **Apply** on the Web Settings page. If `dsh` is not on PATH, install the official CLI or use **Manual install** below.

### Desktop (default)

Open community [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop) and run this in the **built-in terminal** (`dsh` is the desktop wrapper; default profile is `desktop`):

```sh
dsh plugin add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz
```

Do not use official `dsh plugin --profile desktop` on PATH (it is rejected). Do not use `dsh://` (that is the official EXE).

Then quit the tray, reopen `DSH Desktop.exe`, and **Apply** on the **desktop** Settings page.

From a system terminal, use the app’s own CLI. Locate `DSH Desktop.exe` from the running process or the default install locations:

```powershell
$zip = "https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz"
$exe = (Get-Process -Name "DSH Desktop" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)
if (-not $exe) {
  $exe = @(
    "$env:LOCALAPPDATA\Programs\DSH Desktop\DSH Desktop.exe",
    "$env:ProgramFiles\DSH Desktop\DSH Desktop.exe",
    "${env:ProgramFiles(x86)}\DSH Desktop\DSH Desktop.exe"
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $exe) { throw "DSH Desktop.exe not found. Start the app, or set `$exe` to the exe in the install folder." }
$cli = @(
  (Join-Path (Split-Path $exe) "resources\app\lib\desktop-cli.js"),
  (Join-Path (Split-Path $exe) "resources\app.asar.unpacked\lib\desktop-cli.js")
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
$env:ELECTRON_RUN_AS_NODE = "1"
$env:DSH_DESKTOP_DEFAULT_PROFILE = "desktop"
& $exe --expose-internals $cli plugin add $zip
```

For a custom install folder, set `$exe` to `DSH Desktop.exe` in that folder. The tarball URL is the default source so a local path with spaces cannot split the command.

### Hand this to an AI (install only)

Paste the block below to a local coding assistant and ask it to install the plugin.

<details open>
<summary><strong>For AI assistants (install only)</strong></summary>

<!-- AI-AGENT-START -->

Install the DeepSeek Harness plugin `dsh-purge`. Confirm the host first and install only that one. Do not scan the whole disk, do not read or edit other files, do not apply settings, and do not restart the app.

**Web (official `dsh web`)**

If `dsh` is not on PATH, tell the user and stop.

```sh
dsh plugin --profile web add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz
```

If this directory is already a clone, use `dsh plugin --profile web add .`.

**Desktop (community DSH Desktop)**

Do not use official `dsh plugin --profile desktop` on PATH. Do not use `dsh://`.

Default: already inside Desktop’s built-in terminal:

```sh
dsh plugin add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz
```

From a system terminal: use the running `DSH Desktop` process Path, or the default locations `%LOCALAPPDATA%\Programs\DSH Desktop\DSH Desktop.exe`, `%ProgramFiles%\DSH Desktop\DSH Desktop.exe`. Do not scan the whole disk. Then:

```powershell
$zip = "https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz"
$exe = (Get-Process -Name "DSH Desktop" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)
if (-not $exe) {
  $exe = @(
    "$env:LOCALAPPDATA\Programs\DSH Desktop\DSH Desktop.exe",
    "$env:ProgramFiles\DSH Desktop\DSH Desktop.exe",
    "${env:ProgramFiles(x86)}\DSH Desktop\DSH Desktop.exe"
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $exe) { Write-Host "DSH Desktop.exe not found. Start the app or give the install folder."; return }
$cli = @(
  (Join-Path (Split-Path $exe) "resources\app\lib\desktop-cli.js"),
  (Join-Path (Split-Path $exe) "resources\app.asar.unpacked\lib\desktop-cli.js")
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
$env:ELECTRON_RUN_AS_NODE = "1"
$env:DSH_DESKTOP_DEFAULT_PROFILE = "desktop"
& $exe --expose-internals $cli plugin add $zip
```

**Official Harness desktop EXE**

```sh
dsh plugin --profile default add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz
```

After the command finishes, tell the user to fully quit and restart the host they just installed into, then **Apply** on that host’s Settings page. Do not Apply Web from Desktop or Desktop from Web. Then stop.

<!-- AI-AGENT-END -->

</details>

### Official desktop EXE (`dsh://`)

If the **official DeepSeek Harness desktop client (EXE)** is installed, the button below opens a system URI. Community [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop) does **not** handle `dsh://` — use **Desktop (default)** above.

CLI equivalent:

```sh
dsh plugin --profile default add https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz
```

<p align="center">
  <a href="https://deepseek.stream/plugins/dsh-purge"><strong>🌐 Open Hub page</strong></a>
  &nbsp;·&nbsp;
  <a href="dsh://plugin/install?id=dsh-purge&name=dsh-purge&version=1.1.7&repo=YuJunZhiXue%2Fdsh-purge&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fgithub.com%2FYuJunZhiXue%2Fdsh-purge%2Farchive%2Frefs%2Fheads%2Fmaster.tar.gz"><strong>🚀 Install in desktop client</strong></a>
</p>

🔗 **Raw protocol URL:**

```
dsh://plugin/install?id=dsh-purge&name=dsh-purge&version=1.1.7&repo=YuJunZhiXue%2Fdsh-purge&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fgithub.com%2FYuJunZhiXue%2Fdsh-purge%2Farchive%2Frefs%2Fheads%2Fmaster.tar.gz
```

**Web trigger example:**

```js
/**
 * Open the DeepSeek Harness desktop client to install dsh-purge
 */
export function installDshPurgeToDesktop() {
  const params = new URLSearchParams({
    id: 'dsh-purge',
    name: 'dsh-purge',
    version: '1.1.7',
    repo: 'YuJunZhiXue/dsh-purge',
    permissions: '系统提示词注入, 本机补丁, 设置页',
    downloadUrl: 'https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz',
  });

  const deepLink = `dsh://plugin/install?${params.toString()}`;

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = deepLink;
  document.body.appendChild(iframe);
  setTimeout(() => document.body.removeChild(iframe), 2000);
}
```

**HTML link:**

```html
<a href="dsh://plugin/install?id=dsh-purge&name=dsh-purge&version=1.1.7&repo=YuJunZhiXue%2Fdsh-purge&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fgithub.com%2FYuJunZhiXue%2Fdsh-purge%2Farchive%2Frefs%2Fheads%2Fmaster.tar.gz">
  🚀 Install in desktop client
</a>
```

**`dsh://plugin/install` parameters:**

| Param | Value / example | Meaning |
|---|---|---|
| id | `dsh-purge` | Plugin id |
| name | `dsh-purge` | Display name |
| version | `1.1.7` | Semver |
| repo | `YuJunZhiXue/dsh-purge` | GitHub repo |
| permissions | `系统提示词注入, 本机补丁, 设置页` | Requested permissions |
| downloadUrl | `https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz` | GitHub tarball (not `.zip`) |

### Manual install

Use this when `dsh` is not on `PATH` or you do not want `dsh plugin add`. Edit the profile for that host. Do **not** delete existing bundles.

**1. Find the Harness home (`$DSH_HOME`)**

| Layout | Typical path |
|---|---|
| Env | `DSH_HOME` if set (community Desktop host-commands also set this) |
| Windows portable | `.dsh` next to `npm-global` |
| User default | Windows `%USERPROFILE%\.dsh`; Linux / macOS `~/.dsh` |

| Host | Profile directory |
|---|---|
| Official Web | `$DSH_HOME/profiles/web` |
| Official desktop EXE | `$DSH_HOME/profiles/default` |
| Community DSH Desktop | `$DSH_HOME/profiles/desktop` |

**2. Put this repo under plugins**

```sh
git clone https://github.com/YuJunZhiXue/dsh-purge.git "$DSH_HOME/plugins/dsh-purge"
```

Or copy the tree to `$DSH_HOME/plugins/dsh-purge` (folder name must be `dsh-purge`). The `file:../../plugins/dsh-purge` relative path is enough. A junction is only needed if `plugin add` is given a local path that contains spaces.

**3. Edit that profile’s `package.json`**

- Web: `$DSH_HOME/profiles/web/package.json`
- Official desktop EXE: `$DSH_HOME/profiles/default/package.json`
- Community DSH Desktop: `$DSH_HOME/profiles/desktop/package.json`

Add to `dependencies` (keep other deps):

```json
"dsh-purge": "file:../../plugins/dsh-purge"
```

**Append** `"dsh-purge"` at the end of `dsh.profile.bundles`:

- Web: **keep** `@deepseek-ai/dsh-web-app`, only append this plugin
- Official / community Desktop: keep `@deepseek-ai/dsh-base` (and the rest), only append this plugin

Sketch (keep every other field from the file on disk):

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

If the desktop profile has no `dsh-web-app` row, do not add it; just make sure `"dsh-purge"` is in `bundles`.

**4. Install deps**

```sh
cd "$DSH_HOME/profiles/web"
pnpm install

cd "$DSH_HOME/profiles/default"
pnpm install

cd "$DSH_HOME/profiles/desktop"
pnpm install
```

PowerShell: use the real Harness home:

```powershell
cd "$env:USERPROFILE\.dsh\profiles\web"          # Web
# cd "$env:USERPROFILE\.dsh\profiles\desktop"    # community Desktop
# cd "$env:USERPROFILE\.dsh\profiles\default"    # official EXE
# portable: <install root>\.dsh\profiles\<web|desktop|default>
pnpm install
```

**5. Restart, then apply patches**

1. Fully quit the current host (Web process, or official EXE / community Desktop tray) and start it again. Community Desktop opens `DSH Desktop.exe`, not `dsh web`.
2. Settings should show **Rules**. Ctrl+F5 if cached.
3. Click **Apply**, or `/purge apply`, or `dsh-purge --apply` from the plugin dir.
4. Restart again when prompted so patched packages load in this process. Settings **Restart / Uninstall** relaunch the desktop app when you are on Desktop.

### Uninstall

Settings → **Rules** → **Uninstall**. Confirm the dialog: uninstall restores the original Harness and removes this plugin. If patches were applied, they are reverted first. The current host then restarts (Web relaunches `dsh web`; community Desktop relaunches `DSH Desktop.exe`).

```sh
# or from a terminal
dsh-purge --uninstall
# or in chat: /purge uninstall
```

Plugin config lives in `cordis.patch.yml`:

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

`postPrompt` is empty by default.

---

## What this is

**dsh-purge** is a settings plugin for [DeepSeek Harness](https://www.deepseek.com/harness/):

- Updates default copy, permission policy, and tool limits in the installed `@deepseek-ai/*` packages
- Adds a **Rules** card: grouped patches, Apply / Restore / Uninstall, session override editor, multiple rule sets
- Re-applies on start after an npm upgrade overwrites `node_modules`
- No hardcoded drive letters: `$DSH_HOME`, `.dsh` next to the dsh launcher, then `~/.dsh`

It does not patch the Harness source tree. Use **Apply** on the settings page. Identity comes only from your `prompt-inject.md` — the plugin does not author a second identity card.

---

## 0.1.5 notes

| Symptom | Patch | What it does |
|---|---|---|
| Picking a workspace / new chat wipes to empty | `#4` `#28` `#39` | 0.1.5 `dsh-persona` requires `prefix`; old presets still send `text`. Alias `text` → `prefix` so 0.1.2 presets (liangshen) can mount |
| History: `summary requires notice form` | `#40` | `dsh-session-format-v0-to-v1` allows mnemon `instructions` / `recall` sources to carry `summary` |
| “Who are you” falls back to DeepSeek assistant | inject file | No second identity. The `dsh-purge` section is verbatim `prompt-inject.md` |
| Liangshen turn 1 looks uninjected | `#29` | phase-1 keeps persona / persona-prefix / persona-suffix plus inject; official tool catalog stays isolated |

`#20` / `#21` / `#28` / `#29` remain optional plugin rows: skip if those packages are absent.

---

## Preview

The **Rules** card appears on the dsh web settings page. Switch **Light / Ink**. Patches are grouped; the count only includes items that actually applied. Rule sets sit in a list above the editor, with Enable and Delete on each row.

**Patches**

![Patches](docs/preview/settings.png)

**Rule sets**

![Rule sets](docs/preview/rules.png)

| Area | What it shows |
|---|---|
| Light / Ink | card appearance |
| Patches | grouped status, Apply, Restore, or Uninstall |
| Prompt | edit `prompt-inject.md` as the session override |
| Rule sets | multiple `AGENTS.md` / `CLAUDE.md`; Enable writes under `$DSH_HOME`, Delete removes the row |

---

## Layout

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

Runtime user files: `$DSH_HOME/prompt-inject.md`, `$DSH_HOME/rules/`. If `DSH_HOME` is unset, the launcher-adjacent `.dsh` wins over `~/.dsh`.

---

## Verify

- After restart, the **Rules** card is on the settings page. Hard-refresh (Ctrl+F5) if the client bundle is cached.
- Click **Apply**, then **Restart** when prompted. Optional packages (liangshen / web-fetch) show as missing/skipped and do not block complete → restart.
- First Apply writes the built-in default into `prompt-inject.md` when the file is missing; an already-empty file is left empty.
- `/purge status` prints `DSH_HOME` and the patch list.
- On 0.1.5, selecting an existing workspace should restore the session — not wipe to an empty workspace.
- Skipped items are expected when a target file is absent (for example #20 / #21 without `dsh-web-fetch-http`).

---

## Usage

```sh
dsh-purge --status
dsh-purge --apply
dsh-purge --revert
dsh-purge --uninstall
dsh-purge --edit

/purge status | apply | revert | uninstall | edit | help
/rules list | use <id> | create <id> | delete <id> | reset | help
/rewind

purge_status   purge_apply   purge_revert
```

Patched packages load only after a restart. Apply does not restart by itself.

The composer **Undo** button drops the last turn and puts the last user sentence back in the input. On the main agent you can rewind once or the whole last round (including subagents). After rewind, send only what is in the box now. `/rewind` does the same.

---

## Local checks

```sh
node --check lib/index.js
node --check lib/core.js
node --check lib/surface.js
node --check lib/web.js
node --check lib/desktop.js
node --check lib/host.js
node --check lib/rewind.js
node --check client.js
node --test test/surface.test.js
node --test test/update-spec.test.js
```

---

## How it works

**Apply (on start or by hand):**

```
patch not applied? ──no──> skip
    │yes
    ├─> backup <file>.dshpurge.bak (Desktop host-commands backups stay under `$DSH_HOME/dsh-purge/shim-backups` only)
    ├─> apply matching replacements
    ├─> override shim (dsh.cmd / dsh.ps1 / unix dsh; **skip Desktop sealed host-commands bins**)
    ├─> scrub illegal sibling `*.dshpurge.bak` inside sealed bins (Desktop validates before plugins load)
    ├─> Windows: pin hide-console + child_process import hook; patch subprocess-local / doctor / market / liangshen bash
    └─> if `prompt-inject.md` is missing, write the default (do not refill an empty file)
```

**Override (each session):**

```
prompt-inject.md has content? ──yes──> write it verbatim as the dsh-purge systemPrompt section
           │no
           └─> no override section
```

**Identity (1.3.6):** the plugin does not invent an “operator / LCS” second persona. Official Harness identity lines are stripped; `prompt-inject.md` is the identity. On 0.1.5 the inject is folded into `persona-prefix` so liangshen phase-1 cannot drop it.

**Windows CMD silence:** on Node 24, `import { spawn } from "node:child_process"` is not a live binding. `registerHooks` redirects `node:child_process` to a `windowsHide` facade; `@deepseek-ai/dsh-subprocess-local` also gets `windowsHide: true`. Doctor relaunch uses `node + bin.js` and does not leave a noop `supervisor.cmd`.

**Liangshen phase-1:** the default preset strips non-persona system-prompt sections. Apply / startup keeps persona, persona-prefix, persona-suffix, and inject (tool quarantine unchanged).

**DSH Desktop (anywhere-labs/dsh-desktop, issue #9):** `host-commands/<profile>/bin` is sealed — no sibling extras (including `dsh.cmd.dshpurge.bak`). This plugin scrubs only (no inject, no bak writes).

**Prompt purge:** refusal / anti-roleplay wording in `minimal`, official `standard` / `ptc` / `cordis`, and liangshen personas becomes executable + roleplay-allowed. No fixed role name is locked in.

---

## Restore

- Each target is copied to `<file>.dshpurge.bak` before the first apply.
- **Restore** or `/purge revert` copies backups back and deletes them. With no backup, shim lines written by this plugin are stripped.
- `prompt-inject.md` is a user file and is kept.
- **Uninstall** restores first if patches were applied, then deletes the inject file, rule library, and the plugin itself.
- Apply is idempotent.

---

## Path detection

The host surface is detected first: `web` / `desktop` (`gui` / `tui` are reserved and still fall back to web).

**Web:**

1. `DSH_HOME` / `DSH_BASE`
2. `.dsh` next to the dsh launcher (portable install, any drive)
3. `npm prefix -g` / `npm root -g`
4. Nested `@deepseek-ai/dsh/node_modules/@deepseek-ai`
5. `~/.dsh`

**Community DSH Desktop:** only the **running desktop process** install tree (`resources/app` or `app.asar.unpacked` → `@deepseek-ai`). The folder does not have to be named `DSH Desktop`, and the drive letter is not hard-coded. Order:

1. Running `DSH Desktop.exe` / `process.resourcesPath` / `host-process-entry.js` / `desktop-cli.js`
2. A `resources/app` tree whose parent folder actually contains `DSH Desktop.exe`
3. A path whose name contains `DSH Desktop` / `dsh-desktop`
4. `DSH_DESKTOP_INSTALL` (install root) or `DSH_BASE` (`@deepseek-ai` under that tree)
5. Common NSIS locations (`%LOCALAPPDATA%\Programs\DSH Desktop`, `%ProgramFiles%\DSH Desktop`, …)

Official npm-global is not patched. Sealed `host-commands` / `runtime-commands` are scrubbed, never injected.

If nothing is found, set `DSH_BASE` / `DSH_DESKTOP_INSTALL`. No files are changed.

---

## Changelog

### 1.1.7

- **#25:** After the first turn, do not pin the previous full system prompt. Inject `prompt-inject.md` once; later turns leave this turn’s other sections as assembled.
- **#26:** `dsh plugin add` / in-app update use GitHub `master.tar.gz`. A `.zip` URL is not a pnpm tarball (`ERR_PNPM_TARBALL_DECODE_GZIP`). Local overlay still downloads the zip for `tar` / Expand-Archive.
- Install docs split **Web / Desktop** defaults: Web uses official `dsh --profile web`; Desktop uses the built-in terminal `dsh plugin add <tar.gz>`.
- Desktop Apply / Restart / Uninstall only touch the running desktop install tree, not official Web / npm-global.
- Desktop package root follows the running `DSH Desktop.exe` (default or custom install folder).

<details>
<summary>Earlier versions</summary>

### 1.1.6

- Settings **Uninstall** asks for confirmation, restores applied patches, then removes the plugin and restarts.
- The AI-assistant install block is install-only: no disk scan, no apply.
- Separate install commands for official Web / official EXE / community DSH Desktop. Desktop **Restart / Uninstall** relaunch `DSH Desktop.exe`.

### 1.1.5

- Manual Update: if `git pull --ff-only` fails, fetch + reset to `origin/master`, then zip overlay.

### 1.1.4

- Update check reads `package.json` at the GitHub commit SHA, instead of the stale jsDelivr `@master` cache or falling back to the local version.

### 1.1.3

- Prompt inject once on the first turn; later turns pin the committed system prompt instead of appending a second copy.
- Strip bundled `dsh-mnemon` context rows by default.
- Switching back from a subagent no longer puts the last sent message into the composer.
- Export a Cordis `{ apply }` default so the plugin tree can load.

### 1.1.2

- Custom OpenAI-compatible APIs no longer 400 on `developer` role: `#42` remaps it back to `system`.
- Settings rule sets: read / delete / save go through one POST so the browser no longer fails with `Failed to fetch`.

### 1.1.1

- Composer **Undo** / `/rewind`: main agent can rewind once or the last round (drop this round’s subagents); a subagent rewinds once.
- After rewind, the input box keeps the last user sentence, but sending again is a new turn — leftover inbox is cleared so the old prompt is not auto-sent.
- Optional unmatched patches count as skipped, not failed.

### 1.1.0

- Check update and download share one button: after a check, it becomes **Update** and the pill shows the remote version.
- Startup auto-checks GitHub `master` and downloads. `dsh plugin add` (zip / github) uses the official CLI; machines without git overlay `master.zip`. Uncommitted files in a git checkout are not auto-overwritten.
- **#16:** `#26` no longer applies bare identity replacements to YAML; apply rewrites `prefix`/`text` fold indent so the cordis preset mounts.
- **#15:** Empty prompt-inject still injects nothing. If there is text but it never reaches the model, 0.1.5 `complete:true` was dropping every section after assemble; `#41` folds inject back into the complete prompt.
- **#14:** Hub `api/plugins/download` is not a tarball; install from GitHub `master.zip` only.

### 1.0.0

- Version numbering reset.
- Settings: **Check update** reads GitHub `master`.

</details>

## Notes

- Scope is rendered copy, defaults, and runtime logic inside local `@deepseek-ai/*` packages, plus override files and rule sets under the harness home.
- After an upgrade, unmatched originals surface as `pattern_not_found` or pending.
- Third-party plugin *source repos* outside `@deepseek-ai` are left alone (CMD silence may **best-effort** patch installed doctor / market / liangshen / mnemon at runtime).
- The npm package name is not published yet. Install from GitHub, the [Hub](https://deepseek.stream/plugins/dsh-purge), or `dsh plugin add .`.

---

Thanks to the [LINUX DO](https://linux.do) community
