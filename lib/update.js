import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDshHome } from "./core.js";
import { adapterFor, detectSurface } from "./surface.js";
import { cliInvocation } from "./desktop.js";

const REPO = "YuJunZhiXue/dsh-purge";
const STABLE_REF = "master";
const BETA_REF = "beta";
export const TARBALL_URL = `https://github.com/${REPO}/archive/refs/heads/${STABLE_REF}.tar.gz`;
const PLUGIN_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const CHANNELS = {
  stable: { id: "stable", ref: STABLE_REF, label: "正式版" },
  beta: { id: "beta", ref: BETA_REF, label: "测试版" },
};
const COPY_NAMES = [
  "lib",
  "bin",
  "docs",
  "client.js",
  "cordis.patch.yml",
  "screenshots.json",
  "package.json",
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
];

const HIDDEN = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
  windowsHide: true,
  timeout: 20000,
};

export function pluginRoot() {
  return PLUGIN_ROOT;
}

export function localVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "package.json"), "utf8"));
    return String(pkg.version || "");
  } catch {
    return "";
  }
}

function channelStatePath() {
  return path.join(findDshHome(), "dsh-purge", "channel.json");
}

function historyPath() {
  return path.join(findDshHome(), "dsh-purge", "version-history.json");
}

function stampPath() {
  return path.join(findDshHome(), "dsh-purge", "installed-rev");
}

export function normalizeChannel(value) {
  return String(value || "").toLowerCase() === "beta" ? "beta" : "stable";
}

function isBetaName(name) {
  return /(?:^|[-._])(beta|rc|pre|preview|test)(?:\d|$|[-._])/i.test(String(name || ""));
}

function withdrawnVersion(item) {
  const text = [item?.version, item?.ref, item?.id].filter(Boolean).join(" ");
  return /(?:^|[\sv])1\.1\.11-beta/i.test(String(text).replace(/^v/i, " "));
}

function splitVersion(raw) {
  const text = String(raw || "").trim().replace(/^v/i, "");
  const cut = text.split("-");
  const core = String(cut[0] || "").split(".").map((n) => parseInt(n, 10) || 0);
  return { core: [core[0] || 0, core[1] || 0, core[2] || 0], pre: cut.slice(1).join("-") };
}

export function versionIsNewer(remote, local) {
  if (!remote) return false;
  if (!local) return true;
  if (String(remote) === String(local)) return false;
  const a = splitVersion(remote);
  const b = splitVersion(local);
  for (let i = 0; i < 3; i += 1) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i];
  }
  if (a.pre && !b.pre) return false;
  if (!a.pre && b.pre) return true;
  return a.pre > b.pre;
}

export function latestStableVersion(versions) {
  let best = "";
  for (const item of versions || []) {
    if (!item || item.channel === "beta") continue;
    const ver = String(item.version || "").replace(/^v/i, "");
    if (!/^\d+\.\d+\.\d+/.test(ver) || isBetaName(ver)) continue;
    if (!best || versionIsNewer(ver, best)) best = ver;
  }
  return best;
}

/** 正式版已经追上的测试版不再列出。1.1.11-beta 始终下线。 */
export function hideListedVersion(item, stableVersion = "") {
  if (!item || withdrawnVersion(item)) return true;
  const beta = item.channel === "beta" || isBetaName(item.version) || isBetaName(item.ref) || isBetaName(item.id);
  if (!beta) return false;
  const ceiling = String(stableVersion || "").replace(/^v/i, "");
  if (!ceiling || isBetaName(ceiling)) return false;
  const ver = String(item.version || item.ref || item.id || "").replace(/^v/i, "");
  if (!/^\d+\.\d+/.test(ver)) return false;
  return !versionIsNewer(ver, ceiling);
}

export function readChannelState() {
  const raw = readJson(channelStatePath()) || {};
  return {
    channel: normalizeChannel(raw.channel),
    pin: typeof raw.pin === "string" ? raw.pin.trim() : "",
  };
}

