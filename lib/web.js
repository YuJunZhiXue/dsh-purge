import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as core from "./core.js";

export function restartNote() {
  return "正在重启 dsh web…";
}

export function portFromRequest(request) {
  const host = String(request?.headers?.host || "");
  const m = host.match(/:(\d+)$/);
  if (m) return Number(m[1]);
  return Number(process.env.PORT) || 3080;
}

export function hostFromRequest(request) {
  const hostHeader = String(request?.headers?.host || "127.0.0.1");
  return hostHeader.replace(/:\d+$/, "") || "127.0.0.1";
}

export function restartArgv({
  argv = process.argv,
  findBinRoot = core.findDshBinRoot,
} = {}) {
  const root = findBinRoot();
  const binJs = root ? path.join(root, "lib", "bin.js") : null;
  if (binJs && fs.existsSync(binJs)) {
    const rest = argv.slice(2).filter((arg) => arg !== "--no-open");
    if (!rest.includes("web") && !rest.includes("desktop")) {
      const port = Number(process.env.PORT) || 3080;
      rest.unshift("web", "--port", String(port));
    }
    rest.push("--no-open");
    return [binJs, ...rest];
  }
  const next = argv.slice(1).filter((arg) => arg !== "--no-open");
  if (next[0] && /\.(cmd|bat)$/i.test(next[0])) {
    const dir = path.dirname(next[0]);
    const candidates = [
      path.resolve(dir, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
      path.resolve(dir, "..", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
    ];
    const hit = candidates.find((p) => fs.existsSync(p));
    if (hit) next[0] = hit;
  }
  next.push("--no-open");
  return next;
}

function spawnRestartHelper(helper, payload, exitAfter = 250) {
  try {
    core.silenceCmdFlash();
  } catch {}
  const child = spawn(process.execPath, [helper], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
    env: {
      ...core.envForDetachedSpawn(),
      DSH_PURGE_RESTART: JSON.stringify(payload),
    },
  });
  child.unref();
  setTimeout(() => process.exit(0), exitAfter);
}

export function scheduleRestart(request) {
  const helper = fileURLToPath(new URL("./restart-web.js", import.meta.url));
  spawnRestartHelper(helper, {
    kind: "web",
    execPath: process.execPath,
    argv: restartArgv(),
    cwd: process.cwd(),
    host: hostFromRequest(request),
    port: portFromRequest(request),
  });
}

export function scheduleCleanupRestart({ request, restartArgv: argv, cleanup = [] } = {}) {
  const src = fileURLToPath(new URL("./uninstall-restart.js", import.meta.url));
  const dest = path.join(os.tmpdir(), `dsh-purge-uninst-${process.pid}.mjs`);
  fs.copyFileSync(src, dest);
  spawnRestartHelper(dest, {
    kind: "web",
    execPath: process.execPath,
    argv: argv || restartArgv(),
    cwd: process.cwd(),
    host: hostFromRequest(request),
    port: portFromRequest(request),
    cleanup,
    helper: dest,
  }, 400);
}
