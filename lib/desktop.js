import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launchOfficialDesktopUpdate, pendingOfficialUpdate } from "./official-update.js";

/** 路径落在 `app.asar/...` 里面。`app.asar` 文件本身和 `app.asar.unpacked` 不算。 */
export function isAsarSealedPath(p) {
  const parts = String(p || "").replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length < 2) return false;
  return parts.slice(0, -1).some((seg) => {
    const s = seg.toLowerCase();
    return s.endsWith(".asar") && !s.endsWith(".asar.unpacked");
  });
}

function isFile(fp) {
  try {
    if (isAsarSealedPath(fp)) return false;
    return Boolean(fp) && fs.existsSync(fp) && fs.statSync(fp).isFile();
  } catch {
    return false;
  }
}

function isDir(fp) {
  try {
    if (isAsarSealedPath(fp)) return false;
    return Boolean(fp) && fs.existsSync(fp) && fs.statSync(fp).isDirectory();
  } catch {
    return false;
  }
}

function isAiBase(p) {
  return Boolean(p) && isDir(path.join(p, "dsh-agent-instructions", "lib"));
}

function uniquePaths(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item) continue;
    const n = path.normalize(item);
    const key = n.replace(/\\/g, "/").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function slashNorm(p) {
  return path.normalize(String(p || "")).replace(/\\/g, "/").toLowerCase();
}

function isSubPath(child, root) {
  const c = slashNorm(child).replace(/\/+$/, "");
  const r = slashNorm(root).replace(/\/+$/, "");
  if (!c || !r || r === "/") return false;
  if (/^[a-z]:$/.test(r)) return false;
  return c === r || c.startsWith(`${r}/`);
}

/** 文件夹名带 DSH Desktop / dsh-desktop 时，任意盘符都算桌面安装树。 */
export function looksLikeDesktopName(p) {
  const n = slashNorm(p);
  if (!n) return false;
  return (
    n.includes("/dsh desktop/") ||
    n.includes("/dsh desktop.app/") ||
    n.endsWith("/dsh desktop") ||
    n.endsWith("/dsh desktop.app") ||
    n.includes("dsh-desktop") ||
    n.includes("/deepseek harness/") ||
    n.includes("/deepseek harness.app/") ||
    n.endsWith("/deepseek harness") ||
    n.includes("deepseek-harness") ||
    /\/dsh desktop\.exe$/i.test(n) ||
    /\/deepseek harness\.exe$/i.test(n)
  );
}

export function isDesktopExecutable(fp) {
  const base = path.basename(String(fp || "")).toLowerCase();
  return (
    base === "dsh desktop.exe" ||
    base === "dsh desktop" ||
    base === "deepseek harness.exe" ||
    base === "deepseek-harness.exe"
  );
}

/** 只有官方 DeepSeek Harness 会把宿主封进 app.asar 并在「应用」时解开。第三方 DSH Desktop 不走这条。 */
export function isOfficialHarnessExecutable(fp) {
  const base = path.basename(String(fp || "")).toLowerCase();
  return base === "deepseek harness.exe" || base === "deepseek-harness.exe";
}

function exeCandidatesBeside(dir) {
  if (!dir) return [];
  return [
    path.join(dir, "DeepSeek Harness.exe"),
    path.join(dir, "deepseek-harness.exe"),
    path.join(dir, "DSH Desktop.exe"),
    path.join(dir, "DSH Desktop"),
    path.join(dir, "MacOS", "DSH Desktop"),
    path.join(dir, "MacOS", "DeepSeek Harness"),
    path.join(dir, "Contents", "MacOS", "DSH Desktop"),
    path.join(dir, "Contents", "MacOS", "DeepSeek Harness"),
  ];
}

function firstExistingExe(dirs) {
  for (const dir of dirs) {
    if (!dir) continue;
    for (const cand of exeCandidatesBeside(dir)) {
      if (isFile(cand)) return path.normalize(cand);
    }
  }
  return "";
}

const APP_SCRIPT_RE = /(desktop-cli|host-process-entry)\.js$/i;

