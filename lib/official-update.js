// 官方桌面已下载新版本时，重启改去跑安装包，装完再解开并重新打补丁。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readAsarFile } from "./extract-asar.js";

const CACHE_DIR_NAME = "@deepseek-aidsh-desktop-updater";
const MARKER_NAME = "dsh-purge-reapply-asar";
const TEMPLATE_PATH = fileURLToPath(new URL("./official-update.wscript", import.meta.url));

function harnessExeName(exe) {
  const base = path.basename(String(exe || "")).toLowerCase();
  return base === "deepseek harness.exe" || base === "deepseek-harness.exe";
}

function updaterCacheDir() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(local, CACHE_DIR_NAME);
}

export function versionFromInstallerName(fileName) {
  const match = /^deepseek-harness-(.+)-win-x64\.exe$/i.exec(path.basename(String(fileName || "")));
  return match ? match[1] : "";
}

function parseSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(String(version || ""));
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ? match[4].split(".") : null,
  };
}

function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return 0;
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (!a.pre && !b.pre) return 0;
  if (!a.pre) return 1;
  if (!b.pre) return -1;
  const count = Math.max(a.pre.length, b.pre.length);
  for (let i = 0; i < count; i += 1) {
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    const aNum = /^\d+$/.test(a.pre[i]);
    const bNum = /^\d+$/.test(b.pre[i]);
    if (aNum && bNum) {
      const diff = Number(a.pre[i]) - Number(b.pre[i]);
      if (diff) return diff;
    } else if (aNum) return -1;
    else if (bNum) return 1;
    else if (a.pre[i] !== b.pre[i]) return a.pre[i] < b.pre[i] ? -1 : 1;
  }
  return 0;
}

function readPackageVersion(text) {
  try {
    return String(JSON.parse(String(text || "")).version || "");
  } catch {
    return "";
  }
}

function readInstalledVersion(exe) {
  const root = path.dirname(exe);
  try {
    const packed = readAsarFile(path.join(root, "resources", "app.asar"), "package.json");
    const version = readPackageVersion(packed);
    if (version) return version;
  } catch {
    // 归档不在或还被外壳占着时，改看解开目录。
  }
  try {
    return readPackageVersion(fs.readFileSync(path.join(root, "resources", "app", "package.json"), "utf8"));
  } catch {
    return "";
  }
}

/** 官方更新器已经下好、且比当前 exe 新的安装包。没有则返回 null。 */
export function pendingOfficialUpdate(exe) {
  if (process.platform !== "win32" || !harnessExeName(exe)) return null;
  const cache = updaterCacheDir();
  let installer = path.join(cache, "installer.exe");
  let fileName = "installer.exe";
  try {
    const info = JSON.parse(fs.readFileSync(path.join(cache, "pending", "update-info.json"), "utf8"));
    const pendingName = String(info.fileName || "");
    const pending = path.join(cache, "pending", pendingName);
    if (pendingName && fs.existsSync(pending)) {
      installer = pending;
      fileName = pendingName;
    }
  } catch {
    // 没有 update-info 时只认已经复制出来的 installer.exe。
  }
  if (!fs.existsSync(installer)) return null;
  const version = versionFromInstallerName(fileName);
  const installed = readInstalledVersion(exe);
  if (version && installed && compareSemver(version, installed) <= 0) return null;
  if (!installed) {
    try {
      const exeTime = fs.statSync(exe).mtimeMs;
      const installerTime = fs.statSync(installer).mtimeMs;
      if (exeTime > installerTime + 2000) return null;
    } catch {
      return null;
    }
  }
  return { installer, version, installed };
}

export function upgradeMarkerPath(exe) {
  if (!harnessExeName(exe)) return "";
  return path.join(path.dirname(exe), "resources", MARKER_NAME);
}

export function upgradeMarkerExists(exe) {
  const marker = upgradeMarkerPath(exe);
  return Boolean(marker && fs.existsSync(marker));
}

export function clearUpgradeMarker(exe) {
  const marker = upgradeMarkerPath(exe);
  if (!marker) return;
  try { fs.rmSync(marker, { force: true }); } catch { /* 下次启动再试 */ }
}

export function clearStaleExtractedApps(exe) {
  if (!harnessExeName(exe)) return;
  const resources = path.join(path.dirname(exe), "resources");
  let names = [];
  try { names = fs.readdirSync(resources); } catch { return; }
  for (const name of names) {
    if (!name.startsWith("app.dshpurge-prev")) continue;
    try { fs.rmSync(path.join(resources, name), { recursive: true, force: true }); } catch { /* 旧目录删不掉不影响新版本 */ }
  }
}

function winPath(value) {
  return path.win32.normalize(String(value || ""));
}

function renderUpdateScript(exe, installer) {
  const installDir = winPath(path.dirname(exe));
  const resources = winPath(path.join(installDir, "resources"));
  const logPath = winPath(path.join(os.tmpdir(), "dsh-purge-official-update.log"));
  return fs.readFileSync(TEMPLATE_PATH, "utf8")
    .split("__EXE_JSON__").join(JSON.stringify(winPath(exe)))
    .split("__INSTALLER_JSON__").join(JSON.stringify(winPath(installer)))
    .split("__RESOURCES_JSON__").join(JSON.stringify(resources))
    .split("__INSTALL_DIR_JSON__").join(JSON.stringify(installDir))
    .split("__LOG_JSON__").join(JSON.stringify(logPath));
}

/** 退出官方客户端后运行已下载的安装包，再打开新版本。不把新的 app.asar 挪走。 */
export function launchOfficialDesktopUpdate(exe, pending) {
  const installer = pending?.installer;
  if (!exe || !installer) return { restarting: false };
  const script = path.join(os.tmpdir(), "dsh-purge-official-update.js");
  const launcher = path.join(os.tmpdir(), "dsh-purge-official-update.cmd");
  fs.writeFileSync(script, renderUpdateScript(exe, installer), "utf8");
  fs.writeFileSync(launcher, `@echo off\r\nstart "" wscript.exe //nologo //B "${script}"\r\n`, "utf8");
  const child = spawn("cmd.exe", ["/d", "/c", launcher], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
  });
  child.unref();
  return { restarting: true, officialUpdate: true, installer };
}