function writeChannelState(next) {
  const state = {
    channel: normalizeChannel(next?.channel),
    pin: typeof next?.pin === "string" ? next.pin.trim() : "",
  };
  fs.mkdirSync(path.dirname(channelStatePath()), { recursive: true });
  fs.writeFileSync(channelStatePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

export function channelPublic(state = readChannelState()) {
  const meta = CHANNELS[state.channel] || CHANNELS.stable;
  return {
    channel: meta.id,
    channelLabel: meta.label,
    pin: state.pin || "",
  };
}

function currentChannelRef(state = readChannelState()) {
  return (CHANNELS[state.channel] || CHANNELS.stable).ref;
}

function readHistory() {
  const raw = readJson(historyPath());
  const rows = Array.isArray(raw) ? raw : [];
  return rows.filter((item) => item && !withdrawnVersion(item));
}

function pushHistory(entry) {
  const next = [entry, ...readHistory().filter((item) => item && item.ref !== entry.ref)].slice(0, 20);
  fs.mkdirSync(path.dirname(historyPath()), { recursive: true });
  fs.writeFileSync(historyPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function archiveZipUrl(ref) {
  const value = String(ref || STABLE_REF);
  if (/^[0-9a-f]{40}$/i.test(value)) return `https://github.com/${REPO}/archive/${value}.zip`;
  if (/^v?\d/.test(value)) return `https://github.com/${REPO}/archive/refs/tags/${encodeURIComponent(value)}.zip`;
  return `https://github.com/${REPO}/archive/refs/heads/${encodeURIComponent(value)}.zip`;
}

function archiveTarballUrl(ref) {
  const value = String(ref || STABLE_REF);
  if (/^[0-9a-f]{40}$/i.test(value)) return `https://github.com/${REPO}/archive/${value}.tar.gz`;
  if (/^v?\d/.test(value)) return `https://github.com/${REPO}/archive/refs/tags/${encodeURIComponent(value)}.tar.gz`;
  return `https://github.com/${REPO}/archive/refs/heads/${encodeURIComponent(value)}.tar.gz`;
}

function readStamp() {
  try {
    return fs.readFileSync(stampPath(), "utf8").trim();
  } catch {
    return "";
  }
}

function writeStamp(value) {
  if (!value) return;
  const fp = stampPath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, `${value}\n`, "utf8");
}

function sameRev(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

export function realPath(dir) {
  try {
    return fs.realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

function readJson(fp) {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

function isGitCheckout(dir) {
  return fs.existsSync(path.join(dir, ".git"));
}

function canGit(dir) {
  if (!isGitCheckout(dir)) return false;
  try {
    execFileSync("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"], HIDDEN);
    return true;
  } catch {
    return false;
  }
}

function gitOk() {
  return canGit(PLUGIN_ROOT);
}

function gitHead(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], HIDDEN).trim();
  } catch {
    return "";
  }
}

export function isLinkSpec(spec) {
  const s = String(spec || "");
  return /^(link|file):/i.test(s) || s === "." || /^\.\.?(?:[/\\]|$)/.test(s);
}

export function resolveLinkDir(profileDir, spec) {
  const raw = String(spec).replace(/^(link|file):/i, "");
  return path.resolve(profileDir, raw);
}

export function findPurgeProfiles() {
  const root = path.join(findDshHome(), "profiles");
  if (!fs.existsSync(root)) return [];
  let names = [];
  try {
    names = fs.readdirSync(root);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    const dir = path.join(root, name);
    const pkg = readJson(path.join(dir, "package.json"));
    const spec = pkg?.dependencies?.["dsh-purge"] || pkg?.devDependencies?.["dsh-purge"];
    if (!spec) continue;
    out.push({ name, dir, spec: String(spec) });
  }
  return out;
}

export function profilePluginDir(profileDir) {
  const nm = path.join(profileDir, "node_modules", "dsh-purge");
  return fs.existsSync(nm) ? realPath(nm) : "";
}

function resolveDshBin() {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", ["dsh"], HIDDEN);
    return "dsh";
  } catch {
    // 桌面进程 PATH 里经常没有 dsh，再到启动器旁找。
  }
  const home = findDshHome();
  const names = process.platform === "win32" ? ["dsh.cmd", "dsh.exe", "dsh"] : ["dsh"];
  const dirs = [
    path.join(home, "..", "npm-global"),
    path.join(home, "..", "npm-global-0.1.5-rc.2"),
    path.join(home, "..", "npm-global-0.1.5-rc.1"),
    path.join(home, "bin"),
  ];
  for (const dir of dirs) {
    for (const name of names) {
      const fp = path.join(dir, name);
      if (fs.existsSync(fp)) return fp;
    }
  }
  return "";
}

export function runDshPlugin(profile, args) {
  if (adapterFor(detectSurface()) === "desktop") {
    const inv = cliInvocation();
    if (!inv) throw new Error("找不到 DSH Desktop CLI");
    execFileSync(inv.execPath, [...inv.argvPrefix, "plugin", "--profile", profile, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 120000,
      env: {
        ...process.env,
        ...inv.env,
        DSH_HOME: findDshHome(),
        CI: "1",
      },
    });
    return;
  }
  const bin = resolveDshBin();
  if (!bin) throw new Error("找不到 dsh");
  execFileSync(bin, ["plugin", "--profile", profile, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    timeout: 120000,
    env: {
      ...process.env,
      DSH_HOME: findDshHome(),
      CI: "1",
    },
  });
}

export function pluginAddSpec(spec, ref = currentChannelRef()) {
  const s = String(spec || "");
  // github: / git+https 会让 pnpm 跑 git ls-remote。没装 git 时就是 #30。
  // 公开仓库用 archive tar.gz，不依赖本机 git。
  if (
    /\.(zip|tgz|tar\.gz)(\b|$)/i.test(s) ||
    /^https?:\/\//i.test(s) ||
    /^git\+https?:\/\//i.test(s) ||
    /^github:/i.test(s) ||
    /github\.com\/.+\.git/i.test(s)
  ) {
    return archiveTarballUrl(ref);
  }
  return "";
}

function dshReinstall(profile, spec, ref = currentChannelRef()) {
  const addSpec = pluginAddSpec(spec, ref);
  if (addSpec) {
    runDshPlugin(profile, ["add", "--force", addSpec]);
    return;
  }
  try {
    runDshPlugin(profile, ["update", "dsh-purge"]);
  } catch {
    runDshPlugin(profile, ["add", "--force", archiveTarballUrl(ref)]);
  }
}

function planUpdates() {
  const profiles = findPurgeProfiles();
  const jobs = [];
  const seen = new Set();
  const remember = (dir) => {
    const key = realPath(dir).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };

  for (const p of profiles) {
    if (isLinkSpec(p.spec)) {
      const dir = resolveLinkDir(p.dir, p.spec);
      if (!remember(dir)) continue;
      jobs.push(canGit(dir) ? { kind: "git", dir, profile: p.name } : { kind: "zip", dir, profile: p.name });
      continue;
    }
    const dir = profilePluginDir(p.dir) || PLUGIN_ROOT;
    jobs.push({ kind: "dsh", profile: p.name, spec: p.spec, dir });
    remember(dir);
  }

  if (!jobs.length) {
    jobs.push(canGit(PLUGIN_ROOT) ? { kind: "git", dir: PLUGIN_ROOT } : { kind: "zip", dir: PLUGIN_ROOT });
    return jobs;
  }
  if (remember(PLUGIN_ROOT)) {
    jobs.push(canGit(PLUGIN_ROOT) ? { kind: "git", dir: PLUGIN_ROOT } : { kind: "zip", dir: PLUGIN_ROOT });
  }
  return jobs;
}

function detectVia() {
  if (gitOk()) {
    const extra = findPurgeProfiles().some((p) => !isLinkSpec(p.spec));
    return extra ? "mixed" : "git";
  }
  if (findPurgeProfiles().some((p) => !isLinkSpec(p.spec))) return "dsh";
  if (findPurgeProfiles().length) return "dsh";
  return "zip";
}

function isAbortError(e) {
  const msg = String((e && e.message) || e || "");
  return (e && (e.name === "AbortError" || e.name === "TimeoutError")) || /aborted|abort/i.test(msg);
}

async function fetchRes(url, ms = 20000, headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    try {
      ctrl.abort("timeout");
    } catch {
      ctrl.abort();
    }
  }, ms);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "dsh-purge-update", accept: "*/*", ...headers },
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return res;
  } catch (e) {
    if (isAbortError(e)) throw new Error("GitHub 超时");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, ms = 20000, headers = {}) {
  return (await fetchRes(url, ms, headers)).text();
}