function installDirsFromAppScript(scriptPath) {
  if (!scriptPath) return [];
  const abs = path.resolve(scriptPath);
  const lib = path.dirname(abs);
  const app = path.dirname(lib);
  const resources = path.dirname(app);
  const install = path.dirname(resources);
  return uniquePaths([lib, app, resources, install]);
}

/** 从任意 `.../resources/app/...` 树反推安装目录（不要求文件夹叫 DSH Desktop）。 */
export function inferDesktopInstallDir(p) {
  const raw = path.normalize(String(p || "")).replace(/\\/g, "/");
  const n = raw.toLowerCase();
  if (!n) return "";
  const markers = [
    "/resources/app.asar.unpacked/",
    "/resources/app/",
    "/contents/resources/",
  ];
  for (const marker of markers) {
    const i = n.indexOf(marker);
    if (i <= 0) continue;
    return path.normalize(raw.slice(0, i));
  }
  return "";
}

function extraInstallsFromEnv(env = process.env) {
  return String(env.DSH_DESKTOP_INSTALL || "")
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function trustedInstallDir(dir) {
  if (!dir) return false;
  if (looksLikeDesktopName(dir)) return true;
  if (firstExistingExe([dir])) return true;
  return (
    isAiBase(path.join(dir, "resources", "app", "dsh", "node_modules", "@deepseek-ai")) ||
    isAiBase(path.join(dir, "resources", "app", "node_modules", "@deepseek-ai")) ||
    isAiBase(path.join(dir, "resources", "app.asar.unpacked", "dsh", "node_modules", "@deepseek-ai")) ||
    isAiBase(path.join(dir, "resources", "app.asar.unpacked", "node_modules", "@deepseek-ai"))
  );
}

const REGISTRY_INSTALL_SCRIPT = `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$names = @('DeepSeek Harness','DSH Desktop')
$roots = @(
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
)
$rows = foreach ($root in $roots) {
  if (-not (Test-Path $root)) { continue }
  Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
    $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
    if (-not $p.DisplayName) { return }
    $hit = $false
    foreach ($n in $names) { if ($p.DisplayName -like ('*' + $n + '*')) { $hit = $true } }
    if (-not $hit) { return }
    [pscustomobject]@{
      InstallLocation = [string]$p.InstallLocation
      DisplayIcon = [string]$p.DisplayIcon
      UninstallString = [string]$p.UninstallString
    }
  }
}
if ($rows) { @($rows) | ConvertTo-Json -Compress }
`.trim();

function exeDirFromRegistryValue(value) {
  let val = String(value || "").trim();
  const quoted = val.match(/^"([^"]+)"/);
  if (quoted) val = quoted[1];
  val = val.replace(/,0$/, "").trim();
  if (!val) return "";
  return path.normalize(path.dirname(val));
}

let cachedRegistryDirs;
/** 从卸载登记读安装目录。盘符跟着用户安装位置，不写死。 */
export function registryInstallDirs() {
  if (cachedRegistryDirs) return cachedRegistryDirs;
  if (process.platform !== "win32") {
    cachedRegistryDirs = [];
    return cachedRegistryDirs;
  }
  let text = "";
  try {
    text = execFileSync("powershell.exe", ["-NoProfile", "-Command", REGISTRY_INSTALL_SCRIPT], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15000,
    });
  } catch {
    cachedRegistryDirs = [];
    return cachedRegistryDirs;
  }
  let rows = [];
  try {
    const parsed = JSON.parse(String(text || "").replace(/^\uFEFF/, "").trim() || "[]");
    rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch {
    rows = [];
  }
  const found = [];
  for (const row of rows) {
    const location = String(row.InstallLocation || "").trim();
    if (location) found.push(path.normalize(location));
    found.push(exeDirFromRegistryValue(row.DisplayIcon));
    found.push(exeDirFromRegistryValue(row.UninstallString));
  }
  cachedRegistryDirs = uniquePaths(found).filter((dir) => firstExistingExe([dir]));
  return cachedRegistryDirs;
}

