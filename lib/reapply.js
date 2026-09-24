import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "./core.js";

const PLUGIN_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function pluginVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "package.json"), "utf8"));
    return String(pkg.version || "");
  } catch {
    return "";
  }
}

function installedRev() {
  try {
    return fs.readFileSync(path.join(core.findDshHome(), "dsh-purge", "installed-rev"), "utf8").trim();
  } catch {
    return "";
  }
}

function appliedStampPath() {
  return path.join(core.findDshHome(), "dsh-purge", "applied.json");
}

export function readAppliedStamp() {
  try {
    const raw = JSON.parse(fs.readFileSync(appliedStampPath(), "utf8"));
    return {
      version: String(raw.version || ""),
      sha: String(raw.sha || ""),
    };
  } catch {
    return null;
  }
}

function sameRev(a, b) {
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/** 当前插件版本和已写入补丁的版本一致时，启动不必再还原重打。 */
export function stampMatches(stamp, version, rev) {
  if (!stamp || !stamp.version || stamp.version !== version) return false;
  if (rev && stamp.sha && !sameRev(rev, stamp.sha)) return false;
  return true;
}

export function patchesMatchInstall() {
  return stampMatches(readAppliedStamp(), pluginVersion(), installedRev());
}

function writeAppliedStamp(sha) {
  const fp = appliedStampPath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, `${JSON.stringify({
    version: pluginVersion(),
    sha: sha || "",
    at: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
}

/**
 * 先把宿主文件从备份还原，再按当前这份插件的补丁重写。
 * 低版本带着自己的补丁列表，高版本带着自己的；回退到哪一版就打哪一版。
 */
export async function reapplyInstalled() {
  core.applyRuntimeEnv();
  let aiBase = null;
  let handoff = null;
  try {
    const state = await core.gatherState();
    aiBase = state.ai_base;
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
  if (!aiBase) {
    try {
      const opened = await core.openSealedDesktopHost();
      aiBase = opened.aiBase;
      if (opened.swapAsar) handoff = opened;
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  } else {
    handoff = core.sealedAsarHandoff();
  }
  if (!aiBase) return { ok: false, error: core.missingAiBaseMessage() };
  const reverted = await core.revertAll(aiBase);
  await core.revertAllShims();
  await core.backupAll(aiBase);
  const report = await core.applyPatches(aiBase);
  await core.patchAllShims();
  const flash = core.silenceCmdFlash(aiBase);
  let renamed = false;
  if (handoff?.asar) {
    const swapped = core.scheduleSealedDesktopRestart(handoff);
    renamed = Boolean(swapped?.renamed);
  }
  const summary = core.summarizeApplyReport(report);
  writeAppliedStamp(installedRev());
  return {
    ok: true,
    version: pluginVersion(),
    reverted: reverted.reverted?.length || 0,
    applied: summary.applied || 0,
    failed: summary.failed.length,
    renamed,
    needsFullQuit: renamed || core.officialHostMustStayUp(),
    cmdFlashOk: flash.ok === true,
  };
}
