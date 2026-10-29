/**
 * 用户层 profile/cordis.patch.yml 的本体 insert（#154 / #159）。
 *
 * 包内 overlay 只改已入队行的 inject/config，不能再 insert 一次（Hub 已入队会
 * already queued）。postinstall 和演练台子行都走这里：行不存在就写一条。
 */
import fs from "node:fs";
import path from "node:path";

export const PURGE_NAME = "dsh-purge";

export const INSERT_BLOCK = [
  "- insert:",
  "    - id: dsh-purge",
  "      name: dsh-purge",
  "      inject: [systemPrompt, tools]",
  "      config:",
  "        enabled: true",
  "        stripMnemon: true",
  "        capabilityProtocol: true",
  "        hooksDenyBypass: true",
  "",
].join("\n");

export function profileHasPurgeBodyInsert(text) {
  const lines = String(text || "").split(/\r?\n/);
  let insertIndent = -1;
  for (const line of lines) {
    if (/^-\s*insert:\s*$/.test(line) || /^\s+-\s*insert:\s*$/.test(line)) {
      insertIndent = (line.match(/^[ \t]*/) || [""])[0].length;
      continue;
    }
    if (insertIndent < 0) continue;
    const indent = (line.match(/^[ \t]*/) || [""])[0].length;
    const trimmed = line.trim();
    if (trimmed && indent <= insertIndent && /^-\s/.test(trimmed)) {
      insertIndent = -1;
      if (/^-\s*insert:\s*$/.test(trimmed)) {
        insertIndent = indent;
      }
      continue;
    }
    // 本体行：id: dsh-purge，或用户按 #159 临时绕过写的 dsh-purge-main / name: dsh-purge
    if (/^-\s*id:\s*dsh-purge(-main)?\s*$/.test(trimmed)) return true;
    if (/^-\s*name:\s*dsh-purge\s*$/.test(trimmed)) return true;
  }
  return false;
}

export function ensureProfileBodyInsert(profileDir) {
  const fp = path.join(profileDir, "cordis.patch.yml");
  let text = "";
  try { text = fs.readFileSync(fp, "utf8"); } catch { text = ""; }
  if (profileHasPurgeBodyInsert(text)) {
    return { ok: true, wrote: false, path: fp };
  }
  const prefix = text && !text.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(fp, `${text}${prefix}${text ? "\n" : ""}${INSERT_BLOCK}`, "utf8");
  return { ok: true, wrote: true, path: fp };
}

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

function profileOwnsPurge(dir) {
  const pkg = readJson(path.join(dir, "package.json"));
  const bundles = pkg?.dsh?.profile?.bundles;
  if (Array.isArray(bundles) && bundles.includes(PURGE_NAME)) return true;
  try {
    return fs.existsSync(path.join(dir, "node_modules", PURGE_NAME, "package.json"));
  } catch {
    return false;
  }
}

export function listProfileDirs(dshHome) {
  const root = path.join(dshHome || "", "profiles");
  const out = [];
  let names = [];
  try { names = fs.readdirSync(root); } catch { return out; }
  for (const name of names) {
    const dir = path.join(root, name);
    try {
      if (fs.statSync(dir).isDirectory()) out.push(dir);
    } catch { /* skip */ }
  }
  return out;
}

export function ensureProfileBundles(profileDir) {
  const fp = path.join(profileDir, "package.json");
  const pkg = readJson(fp);
  if (!pkg) return { ok: false, wrote: false, path: fp };
  pkg.dsh = pkg.dsh && typeof pkg.dsh === "object" ? pkg.dsh : {};
  pkg.dsh.profile = pkg.dsh.profile && typeof pkg.dsh.profile === "object" ? pkg.dsh.profile : {};
  const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : [];
  if (bundles.includes(PURGE_NAME)) return { ok: true, wrote: false, path: fp };
  pkg.dsh.profile.bundles = [...bundles, PURGE_NAME];
  fs.writeFileSync(fp, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  return { ok: true, wrote: true, path: fp };
}

function readPkgTarball() {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return String(pkg?.dsh?.install?.tarball || "").trim();
  } catch {
    return "https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master";
  }
}

/**
 * 从 profile 的 pnpm-lock.yaml 读 dsh-purge 实际解析到的 tarball URL（#180）。
 * 用户用 `github:user/repo#<commit>` 固定 commit 安装时，lock 里记录的是
 * `.../tar.gz/<commit>`，写死 master URL 会和实际键并存成两个 URL 键。
 * 简单文本/正则解析即可，不引 yaml 依赖；读不到返回空串。
 */
