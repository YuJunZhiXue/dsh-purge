import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDshHome } from "./core.js";

const REPO = "YuJunZhiXue/dsh-purge";
const BRANCH = "master";
const ZIP_URL = `https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip`;
const GITHUB_SPEC = `github:${REPO}#${BRANCH}`;
const PLUGIN_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const COPY_NAMES = [
  "lib",
  "bin",
  "docs",
  "client.js",
  "cordis.patch.yml",
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

function stampPath() {
  return path.join(findDshHome(), "dsh-purge", "installed-rev");
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

function realPath(dir) {
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

function isLinkSpec(spec) {
  const s = String(spec || "");
  return /^(link|file):/i.test(s) || s === "." || /^\.\.?(?:[/\\]|$)/.test(s);
}

function resolveLinkDir(profileDir, spec) {
  const raw = String(spec).replace(/^(link|file):/i, "");
  return path.resolve(profileDir, raw);
}

function findPurgeProfiles() {
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

function profilePluginDir(profileDir) {
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

function runDshPlugin(profile, args) {
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

function addSpecFor(spec) {
  const s = String(spec || "");
  if (/\.zip(\b|$)/i.test(s) || /^https?:\/\//i.test(s)) return ZIP_URL;
  if (/^github:/i.test(s) || /github\.com\/.+\.git/i.test(s)) return GITHUB_SPEC;
  return "";
}

function dshReinstall(profile, spec) {
  const addSpec = addSpecFor(spec);
  if (addSpec) {
    runDshPlugin(profile, ["add", "--force", addSpec]);
    return;
  }
  try {
    runDshPlugin(profile, ["update", "dsh-purge"]);
  } catch {
    runDshPlugin(profile, ["add", "--force", ZIP_URL]);
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

async function remotePackageVersion(sha = "") {
  const ref = sha || BRANCH;
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

async function remoteHeadSha() {
  const fromApi = fetchJson(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`)
    .then((data) => (data?.sha ? String(data.sha) : ""))
    .catch(() => "");
  const fromAtom = fetchText(`https://github.com/${REPO}/commits/${BRANCH}.atom`)
    .then((atom) => {
      const hit = atom.match(/<id>tag:github\.com,2008:Grit::Commit\/([0-9a-f]{40})<\/id>/);
      return hit ? hit[1] : "";
    })
    .catch(() => "");
  const [apiSha, atomSha] = await Promise.all([fromApi, fromAtom]);
  return apiSha || atomSha || "";
}

export async function checkUpdate() {
  const localVer = localVersion();
  const remoteSha = await remoteHeadSha();
  const remoteVer = await remotePackageVersion(remoteSha);
  if (!remoteSha && !remoteVer) throw new Error("无法读取 GitHub master");
  const gitSha = gitOk() ? gitHead(PLUGIN_ROOT) : "";
  const stamp = readStamp();
  const localRev = gitSha || stamp;
  let hasUpdate = false;
  if (remoteSha && localRev) {
    hasUpdate = !sameRev(localRev, remoteSha);
  } else if (remoteVer && localVer && remoteVer !== localVer) {
    hasUpdate = true;
  } else if (remoteSha && !localRev) {
    // zip / dsh 安装没有 stamp，按有更新处理，拉一次与 master 对齐。
    hasUpdate = true;
  }
  const result = {
    ok: true,
    hasUpdate,
    localVersion: localVer,
    remoteVersion: remoteVer || (remoteSha ? remoteSha.slice(0, 7) : ""),
    localSha: localRev ? localRev.slice(0, 7) : "",
    remoteSha: remoteSha ? remoteSha.slice(0, 7) : "",
    via: detectVia(),
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

function gitPull(dir) {
  try {
    runGit(dir, ["pull", "--ff-only", "origin", BRANCH], 60000);
    return;
  } catch (pullErr) {
    try {
      runGit(dir, ["fetch", "origin", BRANCH], 60000);
      runGit(dir, ["reset", "--hard", `origin/${BRANCH}`], 60000);
      return;
    } catch (resetErr) {
      throw new Error(
        `git 更新失败（${dir}）：${String(resetErr.message || resetErr).slice(0, 240)}；${String(pullErr.message || pullErr).slice(0, 160)}`,
      );
    }
  }
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

async function overlayFromZip(dests) {
  const unique = [...new Set(dests.filter(Boolean).map((d) => realPath(d)))];
  if (!unique.length) return;
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "dsh-purge-upd-"));
  const zip = path.join(tmp, "master.zip");
  const res = await fetchRes(ZIP_URL, 45000);
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
      if (!fs.existsSync(from)) continue;
      await fsp.cp(from, path.join(dest, name), { recursive: true, force: true });
    }
  }
  try {
    await fsp.rm(tmp, { recursive: true, force: true });
  } catch {
    // 临时目录清不掉不影响安装结果。
  }
}

export async function applyUpdate(jobs = planUpdates()) {
  const zipDirs = [];
  const vias = new Set();
  for (const job of jobs) {
    if (job.kind === "git") {
      try {
        gitPull(job.dir);
        vias.add("git");
        continue;
      } catch {
        zipDirs.push(job.dir);
      }
      continue;
    }
    if (job.kind === "dsh") {
      try {
        dshReinstall(job.profile, job.spec);
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
    await overlayFromZip(zipDirs);
    vias.add("zip");
  }
  const sha = (await remoteHeadSha()) || (gitOk() ? gitHead(PLUGIN_ROOT) : "");
  if (sha) writeStamp(sha);
  const via = vias.size > 1 ? "mixed" : [...vias][0] || detectVia();
  return rememberUpdate({
    ok: true,
    applied: true,
    hasUpdate: false,
    localVersion: localVersion(),
    remoteVersion: localVersion(),
    localSha: sha ? String(sha).slice(0, 7) : "",
    remoteSha: sha ? String(sha).slice(0, 7) : "",
    needRestart: true,
    via,
  });
}

export async function autoUpdateIfNeeded() {
  try {
    const check = await checkUpdate();
    if (!check.hasUpdate) return rememberUpdate({ ...check, auto: true, skipped: "latest" });
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
    const applied = await applyUpdate(runnable);
    return rememberUpdate({ ...applied, auto: true });
  } catch (e) {
    return rememberUpdate({
      ok: false,
      auto: true,
      hasUpdate: false,
      error: String(e && e.message ? e.message : e),
    });
  }
}
