import { promises as fsp } from "node:fs";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { findDshHome } from "./core.js";

export { findDshHome };

let hostCtx = null;

export function bindHost(ctx) {
  hostCtx = ctx || null;
}

function hostService(ctx, name) {
  const current = ctx || hostCtx;
  if (!current || typeof current.get !== "function") return undefined;
  try {
    return current.get(name);
  } catch {
    return undefined;
  }
}

/** 与官方 @deepseek-ai/dsh-skill 一致：kebab-case。 */
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SKILL_BYTES = 256 * 1024;
const MAX_ARCHIVE_BYTES = 12 * 1024 * 1024;
const MAX_IMPORT_FILES = 200;
const MAX_DESCRIPTION = 500;
const SKIP_COPY_NAMES = new Set([".", "..", ".system", ".git", "node_modules", "__MACOSX", ".DS_Store"]);

export function validSkillName(id) {
  return typeof id === "string" && SKILL_NAME_RE.test(id);
}

function workspaceIdFor(root) {
  return crypto.createHash("sha1").update(path.resolve(String(root || ""))).digest("hex").slice(0, 12);
}

function safeSlug(root) {
  const base = path.basename(path.resolve(String(root || ""))) || "workspace";
  return `${base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "workspace"}_${workspaceIdFor(root)}`;
}

function workspaceStateFile(dshHome) {
  return path.join(dshHome, "dsh-purge", "skill-workspace.json");
}

export function resolveSkillScope(dshHome, options = {}) {
  const scope = options && options.scope === "project" ? "project" : "user";
  if (scope !== "project") {
    return {
      scope: "user",
      dshHome,
      skillsRoot: path.join(dshHome, "skills"),
      backupRoot: path.join(dshHome, "dsh-purge-backups", "skills"),
      backupGuard: path.join(dshHome, "dsh-purge-backups"),
      displayHome: dshHome,
      displayPrefix: "$DSH_HOME",
    };
  }
  const projectRoot = path.resolve(String((options && options.projectRoot) || ""));
  if (!projectRoot || projectRoot === path.parse(projectRoot).root) {
    throw new Error("未选择工作区");
  }
  return {
    scope: "project",
    dshHome,
    projectRoot,
    skillsRoot: path.join(projectRoot, ".dsh", "skills"),
    backupRoot: path.join(dshHome, "dsh-purge-backups", "skills-project", safeSlug(projectRoot)),
    backupGuard: path.join(dshHome, "dsh-purge-backups"),
    displayHome: projectRoot,
    displayPrefix: "$WORKSPACE",
  };
}

export function skillsDir(dshHome, options) {
  return resolveSkillScope(dshHome, options).skillsRoot;
}

export function skillBackupDir(dshHome, options) {
  return resolveSkillScope(dshHome, options).backupRoot;
}

export function skillBundleDir(dshHome, id, options) {
  return path.join(skillsDir(dshHome, options), id);
}

export function skillBundleFile(dshHome, id, options) {
  return path.join(skillBundleDir(dshHome, id, options), "SKILL.md");
}

export function skillFlatFile(dshHome, id, options) {
  return path.join(skillsDir(dshHome, options), `${id}.md`);
}

/** 对外只报 $DSH_HOME / $WORKSPACE，不暴露本机盘符。 */
export function displayUnderHome(home, absPath, prefix = "$DSH_HOME") {
  if (!absPath) return "";
  const root = path.resolve(home);
  const abs = path.resolve(absPath);
  if (abs === root) return prefix;
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return prefix;
  return `${prefix}/${rel.split(/[/\\]/).join("/")}`;
}

export function toPublicSkill(dshHome, item, options) {
  if (!item || typeof item !== "object") return item;
  const sc = resolveSkillScope(dshHome, options);
  const next = { ...item, scope: sc.scope };
  if (typeof next.path === "string") next.path = displayUnderHome(sc.displayHome, next.path, sc.displayPrefix);
  if (typeof next.backup === "string") next.backup = displayUnderHome(sc.dshHome, next.backup, "$DSH_HOME");
  return next;
}

