// Force every child_process launch on Windows to use CREATE_NO_WINDOW.
// Must load before other plugins spawn work — import this module for side effects,
// or call installHideConsole() explicitly from apply().

import { createRequire } from "node:module";

const MARK = "__dshPurgeHideConsole";
const IMPORT_MARK = "dsh-purge-hide-console";

function forceHideOptions(options) {
  if (options == null) return { windowsHide: true };
  if (typeof options !== "object") return options;
  if (options.windowsHide === true) return options;
  return { ...options, windowsHide: true };
}

function wrapSpawn(orig) {
  return function patchedSpawn(file, args, options) {
    if (args != null && !Array.isArray(args)) {
      // spawn(file, options)
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
      // execFile(file, options, callback)
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

/** Patch node:child_process in this process. Idempotent. */
export function installHideConsole() {
  if (process.platform !== "win32") return { ok: true, skipped: "not_win32" };
  const require = createRequire(import.meta.url);
  const cp = require("node:child_process");
  if (cp[MARK]) return { ok: true, already: true };

  cp.spawn = wrapSpawn(cp.spawn);
  cp.spawnSync = wrapSpawn(cp.spawnSync);
  cp.exec = wrapExecLike(cp.exec);
  cp.execSync = wrapExecLike(cp.execSync);
  cp.execFile = wrapExecFile(cp.execFile);
  cp.execFileSync = wrapExecFile(cp.execFileSync);
  if (typeof cp.fork === "function") cp.fork = wrapFork(cp.fork);

  Object.defineProperty(cp, MARK, { value: true, enumerable: false });
  return { ok: true, patched: true };
}

/** Source written next to DSH `lib/bin.js` so the entry imports it first. */
export function hideConsoleEntrySource() {
  return `// ${IMPORT_MARK} — auto-installed by dsh-purge; do not edit
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cp = require("node:child_process");
const MARK = ${JSON.stringify(MARK)};
if (process.platform === "win32" && !cp[MARK]) {
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

const IMPORT_LINE = `import "./${IMPORT_MARK}.js"; // [dsh-purge] hide-console`;

/**
 * Resolve the @deepseek-ai/dsh package root that actually owns lib/bin.js.
 * `ai_base` is often `.../dsh/node_modules/@deepseek-ai` (packages tree), which
 * does NOT contain bin.js — walking up / sideways is required.
 */
export function resolveDshBinRoot(hint, { fs, path } = {}) {
  const nodeFs = fs ?? requireFs();
  const nodePath = path ?? requirePath();
  const tries = [];
  const push = (p) => {
    if (p && !tries.includes(p)) tries.push(p);
  };
  if (hint) {
    push(hint);
    push(nodePath.join(hint, "dsh"));
    push(nodePath.join(hint, "@deepseek-ai", "dsh"));
    if (nodePath.basename(hint) === "@deepseek-ai") {
      push(nodePath.dirname(hint)); // .../node_modules
      push(nodePath.join(nodePath.dirname(hint), "dsh"));
      push(nodePath.dirname(nodePath.dirname(hint))); // .../dsh when hint is .../dsh/node_modules/@deepseek-ai
    }
    if (nodePath.basename(hint) === "dsh") push(hint);
  }
  if (typeof process.argv[1] === "string" && /[\\/]bin\.js$/i.test(process.argv[1])) {
    push(nodePath.dirname(nodePath.dirname(process.argv[1])));
  }
  for (const root of tries) {
    try {
      if (nodeFs.existsSync(nodePath.join(root, "lib", "bin.js"))) return nodePath.normalize(root);
    } catch {}
  }
  return null;
}

/**
 * Drop hide-console next to bin.js and ensure it is the first import.
 * Returns status string for reports.
 */
export function installHideConsoleIntoBin(aiBase, { fs, path } = {}) {
  if (process.platform !== "win32") return "skipped_not_win32";
  const nodeFs = fs ?? requireFs();
  const nodePath = path ?? requirePath();
  const root = resolveDshBinRoot(aiBase, { fs: nodeFs, path: nodePath });
  if (!root) return "missing_bin";
  const binJs = nodePath.join(root, "lib", "bin.js");
  const side = nodePath.join(root, "lib", `${IMPORT_MARK}.js`);

  nodeFs.writeFileSync(side, hideConsoleEntrySource(), "utf8");

  let text = nodeFs.readFileSync(binJs, "utf8");
  if (text.includes(IMPORT_MARK) && text.includes(IMPORT_LINE.split(" //")[0])) {
    // Refresh side file only
    return "already_injected";
  }
  // Remove stale markers then inject after shebang
  text = text.replace(
    /^import "\.\/dsh-purge-hide-console\.js";.*\r?\n/m,
    "",
  );
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

function requireFs() {
  return createRequire(import.meta.url)("node:fs");
}
function requirePath() {
  return createRequire(import.meta.url)("node:path");
}

// Side-effect install when this module is imported on win32
installHideConsole();