/** NSIS / 商店默认位置；不是全盘扫描。自定义目录靠当前进程、卸载登记或 DSH_DESKTOP_INSTALL。 */
export function commonDesktopInstallDirs(env = process.env) {
  const home = os.homedir();
  const local = env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const pf = env.ProgramFiles || "";
  const pf86 = env["ProgramFiles(x86)"] || "";
  return uniquePaths([
    ...extraInstallsFromEnv(env).filter(trustedInstallDir),
    ...registryInstallDirs(),
    path.join(local, "Programs", "DeepSeek Harness"),
    path.join(local, "Programs", "DSH Desktop"),
    path.join(local, "DeepSeek Harness"),
    ...(pf
      ? [path.join(pf, "DeepSeek Harness"), path.join(pf, "DSH Desktop")]
      : []),
    ...(pf86
      ? [path.join(pf86, "DeepSeek Harness"), path.join(pf86, "DSH Desktop")]
      : []),
    "/Applications/DeepSeek Harness.app",
    "/Applications/DSH Desktop.app",
    path.join(home, "Applications", "DeepSeek Harness.app"),
    path.join(home, "Applications", "DSH Desktop.app"),
  ]);
}

export function listDesktopInstallRoots(input = {}) {
  const execPath = input.execPath ?? process.execPath;
  const resourcesPath = input.resourcesPath ?? process.resourcesPath;
  const argv = input.argv ?? process.argv;
  const env = input.env ?? process.env;
  const roots = [];

  if (isDesktopExecutable(execPath)) {
    const dir = path.dirname(path.normalize(execPath));
    roots.push(dir);
    if (path.basename(dir) === "MacOS") {
      const contents = path.dirname(dir);
      roots.push(contents, path.join(contents, "Resources"), path.dirname(contents));
    }
  }

  if (resourcesPath) {
    const res = path.normalize(resourcesPath);
    roots.push(res, path.dirname(res), path.join(res, "app"), path.join(res, "app.asar.unpacked"));
  }

  for (const arg of argv) {
    if (typeof arg === "string" && APP_SCRIPT_RE.test(arg)) {
      roots.push(...installDirsFromAppScript(arg));
    }
  }

  for (const extra of extraInstallsFromEnv(env)) {
    if (trustedInstallDir(extra)) roots.push(extra);
  }
  return uniquePaths(roots);
}

/**
 * 是否落在社区 Desktop 安装树。
 * 不依赖盘符、也不要求文件夹叫 “DSH Desktop”：
 * 当前进程的 exe / resources / host-process-entry、旁边真有 DSH Desktop.exe、或名字启发式。
 */
export function isInsideDesktopInstall(p, input = {}) {
  if (!p) return false;
  if (looksLikeDesktopName(p)) return true;
  const roots = listDesktopInstallRoots(input);
  if (roots.some((root) => isSubPath(p, root))) return true;
  const inferred = inferDesktopInstallDir(p);
  if (!inferred) return false;
  if (roots.some((root) => isSubPath(inferred, root) || isSubPath(root, inferred))) return true;
  return Boolean(firstExistingExe([inferred]));
}

export function findDesktopAppExecutable(input = {}) {
  const execPath = input.execPath ?? process.execPath;
  const resourcesPath = input.resourcesPath ?? process.resourcesPath;
  const argv = input.argv ?? process.argv;
  const env = input.env ?? process.env;

  if (isDesktopExecutable(execPath) && isFile(execPath)) return path.normalize(execPath);

  if (resourcesPath) {
    const hit = firstExistingExe([path.dirname(path.normalize(resourcesPath))]);
    if (hit) return hit;
  }

  for (const arg of argv) {
    if (typeof arg !== "string" || !APP_SCRIPT_RE.test(arg)) continue;
    const hit = firstExistingExe(installDirsFromAppScript(arg));
    if (hit) return hit;
  }

  const guessed = firstExistingExe([
    ...extraInstallsFromEnv(env),
    ...commonDesktopInstallDirs(env),
  ]);
  return guessed || "";
}