function readPurgeTarballFromLock(profileDir) {
  if (!profileDir) return "";
  let text = "";
  try {
    text = fs.readFileSync(path.join(profileDir, "pnpm-lock.yaml"), "utf8");
  } catch {
    return "";
  }
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  let inImporters = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\S/.test(line)) {
      if (inImporters) break; // 已扫过 importers，遇到下一个顶层键就结束
      inImporters = /^importers[ \t]*:/.test(line);
      continue;
    }
    if (!inImporters) continue;
    const entry = line.match(/^([ \t]+)dsh-purge[ \t]*:[ \t]*$/);
    if (!entry) continue;
    const indent = entry[1].length;
    // 收集该条目下的 specifier / version 行，直到缩进回到条目本身
    let specifier = "";
    let version = "";
    for (let j = i + 1; j < lines.length; j += 1) {
      const sub = lines[j];
      if (sub.trim() && (sub.match(/^[ \t]*/) || [""])[0].length <= indent) break;
      const sm = sub.match(/^[ \t]+(specifier|version)[ \t]*:[ \t]*(.*)$/);
      if (!sm) continue;
      let value = String(sm[2] || "").trim();
      // 掉引号：pnpm-lock 里带引号与否取决于内容
      if (/^(["']).*\1[ \t]*$/.test(value)) value = value.slice(1, -1).trim();
      if (sm[1] === "specifier") specifier = value;
      else version = value;
    }
    // version 是实际解析结果，优先；specifier 只是没有 URL 化版本时兜底
    for (const candidate of [version, specifier]) {
      const url = String(candidate || "").match(/https?:\/\/[^\s'"]+/);
      if (url) return url[0];
    }
    return "";
  }
  return "";
}

/**
 * pnpm allowBuilds 期望键（#185）。
 * 注意：在 pnpm 11 下，allowBuilds 中写入 `name@https://...` 这类含 URL 的 key 会被 semver 解析器
 * 误判为非法版本联合，直接触发 `[ERR_PNPM_INVALID_VERSION_UNION]` 导致 pnpm install 彻底崩溃。
 * 只要声明了裸包名 `dsh-purge: true`，pnpm 便会在构建阶段放行 postinstall 脚本，
 * 同时历史遗留的 `dsh-purge@https*` 畸形/URL 键会在 rewrite 时被安全自愈剔除。
 */
export function purgePnpmBuildSpecs(profileDir) {
  return [PURGE_NAME];
}

function isPurgeAllowBuildKey(key) {
  const name = String(key || "").replace(/^['"]|['"]$/g, "");
  return name === PURGE_NAME || name.startsWith(`${PURGE_NAME}@`);
}

/** 导出仅供单测 round-trip（#180）。 */
export function parseAllowBuildLine(line) {
  const text = String(line || "").replace(/\r$/, "");
  // 引号包裹：键整段取出，URL 里的冒号不会切碎键
  const quoted = text.match(/^[ \t]+(?:"([^"]+)"|'([^']+)')[ \t]*:[ \t]*(.*?)\s*$/);
  if (quoted) return { key: quoted[1] !== undefined ? quoted[1] : quoted[2], value: String(quoted[3] || "").trim() };
  // 未加引号的键：要求有缩进（顶层键不算），只在「冒号+空白（或行尾）」处切分，且取最后一次出现的位置——
  // URL 里的 `:` 后面跟的是 `/`，不会断键；`dsh-purge@https: true`（畸形历史键）也能正常切成键+值（#180）
  if (!/^[ \t]+/.test(text)) return null;
  let split = -1;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== ":") continue;
    if (i + 1 >= text.length || /[ \t]/.test(text[i + 1])) split = i;
  }
  if (split < 0) return null;
  const key = text.slice(0, split).trim();
  if (!key) return null;
  return { key, value: text.slice(split + 1).trim() };
}

/** 导出仅供单测 round-trip（#180）。 */
export function formatAllowBuildLine(key) {
  const name = String(key || "");
  // 含 `://` 的 URL 键加引号，避免 YAML 把 URL 里的冒号当分隔符（#180）
  if (name.includes("://")) return `  ${JSON.stringify(name)}: true`;
  return `  ${name}: true`;
}

/**
 * 重写前做最小校验：顶层键、allowBuilds 段内键都不重复，每个键写回格式都能被
 * parseAllowBuildLine 无损还原。校验不过就不写盘，宁可不动用户的文件（#180）。
 * 导出仅供单测（#180）。
 */
export function validateAllowBuildRewrite(text) {
  const lines = String(text || "").split("\n");
  let inAllow = false;
  let allowIndent = -1;
  const topKeys = new Set();
  const allowKeys = new Set();
  for (const line of lines) {
    if (!line.trim()) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue; // 注释行原样保留，不参与校验
    if (/^\S/.test(line)) {
      inAllow = /^allowBuilds[ \t]*:/.test(line);
      allowIndent = -1;
      const m = line.match(/^(\S+?)[ \t]*:/);
      if (!m) return false;
      if (topKeys.has(m[1])) return false;
      topKeys.add(m[1]);
      continue;
    }
    if (!inAllow) continue;
    const indent = (line.match(/^[ \t]*/) || [""])[0].length;
    if (allowIndent < 0) allowIndent = indent;
    if (indent < allowIndent) {
      // 缩进回到 allowBuilds 的子键层级以上，说明段已结束
      inAllow = false;
      continue;
    }
    const parsed = parseAllowBuildLine(line);
    if (!parsed || !parsed.key) return false;
    const name = parsed.key;
    if (allowKeys.has(name)) return false;
    // 写回后的行必须能无损解析出同一个键
    if (parseAllowBuildLine(formatAllowBuildLine(name))?.key !== name) return false;
    allowKeys.add(name);
  }
  return true;
}

/**
 * 把 dsh-purge 以及 `dsh-purge@tarball` 都写成 true，避免装别的插件还报 ERR_PNPM_IGNORED_BUILDS（#168）。
 * profileDir 可选：给了就从该 profile 的 pnpm-lock.yaml 读实际 tarball URL（#180）。
 * 期望键精确命中的才保留；其它一切 `dsh-purge@*` 历史键（畸形 `dsh-purge@https`、过期版本/commit URL）一律丢弃，
 * 让旧的污染文件在下一次 ensure 时自动清干净。
 */
export function rewritePnpmAllowBuilds(raw, profileDir) {
  const wanted = purgePnpmBuildSpecs(profileDir);
  const wantedSet = new Set(wanted);
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const wantedBlock = wanted.map(formatAllowBuildLine);
  if (!text.trim()) {
    return `allowBuilds:\n${wantedBlock.join("\n")}\n`;
  }
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^allowBuilds[ \t]*:/.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    const prefix = text.endsWith("\n") ? "" : "\n";
    return `${text}${prefix}\nallowBuilds:\n${wantedBlock.join("\n")}\n`;
  }
  let end = lines.length;
  const kept = [];
  const seen = new Set();
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      end = i;
      break;
    }
    if (/^\S/.test(line)) {
      end = i;
      break;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      kept.push(line);
      continue;
    }
    const parsed = parseAllowBuildLine(line);
    if (!parsed) {
      kept.push(line);
      continue;
    }
    if (isPurgeAllowBuildKey(parsed.key)) {
      // 只保留精确等于期望键的行，且去重；其余历史 purge 键丢弃（#180 自愈）
      if (!wantedSet.has(parsed.key) || seen.has(parsed.key)) continue;
      kept.push(formatAllowBuildLine(parsed.key));
      seen.add(parsed.key);
      continue;
    }
    // 非 purge 键原样保留；同键重复（会让 pnpm 报 duplicated mapping key）只留第一份
    if (seen.has(parsed.key)) continue;
    seen.add(parsed.key);
    kept.push(line);
  }
  for (let i = 0; i < wanted.length; i += 1) {
    if (!seen.has(wanted[i])) {
      kept.push(wantedBlock[i]);
      seen.add(wanted[i]);
    }
  }
  const next = [...lines.slice(0, start + 1), ...kept, ...lines.slice(end)].join("\n");
  return next.endsWith("\n") ? next : `${next}\n`;
}