function assertInside(root, target) {
  const a = path.resolve(root);
  const b = path.resolve(target);
  const prefix = a.endsWith(path.sep) ? a : a + path.sep;
  if (b !== a && !b.startsWith(prefix)) {
    throw new Error("skill path escaped official skills directory");
  }
}

function yamlScalar(value) {
  const text = String(value ?? "").trim();
  if (!text) return '""';
  if (/^[A-Za-z0-9._+/-]+$/.test(text)) return text;
  return JSON.stringify(text);
}

export function splitFrontmatter(raw) {
  const text = String(raw || "").replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) return null;
  const afterOpen = text.slice(3);
  if (!/^\r?\n/.test(afterOpen)) return null;
  const rest = afterOpen.replace(/^\r?\n/, "");
  const close = rest.match(/\r?\n---(?:\r?\n|$)/);
  if (!close || close.index == null) return null;
  return {
    head: rest.slice(0, close.index),
    body: rest.slice(close.index + close[0].length),
  };
}

function yamlLineField(head, key) {
  const re = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const match = String(head || "").match(re);
  if (!match) return "";
  let value = match[1].trim();
  if (!value) return "";
  if (value === "|" || value === ">" || value === "|-" || value === ">-") return "";
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    try {
      return value.startsWith("\"") ? JSON.parse(value) : value.slice(1, -1);
    } catch {
      return value.slice(1, -1);
    }
  }
  const comment = value.indexOf(" #");
  if (comment >= 0) value = value.slice(0, comment).trim();
  return value;
}

function yamlBoolField(head, key) {
  const re = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const match = String(head || "").match(re);
  if (!match) return { present: false };
  let value = match[1].trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  const comment = value.indexOf(" #");
  if (comment >= 0) value = value.slice(0, comment).trim();
  const norm = value.toLowerCase();
  if (["true", "yes", "on", "1"].includes(norm)) return { present: true, value: true };
  if (["false", "no", "off", "0"].includes(norm)) return { present: true, value: false };
  return { present: true, invalid: true };
}

export function parseSkillDocument(raw) {
  const parts = splitFrontmatter(raw);
  if (!parts) return { ok: false, error: "缺少 YAML frontmatter（须以 --- 包围）" };
  const name = yamlLineField(parts.head, "name");
  const description = yamlLineField(parts.head, "description");
  if (!validSkillName(name)) return { ok: false, error: "frontmatter.name 必须是 kebab-case，例如 code-review" };
  if (!description) return { ok: false, error: "frontmatter.description 必填（单行）" };
  const disableModel = yamlBoolField(parts.head, "disable-model-invocation");
  const userInvocable = yamlBoolField(parts.head, "user-invocable");
  if (disableModel.invalid) return { ok: false, error: "disable-model-invocation 必须是布尔值（true/false）" };
  if (userInvocable.invalid) return { ok: false, error: "user-invocable 必须是布尔值（true/false）" };
  return {
    ok: true,
    name,
    description,
    whenToUse: yamlLineField(parts.head, "whenToUse"),
    modelInvocable: disableModel.value !== true,
    userInvocable: userInvocable.value !== false,
    body: parts.body,
    head: parts.head,
  };
}

export function renderSkillDocument(id, description, body = "") {
  if (!validSkillName(id)) throw new Error("invalid skill name");
  const desc = String(description || "").trim() || id;
  const text = String(body || "").replace(/^\uFEFF/, "");
  const parts = splitFrontmatter(text);
  const inner = parts ? parts.body : text;
  return `---\nname: ${id}\ndescription: ${yamlScalar(desc.slice(0, MAX_DESCRIPTION))}\n---\n\n${inner.replace(/^\r?\n/, "")}`;
}