function packageRootsFromInstall(installDir) {
  if (!installDir) return [];
  const bases = [installDir];
  const name = path.basename(installDir);
  if (name === "MacOS") bases.push(path.join(path.dirname(installDir), "Resources"));
  if (name === "Contents") bases.push(path.join(installDir, "Resources"));
  if (name.toLowerCase().endsWith(".app")) bases.push(path.join(installDir, "Contents", "Resources"));
  const out = [];
  for (const base of bases) {
    out.push(
      path.join(base, "resources", "app", "dsh", "node_modules", "@deepseek-ai"),
      path.join(base, "resources", "app", "node_modules", "@deepseek-ai"),
      path.join(base, "resources", "app.asar.unpacked", "dsh", "node_modules", "@deepseek-ai"),
      path.join(base, "resources", "app.asar.unpacked", "node_modules", "@deepseek-ai"),
      path.join(base, "app", "dsh", "node_modules", "@deepseek-ai"),
      path.join(base, "app", "node_modules", "@deepseek-ai"),
      path.join(base, "app.asar.unpacked", "dsh", "node_modules", "@deepseek-ai"),
      path.join(base, "app.asar.unpacked", "node_modules", "@deepseek-ai"),
    );
  }
  return out;
}

export function listDesktopPackageRoots(input = {}) {
  const execPath = input.execPath ?? process.execPath;
  const resourcesPath = input.resourcesPath ?? process.resourcesPath;
  const argv = input.argv ?? process.argv;
  const env = input.env ?? process.env;
  const cands = [];

  if (resourcesPath) {
    cands.push(
      path.join(resourcesPath, "app", "dsh", "node_modules", "@deepseek-ai"),
      path.join(resourcesPath, "app", "node_modules", "@deepseek-ai"),
      path.join(resourcesPath, "app.asar.unpacked", "dsh", "node_modules", "@deepseek-ai"),
      path.join(resourcesPath, "app.asar.unpacked", "node_modules", "@deepseek-ai"),
    );
  }

  if (isDesktopExecutable(execPath)) {
    cands.push(...packageRootsFromInstall(path.dirname(execPath)));
  }

  const exe = findDesktopAppExecutable(input);
  if (exe) cands.push(...packageRootsFromInstall(path.dirname(exe)));

  for (const arg of argv) {
    if (typeof arg !== "string" || !APP_SCRIPT_RE.test(arg)) continue;
    const appDir = path.dirname(path.dirname(path.resolve(arg)));
    cands.push(path.join(appDir, "node_modules", "@deepseek-ai"));
    cands.push(path.join(appDir, "dsh", "node_modules", "@deepseek-ai"));
    cands.push(...packageRootsFromInstall(path.dirname(path.dirname(appDir))));
  }

  const localHits = uniquePaths(cands).filter(isAiBase);
  // 已经在某个桌面 exe 里时，只改这一份。旁边装了另一种客户端也不能被带上。
  if (isDesktopExecutable(execPath)) return localHits;

  for (const install of commonDesktopInstallDirs(env)) {
    cands.push(...packageRootsFromInstall(install));
  }

  return uniquePaths(cands).filter(isAiBase);
}

export function resolveDesktopAiBase(input = {}) {
  return listDesktopPackageRoots(input)[0] || null;
}

export function resolveDesktopCliScript(input = {}) {
  const exe = findDesktopAppExecutable(input);
  if (exe) {
    const install = path.dirname(exe);
    const packed = path.join(install, "resources", "app", "lib", "desktop-cli.js");
    if (isFile(packed)) return path.normalize(packed);
    const unpacked = path.join(install, "resources", "app.asar.unpacked", "lib", "desktop-cli.js");
    if (isFile(unpacked)) return path.normalize(unpacked);
    if (path.basename(install) === "MacOS") {
      const macPacked = path.join(path.dirname(install), "Resources", "app", "lib", "desktop-cli.js");
      if (isFile(macPacked)) return path.normalize(macPacked);
    }
  }
  for (const arg of input.argv ?? process.argv) {
    if (typeof arg === "string" && /desktop-cli\.js$/i.test(arg) && isFile(arg)) {
      return path.normalize(path.resolve(arg));
    }
  }
  return "";
}