/** pnpm 11/12 默认拦 postinstall（ERR_PNPM_IGNORED_BUILDS）。写进 profile 的 allowBuilds，下次 add 能跑脚本。 */
export function ensurePnpmAllowBuild(profileDir) {
  const fp = path.join(profileDir, "pnpm-workspace.yaml");
  let text = "";
  try { text = fs.readFileSync(fp, "utf8"); } catch { text = ""; }
  const current = String(text || "").replace(/\r\n/g, "\n");
  const next = rewritePnpmAllowBuilds(current, profileDir);
  if (next === current) return { ok: true, wrote: false, path: fp };
  // 写前校验不过就不写盘，宁可保持现状（#180）
  if (!validateAllowBuildRewrite(next)) return { ok: false, wrote: false, path: fp, reason: "allowBuilds-invalid" };
  fs.writeFileSync(fp, next, "utf8");
  return { ok: true, wrote: true, path: fp };
}

/** 已装进 bundles / node_modules 但缺 insert 的 profile，补上本体行。 */
export function ensureAllProfileBodyInserts(dshHome) {
  return ensureAllProfileInstall(dshHome).map((item) => ({
    dir: item.dir,
    ok: item.ok,
    wrote: Boolean(item.insert?.wrote),
    path: item.insert?.path || path.join(item.dir || "", "cordis.patch.yml"),
    error: item.error,
  }));
}

/** bundles + 本体 insert + pnpm allowBuilds。postinstall 被跳过、升级覆盖 overlay 之后靠这条把按钮找回来。 */
export function ensureAllProfileInstall(dshHome) {
  const results = [];
  for (const dir of listProfileDirs(dshHome)) {
    if (!profileOwnsPurge(dir)) continue;
    try {
      const bundles = ensureProfileBundles(dir);
      const insert = ensureProfileBodyInsert(dir);
      const pnpm = ensurePnpmAllowBuild(dir);
      results.push({ dir, ok: true, bundles, insert, pnpm });
    } catch (error) {
      results.push({
        dir,
        ok: false,
        error: error && error.message ? error.message : String(error),
      });
    }
  }
  return results;
}