function upsertYamlLine(head, key, value) {
  const line = `${key}: ${yamlScalar(value)}`;
  const re = new RegExp(`^${key}:\\s*.*$`, "m");
  if (re.test(head)) return head.replace(re, line);
  return `${line}\n${String(head || "").replace(/^\r?\n/, "")}`;
}

function removeYamlLine(head, key) {
  return String(head || "").replace(new RegExp(`^${key}:\\s*.*\\r?\\n?`, "m"), "");
}

/** 保留官方 metadata。extra 可改 whenToUse / 调用开关；未传的字段不动。 */
export function mergeSkillDocument(id, description, raw = "", extra = null) {
  const parsed = parseSkillDocument(raw);
  const desc = String(description || "").trim() || (parsed.ok ? parsed.description : "") || id;
  if (!parsed.ok) return mergeSkillDocument(id, desc, renderSkillDocument(id, desc, raw), extra);
  let head = upsertYamlLine(upsertYamlLine(parsed.head, "name", id), "description", desc.slice(0, MAX_DESCRIPTION));
  if (extra && extra.whenToUse != null) {
    const when = String(extra.whenToUse || "").trim();
    head = when ? upsertYamlLine(head, "whenToUse", when.slice(0, MAX_DESCRIPTION)) : removeYamlLine(head, "whenToUse");
  }
  if (extra && extra.modelInvocable === true) head = removeYamlLine(head, "disable-model-invocation");
  if (extra && extra.modelInvocable === false) head = upsertYamlLine(head, "disable-model-invocation", "true");
  if (extra && extra.userInvocable === true) head = removeYamlLine(head, "user-invocable");
  if (extra && extra.userInvocable === false) head = upsertYamlLine(head, "user-invocable", "false");
  return `---\n${head.replace(/^\r?\n/, "").replace(/\r?\n$/, "")}\n---\n\n${parsed.body.replace(/^\r?\n/, "")}`;
}

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
}

async function fileSize(fp) {
  try {
    return (await fsp.stat(fp)).size;
  } catch {
    return 0;
  }
}

async function pathExists(fp) {
  try {
    await fsp.access(fp);
    return true;
  } catch {
    return false;
  }
}

async function listBundleRelatives(fp, kind) {
  if (kind !== "bundle") return [];
  const dir = path.dirname(fp);
  const out = [];
  async function walk(root, prefix, depth) {
    if (depth > 3 || out.length >= 40) return;
    let entries = [];
    try {
      entries = await fsp.readdir(root, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIP_COPY_NAMES.has(entry.name) || entry.name.startsWith("._")) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isFile()) {
        if (entry.name !== "SKILL.md") out.push(rel);
      } else if (entry.isDirectory()) {
        await walk(path.join(root, entry.name), rel, depth + 1);
      }
    }
  }
  await walk(dir, "", 0);
  return out;
}

async function skillFromFile(id, fp, kind) {
  const content = await fsp.readFile(fp, "utf8");
  const parsed = parseSkillDocument(content);
  const files = await listBundleRelatives(fp, kind);
  return {
    id,
    kind,
    path: fp,
    content,
    description: parsed.ok ? parsed.description : "",
    whenToUse: parsed.ok ? parsed.whenToUse : "",
    modelInvocable: parsed.ok ? parsed.modelInvocable : false,
    userInvocable: parsed.ok ? parsed.userInvocable : false,
    files,
    valid: parsed.ok,
    error: parsed.ok ? null : parsed.error,
    size: Buffer.byteLength(content, "utf8"),
  };
}

export async function readSkill(dshHome, id, options) {
  if (!validSkillName(id)) throw new Error(`invalid skill name: ${id}`);
  const bundle = skillBundleFile(dshHome, id, options);
  if (await pathExists(bundle)) return skillFromFile(id, bundle, "bundle");
  const flat = skillFlatFile(dshHome, id, options);
  if (await pathExists(flat)) return skillFromFile(id, flat, "flat");
  const dir = skillsDir(dshHome, options);
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ".system") continue;
    const fp = path.join(dir, entry.name, "SKILL.md");
    if (!(await pathExists(fp))) continue;
    const parsed = parseSkillDocument(await fsp.readFile(fp, "utf8"));
    if (parsed.ok && parsed.name === id) return skillFromFile(id, fp, "bundle");
  }
  return null;
}

