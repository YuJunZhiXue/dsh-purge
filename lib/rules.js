import fs, { promises as fsp } from "node:fs";
import path from "node:path";
import {
  findDshHome,
  defaultOverrideText,
  hangOperatorPrompt,
  hungOperatorPrompt,
  normalizeOverride,
  peekCommittedOverride,
  readPromptInjectFileSync,
  hashOverride,
  defaultOverrideHash,
  atomicWriteFile,
  atomicCopyFile,
} from "./core.js";

const RULE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const MAX_RULE_BYTES = 256 * 1024;
const MAX_NAME_LENGTH = 64;
export const RULE_TARGETS = ["AGENTS.md", "CLAUDE.md"];
const BACKUP_SUFFIX = ".dsh-purge-rule.bak";

export { findDshHome };

export function rulesDir(dshHome) {
  return path.join(dshHome, "rules");
}

export function stateFile(dshHome) {
  return path.join(rulesDir(dshHome), "state.json");
}

export function rulePath(dshHome, id) {
  return path.join(rulesDir(dshHome), id + ".md");
}

export function ruleMetaPath(dshHome, id) {
  return path.join(rulesDir(dshHome), id + ".json");
}

export function validRuleId(id) {
  return typeof id === "string" && RULE_ID_RE.test(id);
}

export function validTarget(target) {
  return typeof target === "string" && RULE_TARGETS.includes(target);
}

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
}

export function targetPath(dshHome, target) {
  if (!validTarget(target)) throw new Error(`invalid target: ${target}`);
  return path.join(dshHome, target);
}

export function normalizeMeta(id, meta) {
  const name =
    typeof meta?.name === "string" && meta.name.trim()
      ? meta.name.trim().slice(0, MAX_NAME_LENGTH)
      : id;
  const target = validTarget(meta?.target) ? meta.target : "AGENTS.md";
  return { name, target };
}

export async function readRuleMeta(dshHome, id) {
  try {
    const parsed = JSON.parse(await fsp.readFile(ruleMetaPath(dshHome, id), "utf8"));
    return normalizeMeta(id, parsed);
  } catch {
    return normalizeMeta(id, null);
  }
}

export async function writeRuleMeta(dshHome, id, meta) {
  if (!validRuleId(id)) throw new Error(`invalid rule id: ${id}`);
  await fsp.mkdir(rulesDir(dshHome), { recursive: true });
  await atomicWriteFile(ruleMetaPath(dshHome, id), JSON.stringify(normalizeMeta(id, meta), null, 2));
}

function readRuleContentSync(dshHome, id) {
  try {
    return fs.readFileSync(rulePath(dshHome, id), "utf8");
  } catch {
    return null;
  }
}

async function collectRuleContents(dshHome) {
  const listed = await listRules(dshHome);
  const contents = new Set();
  for (const r of listed) {
    const c = readRuleContentSync(dshHome, r.id);
    if (c !== null) contents.add(c);
  }
  return contents;
}