export function cliInvocation(input = {}) {
  const exe = findDesktopAppExecutable(input);
  const cli = resolveDesktopCliScript(input);
  if (!exe || !cli) return null;
  return {
    execPath: exe,
    argvPrefix: ["--expose-internals", cli],
    env: {
      ELECTRON_RUN_AS_NODE: "1",
      DSH_DESKTOP_DEFAULT_PROFILE: "desktop",
    },
  };
}

export function isSealedRuntimeDir(dir) {
  if (!dir) return false;
  const n = path.normalize(dir).replace(/\\/g, "/").toLowerCase();
  if (!/(^|\/)bin\/?$/.test(n)) return false;
  return (
    n.includes("/host-commands/") ||
    n.includes("/runtime-commands/") ||
    n.includes("/dsh desktop/")
  );
}

export function sealedRuntimeRoots(env = process.env) {
  const home = os.homedir();
  const appdata = env.APPDATA || path.join(home, "AppData", "Roaming");
  const localapp = env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  return uniquePaths([
    path.join(appdata, "DSH Desktop", "host-commands"),
    path.join(appdata, "DSH Desktop", "runtime-commands"),
    path.join(localapp, "DSH Desktop", "host-commands"),
    path.join(localapp, "DSH Desktop", "runtime-commands"),
    path.join(home, "Library", "Application Support", "DSH Desktop", "host-commands"),
  ]);
}

function walkBinDirs(dir, out, depth) {
  if (depth < 0 || !isDir(dir)) return;
  const n = dir.replace(/\\/g, "/").toLowerCase();
  if (/(^|\/)bin$/.test(n)) {
    out.push(path.normalize(dir));
    return;
  }
  let ents = [];
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of ents) {
    if (ent.isDirectory()) walkBinDirs(path.join(dir, ent.name), out, depth - 1);
  }
}

export function listSealedRuntimeBins(env = process.env) {
  const out = [];
  for (const root of sealedRuntimeRoots(env)) walkBinDirs(root, out, 5);
  return uniquePaths(out).filter(isSealedRuntimeDir);
}

export function restartNote() {
  return "正在重启桌面应用…";
}

export function restartPlan(input = {}) {
  const exe = findDesktopAppExecutable(input);
  if (!exe) {
    return { kind: "desktop", execPath: "", argv: [], cwd: "", error: "未找到 DSH Desktop.exe，无法重启桌面应用" };
  }
  return {
    kind: "desktop",
    execPath: exe,
    argv: [],
    cwd: path.dirname(exe),
  };
}

function helperEnv(payload) {
  const env = { ...process.env };
  delete env.DSH_PERMISSION_MODE;
  env.ELECTRON_RUN_AS_NODE = "1";
  env.DSH_PURGE_RESTART = JSON.stringify(payload);
  return env;
}

function spawnHelper(helper, payload, opts = {}) {
  const plan = restartPlan();
  if (!plan.execPath) throw new Error(plan.error || "未找到 DSH Desktop.exe，无法重启桌面应用");
  const child = spawn(process.execPath, [helper], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
    env: helperEnv({
      kind: "desktop",
      execPath: plan.execPath,
      argv: plan.argv,
      cwd: plan.cwd,
      pid: process.pid,
      ...payload,
    }),
  });
  child.unref();
  if (opts.exit !== false) setTimeout(() => process.exit(0), opts.exitAfter ?? 250);
}

function desktopRuntimeOf(ctx) {
  if (!ctx || typeof ctx.get !== "function") return null;
  const runtime = ctx.get("desktopRuntime") || ctx.get("desktopActions");
  return runtime && typeof runtime.requestRestart === "function" ? runtime : null;
}