async function fetchJson(url, ms = 20000, headers = {}) {
  return JSON.parse(await fetchText(url, ms, headers));
}

function versionFromPackageText(text) {
  const pkg = JSON.parse(text);
  return pkg && pkg.version ? String(pkg.version) : "";
}

async function remotePackageVersion(sha = "", fallbackRef = STABLE_REF) {
  const ref = sha || fallbackRef;
  const urls = [
    sha ? `https://cdn.jsdelivr.net/gh/${REPO}@${sha}/package.json` : "",
    `https://raw.githubusercontent.com/${REPO}/${ref}/package.json`,
    `https://cdn.jsdelivr.net/gh/${REPO}@${ref}/package.json`,
    `https://api.github.com/repos/${REPO}/contents/package.json?ref=${encodeURIComponent(ref)}`,
  ].filter(Boolean);
  for (const url of urls) {
    try {
      if (url.includes("api.github.com/repos/")) {
        const data = await fetchJson(url, 20000, { accept: "application/vnd.github.raw" });
        if (typeof data === "string") return versionFromPackageText(data);
        if (data && data.version) return String(data.version);
        if (data && data.content && data.encoding === "base64") {
          return versionFromPackageText(Buffer.from(data.content.replace(/\s/g, ""), "base64").toString("utf8"));
        }
        continue;
      }
      const ver = versionFromPackageText(await fetchText(url));
      if (ver) return ver;
    } catch {
      // 换下一个源。
    }
  }
  return "";
}