export async function listSkills(dshHome, options) {
  const dir = skillsDir(dshHome, options);
  const out = [];
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  const seen = new Set();
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === ".system") continue;
    if (entry.isDirectory()) {
      const fp = path.join(dir, entry.name, "SKILL.md");
      if (!(await pathExists(fp))) continue;
      const parsed = parseSkillDocument(await fsp.readFile(fp, "utf8"));
      const id = parsed.ok ? parsed.name : (validSkillName(entry.name) ? entry.name : "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(await skillFromFile(id, fp, "bundle"));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "SKILL.md") continue;
    const fallback = entry.name.slice(0, -3);
    const fp = path.join(dir, entry.name);
    const parsed = parseSkillDocument(await fsp.readFile(fp, "utf8"));
    const id = parsed.ok ? parsed.name : (validSkillName(fallback) ? fallback : "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(await skillFromFile(id, fp, "flat"));
  }
  return out;
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  for (const entry of await fsp.readdir(src, { withFileTypes: true })) {
    if (SKIP_COPY_NAMES.has(entry.name) || entry.name.startsWith("._")) continue;
    if (entry.isSymbolicLink()) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    assertInside(dest, to);
    if (entry.isDirectory()) await copyDir(from, to);
    else if (entry.isFile()) await fsp.copyFile(from, to);
  }
}

async function backupExisting(dshHome, id, options) {
  const sc = resolveSkillScope(dshHome, options);
  const existing = await readSkill(dshHome, id, options).catch(() => null);
  const root = sc.skillsRoot;
  const bundleDir = existing?.kind === "bundle" ? path.dirname(existing.path) : skillBundleDir(dshHome, id, options);
  const flat = existing?.kind === "flat" ? existing.path : skillFlatFile(dshHome, id, options);
  const hasBundle = await pathExists(bundleDir);
  const hasFlat = await pathExists(flat);
  if (!hasBundle && !hasFlat) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(sc.backupRoot, `${id}_${stamp}`);
  assertInside(sc.backupGuard, dest);
  await fsp.mkdir(dest, { recursive: true });
  if (hasBundle) {
    assertInside(root, bundleDir);
    await copyDir(bundleDir, path.join(dest, id));
  }
  if (hasFlat) {
    assertInside(root, flat);
    await fsp.copyFile(flat, path.join(dest, `${id}.md`));
  }
  return dest;
}

async function removeOfficialSkill(dshHome, id, options) {
  const existing = await readSkill(dshHome, id, options).catch(() => null);
  const root = skillsDir(dshHome, options);
  const bundleDir = existing?.kind === "bundle" ? path.dirname(existing.path) : skillBundleDir(dshHome, id, options);
  const flat = existing?.kind === "flat" ? existing.path : skillFlatFile(dshHome, id, options);
  if (await pathExists(bundleDir)) {
    assertInside(root, bundleDir);
    await fsp.rm(bundleDir, { recursive: true, force: true });
  }
  if (await pathExists(flat)) {
    assertInside(root, flat);
    await fsp.rm(flat, { force: true });
  }
  const canonical = skillBundleDir(dshHome, id, options);
  if (canonical !== bundleDir && await pathExists(canonical)) {
    assertInside(root, canonical);
    await fsp.rm(canonical, { recursive: true, force: true });
  }
}

export async function saveSkill(dshHome, id, content, description, extra, options) {
  if (!validSkillName(id)) throw new Error(`invalid skill name: ${id}`);
  const parsed = parseSkillDocument(content);
  const desc = String(description || "").trim() || (parsed.ok ? parsed.description : "");
  const document = mergeSkillDocument(id, desc, String(content || ""), extra || null);
  if (Buffer.byteLength(document, "utf8") > MAX_SKILL_BYTES) {
    throw new Error("skill too large (max 256KB)");
  }
  const check = parseSkillDocument(document);
  if (!check.ok) throw new Error(check.error);
  const root = skillsDir(dshHome, options);
  const existing = await readSkill(dshHome, id, options).catch(() => null);
  const dest = existing?.path || skillBundleFile(dshHome, id, options);
  assertInside(root, dest);
  const backup = existing ? await backupExisting(dshHome, id, options) : null;
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.writeFile(dest, document, "utf8");
  const kind = existing?.kind || "bundle";
  return {
    id,
    kind,
    scope: resolveSkillScope(dshHome, options).scope,
    path: dest,
    description: check.description,
    whenToUse: check.whenToUse || "",
    modelInvocable: check.modelInvocable,
    userInvocable: check.userInvocable,
    files: await listBundleRelatives(dest, kind),
    backup,
    size: Buffer.byteLength(document, "utf8"),
    content: document,
    valid: true,
  };
}

export async function deleteSkill(dshHome, id, options) {
  if (!validSkillName(id)) throw new Error(`invalid skill name: ${id}`);
  const existing = await readSkill(dshHome, id, options);
  if (!existing) throw new Error(`skill not found: ${id}`);
  const backup = await backupExisting(dshHome, id, options);
  await removeOfficialSkill(dshHome, id, options);
  return { id, backup, path: existing.path, scope: resolveSkillScope(dshHome, options).scope };
}

function kebabFromLabel(name) {
  const base = String(name || "")
    .replace(/\.(zip|tgz|tar\.gz|tar|skill)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return validSkillName(base) ? base : "";
}

function isUnsafeArchiveEntry(name) {
  const rel = String(name || "").replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/+$/, "");
  if (!rel) return false;
  if (rel.startsWith("/") || /^[A-Za-z]:/.test(rel)) return true;
  return rel.split("/").some((part) => part === ".." || part === "");
}

function listArchiveEntries(archivePath) {
  const result = spawnSync("tar", ["-tf", archivePath], {
    windowsHide: true,
    encoding: "utf8",
    timeout: 15000,
  });
  if (result.status !== 0) return null;
  return String(result.stdout || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function extractArchive(archivePath, dest) {
  const entries = listArchiveEntries(archivePath);
  if (entries && entries.some(isUnsafeArchiveEntry)) {
    throw new Error("压缩包路径不合法");
  }
  if (entries && entries.length > MAX_IMPORT_FILES) {
    throw new Error("压缩包里文件太多");
  }
  const result = spawnSync("tar", ["-xf", archivePath, "-C", dest], {
    windowsHide: true,
    encoding: "utf8",
    timeout: 30000,
  });
  if (result.status === 0) return;
  if (/\.zip$/i.test(archivePath) && process.platform === "win32") {
    const ps = spawnSync("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${String(archivePath).replace(/'/g, "''")}' -DestinationPath '${String(dest).replace(/'/g, "''")}' -Force`,
    ], {
      windowsHide: true,
      encoding: "utf8",
      timeout: 30000,
    });
    if (ps.status === 0) return;
  }
  const detail = String(result.stderr || result.stdout || "").trim();
  throw new Error(detail || "无法解压，请改用文件夹导入");
}

async function walkFiles(root, onFile, depth = 0) {
  if (depth > 6) return;
  let entries = [];
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "." || entry.name === ".." || entry.name === ".system" || entry.name === "__MACOSX" || entry.name === ".DS_Store") continue;
    if (entry.name.startsWith("._")) continue;
    const full = path.join(root, entry.name);
    assertInside(root, full);
    if (entry.isDirectory()) await walkFiles(full, onFile, depth + 1);
    else if (entry.isFile()) await onFile(full);
  }
}

