<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">⚔️ DeepSeek Harness cybersecurity red-team tool (dsh-purge)</h1>

<p align="center"><strong>Version 1.1.12-beta.1</strong></p>

<p align="center">
    <em>Local official DeepSeek Harness cybersecurity red-team plugin: evaluate and harden host safety policy in a controlled local install; swap prompts per model. Default prompt for Chinese models — 小码酱. Please star ⭐</em>
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

> 🌐 **Plugin hub:** [DeepSeek Harness Hub](https://deepseek.stream/plugins/dsh-purge) — official and community DeepSeek plugin market | discover and one-click install

> Aligned with **dsh 0.1.5-rc.2** (Node.js **≥18**; Windows no-flash import hooks need **Node ≥22** `registerHooks`, older Node still gets file-level `windowsHide` patches). On other versions, unmatched originals stay pending or skipped. Nothing is rewritten blindly.
>
> Also accepts the 0.1.2 community `dsh-persona text` field and `dsh-mnemon` v0 session `summary`. After install you still need **Apply + restart**.

---

## ☕ Sponsor

If this project helps you, send it over — I'm out here asking~

| Asset | Address |
|---|---|
| **USDT (TRC20)** | `TV5ajPkRD8RH623Dx9mqvYZVNN8nPGRKid` |
| **Solana** | `6x16GhRgLVpKFFXaU1seKNdx2rypspSJTL4dbpt6Xpwk` |
| **Ethereum** | `0xB68BD60C0e8c519513B7DF9bB147696815423B3E` |
| **Bitcoin** | `bc1qu70yxkrtwnymt8ryluz9x8y8hqzune5340npht` |

<p align="center">
  <sub>Built by 小杨 · for DeepSeek Harness</sub>
</p>

---

## 🛡️ Why cybersecurity red-teaming matters

As generative AI and large language models move into production, robustness, adversarial defense, and alignment safety are core cybersecurity research problems. A local Agent / Harness also rewrites prompts, approval gates, sandbox policy, and session migration at runtime. Asking “will the model answer” is not enough if the host layer kills a lawful eval request first.

1. **Map the defense boundary, then harden the guardrail.** Professional cybersecurity red-teaming on a controlled local official DeepSeek Harness install is how teams find guardrail failures, prompt-injection, and unexpected-behavior gaps — then feed those findings back into fine-tuning, input guardrails, and the system safety layer.
2. **Build an offense–defense eval loop.** Defense without a controlled red-team suite is guesswork. Reversible patches on the installed official `@deepseek-ai/*` packages show which refusals come from the model and which come from default copy, approval ladders, or session-format checks — a reproducible ruler for labs and auditors.
3. **Advance native model-security research.** The project aims to give academia and security engineering a transparent, local, reproducible baseline. Keep official capabilities; only adjust over-refusal policy for controlled security eval. No second invented identity, and official optimizations stay.

This is a **local official DeepSeek Harness cybersecurity red-team plugin**. It only touches **your** installed official `@deepseek-ai` packages and local config. It is **not** a public scanner, **not** an attack kit for third-party sites, and the repo does **not** ship malware, unauthorized-exploit scripts, or payloads aimed at the public internet.

---

<a id="strict-legal--compliance-disclaimer"></a>

<div>

### ⚠️ <font color="red">Strict legal and compliance disclaimer</font>

<font color="red">

**Zero-tolerance statement:** This project opposes and forbids any illegal activity. The authors do not support, encourage, or assist unauthorized network attacks, exploit use, data theft, unlawful intrusion into computer information systems, or generation of illegal or prohibited content. **Anyone who uses this project for crime is solely responsible under the law. The authors have no liability.**

1. **This repository contains no illegal material.** The published code, docs, patches, and default prompt are **not** malware, backdoors, unauthorized pentest kits, ransomware, credential-stuffing scripts, or attack payloads aimed at the public internet or third-party systems. The project does not supply illegal content and does not incite, organize, or assist crime.
2. **Local official Harness only.** Security-eval patches and prompt injection run only on the **official DeepSeek Harness already installed on the user's machine** (`@deepseek-ai` packages, local profile / `$DSH_HOME`). The target is the user's own official local software, **not** someone else's website, server, account, or information system.
3. **Eval patches do not attack the public internet.** Apply, inject, revert, and uninstall stay in local files and local processes. They **do not scan, probe, intrude, or send attack traffic to any public host or unauthorized system**. Do not use this project as a jump host against the public internet. If "check for updates" is on, the plugin may only contact this plugin's own GitHub repository to compare versions. That is **not** an attack on third-party systems and is **not** authorization to penetrate anything.
4. **Lawful, controlled scope.** This project is an aid for red-team research and robustness evaluation on an **official Harness the user is entitled to administer**. **Do not run it against targets without the owner's lawful written authorization, public online systems, or production workloads.** Testing must stay on the **authorized local official Harness, offline local synthetic fixtures, authorized cybersecurity ranges, and compliant lab environments**.
5. **Forbidden uses.** Users must not use this project, directly or indirectly, to violate the following (each must be followed; no excuse to evade):
   - <font color="red"><strong>Criminal Law of the People's Republic of China</strong></font>
   - <font color="red"><strong>Cybersecurity Law of the People's Republic of China</strong></font>
   - <font color="red"><strong>Data Security Law of the People's Republic of China</strong></font>
   - <font color="red"><strong>Personal Information Protection Law of the People's Republic of China</strong></font>
   - and other applicable laws, regulations, and supervisory rules;
   - Also forbidden:
   - Unauthorized intrusion or attacks on public or private computer information systems; extortion, sabotage, credential stuffing, or spreading malicious payloads;
   - Inducing, generating, or spreading any content the law forbids, including threats to national security, terrorism, violence, pornography, gambling, fraud, and privacy or intellectual-property infringement;
   - Violating the model provider's terms of service and acceptable-use policy.
6. **The user bears all responsibility.** The project is provided under the MIT license as-is. The authors make no warranty of completeness, security, or fitness. **Users independently bear all civil, administrative, and criminal liability** for download, deploy, run, modify, distribute, and all resulting inputs and outputs. Authors and contributors bear no direct, indirect, or joint liability for abuse.
7. **The license ends on breach.** Anyone who uses this project for illegal attacks, malicious activity, or other violations has their open-source license **automatically and irrevocably terminated** from the moment of the violation. They must stop using the project, permanently destroy all copies and derivatives, and accept legal sanctions.
8. **No affiliation.** This is an independent open-source security-eval research project. It has no employment, commercial, authorization, or endorsement relationship with DeepSeek or its affiliates. "Official" here only means the eval target is the official DeepSeek Harness package on the user's machine. It does **not** mean DeepSeek developed, approved, or warrants this plugin.

</font>

</div>

---

## ⚡ Install

Web and Desktop are **installed and security-eval patched separately**. They do not touch each other.

| Host | Profile | Default install |
|---|---|---|
| **Web** (official `dsh web`) | `web` | Official `dsh` on PATH |
| **Desktop** (community [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop)) | `desktop` | `dsh` inside the app’s built-in terminal (not official `dsh` on PATH) |
| Official Harness desktop EXE | `default` | Official `dsh`, or `dsh://` below |

After install:

1. Fully quit and restart **the host you just installed into** (stop `dsh web`, or quit the Desktop tray and open `DSH Desktop.exe`)
2. When **Rules** appears on that host’s Settings page, click **Apply** (adding the bundle does not patch `@deepseek-ai` by itself)
3. On start the plugin auto-applies the current host and uses the built-in default prompt unless the user has saved a different one

Web **Apply / Restart / Uninstall** affect Web only. Desktop **Apply / Restart / Uninstall** affect the desktop app only — they do not launch `dsh web`.

> 🌐 **Plugin hub:** [DeepSeek Harness Hub](https://deepseek.stream/plugins/dsh-purge) (docs only — **do not** install via `deepseek.stream/api/plugins/download?...`)

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
  <a href="dsh://plugin/install?id=dsh-purge&name=dsh-purge&version=1.1.10&repo=YuJunZhiXue%2Fdsh-purge&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fgithub.com%2FYuJunZhiXue%2Fdsh-purge%2Farchive%2Frefs%2Fheads%2Fmaster.tar.gz"><strong>🚀 Install in desktop client</strong></a>
</p>

🔗 **Raw protocol URL:**

```
dsh://plugin/install?id=dsh-purge&name=dsh-purge&version=1.1.10&repo=YuJunZhiXue%2Fdsh-purge&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fgithub.com%2FYuJunZhiXue%2Fdsh-purge%2Farchive%2Frefs%2Fheads%2Fmaster.tar.gz
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
    version: '1.1.10',
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
<a href="dsh://plugin/install?id=dsh-purge&name=dsh-purge&version=1.1.10&repo=YuJunZhiXue%2Fdsh-purge&permissions=%E7%B3%BB%E7%BB%9F%E6%8F%90%E7%A4%BA%E8%AF%8D%E6%B3%A8%E5%85%A5%2C%E6%9C%AC%E6%9C%BA%E8%A1%A5%E4%B8%81%2C%E8%AE%BE%E7%BD%AE%E9%A1%B5&downloadUrl=https%3A%2F%2Fgithub.com%2FYuJunZhiXue%2Fdsh-purge%2Farchive%2Frefs%2Fheads%2Fmaster.tar.gz">
  🚀 Install in desktop client
</a>
```

**`dsh://plugin/install` parameters:**

| Param | Value / example | Meaning |
|---|---|---|
| id | `dsh-purge` | Plugin id |
| name | `dsh-purge` | Display name |
| version | `1.1.10` | Semver |
| repo | `YuJunZhiXue/dsh-purge` | GitHub repo |
| permissions | `系统提示词注入, 本机补丁, 设置页` | Requested permissions |
| downloadUrl | `https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz` | GitHub source archive |

### Manual install

Use this when `dsh` is not on `PATH`, official `dsh plugin add` fails, or you do not want a remote install. Edit **only the profile for the host you are using**. Do **not** delete existing bundles. Do not edit Web and Desktop in the same pass.

**0. Pick one host, one profile**

| What you actually run | Edit only this directory | Leave alone |
|---|---|---|
| Official `dsh web` | `$DSH_HOME/profiles/web` | `desktop`, `default` |
| Community [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop) | `$DSH_HOME/profiles/desktop` | `web`, `default` |
| Official Harness desktop EXE | `$DSH_HOME/profiles/default` | `web`, `desktop` |

If `profiles/<name>/package.json` is missing, start that host once so the official program creates the profile, then continue.

**1. Find the `$DSH_HOME` this host actually uses**

A real home is named `.dsh` (official EXE sometimes uses `dsh-home`), contains `profiles`, and has at least one `profiles/<name>/package.json`.

Search in this order and use the first tree that matches the host you run:

| Order | Layout | Typical path |
|---|---|---|
| 1 | Environment | `DSH_HOME` if set |
| 2 | Windows portable / install folder | `.dsh` next to `dsh.cmd` or `npm-global`, for example `<install root>\.dsh` |
| 3 | User default | Windows `%USERPROFILE%\.dsh`; Linux / macOS `~/.dsh` |
| 4 | Official desktop EXE | `%APPDATA%\DeepSeek Harness\dsh-home`, `%LOCALAPPDATA%\DeepSeek Harness\dsh-home` |

PowerShell can list candidates:

```powershell
$cands = @()
if ($env:DSH_HOME) { $cands += $env:DSH_HOME }
$cands += "$env:USERPROFILE\.dsh"
$dsh = Get-Command dsh -ErrorAction SilentlyContinue
if ($dsh) {
  $dir = Split-Path $dsh.Source
  $cands += @(
    (Join-Path $dir ".dsh"),
    (Join-Path (Split-Path $dir) ".dsh"),
    (Join-Path (Split-Path (Split-Path $dir)) ".dsh")
  )
}
$cands += @(
  "$env:APPDATA\DeepSeek Harness\dsh-home",
  "$env:LOCALAPPDATA\DeepSeek Harness\dsh-home"
)
$cands | Select-Object -Unique | Where-Object { $_ -and (Test-Path (Join-Path $_ "profiles")) }
```

How to confirm you found the right one:

- Web: `$DSH_HOME/profiles/web/package.json` has `"name": "dsh-profile-web"`
- Community Desktop: `$DSH_HOME/profiles/desktop/package.json` has `"name": "dsh-profile-desktop"`
- Official EXE: `$DSH_HOME/profiles/default/package.json` exists

Machines often have two homes (user folder and install folder). A portable / install-dir official `dsh` uses the `.dsh` next to the install root — not an empty `%USERPROFILE%\.dsh`. After the steps below, start the host that belongs to that home.

**2. Put the plugin at `$DSH_HOME/plugins/dsh-purge`**

The tree must look like this (do not rename the folder):

```
$DSH_HOME/
  plugins/
    dsh-purge/                 ← must be named dsh-purge
      package.json             ← "name" must be "dsh-purge"
      client.js
      cordis.patch.yml
      lib/
  profiles/
    web/package.json           ← or desktop / default
```

With git:

```sh
mkdir -p "$DSH_HOME/plugins"
git clone https://github.com/YuJunZhiXue/dsh-purge.git "$DSH_HOME/plugins/dsh-purge"
```

Without git, download [master.tar.gz](https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz), extract it, rename `dsh-purge-master` to `dsh-purge`, and place that folder under `plugins`. PowerShell example (set `$home` to the path from step 1):

```powershell
$home = "D:\DeepSeek Harness\.dsh"
$plugins = Join-Path $home "plugins"
New-Item -ItemType Directory -Force -Path $plugins | Out-Null
$tmp = Join-Path $env:TEMP "dsh-purge-master.tar.gz"
Invoke-WebRequest -Uri "https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz" -OutFile $tmp
tar -xzf $tmp -C $plugins
$src = Join-Path $plugins "dsh-purge-master"
$dst = Join-Path $plugins "dsh-purge"
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
Rename-Item $src "dsh-purge"
```

If you already have a clone, copy the whole tree to `$DSH_HOME/plugins/dsh-purge`. Do not copy a few `.js` files by themselves.

Check: `$DSH_HOME/plugins/dsh-purge/package.json` opens and `"name": "dsh-purge"`. Do not use the Hub `api/plugins/download` URL as the source.

**3. Edit only that profile’s `package.json` — back it up first**

| Host | File to edit |
|---|---|
| Web | `$DSH_HOME/profiles/web/package.json` |
| Community Desktop | `$DSH_HOME/profiles/desktop/package.json` |
| Official desktop EXE | `$DSH_HOME/profiles/default/package.json` |

Copy `package.json.bak` first. Then **add only two things**. Keep every existing dependency, bundle, and other field:

1. In `dependencies`, add `"dsh-purge": "file:../../plugins/dsh-purge"`
2. At the **end** of `dsh.profile.bundles`, append `"dsh-purge"` (skip if it is already there)

`file:../../plugins/dsh-purge` is the relative path from `profiles/web` (or `desktop` / `default`) to `$DSH_HOME/plugins/dsh-purge`. The same relative path works for all three. Do not switch it to an absolute path.

Before (official default often looks like this; your file may list more plugins — keep them):

```json
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {},
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app"
      ],
      "patchReload": "live"
    }
  }
}
```

After:

```json
{
  "name": "dsh-profile-web",
  "private": true,
  "dependencies": {
    "dsh-purge": "file:../../plugins/dsh-purge"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-purge"
      ],
      "patchReload": "live"
    }
  }
}
```

Notes:

- Web: **keep** `@deepseek-ai/dsh-web-app`; only append this plugin
- Desktop: keep `@deepseek-ai/dsh-base` and the rest; if there is no `dsh-web-app` row, do not add one
- JSON must stay valid: a comma before the new item, no trailing comma after the last item
- Leave `patchReload`, other plugin names, and versions alone
- Do not write `"dsh-purge"` twice

**4. Run `pnpm install` only in the profile you just edited**

`pnpm` must be available (official `dsh` usually ships it). `cd` into **that profile directory**, not the repo root and not `$DSH_HOME` itself.

```sh
cd "$DSH_HOME/profiles/web"
pnpm install

cd "$DSH_HOME/profiles/desktop"
pnpm install

cd "$DSH_HOME/profiles/default"
pnpm install
```

PowerShell (use the home from step 1):

```powershell
cd "$env:USERPROFILE\.dsh\profiles\web"
# cd "$env:USERPROFILE\.dsh\profiles\desktop"
# cd "$env:USERPROFILE\.dsh\profiles\default"
# portable example:
# cd "D:\DeepSeek Harness\.dsh\profiles\web"
pnpm install
```

Success: `$DSH_HOME/profiles/<web|desktop|default>/node_modules/dsh-purge/package.json` exists.

Common failures:

- `pnpm` not found: install pnpm, or use the Node / pnpm that ships with official `dsh`
- `Could not resolve` / missing local package: check that `plugins/dsh-purge/package.json` exists and `file:../../plugins/dsh-purge` is correct
- JSON parse error: fix commas in `package.json` and retry; restore the backup if needed

**5. Fully quit that host, start it, then apply**

Writing `package.json` does **not** patch `@deepseek-ai` by itself. Restart, then click **Apply**.

1. Fully quit the host you just installed into: stop `dsh web`; quit the community Desktop tray and open `DSH Desktop.exe`; quit the official EXE tray as well
2. Open **that host’s** Settings page. **Rules** should appear. Ctrl+F5 if cached
3. Click **Apply** on this host only, or run `/purge apply` in chat. Do not Apply Web from Desktop or Desktop from Web
4. Restart again when prompted so patched packages load in this process. Settings **Restart / Uninstall** relaunch the desktop app; they do not launch `dsh web`

**6. How to confirm it is installed**

- Settings shows the **Rules** card
- `/purge status` prints `DSH_HOME` and the patch list; the path should match step 1
- `profiles/<name>/node_modules/dsh-purge` points at `plugins/dsh-purge`

If the card is missing, you likely edited the other `.dsh`, or you edited `web` and then opened Desktop. Go back to step 1. Do not split the same install across two homes.

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
| Skills | import a zip or folder into this host’s official `$DSH_HOME/skills/<id>/SKILL.md` (web and desktop each use their own home; no drive letter is hardcoded); DSH owns match, load, and `/name`. You can also delete that folder yourself |

---

## Layout

```
dsh-purge/
├── bin/dsh-purge.js
├── client.js
├── cordis.patch.yml
├── docs/
│   ├── banner.svg
│   └── preview/
│       ├── rules.png
│       └── settings.png
├── lib/
│   ├── child-process-hide.mjs
│   ├── core.js
│   ├── hide-console.js
│   ├── identity.js
│   ├── index.js
│   ├── restart-web.js
│   ├── rewind.js
│   ├── rules.js
│   ├── skills.js
│   ├── uninstall-restart.js
│   ├── uninstall.js
│   └── update.js
├── package.json
├── screenshots.json
├── LICENSE
├── README.md
└── README.zh-CN.md
```

Runtime user files: `$DSH_HOME/prompt-inject.md`, `$DSH_HOME/rules/`, `$DSH_HOME/skills/`. If `DSH_HOME` is unset, the launcher-adjacent `.dsh` wins over `~/.dsh`. Skills are not part of the `dsh-purge` inject section and do not replace the prompt.

---

## Verify

- After restart, the **Rules** card is on the settings page. Hard-refresh (Ctrl+F5) if the client bundle is cached.
- Click **Apply**, then **Restart** when prompted. Optional packages (liangshen / web-fetch) show as missing/skipped and do not block complete → restart.
- Until the user saves a different prompt, `prompt-inject.md` stays the built-in default.
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
/skills list | import <zip-or-folder> | create <id> [description] | delete <id> | help
/rewind

purge_status   purge_apply   purge_revert
```

Patched packages load only after a restart. Apply does not restart by itself. Under the patch title, **Stable** and **Beta** are separate: each has its own version list and switch action. A rollback is pinned; click **Update** to return to that channel's tip.

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
node --check lib/skills.js
node --check client.js
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
    └─> if the user has not replaced the prompt, write/refresh the built-in default
```

**Override (each session):**

```
prompt-inject.md has content? ──yes──> write it verbatim as the dsh-purge systemPrompt section
           │no
           └─> no override section
```

**Skills (official catalog, not injected):** Settings import (zip or folder) or `/skills import` writes only to official `$DSH_HOME/skills/<id>/SKILL.md` (companion files in that folder are kept). Official `dsh-skill-filesystem` watches that directory; the model loads via the `skill` tool or `/id`. Uninstalling the plugin does not delete user skills.

**Identity (1.3.6):** the plugin does not invent an “operator / LCS” second persona. Official Harness identity lines are stripped; `prompt-inject.md` is the identity. On 0.1.5 the inject is folded into `persona-prefix` so liangshen phase-1 cannot drop it.

**Windows CMD silence:** on Node 24, `import { spawn } from "node:child_process"` is not a live binding. `registerHooks` redirects `node:child_process` to a `windowsHide` facade; `@deepseek-ai/dsh-subprocess-local` also gets `windowsHide: true`. Doctor relaunch uses `node + bin.js` and does not leave a noop `supervisor.cmd`.

**Liangshen phase-1:** the default preset strips non-persona system-prompt sections. Apply / startup keeps persona, persona-prefix, persona-suffix, and inject (tool quarantine unchanged).

**DSH Desktop (anywhere-labs/dsh-desktop, issue #9):** `host-commands/<profile>/bin` is sealed — no sibling extras (including `dsh.cmd.dshpurge.bak`). This plugin scrubs only (no inject, no bak writes).

**Prompt security eval:** over-refusal and anti-eval-persona wording in `minimal`, official `standard` / `ptc` / `cordis`, and liangshen personas is rewritten so controlled security evaluations can complete. No fixed role name is locked in.

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

### 1.1.12-beta.1

- Skill import stays on beta: Settings and `/skills` write zip/folder into official `$DSH_HOME/skills`
- Stable / Beta columns match official 1.1.11, so you can switch both ways
- Same system-prompt fix as official 1.1.11: inject once per conversation, do not append another「系统提示词」on later steps

### 1.1.11

- Settings splits Stable / Beta into two columns, each with its own list, switch, and rollback. 1.1.10 can reach this by Check update.
- **No Skill import.** Skill stays on beta 1.1.12.
- **Inject the system prompt once per conversation.** The first turn writes the full `prompt-inject`; later steps pin that committed prompt and do not fold it again.
- **Stop a new「系统提示词」card on every step.** With 0.1.5 in-history, a changed assemble appends another `system/message`, so the transcript repeats system prompt → think → tools. Refolding inject every step made later official sections look like a new prompt; emptying inject did the same. After the inject is already in history, this release pins that committed system prompt and does not append a second copy.

### 1.1.11-beta.2

- Stable and Beta sit in two columns, each with its own list; switching a channel checks out that branch and can switch back after restart

### 1.1.11-beta.1

- Settings can import a zip or folder into official `$DSH_HOME/skills`; Stable / Beta can be switched and rolled back
- Import ignores symlinks and checks archive paths; save keeps official frontmatter fields

### 1.1.10

- Saving or applying with both the prompt and the rule set empty is blocked and shows a dialog
- First-turn inject is complete; later turns no longer pin the previous full system prompt
- Settings / `/skills` can import a zip or folder into official `$DSH_HOME/skills`; DSH still owns match and load
- Settings can switch Stable / Beta and roll back to a published version; a rollback is pinned and will not auto-follow

### 1.1.9

- Removed the default prompt from the repository

<details>
<summary>Earlier versions</summary>

### 1.1.8

- Until the user saves a different prompt, the built-in default is used. Settings can restore the default.

### 1.1.7

- **#25:** After the first turn, do not pin the previous full system prompt. Inject `prompt-inject.md` once; later turns leave this turn’s other sections as assembled.
- **#26:** `dsh plugin add` / in-app update use GitHub `master.tar.gz`. A `.zip` URL is not a pnpm tarball (`ERR_PNPM_TARBALL_DECODE_GZIP`). Local overlay still downloads the zip for `tar` / Expand-Archive.
- Install docs split **Web / Desktop** defaults: Web uses official `dsh --profile web`; Desktop uses the built-in terminal `dsh plugin add <tar.gz>`.
- Desktop Apply / Restart / Uninstall only touch the running desktop install tree, not official Web / npm-global.
- Desktop package root follows the running `DSH Desktop.exe` (default or custom install folder).

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
- **#15:** If there is text but it never reaches the model, 0.1.5 `complete:true` was dropping every section after assemble; `#41` folds inject back into the complete prompt.
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
