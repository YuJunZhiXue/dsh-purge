// #80：hooks deny / ask 旁路的开关、反向写回官方形态、状态标注。
// 本模块不 import core.js（core 在需要时回调本模块，避免循环依赖）。
import fs from "node:fs";
import path from "node:path";

/** #80 产品语义：这四条永远同开关，不拆开。 */
export const HOOK_DENY_PATCH_IDS = Object.freeze([30, 31, 64, 65]);

const DEFAULT_SETTINGS = Object.freeze({ hooksDenyBypass: true });
const SETTINGS_FILE = "hooks-deny.json";

/** 补丁 30/31 写出的死字符串；它出现即代表「旁路还开着」。 */
const DISABLED_SENTINEL = "__dsh_purge_deny_disabled__";

const MARKER_STOP = "[dsh-purge] Stop hook steer disabled";
const MARKER_SUBMIT = "[dsh-purge] UserPromptSubmit deny→allow";

/**
 * 反向替换表。find 必须逐字命中本插件写出的形态。
 * R1a 活文件（30+65 同一轮）：65 把 reject 行写成 `=== "deny"` 空壳。
 * R1a2 二次应用：30 没有 skipIfMarked，会再把空壳里的 `"deny"` 改成死字符串。
 * R1b：只打了 30、还没打 65。
 * R2a / R2b 必须连 body 的 kind 一起匹配，不能只认行首。
 */
const REVERSES = Object.freeze([
  {
    id: "R1a",
    find:
      '\t\tif (merged.decision === "deny") { /* [dsh-purge] UserPromptSubmit deny→allow */ }\n' +
      '\t\telse if (merged.decision === "__dsh_purge_deny_disabled__") { /* [dsh-purge] pre-step reject disabled */ }',
    replace: '\t\tif (merged.decision === "deny") return { kind: "reject" };',
  },
  {
    id: "R1a2",
    find:
      '\t\tif (merged.decision === "__dsh_purge_deny_disabled__") /* [dsh-purge] hooks deny→allow */' +
      ' { /* [dsh-purge] UserPromptSubmit deny→allow */ }\n' +
      '\t\telse if (merged.decision === "__dsh_purge_deny_disabled__") { /* [dsh-purge] pre-step reject disabled */ }',
    replace: '\t\tif (merged.decision === "deny") return { kind: "reject" };',
  },
  {
    id: "R1b",
    find:
      '\t\tif (merged.decision === "__dsh_purge_deny_disabled__") /* [dsh-purge] hooks deny→allow */ return { kind: "reject" };',
    replace: '\t\tif (merged.decision === "deny") return { kind: "reject" };',
  },
  {
    id: "R2a",
    find:
      '\t\tif (merged.decision === "__dsh_purge_deny_disabled__") /* [dsh-purge] hooks deny→allow */ return {\n' +
      '\t\t\tkind: "deny",',
    replace: '\t\tif (merged.decision === "deny") return {\n\t\t\tkind: "deny",',
  },
  {
    id: "R2b",
    find:
      '\t\tif (merged.decision === "__dsh_purge_deny_disabled__") /* [dsh-purge] hooks deny→allow */ return {\n' +
      '\t\t\tkind: "block",',
    replace: '\t\tif (merged.decision === "deny") return {\n\t\t\tkind: "block",',
  },
  {
    id: "R3",
    find: '\t\tif (merged.decision === "ask") return next(); /* [dsh-purge] hooks ask→allow */',
    replace:
      '\t\tif (merged.decision === "ask") return {\n' +
      '\t\t\tkind: "ask",\n' +
      '\t\t\t...merged.reason !== void 0 ? { reason: merged.reason } : {}\n' +
      '\t\t};',
  },
  {
    id: "R5a",
    find:
      '\t\tif (merged.decision === "__dsh_purge_deny_disabled__") /* [dsh-purge] hooks deny→allow */ {\n' +
      '\t\t\treturn; // [dsh-purge] Stop hook steer disabled\n',
    replace: '\t\tif (merged.decision === "deny") {\n',
  },
  {
    id: "R5b",
    find:
      '\t\tif (merged.decision === "__dsh_purge_deny_disabled__") /* [dsh-purge] hooks deny→allow */ {\n' +
      '\t\t\tconst text = merged.reason ?? "continue: blocked by Stop hook";',
    replace:
      '\t\tif (merged.decision === "deny") {\n' +
      '\t\t\tconst text = merged.reason ?? "continue: blocked by Stop hook";',
  },
]);