export async function findSkillRoots(root) {
  const dirs = [];
  const flats = [];
  async function visit(dir, depth) {
    if (depth > 4) return;
    let entries = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) {
      dirs.push(dir);
      return;
    }
    for (const entry of entries) {
      if (entry.name === "." || entry.name === "..") continue;
      if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "SKILL.md") {
        const raw = await fsp.readFile(path.join(dir, entry.name), "utf8");
        if (parseSkillDocument(raw).ok) flats.push(path.join(dir, entry.name));
      }
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "." || entry.name === ".." || entry.name === ".system" || entry.name === "__MACOSX") continue;
      const next = path.join(dir, entry.name);
      assertInside(root, next);
      await visit(next, depth + 1);
    }
  }
  await visit(root, 0);
  return { dirs, flats };
}

async function installBundleDir(dshHome, srcDir, fallbackId, options) {
  const mdPath = path.join(srcDir, "SKILL.md");
  const raw = await fsp.readFile(mdPath, "utf8");
  const parsed = parseSkillDocument(raw);
  const id = parsed.ok ? parsed.name : kebabFromLabel(fallbackId || path.basename(srcDir));
  if (!validSkillName(id)) throw new Error("压缩包/文件夹里没有合法的 Skill 名称");
  const dest = skillBundleDir(dshHome, id, options);
  assertInside(skillsDir(dshHome, options), dest);
  const backup = await backupExisting(dshHome, id, options);
  await removeOfficialSkill(dshHome, id, options);
  await copyDir(srcDir, dest);
  const destMd = path.join(dest, "SKILL.md");
  if (parsed.ok && parsed.name !== id) {
    await fsp.writeFile(destMd, mergeSkillDocument(id, parsed.description, raw), "utf8");
  } else if (!parsed.ok && !String(raw).replace(/^\uFEFF/, "").startsWith("---")) {
    await fsp.writeFile(destMd, renderSkillDocument(id, id, raw), "utf8");
  }
  return { id, path: destMd, backup, description: parsed.ok ? parsed.description : id };
}

