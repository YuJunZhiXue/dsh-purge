import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";

const encoded = process.env.DSH_PURGE_RESTART;
if (!encoded) process.exit(1);

let info;
try {
  info = JSON.parse(encoded);
} catch {
  process.exit(1);
}

const cleanup = Array.isArray(info.cleanup) ? info.cleanup : [];

function spawnEnv() {
  const env = { ...process.env };
  delete env.DSH_PERMISSION_MODE;
  delete env.DSH_PURGE_RESTART;
  for (const key of Object.keys(env)) {
    if (key.toUpperCase() === "ELECTRON_RUN_AS_NODE") delete env[key];
  }
  return env;
}

function pidAlive(pid) {
  const n = Number(pid);
  if (!n) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitPidGone(pid) {
  if (!pid) {
    await new Promise((r) => setTimeout(r, 400));
    return true;
  }
  for (let i = 0; i < 80; i++) {
    if (!pidAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 120));
  }
  return !pidAlive(pid);
}

function rmTree(dir) {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 120 });
  } catch {
    // 锁着就留下
  }
}

function listDesktopPids() {
  if (process.platform !== "win32") return [];
  try {
    const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq DSH Desktop.exe", "/FO", "CSV", "/NH"], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 8000,
    });
    const pids = [];
    for (const line of String(out || "").split(/\r?\n/)) {
      const cols = line.split(",");
      const pid = Number(String(cols[1] || "").replace(/"/g, "").trim());
      if (pid) pids.push(pid);
    }
    return pids;
  } catch {
    return [];
  }
}

function killOtherDesktopProcesses(keepPid) {
  for (const pid of listDesktopPids()) {
    if (pid === keepPid || pid === process.pid) continue;
    try {
      process.kill(pid);
    } catch {
      // 已经退了
    }
  }
}

if (info.killApp) {
  await new Promise((r) => setTimeout(r, 400));
  for (const dir of cleanup) rmTree(dir);
  if (info.helper) {
    try { fs.unlinkSync(info.helper); } catch { /* ignore */ }
  }
  killOtherDesktopProcesses(process.pid);
  await new Promise((r) => setTimeout(r, 500));
} else {
  const gone = await waitPidGone(info.pid);
  if (!gone) process.exit(1);
  for (const dir of cleanup) rmTree(dir);
  if (info.helper) {
    try { fs.unlinkSync(info.helper); } catch { /* ignore */ }
  }
}

if (info.respawn === false) {
  process.exit(0);
}

if (!info.execPath) process.exit(1);

const child = spawn(info.execPath, Array.isArray(info.argv) ? info.argv : [], {
  detached: true,
  stdio: "ignore",
  cwd: info.cwd || process.cwd(),
  env: spawnEnv(),
  windowsHide: true,
  shell: false,
});
child.on("error", () => process.exit(1));
child.unref();
await new Promise((r) => setTimeout(r, 400));
process.exit(0);