const ASAR_SWAP_PS1 = [
  "param(",
  "  [Parameter(Mandatory = $true)][int]$WaitPid,",
  "  [Parameter(Mandatory = $true)][string]$AsarPath,",
  "  [Parameter(Mandatory = $true)][string]$ExePath",
  ")",
  "$ErrorActionPreference = 'Continue'",
  "$names = @('DeepSeek Harness', 'DSH Desktop')",
  "$deadline = (Get-Date).AddSeconds(90)",
  "while ((Get-Date) -lt $deadline) {",
  "  $self = Get-Process -Id $WaitPid -ErrorAction SilentlyContinue",
  "  $holding = @(Get-Process -Name $names -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $ExePath })",
  "  if (-not $self -and $holding.Count -eq 0) { break }",
  "  Start-Sleep -Milliseconds 300",
  "}",
  "Get-Process -Name $names -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $ExePath } | Stop-Process -Force -ErrorAction SilentlyContinue",
  "Start-Sleep -Seconds 1",
  "$appDir = Join-Path (Split-Path -Parent $AsarPath) 'app'",
  "$unpacked = $AsarPath + '.unpacked'",
  "$marker = Join-Path $appDir 'dsh\\node_modules\\node-addon-require-builtin-win32-x64-msvc\\prebuilt\\win32-x64-msvc-napi-v9.node'",
  "if ((Test-Path -LiteralPath $unpacked) -and -not (Test-Path -LiteralPath $marker)) {",
  "  & robocopy.exe $unpacked $appDir /E /XC /XN /XO /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null",
  "}",
  "if (Test-Path -LiteralPath $AsarPath) {",
  "  $bak = \"$AsarPath.bak\"",
  "  if (Test-Path -LiteralPath $bak) { Remove-Item -LiteralPath $bak -Force -ErrorAction SilentlyContinue }",
  "  $moved = $false",
  "  for ($i = 0; $i -lt 30; $i++) {",
  "    try {",
  "      Move-Item -LiteralPath $AsarPath -Destination $bak -Force",
  "      $moved = $true",
  "      break",
  "    } catch {",
  "      Start-Sleep -Milliseconds 400",
  "    }",
  "  }",
  "  if (-not $moved) { throw \"could not rename app.asar\" }",
  "}",
  "Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue",
  "Start-Process -FilePath $ExePath",
  "",
].join("\r\n");

const ASAR_RENAME_WHEN_IDLE_PS1 = [
  "param(",
  "  [Parameter(Mandatory = $true)][string]$AsarPath,",
  "  [Parameter(Mandatory = $true)][string]$ExePath,",
  "  [Parameter(Mandatory = $true)][string]$LockPath",
  ")",
  "$ErrorActionPreference = 'Continue'",
  "$deadline = (Get-Date).AddMinutes(30)",
  "while ((Get-Date) -lt $deadline) {",
  "  if (Test-Path -LiteralPath (Join-Path $env:TEMP 'dsh-purge-official-restarting')) { exit 0 }",
  "  $holding = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { try { $_.Path -eq $ExePath } catch { $false } })",
  "  if ($holding.Count -gt 0) { Start-Sleep -Milliseconds 500; continue }",
  "  if (-not (Test-Path -LiteralPath $AsarPath)) {",
  "    Remove-Item -LiteralPath $LockPath -Force -ErrorAction SilentlyContinue",
  "    exit 0",
  "  }",
  "  $appDir = Join-Path (Split-Path -Parent $AsarPath) 'app'",
  "  $unpacked = $AsarPath + '.unpacked'",
  "  $marker = Join-Path $appDir 'dsh\\node_modules\\node-addon-require-builtin-win32-x64-msvc\\prebuilt\\win32-x64-msvc-napi-v9.node'",
  "  if ((Test-Path -LiteralPath $unpacked) -and -not (Test-Path -LiteralPath $marker)) {",
  "    & robocopy.exe $unpacked $appDir /E /XC /XN /XO /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null",
  "  }",
  "  $bak = \"$AsarPath.bak\"",
  "  if (Test-Path -LiteralPath $bak) { Remove-Item -LiteralPath $bak -Force -ErrorAction SilentlyContinue }",
  "  try {",
  "    Move-Item -LiteralPath $AsarPath -Destination $bak -Force -ErrorAction Stop",
  "  } catch {",
  "    Start-Sleep -Milliseconds 400",
  "    continue",
  "  }",
  "  Remove-Item -LiteralPath $LockPath -Force -ErrorAction SilentlyContinue",
  "  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue",
  "  Start-Process -FilePath $ExePath",
  "  exit 0",
  "}",
  "Remove-Item -LiteralPath $LockPath -Force -ErrorAction SilentlyContinue",
  "",
].join("\r\n");

