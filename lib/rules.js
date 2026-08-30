// 规则集：多套 AGENTS.md / CLAUDE.md，切换即写入 ~/.dsh 原生全局指令通道
// 存储: $DSH_HOME/rules/<id>.md + <id>.json ；状态: rules/state.json

import { promises as fsp } from "node:fs";
import path from "node:path";
import { findDshHome } from "./core.js";

const RULE_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const MAX_RULE_BYTES = 256 * 1024;
const MAX_NAME_LENGTH = 64;
export const RULE_TARGETS = ["AGENTS.md", "CLAUDE.md"];

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
  await fsp.writeFile(ruleMetaPath(dshHome, id), JSON.stringify(normalizeMeta(id, meta), null, 2), "utf8");
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
        /* ignore */
      }
      const meta = await readRuleMeta(dshHome, id);
      out.push({ id, name: meta.name, target: meta.target, size });
    }
  } catch {
    /* rules dir missing → empty */
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
  await fsp.writeFile(rulePath(dshHome, id), content, "utf8");
  await writeRuleMeta(dshHome, id, meta);
  if ((await readActive(dshHome)) === id) {
    await activateRule(dshHome, id);
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
      /* ignore */
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

export async function activateRule(dshHome, id) {
  const content = await readRule(dshHome, id);
  if (content === null) throw new Error(`rule not found: ${id}`);
  const meta = await readRuleMeta(dshHome, id);
  await fsp.writeFile(targetPath(dshHome, meta.target), content, "utf8");
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
      /* ignore */
    }
    active = null;
  }
  if (active !== null) return { active };
  if (listed.length > 0) return { active: null };
  for (const target of RULE_TARGETS) {
    try {
      const content = await fsp.readFile(targetPath(dshHome, target), "utf8");
      if (content.trim().length > 0) {
        await saveRule(dshHome, "default", content, { name: "默认规则", target });
        await setActive(dshHome, "default");
        return { active: "default", imported: target };
      }
    } catch {
      /* file missing, try next target */
    }
  }
  return { active: null };
}

export async function resetToOriginal(dshHome) {
  const active = await readActive(dshHome);
  const removed = [];
  const skipped = [];
  if (active !== null) {
    const meta = await readRuleMeta(dshHome, active);
    const ruleContent = await readRule(dshHome, active);
    const fp = targetPath(dshHome, meta.target);
    try {
      const fileContent = await fsp.readFile(fp, "utf8");
      if (ruleContent !== null && fileContent === ruleContent) {
        await fsp.unlink(fp);
        removed.push(fp);
      } else {
        skipped.push(fp);
      }
    } catch {
      /* 目标文件不存在 */
    }
  }
  try {
    await fsp.unlink(stateFile(dshHome));
  } catch {
    /* 无状态文件 */
  }
  return { removed, skipped };
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
      /* target file missing */
    }
  }
  return {
    rules: listed,
    active,
    active_target,
    agents_exists,
    agents_synced,
    agents_path,
    rules_dir: rulesDir(dshHome),
  };
}
