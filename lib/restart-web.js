// Spawned by /dsh-purge/restart: wait until the old web port is free, then relaunch.
import net from "node:net";
import { spawn } from "node:child_process";
import { envForDetachedSpawn } from "./core.js";

const encoded = process.env.DSH_PURGE_RESTART;
if (!encoded) process.exit(1);

let info;
try {
  info = JSON.parse(encoded);
} catch {
  process.exit(1);
}

const port = Number(info.port) || 3080;
const host = typeof info.host === "string" && info.host ? info.host : "127.0.0.1";

function portFree() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(true));
  });
}

async function waitFree() {
  for (let i = 0; i < 80; i++) {
    if (await portFree()) return true;
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

const ok = await waitFree();
if (!ok) process.exit(1);

// On Windows, detached without a hidden console allocates a visible conhost.
// Always force windowsHide + never shell (dsh.cmd → cmd.exe flash).
const child = spawn(info.execPath, info.argv, {
  detached: true,
  stdio: "ignore",
  cwd: info.cwd || process.cwd(),
  env: envForDetachedSpawn(),
  windowsHide: true,
  shell: false,
});
child.on("error", () => process.exit(1));
child.unref();
// Brief linger so the replacement is not torn down with this helper's process
// group on Windows before it detaches.
await new Promise((r) => setTimeout(r, 400));
process.exit(0);
