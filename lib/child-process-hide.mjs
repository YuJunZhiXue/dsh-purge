// ESM facade over the real child_process builtin with windowsHide forced.
// Loaded via registerHooks so `import { spawn } from "node:child_process"`
// receives the wrapped functions (plain cp.spawn = … does NOT affect ESM
// named imports on Node 24).

const cp = process.getBuiltinModule("child_process");
const MARK = "__dshPurgeHideConsole";

function hide(options) {
  if (options == null) return { windowsHide: true };
  if (typeof options !== "object") return options;
  return { ...options, windowsHide: true };
}

function wrapSpawn(orig) {
  return function patchedSpawn(file, args, options) {
    if (args != null && !Array.isArray(args)) return orig.call(this, file, hide(args));
    return orig.call(this, file, args ?? [], hide(options));
  };
}

function wrapExec(orig) {
  return function patchedExec(command, options, callback) {
    if (typeof options === "function") return orig.call(this, command, { windowsHide: true }, options);
    return orig.call(this, command, hide(options), callback);
  };
}

function wrapExecFile(orig) {
  return function patchedExecFile(file, args, options, callback) {
    if (typeof args === "function") return orig.call(this, file, hide(undefined), args);
    if (args != null && !Array.isArray(args)) return orig.call(this, file, hide(args), options);
    if (typeof options === "function") return orig.call(this, file, args, { windowsHide: true }, options);
    return orig.call(this, file, args, hide(options), callback);
  };
}

function wrapFork(orig) {
  return function patchedFork(modulePath, args, options) {
    if (args != null && !Array.isArray(args)) return orig.call(this, modulePath, hide(args));
    return orig.call(this, modulePath, args, hide(options));
  };
}

if (process.platform === "win32" && !cp[MARK]) {
  cp.spawn = wrapSpawn(cp.spawn);
  cp.spawnSync = wrapSpawn(cp.spawnSync);
  cp.exec = wrapExec(cp.exec);
  cp.execSync = wrapExec(cp.execSync);
  cp.execFile = wrapExecFile(cp.execFile);
  cp.execFileSync = wrapExecFile(cp.execFileSync);
  if (typeof cp.fork === "function") cp.fork = wrapFork(cp.fork);
  Object.defineProperty(cp, MARK, { value: true, enumerable: false });
}

export default cp;
export const spawn = cp.spawn;
export const spawnSync = cp.spawnSync;
export const exec = cp.exec;
export const execSync = cp.execSync;
export const execFile = cp.execFile;
export const execFileSync = cp.execFileSync;
export const fork = cp.fork;
export const ChildProcess = cp.ChildProcess;
