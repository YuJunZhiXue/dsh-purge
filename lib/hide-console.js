import { createRequire, registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import path from "node:path";

const MARK = "__dshPurgeHideConsole";
const IMPORT_MARK = "dsh-purge-hide-console";
const HOOK_MARK = "__dshPurgeChildProcessHook";

function forceHideOptions(options) {
  if (options == null) return { windowsHide: true };
  if (typeof options !== "object") return options;
  if (options.windowsHide === true) return options;
  return { ...options, windowsHide: true };
}

function wrapSpawn(orig) {
  return function patchedSpawn(file, args, options) {
    if (args != null && !Array.isArray(args)) {
      return orig.call(this, file, forceHideOptions(args));
    }
    return orig.call(this, file, args ?? [], forceHideOptions(options));
  };
}

function wrapExecLike(orig) {
  return function patchedExec(command, options, callback) {
    if (typeof options === "function") {
      return orig.call(this, command, { windowsHide: true }, options);
    }
    return orig.call(this, command, forceHideOptions(options), callback);
  };
}

function wrapExecFile(orig) {
  return function patchedExecFile(file, args, options, callback) {
    if (typeof args === "function") {
      return orig.call(this, file, forceHideOptions(undefined), args);
    }
    if (args != null && !Array.isArray(args)) {
      return orig.call(this, file, forceHideOptions(args), options);
    }
    if (typeof options === "function") {
      return orig.call(this, file, args, { windowsHide: true }, options);
    }
    return orig.call(this, file, args, forceHideOptions(options), callback);
  };
}

function wrapFork(orig) {
  return function patchedFork(modulePath, args, options) {
    if (args != null && !Array.isArray(args)) {
      return orig.call(this, modulePath, forceHideOptions(args));
    }
    return orig.call(this, modulePath, args, forceHideOptions(options));
  };
}

function facadeUrl() {
  return pathToFileURL(fileURLToPath(new URL("./child-process-hide.mjs", import.meta.url))).href;
}

export function installChildProcessImportHook() {
  if (process.platform !== "win32") return { ok: true, skipped: "not_win32" };
  // Electron 会给 child_process 赋值；ESM namespace 冻结后会抛错，桌面宿主只做 wrap。
  if (typeof process.versions !== "undefined" && process.versions.electron) {
    return { ok: true, skipped: "electron_host" };
  }
  if (globalThis[HOOK_MARK]) return { ok: true, already: true };
  const target = facadeUrl();
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "node:child_process" || specifier === "child_process") {
        return { shortCircuit: true, url: target, format: "module" };
      }
      return nextResolve(specifier, context);
    },
  });
  Object.defineProperty(globalThis, HOOK_MARK, { value: true, enumerable: false });
  return { ok: true, hooked: true };
}

export function installHideConsole() {
  if (process.platform !== "win32") return { ok: true, skipped: "not_win32" };
  const hook = installChildProcessImportHook();
  const require = createRequire(import.meta.url);
  // 改 builtin 本体，和 facade 包的是同一对象。
  const cp =
    typeof process.getBuiltinModule === "function"
      ? process.getBuiltinModule("child_process")
      : require("node:child_process");
  if (cp[MARK]) return { ok: true, already: true, hook };

  cp.spawn = wrapSpawn(cp.spawn);
  cp.spawnSync = wrapSpawn(cp.spawnSync);
  cp.exec = wrapExecLike(cp.exec);
  cp.execSync = wrapExecLike(cp.execSync);
  cp.execFile = wrapExecFile(cp.execFile);
  cp.execFileSync = wrapExecFile(cp.execFileSync);
  if (typeof cp.fork === "function") cp.fork = wrapFork(cp.fork);

  Object.defineProperty(cp, MARK, { value: true, enumerable: false });
  return { ok: true, patched: true, hook };
}