async function installFlatFile(dshHome, srcFile, fallbackId, options) {
  const raw = await fsp.readFile(srcFile, "utf8");
  const parsed = parseSkillDocument(raw);
  const id = parsed.ok ? parsed.name : kebabFromLabel(fallbackId || path.basename(srcFile, ".md"));
  if (!parsed.ok) throw new Error(parsed.error);
  return saveSkill(dshHome, id, raw, parsed.description, null, options);
}

async function installFoundSkills(dshHome, root, fallbackId, options) {
  const found = await findSkillRoots(root);
  const imported = [];
  for (const dir of found.dirs) {
    imported.push(await installBundleDir(dshHome, dir, fallbackId || path.basename(dir), options));
  }
  if (!imported.length) {
    for (const file of found.flats) {
      imported.push(await installFlatFile(dshHome, file, fallbackId, options));
    }
  }
  if (!imported.length) throw new Error("未找到 SKILL.md 或合法的 Skill 文件");
  return imported;
}

export async function importArchive(dshHome, buffer, filename = "skill.zip", options) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!bytes.length) throw new Error("压缩包是空的");
  if (bytes.length > MAX_ARCHIVE_BYTES) throw new Error("压缩包太大（最大 12MB）");
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), "dshp-skill-"));
  const archive = path.join(temp, path.basename(filename) || "skill.zip");
  const unpacked = path.join(temp, "unpacked");
  try {
    await fsp.mkdir(unpacked, { recursive: true });
    await fsp.writeFile(archive, bytes);
    extractArchive(archive, unpacked);
    await walkFiles(unpacked, async () => {});
    const imported = await installFoundSkills(dshHome, unpacked, kebabFromLabel(filename), options);
    return { imported: imported.map((item) => toPublicSkill(dshHome, item, options)) };
  } finally {
    await fsp.rm(temp, { recursive: true, force: true }).catch(() => {});
  }
}