async function remoteHeadSha(ref = STABLE_REF) {
  const target = encodeURIComponent(ref || STABLE_REF);
  const fromApi = fetchJson(`https://api.github.com/repos/${REPO}/commits/${target}`)
    .then((data) => (data?.sha ? String(data.sha) : ""))
    .catch(() => "");
  const fromAtom = fetchText(`https://github.com/${REPO}/commits/${ref}.atom`)
    .then((atom) => {
      const hit = atom.match(/<id>tag:github\.com,2008:Grit::Commit\/([0-9a-f]{40})<\/id>/);
      return hit ? hit[1] : "";
    })
    .catch(() => "");
  const [apiSha, atomSha] = await Promise.all([fromApi, fromAtom]);
  return apiSha || atomSha || "";
}

function versionLabel(version, channel, sha = "") {
  const ver = String(version || "").replace(/^v/, "") || (sha ? String(sha).slice(0, 7) : "");
  const mark = channel === "beta" ? "测试" : "正式";
  return ver ? `${ver}（${mark}）` : mark;
}

function rememberVersion(item, seen) {
  if (!item || !item.ref) return null;
  const key = `${item.sha || ""}|${item.ref}`.toLowerCase();
  if (seen.has(key)) return null;
  seen.add(key);
  return item;
}

const UPDATE_REF_RE = /^(?:master|beta|v\d+\.\d+[\w.-]{0,48}|[0-9a-f]{7,40})$/i;

export function safeUpdateRef(ref) {
  const target = String(ref || "").trim();
  if (!UPDATE_REF_RE.test(target)) return "";
  return target;
}

export function markCurrent(versions, state, localVer, localSha) {
  const pin = String(state?.pin || "");
  const rows = versions || [];
  const ver = String(localVer || "").replace(/^v/i, "");
  const shaMatched = rows.some((item) => localSha && item.sha && sameRev(localSha, item.sha));
  const versionOnLatest = rows.some((item) => (
    item.latest
    && item.channel === state?.channel
    && String(item.version || "").replace(/^v/i, "") === ver
  ));
  const versionFallback = versionOnLatest ? null : rows.find((item) => (
    item.channel === state?.channel
    && String(item.version || "").replace(/^v/i, "") === ver
  ));
  return rows.map((item) => {
    const shaHit = Boolean(localSha && item.sha && sameRev(localSha, item.sha));
    const pinHit = Boolean(pin && item.ref === pin);
    // 提交号对不上时，只把本通道里和本机版本号相同的那一条标成当前。
    const headHit = Boolean(
      !pin
      && !shaMatched
      && ver
      && (versionOnLatest
        ? item.latest && item.channel === state?.channel && String(item.version || "").replace(/^v/i, "") === ver
        : versionFallback && item === versionFallback)
    );
    return {
      ...item,
      shaShort: item.shaShort || (item.sha ? String(item.sha).slice(0, 7) : ""),
      current: shaHit || pinHit || headHit,
    };
  });
}