export function hideConsoleEntrySource() {
  return `// ${IMPORT_MARK} — auto-installed by dsh-purge; do not edit
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const HOOK_MARK = "__dshPurgeChildProcessHook";
const MARK = ${JSON.stringify(MARK)};
const facade = pathToFileURL(fileURLToPath(new URL("./dsh-purge-child-process-hide.mjs", import.meta.url))).href;

const isElectron = typeof process.versions !== "undefined" && !!process.versions.electron;

// Electron 宿主不改 resolve；只 wrap builtin。
if (process.platform === "win32" && !isElectron && !globalThis[HOOK_MARK]) {
  const { registerHooks } = await import("node:module");
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "node:child_process" || specifier === "child_process") {
        return { shortCircuit: true, url: facade, format: "module" };
      }
      return nextResolve(specifier, context);
    },
  });
  Object.defineProperty(globalThis, HOOK_MARK, { value: true, enumerable: false });
}

const cp = process.getBuiltinModule ? process.getBuiltinModule("child_process") : null;
if (process.platform === "win32" && cp && !cp[MARK]) {
  const hide = (options) => {
    if (options == null) return { windowsHide: true };
    if (typeof options !== "object") return options;
    if (options.windowsHide === true) return options;
    return { ...options, windowsHide: true };
  };
  const wrapSpawn = (orig) => function (file, args, options) {
    if (args != null && !Array.isArray(args)) return orig.call(this, file, hide(args));
    return orig.call(this, file, args ?? [], hide(options));
  };
  const wrapExec = (orig) => function (command, options, callback) {
    if (typeof options === "function") return orig.call(this, command, { windowsHide: true }, options);
    return orig.call(this, command, hide(options), callback);
  };
  const wrapExecFile = (orig) => function (file, args, options, callback) {
    if (typeof args === "function") return orig.call(this, file, hide(undefined), args);
    if (args != null && !Array.isArray(args)) return orig.call(this, file, hide(args), options);
    if (typeof options === "function") return orig.call(this, file, args, { windowsHide: true }, options);
    return orig.call(this, file, args, hide(options), callback);
  };
  const wrapFork = (orig) => function (modulePath, args, options) {
    if (args != null && !Array.isArray(args)) return orig.call(this, modulePath, hide(args));
    return orig.call(this, modulePath, args, hide(options));
  };
  cp.spawn = wrapSpawn(cp.spawn);
  cp.spawnSync = wrapSpawn(cp.spawnSync);
  cp.exec = wrapExec(cp.exec);
  cp.execSync = wrapExec(cp.execSync);
  cp.execFile = wrapExecFile(cp.execFile);
  cp.execFileSync = wrapExecFile(cp.execFileSync);
  if (typeof cp.fork === "function") cp.fork = wrapFork(cp.fork);
  Object.defineProperty(cp, MARK, { value: true, enumerable: false });
}
`;
}

function requireFs() {
  return createRequire(import.meta.url)("node:fs");
}
function requirePath() {
  return createRequire(import.meta.url)("node:path");
}

export function resolveDshBinRoot(hint, { fs, path: nodePath } = {}) {
  const nodeFs = fs ?? requireFs();
  const p = nodePath ?? requirePath();
  const tries = [];
  const push = (x) => {
    if (x && !tries.includes(x)) tries.push(x);
  };
  if (hint) {
    push(hint);
    push(p.join(hint, "dsh"));
    push(p.join(hint, "@deepseek-ai", "dsh"));
    if (p.basename(hint) === "@deepseek-ai") {
      push(p.dirname(hint));
      push(p.join(p.dirname(hint), "dsh"));
      push(p.dirname(p.dirname(hint)));
    }
    if (p.basename(hint) === "dsh") push(hint);
  }
  if (typeof process.argv[1] === "string" && /[\\/]bin\.js$/i.test(process.argv[1])) {
    push(p.dirname(p.dirname(process.argv[1])));
  }
  for (const root of tries) {
    try {
      if (nodeFs.existsSync(p.join(root, "lib", "bin.js"))) return p.normalize(root);
    } catch {}
  }
  return null;
}

const IMPORT_LINE = `import "./${IMPORT_MARK}.js"; // [dsh-purge] hide-console`;

export function installHideConsoleIntoBin(aiBase, { fs, path: nodePath } = {}) {
  if (process.platform !== "win32") return "skipped_not_win32";
  const nodeFs = fs ?? requireFs();
  const p = nodePath ?? requirePath();
  const root = resolveDshBinRoot(aiBase, { fs: nodeFs, path: p });
  if (!root) return "missing_bin";
  const binJs = p.join(root, "lib", "bin.js");
  const side = p.join(root, "lib", `${IMPORT_MARK}.js`);
  const facadeSide = p.join(root, "lib", "dsh-purge-child-process-hide.mjs");

  const facadeSrc = nodeFs.readFileSync(
    fileURLToPath(new URL("./child-process-hide.mjs", import.meta.url)),
    "utf8",
  );
  nodeFs.writeFileSync(facadeSide, facadeSrc, "utf8");
  nodeFs.writeFileSync(side, hideConsoleEntrySource(), "utf8");

  let text = nodeFs.readFileSync(binJs, "utf8");
  if (text.includes(IMPORT_MARK) && text.includes(IMPORT_LINE.split(" //")[0])) {
    return "already_injected";
  }
  text = text.replace(/^import "\.\/dsh-purge-hide-console\.js";.*\r?\n/m, "");
  if (/^#!/.test(text)) {
    const nl = text.indexOf("\n");
    text =
      nl >= 0
        ? text.slice(0, nl + 1) + IMPORT_LINE + "\n" + text.slice(nl + 1)
        : text + "\n" + IMPORT_LINE + "\n";
  } else {
    text = IMPORT_LINE + "\n" + text;
  }
  nodeFs.writeFileSync(binJs, text, "utf8");
  return "injected";
}

installHideConsole();