/** 官方壳开着时 app.asar 被占用。不结束进程，等用户退出后再改名并重新打开。 */
export function scheduleAsarRenameWhenIdle({ exe, asar } = {}) {
  if (!exe || !asar) return { pending: false };
  const lock = `${asar}.rename-pending`;
  try {
    const age = Date.now() - fs.statSync(lock).mtimeMs;
    if (age >= 0 && age < 30 * 60 * 1000) return { pending: true, already: true };
  } catch {
    // 没有待处理标记，下面新建。
  }
  fs.writeFileSync(lock, `${Date.now()}\n`, "utf8");
  const script = path.join(os.tmpdir(), "dsh-purge-asar-rename-when-idle.ps1");
  fs.writeFileSync(script, ASAR_RENAME_WHEN_IDLE_PS1, "utf8");
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-AsarPath",
      asar,
      "-ExePath",
      exe,
      "-LockPath",
      lock,
    ],
    { detached: true, stdio: "ignore", windowsHide: true, shell: false },
  );
  child.unref();
  return { pending: true };
}

/** 等当前桌面进程退出后把 app.asar 挪走，再启动 exe。解开后的 resources\\app 才会被加载。 */
export function scheduleAsarSwapRestart({ exe, asar, waitPid = process.pid, exit = false } = {}) {
  if (!exe || !asar) throw new Error("缺少桌面 exe 或 app.asar，无法重启");
  const script = path.join(os.tmpdir(), `dsh-purge-asar-swap-${process.pid}.ps1`);
  fs.writeFileSync(script, ASAR_SWAP_PS1, "utf8");
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-WaitPid",
      String(waitPid),
      "-AsarPath",
      asar,
      "-ExePath",
      exe,
    ],
    { detached: true, stdio: "ignore", windowsHide: true, shell: false },
  );
  child.unref();
  if (exit !== false) setTimeout(() => process.exit(0), 800);
  return { scheduled: true };
}

function officialExeFromProcess() {
  if (isOfficialHarnessExecutable(process.execPath)) return path.normalize(process.execPath);
  const resources = process.resourcesPath;
  if (!resources) return "";
  const beside = path.join(path.dirname(resources), "DeepSeek Harness.exe");
  return fs.existsSync(beside) ? beside : "";
}

export function scheduleRestart(request, ctx) {
  if (officialExeFromProcess()) return restartOfficialHarness();
  const runtime = desktopRuntimeOf(ctx);
  if (runtime) {
    // 只走桌面整应用 relaunch，不要 exit Host（那会先把内嵌 web 单独拉起来）。
    Promise.resolve(runtime.requestRestart()).catch((err) => {
      console.warn("[dsh-purge] desktop requestRestart failed:", err);
    });
    return;
  }
  const helper = fileURLToPath(new URL("./restart-desktop.js", import.meta.url));
  spawnHelper(helper, { respawn: true, killApp: true }, { exit: false });
}

function jsString(value) {
  return JSON.stringify(String(value || ""));
}

