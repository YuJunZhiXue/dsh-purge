import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findDshHome } from "./core.js";

const REPO = "YuJunZhiXue/dsh-purge";
const BRANCH = "master";
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

function isGitCheckout(dir) {
  return fs.existsSync(path.join(dir, ".git"));
}

function gitHead(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], HIDDEN).trim();
  } catch {
    return "";
  }
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "dsh-purge-update", accept: "*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

async function remotePackageVersion() {
  try {
    const pkg = await fetchJson(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/package.json`);
    return String(pkg.version || "");
  } catch {
    return "";
  }
}

async function remoteHeadSha() {
  try {
    const data = await fetchJson(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`);
    if (data?.sha) return String(data.sha);
  } catch {
    // GitHub API 失败时改走 atom。
  }
  try {
    const atom = await fetchText(`https://github.com/${REPO}/commits/${BRANCH}.atom`);
    const hit = atom.match(/<id>tag:github\.com,2008:Grit::Commit\/([0-9a-f]{40})<\/id>/);
    if (hit) return hit[1];
  } catch {
    // 只剩版本号对比。
  }
  return "";
}

export async function checkUpdate() {
  const localVer = localVersion();
  const [remoteSha, remoteVer] = await Promise.all([remoteHeadSha(), remotePackageVersion()]);
  if (!remoteSha && !remoteVer) throw new Error("无法读取 GitHub master");
  const gitSha = isGitCheckout(PLUGIN_ROOT) ? gitHead(PLUGIN_ROOT) : "";
  const stamp = readStamp();
  const localRev = gitSha || stamp;
  let hasUpdate = false;
  if (remoteSha && localRev) {
    hasUpdate = !sameRev(localRev, remoteSha);
  } else if (remoteVer && localVer && remoteVer !== localVer) {
    hasUpdate = true;
  } else if (remoteSha && !localRev) {
    writeStamp(remoteSha);
    hasUpdate = false;
  }
  return {
    ok: true,
    hasUpdate,
    localVersion: localVer,
    remoteVersion: remoteVer || localVer,
    localSha: localRev ? localRev.slice(0, 7) : "",
    remoteSha: remoteSha ? remoteSha.slice(0, 7) : "",
    via: gitSha ? "git" : "zip",
  };
}

function gitPull() {
  execFileSync("git", ["-C", PLUGIN_ROOT, "pull", "--ff-only", "origin", BRANCH], {
    ...HIDDEN,
    timeout: 60000,
  });
}

async function installFromZip() {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "dsh-purge-upd-"));
  const zip = path.join(tmp, "master.zip");
  const res = await fetch(`https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip`, {
    headers: { "user-agent": "dsh-purge-update" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`zip http ${res.status}`);
  await fsp.writeFile(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("tar", ["-xf", zip, "-C", tmp], { ...HIDDEN, timeout: 60000 });
  const names = await fsp.readdir(tmp);
  const unpacked = names
    .map((n) => path.join(tmp, n))
    .find((p) => fs.existsSync(path.join(p, "package.json")));
  if (!unpacked) throw new Error("zip 里没有 package.json");
  for (const name of COPY_NAMES) {
    const from = path.join(unpacked, name);
    if (!fs.existsSync(from)) continue;
    const to = path.join(PLUGIN_ROOT, name);
    await fsp.cp(from, to, { recursive: true, force: true });
  }
  try {
    await fsp.rm(tmp, { recursive: true, force: true });
  } catch {
    // 临时目录清不掉不影响安装结果。
  }
}

export async function applyUpdate() {
  if (isGitCheckout(PLUGIN_ROOT)) gitPull();
  else await installFromZip();
  const sha = (await remoteHeadSha()) || gitHead(PLUGIN_ROOT);
  if (sha) writeStamp(sha);
  return {
    ok: true,
    applied: true,
    hasUpdate: false,
    localVersion: localVersion(),
    remoteVersion: localVersion(),
    localSha: sha ? String(sha).slice(0, 7) : "",
    remoteSha: sha ? String(sha).slice(0, 7) : "",
    needRestart: true,
  };
}