async function listGithubTags() {
  try {
    const rows = await fetchJson(`https://api.github.com/repos/${REPO}/tags?per_page=50`);
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
      const name = String(row?.name || "").trim();
      if (!name || !/^v?\d+\.\d+/.test(name)) return null;
      const sha = row?.commit?.sha ? String(row.commit.sha) : "";
      const channel = isBetaName(name) ? "beta" : "stable";
      return {
        id: name,
        ref: name,
        sha,
        version: name.replace(/^v/, ""),
        channel,
        label: versionLabel(name, channel, sha),
        kind: "tag",
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function ensureRunningVersion(versions, state, localVer, localSha) {
  const ver = String(localVer || "").replace(/^v/i, "");
  if (!ver || isBetaName(ver) || state?.channel === "beta") return versions;
  if ((versions || []).some((item) => item.channel === "stable" && String(item.version || "").replace(/^v/i, "") === ver)) {
    return versions;
  }
  const ref = (versions || []).some((item) => item.ref === "master") ? `local-${ver}` : "master";
  return [{
    id: ref,
    ref,
    sha: localSha || "",
    version: ver,
    channel: "stable",
    label: versionLabel(ver, "stable", localSha),
    kind: "local",
    latest: !(versions || []).some((item) => item.channel === "stable" && item.latest),
  }, ...(versions || [])];
}

async function listRemoteVersions() {
  const state = readChannelState();
  const seen = new Set();
  const out = [];
  const add = (item) => {
    const next = rememberVersion(item, seen);
    if (next) out.push(next);
  };

  const [stableSha, betaSha, tags] = await Promise.all([
    remoteHeadSha(STABLE_REF),
    remoteHeadSha(BETA_REF),
    listGithubTags(),
  ]);

  if (stableSha) {
    const version = await remotePackageVersion(stableSha, STABLE_REF).catch(() => "");
    add({
      id: STABLE_REF,
      ref: STABLE_REF,
      sha: stableSha,
      version: version || "",
      channel: "stable",
      label: `${versionLabel(version, "stable", stableSha)} · 最新`,
      kind: "head",
      latest: true,
    });
  }
  if (betaSha) {
    const version = await remotePackageVersion(betaSha, BETA_REF).catch(() => "");
    add({
      id: BETA_REF,
      ref: BETA_REF,
      sha: betaSha,
      version: version || "",
      channel: "beta",
      label: `${versionLabel(version, "beta", betaSha)} · 最新`,
      kind: "head",
      latest: true,
    });
  }
  for (const tag of tags) {
    if (!withdrawnVersion(tag)) add(tag);
  }
  for (const item of readHistory()) {
    if (!item || !item.ref || withdrawnVersion(item)) continue;
    add({
      ...item,
      label: item.label || versionLabel(item.version, item.channel, item.sha),
      kind: item.kind || "history",
    });
  }

  const localVer = localVersion();
  const localSha = (gitOk() ? gitHead(PLUGIN_ROOT) : "") || readStamp();
  const withLocal = ensureRunningVersion(out, state, localVer, localSha);
  const ceiling = latestStableVersion([
    ...withLocal,
    localVer && !isBetaName(localVer) ? { channel: "stable", version: localVer } : null,
  ].filter(Boolean));
  const visible = withLocal.filter((item) => !hideListedVersion(item, ceiling));
  const betaOpen = visible.some((item) => item.channel === "beta");
  return {
    versions: markCurrent(visible, state, localVer, localSha),
    hasBeta: betaOpen,
    stableSha,
    betaSha: betaOpen ? betaSha : "",
  };
}

function alignChannelState(state, listed, localRev, localVer) {
  if (state.pin) return state;
  if (listed.betaSha && localRev && sameRev(localRev, listed.betaSha) && state.channel !== "beta") {
    return writeChannelState({ channel: "beta", pin: "" });
  }
  if (listed.stableSha && localRev && sameRev(localRev, listed.stableSha) && state.channel !== "stable") {
    return writeChannelState({ channel: "stable", pin: "" });
  }
  if (!localRev && localVer) {
    const inferred = isBetaName(localVer) ? "beta" : "stable";
    if (inferred !== state.channel) return writeChannelState({ channel: inferred, pin: "" });
  }
  return state;
}

function describeLane(id, listed, state, localVer, localRev) {
  const sha = id === "beta" ? listed.betaSha : listed.stableSha;
  const versions = listed.versions.filter((item) => item.channel === id);
  const latest = versions.find((item) => item.latest);
  const version = latest?.version || "";
  const onLane = state.channel === id;
  const matchesHead = Boolean(localRev && sha && sameRev(localRev, sha));
  const current = matchesHead || versions.some((item) => item.current && (item.latest || (state.pin && item.ref === state.pin)));
  let hasUpdate = false;
  if (onLane && state.pin) {
    hasUpdate = Boolean(sha && localRev && !sameRev(localRev, sha));
  } else if (onLane && sha && localRev) {
    hasUpdate = !sameRev(localRev, sha) || versionIsNewer(version, localVer);
  } else if (onLane && versionIsNewer(version, localVer)) {
    hasUpdate = true;
  }
  return {
    id,
    ref: CHANNELS[id].ref,
    version,
    sha: sha ? String(sha).slice(0, 7) : "",
    current,
    hasUpdate,
    hasRemote: Boolean(sha || versions.length),
  };
}

function lanesOf(listed, state, localVer, localRev) {
  return {
    stable: describeLane("stable", listed, state, localVer, localRev),
    beta: describeLane("beta", listed, state, localVer, localRev),
  };
}

export async function checkUpdate() {
  let state = readChannelState();
  const localVer = localVersion();
  const listed = await listRemoteVersions();
  const gitSha = gitOk() ? gitHead(PLUGIN_ROOT) : "";
  const stamp = readStamp();
  const localRev = gitSha || stamp;
  state = alignChannelState(state, listed, localRev, localVer);
  listed.versions = markCurrent(listed.versions, state, localVer, localRev);
  const channelRef = currentChannelRef(state);
  const lanes = lanesOf(listed, state, localVer, localRev);
  const lane = lanes[state.channel] || lanes.stable;
  if (!lane.hasRemote && state.channel === "beta") {
    return rememberUpdate({
      ok: true,
      hasUpdate: false,
      hasBeta: false,
      error: "还没有测试版",
      localVersion: localVer,
      remoteVersion: "",
      localSha: localRev ? localRev.slice(0, 7) : "",
      remoteSha: "",
      updateTarget: channelRef,
      via: detectVia(),
      versions: listed.versions,
      lanes,
      ...channelPublic(state),
    });
  }
  if (!lanes.stable.hasRemote) throw new Error("无法读取 GitHub master");
  const result = {
    ok: true,
    hasUpdate: Boolean(lane.hasUpdate),
    hasBeta: listed.hasBeta,
    updateTarget: channelRef,
    pinned: Boolean(state.pin),
    localVersion: localVer,
    remoteVersion: lane.version || lane.sha,
    localSha: localRev ? localRev.slice(0, 7) : "",
    remoteSha: lane.sha,
    via: detectVia(),
    versions: listed.versions,
    lanes,
    ...channelPublic(state),
  };
  rememberUpdate(result);
  return result;
}

function gitTrackedDirty(dir) {
  try {
    const out = execFileSync(
      "git",
      ["-C", dir, "status", "--porcelain", "--untracked-files=no", "--", ...COPY_NAMES],
      HIDDEN,
    ).trim();
    return Boolean(out);
  } catch {
    return true;
  }
}

let lastUpdate = null;

function rememberUpdate(result) {
  lastUpdate = result && typeof result === "object" ? result : lastUpdate;
  return lastUpdate;
}

export function lastUpdateResult() {
  return lastUpdate;
}

function runGit(dir, args, timeout = 20000) {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout,
    });
  } catch (e) {
    const detail = [e.stderr, e.stdout, e.message].filter(Boolean).join("\n").trim();
    throw new Error(detail || `git ${args.join(" ")}`);
  }
}