function officialRestartScript(exe, asar) {
  const log = path.join(os.tmpdir(), "dsh-purge-official-restart.log");
  return [
    "var exe = " + jsString(exe) + ";",
    "var asar = " + jsString(asar) + ";",
    "var logPath = " + jsString(log) + ";",
    "var fso = new ActiveXObject('Scripting.FileSystemObject');",
    "var sh = new ActiveXObject('WScript.Shell');",
    "var wmi = GetObject('winmgmts:\\\\\\\\.\\\\root\\\\cimv2');",
    "function z(n) { return (n < 10 ? '0' : '') + n; }",
    "function stamp() { var d = new Date(); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()); }",
    "function log(m) { var f = fso.OpenTextFile(logPath, 8, true); f.WriteLine(stamp() + ' ' + m); f.Close(); }",
    "function samePath(a, b) { return String(a || '').replace(/\\//g, '\\\\').toLowerCase() === String(b || '').replace(/\\//g, '\\\\').toLowerCase(); }",
    "function pids() { var out = []; var e = new Enumerator(wmi.ExecQuery(\"SELECT ProcessId, ExecutablePath FROM Win32_Process WHERE Name = 'DeepSeek Harness.exe'\")); for (; !e.atEnd(); e.moveNext()) { var p = e.item(); if (samePath(p.ExecutablePath, exe)) out.push(p.ProcessId); } return out; }",
    "log('begin');",
    "WScript.Sleep(800);",
    "var list = pids();",
    "log('pids ' + list.join(','));",
    "for (var i = 0; i < list.length; i++) sh.Run('taskkill.exe /F /PID ' + list[i], 0, true);",
    "var deadline = new Date().getTime() + 20000;",
    "var left = list;",
    "while (new Date().getTime() < deadline) { left = pids(); if (left.length === 0) break; WScript.Sleep(200); }",
    "log('left ' + left.length);",
    "var unpacked = asar + '.unpacked';",
    "var appDir = asar.replace(/app\\.asar$/i, 'app');",
    "var marker = appDir + '\\\\dsh\\\\node_modules\\\\node-addon-require-builtin-win32-x64-msvc\\\\prebuilt\\\\win32-x64-msvc-napi-v9.node';",
    "if (fso.FolderExists(unpacked) && !fso.FileExists(marker)) { sh.Run('robocopy.exe \"' + unpacked + '\" \"' + appDir + '\" /E /XC /XN /XO /NFL /NDL /NJH /NJS /nc /ns /np', 0, true); log('overlay'); }",
    "if (fso.FileExists(asar)) { var bak = asar + '.bak'; if (fso.FileExists(bak)) fso.DeleteFile(bak, true); for (var n = 0; n < 40; n++) { try { fso.MoveFile(asar, bak); log('renamed'); break; } catch (err) { log(err && err.message ? err.message : String(err)); WScript.Sleep(250); } } }",
    "try { sh.Environment('PROCESS').Remove('ELECTRON_RUN_AS_NODE'); } catch (ignore) {}",
    "sh.Run('\"' + exe + '\"', 1, false);",
    "log('started');",
    "",
  ].join("\r\n");
}

/** 点「重启」后结束当前官方客户端，挪开被占用的 app.asar，再自己打开。 */
export function restartOfficialHarness() {
  const exe = officialExeFromProcess();
  if (!exe) return { restarting: false };
  const pending = pendingOfficialUpdate(exe);
  if (pending) return launchOfficialDesktopUpdate(exe, pending);
  const asar = path.join(path.dirname(exe), "resources", "app.asar");
  const script = path.join(os.tmpdir(), "dsh-purge-official-restart.js");
  const launcher = path.join(os.tmpdir(), "dsh-purge-official-restart.cmd");
  fs.writeFileSync(script, officialRestartScript(exe, asar), "utf8");
  fs.writeFileSync(launcher, `@echo off\r\nstart "" wscript.exe //nologo //B "${script}"\r\n`, "utf8");
  const child = spawn("cmd.exe", ["/d", "/c", launcher], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
  });
  child.unref();
  return { restarting: true };
}

export function scheduleCleanupRestart({ cleanup = [], ctx } = {}) {
  const src = fileURLToPath(new URL("./restart-desktop.js", import.meta.url));
  const dest = path.join(os.tmpdir(), `dsh-purge-uninst-${process.pid}.mjs`);
  fs.copyFileSync(src, dest);
  const runtime = desktopRuntimeOf(ctx);
  if (runtime) {
    spawnHelper(dest, { cleanup, helper: dest, respawn: false }, { exit: false });
    Promise.resolve(runtime.requestRestart()).catch((err) => {
      console.warn("[dsh-purge] desktop uninstall restart failed:", err);
    });
    return;
  }
  spawnHelper(dest, { cleanup, helper: dest, respawn: true, killApp: true }, { exit: false });
}