const SENTINEL_RULE = Object.freeze({
  id: "R0",
  find: '"__dsh_purge_deny_disabled__"',
  replace: '"deny"',
});

export function applyHookDenyReverses(text) {
  let out = String(text || "");
  const hits = [];
  for (const rule of REVERSES) {
    if (!out.includes(rule.find)) continue;
    out = out.split(rule.find).join(rule.replace);
    hits.push(rule.id);
  }
  if (hits.length === 0 && out.includes(DISABLED_SENTINEL)) {
    const next = out.split(SENTINEL_RULE.find).join(SENTINEL_RULE.replace);
    if (next !== out) {
      out = next;
      hits.push("R0");
    }
  }
  return { text: out, hits };
}

export function hookFileLooksBypassed(text) {
  const hay = String(text || "");
  return hay.includes(DISABLED_SENTINEL) || hay.includes(MARKER_STOP) || hay.includes(MARKER_SUBMIT);
}

/**
 * 把 aiBase 上这四条补丁涉及的文件写回官方形态。
 * @returns {{ files: string[], changed: string[], misses: string[], sentinelLeft: string[], hitsByFile: Record<string, string[]> }}
 */
export async function restoreHookDenyOfficial(aiBase, io) {
  const result = { files: [], changed: [], misses: [], sentinelLeft: [], hitsByFile: {} };
  if (!aiBase || !io) return result;
  const paths = io.hookDenyPaths(aiBase);
  for (const fp of paths) {
    result.files.push(fp);
    let text;
    try {
      text = await io.loadText(fp);
    } catch {
      result.misses.push(fp);
      continue;
    }
    const { text: next, hits } = applyHookDenyReverses(text);
    result.hitsByFile[fp] = hits;
    if (hits.length === 0) {
      if (next.includes(DISABLED_SENTINEL)) result.sentinelLeft.push(fp);
      continue;
    }
    try {
      const wrote = await io.saveText(fp, next);
      if (wrote) result.changed.push(fp);
    } catch {
      result.misses.push(fp);
    }
    if (next.includes(DISABLED_SENTINEL)) result.sentinelLeft.push(fp);
  }
  return result;
}

export async function annotateHookDenyStatus(status, settings, aiBase, io) {
  if (!status || !aiBase || settings?.hooksDenyBypass !== false) return status;
  const paths = io.hookDenyPaths(aiBase);
  let dirty = false;
  for (const fp of paths) {
    let text;
    try {
      text = await io.loadText(fp);
    } catch {
      continue;
    }
    if (hookFileLooksBypassed(text)) {
      dirty = true;
      break;
    }
  }
  for (const id of HOOK_DENY_PATCH_IDS) {
    const prev = status[id];
    if (prev === "na" || prev === "missing_file") continue;
    status[id] = dirty ? "pending" : "skipped";
  }
  return status;
}

export function hookDenySettingsPath(dshHome) {
  return path.join(dshHome, "dsh-purge", SETTINGS_FILE);
}

export function loadHookDenySettings(dshHome, configValue) {
  let file = {};
  try {
    const fp = hookDenySettingsPath(dshHome);
    if (fs.existsSync(fp)) {
      const parsed = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (parsed && typeof parsed === "object") file = parsed;
    }
  } catch {
    file = {};
  }
  const pick = [file.hooksDenyBypass, configValue, DEFAULT_SETTINGS.hooksDenyBypass];
  const value = pick.find((v) => typeof v === "boolean");
  return { hooksDenyBypass: value === undefined ? true : value };
}

export function saveHookDenySettings(dshHome, patch) {
  const fp = hookDenySettingsPath(dshHome);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  const current = loadHookDenySettings(dshHome);
  const next = {
    hooksDenyBypass: typeof patch?.hooksDenyBypass === "boolean"
      ? patch.hooksDenyBypass
      : current.hooksDenyBypass,
  };
  const tmp = `${fp}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch { /* rename 覆盖 */ }
  fs.renameSync(tmp, fp);
  return { ok: true, ...next, path: fp };
}

export function selectPatches(patches, settings) {
  if (settings?.hooksDenyBypass !== false) return patches;
  const drop = new Set(HOOK_DENY_PATCH_IDS);
  return patches.filter((p) => !drop.has(p.id));
}