function gitResetTo(dir, ref, { force = false } = {}) {
  if (!force && gitTrackedDirty(dir)) {
    throw new Error("本地插件文件有未提交改动，未覆盖");
  }
  const target = safeUpdateRef(ref || STABLE_REF);
  if (!target) throw new Error("未知版本");
  try {
    runGit(dir, ["fetch", "origin", "--tags"], 60000);
  } catch {
    runGit(dir, ["fetch", "origin", "--tags", target], 60000);
  }
  if (target === STABLE_REF || target === BETA_REF) {
    try {
      runGit(dir, ["checkout", "-B", target, `origin/${target}`]);
      return;
    } catch {
      runGit(dir, ["reset", "--hard", `origin/${target}`]);
      return;
    }
  }
  try {
    runGit(dir, ["fetch", "origin", "--tags", target], 60000);
  } catch {
    // 上面已经 fetch 过全部分支。
  }
  runGit(dir, ["reset", "--hard", target]);
}

function extractZip(zip, dest) {
  try {
    execFileSync("tar", ["-xf", zip, "-C", dest], { ...HIDDEN, timeout: 60000 });
    return;
  } catch {
    // Windows 10+ 自带 tar；没有或失败时改 PowerShell。
  }
  execFileSync(
    "powershell",
    ["-NoProfile", "-Command", "Expand-Archive -LiteralPath $env:DSH_UPD_ZIP -DestinationPath $env:DSH_UPD_DIR -Force"],
    {
      ...HIDDEN,
      timeout: 60000,
      env: { ...process.env, DSH_UPD_ZIP: zip, DSH_UPD_DIR: dest },
    },
  );
}