export async function listRules(dshHome) {
  const dir = rulesDir(dshHome);
  const out = [];
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".md")) continue;
      const id = e.name.slice(0, -3);
      if (!validRuleId(id)) continue;
      let size = 0;
      try {
        size = (await fsp.stat(path.join(dir, e.name))).size;
      } catch {
      }
      const meta = await readRuleMeta(dshHome, id);
      out.push({ id, name: meta.name, target: meta.target, size });
    }
  } catch {
    // rules 目录不存在时按空列表返回
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export async function readRule(dshHome, id) {
  if (!validRuleId(id)) throw new Error(`invalid rule id: ${id}`);
  try {
    return await fsp.readFile(rulePath(dshHome, id), "utf8");
  } catch {
    return null;
  }
}

export async function saveRule(dshHome, id, content, meta) {
  if (!validRuleId(id)) throw new Error(`invalid rule id: ${id}`);
  if (Buffer.byteLength(content, "utf8") > MAX_RULE_BYTES) {
    throw new Error("rule too large (max 256KB)");
  }
  await fsp.mkdir(rulesDir(dshHome), { recursive: true });

  const rulePathStr = rulePath(dshHome, id);
  const metaPathStr = ruleMetaPath(dshHome, id);
  let prevRule = null;
  let prevMeta = null;
  try { prevRule = await fsp.readFile(rulePathStr, "utf8"); } catch { /* 新 rule */ }
  try { prevMeta = await fsp.readFile(metaPathStr, "utf8"); } catch { /* 新 rule */ }

  let wroteRule = false;
  let wroteMeta = false;
  try {
    await atomicWriteFile(rulePathStr, content);
    wroteRule = true;
    await writeRuleMeta(dshHome, id, meta);
    wroteMeta = true;
    if ((await readActive(dshHome)) === id) {
      await activateRule(dshHome, id);
    }
  } catch (e) {
    if (wroteRule) {
      try {
        if (prevRule === null) {
          await fsp.unlink(rulePathStr).catch(() => {});
        } else {
          await atomicWriteFile(rulePathStr, prevRule);
        }
      } catch { /* 回滚失败,原错继续抛 */ }
    }
    if (wroteMeta && prevMeta !== null) {
      try { await atomicWriteFile(metaPathStr, prevMeta); } catch { /* ignore */ }
    } else if (wroteMeta && prevMeta === null) {
      try { await fsp.unlink(metaPathStr).catch(() => {}); } catch { /* ignore */ }
    }
    throw e;
  }
}

export async function deleteRule(dshHome, id) {
  if (!validRuleId(id)) throw new Error(`invalid rule id: ${id}`);
  try {
    await fsp.unlink(rulePath(dshHome, id));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  try {
    await fsp.unlink(ruleMetaPath(dshHome, id));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  if ((await readActive(dshHome)) === id) {
    try {
      await fsp.unlink(stateFile(dshHome));
    } catch {
    }
  }
}

export async function readActive(dshHome) {
  try {
    const parsed = JSON.parse(await fsp.readFile(stateFile(dshHome), "utf8"));
    return typeof parsed?.active === "string" && validRuleId(parsed.active) ? parsed.active : null;
  } catch {
    return null;
  }
}

export async function setActive(dshHome, id) {
  if (!validRuleId(id)) throw new Error(`invalid rule id: ${id}`);
  await fsp.mkdir(rulesDir(dshHome), { recursive: true });
  await fsp.writeFile(stateFile(dshHome), JSON.stringify({ active: id }, null, 2), "utf8");
}

/**
 * 本进程框内提交 > $DSH_HOME/prompt-inject.md > 加密槽。
 * 规则集只改 agents 目标文件，不参与 system 注入链（#74 磁盘与 UI/注入一致）。
 */
export function resolveInjectText(dshHome) {
  const home = path.normalize(String(dshHome || findDshHome() || ""));
  const pinned = peekCommittedOverride(home);
  if (typeof pinned === "string" && normalizeOverride(pinned)) {
    return { text: normalizeOverride(pinned), source: "prompt", ruleId: null };
  }
  const diskNorm = normalizeOverride(readPromptInjectFileSync(home));
  if (diskNorm) {
    const source = hashOverride(diskNorm) === defaultOverrideHash() ? "default" : "prompt";
    return { text: diskNorm, source, ruleId: null };
  }
  const bundled = normalizeOverride(defaultOverrideText());
  if (bundled) return { text: bundled, source: "default", ruleId: null };
  return { text: "", source: "none", ruleId: null };
}

/** 组装前挂上操作者正文（prompt-inject.md / 框内提交 / 加密槽）。 */
export function ensureOperatorBody(dshHome) {
  const resolved = resolveInjectText(dshHome);
  if (resolved.text) hangOperatorPrompt(resolved.text);
  return resolved.text || normalizeOverride(hungOperatorPrompt()) || "";
}

export async function activateRule(dshHome, id) {
  const content = await readRule(dshHome, id);
  if (content === null) throw new Error(`rule not found: ${id}`);
  const meta = await readRuleMeta(dshHome, id);
  const target = targetPath(dshHome, meta.target);
  const backup = `${target}${BACKUP_SUFFIX}`;
  if (!fs.existsSync(backup)) {
    try {
      const existing = await fsp.readFile(target, "utf8");
      const ruleContents = await collectRuleContents(dshHome);
      if (!ruleContents.has(existing)) {
        await atomicCopyFile(target, backup);
      }
    } catch { /* target 不存在 → 无需备份 */ }
  }
  await atomicWriteFile(target, content);
  await setActive(dshHome, id);
  return meta;
}

export async function ensureInitialState(dshHome) {
  const listed = await listRules(dshHome);
  let active = await readActive(dshHome);
  if (active !== null && !listed.some((r) => r.id === active)) {
    try {
      await fsp.unlink(stateFile(dshHome));
    } catch {
    }
    active = null;
  }
  return { active };
}

export async function resetToOriginal(dshHome) {
  const active = await readActive(dshHome);
  const removed = [];
  const skipped = [];
  const restored = [];

  for (const target of RULE_TARGETS) {
    const fp = targetPath(dshHome, target);
    const bak = `${fp}${BACKUP_SUFFIX}`;
    if (!fs.existsSync(bak)) continue;
    try {
      await atomicCopyFile(bak, fp);
      await fsp.unlink(bak);
      restored.push(fp);
    } catch { /* restore 失败,fall through 到老逻辑 */ }
  }

  if (active !== null) {
    const meta = await readRuleMeta(dshHome, active);
    const fp = targetPath(dshHome, meta.target);
    if (!restored.includes(fp)) {
      const ruleContent = await readRule(dshHome, active);
      try {
        const fileContent = await fsp.readFile(fp, "utf8");
        if (ruleContent !== null && fileContent === ruleContent) {
          await fsp.unlink(fp);
          removed.push(fp);
        } else {
          skipped.push(fp);
        }
      } catch {
      }
    }
  }
  try {
    await fsp.unlink(stateFile(dshHome));
  } catch {
  }
  return { removed, skipped, restored };
}

export async function rulesStatus(dshHome) {
  const listed = await listRules(dshHome);
  const active = await readActive(dshHome);
  let active_target = null;
  let agents_exists = false;
  let agents_synced = false;
  let agents_path = targetPath(dshHome, "AGENTS.md");
  if (active !== null) {
    const meta = await readRuleMeta(dshHome, active);
    active_target = meta.target;
    agents_path = targetPath(dshHome, meta.target);
    try {
      const content = await fsp.readFile(agents_path, "utf8");
      agents_exists = true;
      const ruleContent = await readRule(dshHome, active);
      agents_synced = ruleContent !== null && ruleContent === content;
    } catch {
    }
  }
  const inject = resolveInjectText(dshHome);
  return {
    rules: listed,
    active,
    injectSource: inject.source,
    injectRuleId: inject.ruleId,
    active_target,
    agents_exists,
    agents_synced,
    agents_path,
    rules_dir: rulesDir(dshHome),
  };
}