export async function importFileTree(dshHome, files, fallbackId = "", options) {
  if (!Array.isArray(files) || !files.length) throw new Error("文件夹是空的");
  if (files.length > MAX_IMPORT_FILES) throw new Error("文件夹里文件太多");
  const temp = await fsp.mkdtemp(path.join(os.tmpdir(), "dshp-skill-"));
  try {
    let total = 0;
    for (const file of files) {
      const rel = String(file?.path || file?.name || "").replace(/\\/g, "/").replace(/^\/+/, "");
      if (!rel || rel.includes("..") || path.isAbsolute(rel) || isUnsafeArchiveEntry(rel)) {
        throw new Error("文件夹路径不合法");
      }
      const dest = path.join(temp, rel);
      assertInside(temp, dest);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      const text = typeof file.content === "string" ? file.content : "";
      const raw = file.encoding === "base64" ? Buffer.from(text, "base64") : Buffer.from(text, "utf8");
      total += raw.length;
      if (raw.length > MAX_ARCHIVE_BYTES || total > MAX_ARCHIVE_BYTES) throw new Error("文件太大");
      await fsp.writeFile(dest, raw);
    }
    const imported = await installFoundSkills(dshHome, temp, fallbackId, options);
    return { imported: imported.map((item) => toPublicSkill(dshHome, item, options)) };
  } finally {
    await fsp.rm(temp, { recursive: true, force: true }).catch(() => {});
  }
}

export async function importFromPath(dshHome, sourcePath, options) {
  const src = path.resolve(String(sourcePath || ""));
  const stat = await fsp.stat(src);
  if (stat.isDirectory()) {
    const imported = await installFoundSkills(dshHome, src, kebabFromLabel(path.basename(src)), options);
    return { imported: imported.map((item) => toPublicSkill(dshHome, item, options)) };
  }
  if (stat.isFile()) {
    const name = path.basename(src);
    if (/\.(zip|tgz|tar\.gz|tar|skill)$/i.test(name)) {
      return importArchive(dshHome, await fsp.readFile(src), name, options);
    }
    return { imported: [toPublicSkill(dshHome, await installFlatFile(dshHome, src, kebabFromLabel(name), options), options)] };
  }
  throw new Error("只能导入压缩包或文件夹");
}

function summarizeSkill(dshHome, item, options) {
  const pub = toPublicSkill(dshHome, item, options);
  return {
    id: pub.id,
    scope: pub.scope || (options && options.scope) || "user",
    description: pub.description,
    whenToUse: pub.whenToUse || "",
    modelInvocable: pub.modelInvocable !== false,
    userInvocable: pub.userInvocable !== false,
    kind: pub.kind,
    files: pub.files || [],
    valid: pub.valid,
    error: pub.error,
    size: pub.size,
    path: pub.path,
  };
}

async function readWorkspaceState(dshHome) {
  try {
    return JSON.parse(await fsp.readFile(workspaceStateFile(dshHome), "utf8"));
  } catch {
    return {};
  }
}

async function writeWorkspaceState(dshHome, next) {
  const file = workspaceStateFile(dshHome);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(next, null, 2), "utf8");
}