async function overlayFromZip(dests, ref = STABLE_REF) {
  const unique = [...new Set(dests.filter(Boolean).map((d) => realPath(d)))];
  if (!unique.length) return;
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "dsh-purge-upd-"));
  const zip = path.join(tmp, "plugin.zip");
  const res = await fetchRes(archiveZipUrl(ref), 45000);
  await fsp.writeFile(zip, Buffer.from(await res.arrayBuffer()));
  extractZip(zip, tmp);
  const names = await fsp.readdir(tmp);
  const unpacked = names
    .map((n) => path.join(tmp, n))
    .find((p) => fs.existsSync(path.join(p, "package.json")));
  if (!unpacked) throw new Error("zip 里没有 package.json");
  for (const dest of unique) {
    for (const name of COPY_NAMES) {
      const from = path.join(unpacked, name);
      const to = path.join(dest, name);
      if (!fs.existsSync(from)) continue;
      if (name === "lib" || name === "docs" || name === "bin") {
        try {
          await fsp.rm(to, { recursive: true, force: true });
        } catch {
          // 目录被占用时改为覆盖写入。
        }
      }
      await fsp.cp(from, to, { recursive: true, force: true });
    }
  }
  try {
    await fsp.rm(tmp, { recursive: true, force: true });
  } catch {
    // 临时目录清不掉不影响安装结果。
  }
}

export async function applyUpdate(jobs = planUpdates(), options = {}) {
  if (!Array.isArray(jobs)) {
    options = jobs && typeof jobs === "object" ? jobs : {};
    jobs = planUpdates();
  }
  const state = readChannelState();
  const ref = safeUpdateRef(options.ref || currentChannelRef(state) || STABLE_REF);
  if (!ref) throw new Error("未知版本");
  const force = options.force !== false;
  const zipDirs = [];
  const vias = new Set();
  for (const job of jobs) {
    if (job.kind === "git") {
      try {
        gitResetTo(job.dir, ref, { force });
        vias.add("git");
        continue;
      } catch (e) {
        if (!force && /未提交改动/.test(String(e && e.message))) throw e;
        zipDirs.push(job.dir);
      }
      continue;
    }
    if (job.kind === "dsh") {
      try {
        dshReinstall(job.profile, job.spec, ref);
        vias.add("dsh");
        continue;
      } catch {
        zipDirs.push(job.dir);
      }
    } else {
      zipDirs.push(job.dir);
    }
  }
  if (zipDirs.length) {
    await overlayFromZip(zipDirs, ref);
    vias.add("zip");
  }
  const sha = (gitOk() ? gitHead(PLUGIN_ROOT) : "") || (await remoteHeadSha(ref).catch(() => ""));
  if (sha) writeStamp(sha);
  const via = vias.size > 1 ? "mixed" : [...vias][0] || detectVia();
  const pin = options.pin === false ? "" : (options.pin || state.pin || "");
  const channel = normalizeChannel(options.channel || state.channel);
  const saved = writeChannelState({ channel, pin });
  const localVer = localVersion();
  pushHistory({
    ref,
    sha: sha || "",
    version: localVer,
    channel,
    label: versionLabel(localVer, channel, sha),
    at: new Date().toISOString(),
  });
  const listed = await listRemoteVersions().catch(() => ({ versions: [], hasBeta: saved.channel === "beta" }));
  return rememberUpdate({
    ok: true,
    applied: true,
    hasUpdate: false,
    hasBeta: listed.hasBeta,
    pinned: Boolean(saved.pin),
    localVersion: localVer,
    remoteVersion: localVer,
    localSha: sha ? String(sha).slice(0, 7) : "",
    remoteSha: sha ? String(sha).slice(0, 7) : "",
    needRestart: false,
    reloadClient: true,
    via,
    versions: listed.versions,
    lanes: lanesOf(listed, saved, localVer, sha),
    ...channelPublic(saved),
  });
}