export async function findProjectRoot(cwd) {
  let dir = path.resolve(String(cwd || ""));
  for (let i = 0; i < 32; i += 1) {
    if (await pathExists(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(String(cwd || ""));
}

function samePath(a, b) {
  try {
    return path.resolve(a) === path.resolve(b);
  } catch {
    return false;
  }
}

async function addWorkspace(out, seen, dshHome, rawPath, name, id) {
  if (!rawPath || typeof rawPath !== "string") return;
  let root;
  try {
    root = await findProjectRoot(rawPath);
  } catch {
    return;
  }
  if (!root || samePath(root, dshHome)) return;
  const key = path.resolve(root).toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    id: id || workspaceIdFor(root),
    name: String(name || path.basename(root) || "workspace"),
    root,
  });
}

export async function listWorkspaces(dshHome, ctx = hostCtx) {
  const out = [];
  const seen = new Set();
  const registry = hostService(ctx, "workspaceRegistry");
  const listed = registry?.list?.() || registry?.workspaces || [];
  for (const workspace of listed) {
    await addWorkspace(out, seen, dshHome, workspace?.path || workspace?.root || workspace?.cwd || workspace?.folder, workspace?.name || workspace?.title, workspace?.id);
  }
  const store = hostService(ctx, "sessions");
  let sessions = [];
  try {
    sessions = store?.list?.() || [];
  } catch {
    sessions = [];
  }
  if (!Array.isArray(sessions) && sessions && typeof sessions === "object") {
    sessions = [...(sessions.values?.() || []), ...Object.values(sessions)];
  }
  for (const session of sessions) {
    await addWorkspace(out, seen, dshHome, session?.header?.cwd || session?.cwd || session?.meta?.cwd);
  }
  const pinned = await readWorkspaceState(dshHome);
  if (pinned.projectRoot) await addWorkspace(out, seen, dshHome, pinned.projectRoot, path.basename(pinned.projectRoot), pinned.workspaceId);
  return out;
}

export async function pickWorkspace(dshHome, wantedId, ctx = hostCtx) {
  const workspaces = await listWorkspaces(dshHome, ctx);
  if (wantedId) {
    const hit = workspaces.find((item) => item.id === wantedId);
    if (hit) return hit;
  }
  const pinned = await readWorkspaceState(dshHome);
  if (pinned.workspaceId) {
    const hit = workspaces.find((item) => item.id === pinned.workspaceId);
    if (hit) return hit;
  }
  if (pinned.projectRoot) {
    const hit = workspaces.find((item) => samePath(item.root, pinned.projectRoot));
    if (hit) return hit;
    return {
      id: workspaceIdFor(pinned.projectRoot),
      name: path.basename(pinned.projectRoot) || "workspace",
      root: path.resolve(pinned.projectRoot),
    };
  }
  return workspaces[0] || null;
}

export async function setWorkspace(dshHome, body = {}, ctx = hostCtx) {
  let root = "";
  if (typeof body.path === "string" && body.path.trim()) {
    root = await findProjectRoot(body.path.trim());
    if (!(await pathExists(root))) throw new Error("工作区不存在");
  } else if (body.id) {
    const hit = (await listWorkspaces(dshHome, ctx)).find((item) => item.id === body.id);
    if (!hit) throw new Error("未找到该工作区");
    root = hit.root;
  } else {
    throw new Error("需要工作区");
  }
  const id = workspaceIdFor(root);
  await writeWorkspaceState(dshHome, { projectRoot: root, workspaceId: id });
  return { workspace_id: id, workspace_name: path.basename(root) || "workspace" };
}

export async function skillsStatus(dshHome, options = {}) {
  const workspaces = await listWorkspaces(dshHome, options.ctx || hostCtx);
  const selected = await pickWorkspace(dshHome, options.workspaceId || options.workspace, options.ctx || hostCtx);
  const userListed = await listSkills(dshHome, { scope: "user" });
  const projectOpts = selected ? { scope: "project", projectRoot: selected.root } : null;
  const projectListed = projectOpts ? await listSkills(dshHome, projectOpts) : [];
  const projectIds = new Set(projectListed.map((item) => item.id));
  return {
    skills_dir: "$DSH_HOME/skills",
    workspace_dir: "$WORKSPACE/.dsh/skills",
    workspace_id: selected?.id || "",
    workspace_name: selected?.name || "",
    workspace_ready: Boolean(selected?.root),
    workspaces: workspaces.map((item) => ({
      id: item.id,
      name: item.name,
      selected: selected ? item.id === selected.id : false,
    })),
    skills: [
      ...userListed.map((item) => ({
        ...summarizeSkill(dshHome, item, { scope: "user" }),
        shadowed: projectIds.has(item.id),
      })),
      ...projectListed.map((item) => summarizeSkill(dshHome, item, projectOpts)),
    ],
  };
}