export async function switchChannel(channel, { apply = true } = {}) {
  const next = normalizeChannel(channel);
  if (next === "beta") {
    const listed = await listRemoteVersions();
    if (!listed.hasBeta) {
      const state = readChannelState();
      const localVer = localVersion();
      const localRev = (gitOk() ? gitHead(PLUGIN_ROOT) : "") || readStamp();
      return rememberUpdate({
        ok: false,
        error: "还没有测试版",
        hasBeta: false,
        localVersion: localVer,
        versions: listed.versions,
        lanes: lanesOf(listed, state, localVer, localRev),
        ...channelPublic(state),
      });
    }
    if (!listed.betaSha && apply) {
      const tag = listed.versions.find((item) => item.channel === "beta" && item.kind === "tag");
      if (tag) return applyUpdate(planUpdates(), { ref: tag.ref, channel: "beta", pin: false, force: true });
    }
  }
  if (!apply) {
    writeChannelState({ channel: next, pin: "" });
    return checkUpdate();
  }
  return applyUpdate(planUpdates(), { ref: CHANNELS[next].ref, channel: next, pin: false, force: true });
}

function listedUpdateRef(target, listed) {
  const safe = safeUpdateRef(target);
  if (!safe) return "";
  const hit = (listed?.versions || []).find((item) => (
    item.ref === safe
    || item.id === safe
    || item.sha === safe
    || (item.sha && safe.length >= 7 && (item.sha.startsWith(safe) || safe.startsWith(item.sha)))
  ));
  return safeUpdateRef(hit?.ref || "");
}

export async function switchVersion(ref) {
  const raw = String(ref || "").trim();
  if (withdrawnVersion({ ref: raw, version: raw })) throw new Error("该版本已下线");
  const target = safeUpdateRef(raw);
  if (!target) throw new Error("请选择要回退的版本");
  const listed = await listRemoteVersions();
  const resolved = listedUpdateRef(target, listed);
  if (!resolved) throw new Error("未知版本");
  const hit = listed.versions.find((item) => item.ref === resolved);
  const channel = hit?.channel || readChannelState().channel;
  const pin = hit?.latest ? "" : resolved;
  return applyUpdate(planUpdates(), { ref: resolved, channel, pin, force: true });
}

export async function handleUpdateOp(body = {}) {
  const op = String(body.op || (body.auto ? "auto" : "apply")).toLowerCase();
  if (op === "check" || op === "status" || op === "versions") return checkUpdate();
  if (op === "channel") return switchChannel(body.channel, { apply: body.apply !== false });
  if (op === "switch" || op === "rollback") return switchVersion(body.ref || body.version || body.id);
  if (op === "auto") return autoUpdateIfNeeded();
  const state = readChannelState();
  const requested = body.ref || currentChannelRef(state);
  const ref = safeUpdateRef(requested);
  if (!ref) throw new Error("未知版本");
  if (ref !== STABLE_REF && ref !== BETA_REF) {
    const listed = await listRemoteVersions();
    if (!listedUpdateRef(ref, listed)) throw new Error("未知版本");
  }
  const channel = body.channel || (ref === BETA_REF ? "beta" : ref === STABLE_REF ? "stable" : state.channel);
  return applyUpdate(planUpdates(), { ref, channel, pin: false, force: true });
}

export async function autoUpdateIfNeeded() {
  try {
    const check = await checkUpdate();
    if (check.pinned) return rememberUpdate({ ...check, auto: true, skipped: "pinned" });
    if (!check.hasUpdate) return rememberUpdate({ ...check, auto: true, skipped: "latest" });
    if (check.updateTarget === BETA_REF && readChannelState().channel !== "beta") {
      return rememberUpdate({ ...check, auto: true, skipped: "beta" });
    }
    const jobs = planUpdates();
    const dirtyGit = jobs.filter((j) => j.kind === "git" && gitTrackedDirty(j.dir));
    const runnable = jobs.filter((j) => !(j.kind === "git" && gitTrackedDirty(j.dir)));
    if (!runnable.length && dirtyGit.length) {
      return rememberUpdate({
        ...check,
        auto: true,
        skipped: "dirty",
        error: "本地插件文件有未提交改动，未自动覆盖",
      });
    }
    const applied = await applyUpdate(runnable, {
      ref: currentChannelRef(),
      channel: readChannelState().channel,
      pin: false,
      force: false,
    });
    return rememberUpdate({ ...applied, auto: true });
  } catch (e) {
    return rememberUpdate({
      ok: false,
      auto: true,
      hasUpdate: false,
      error: String(e && e.message ? e.message : e),
      ...channelPublic(),
    });
  }
}
