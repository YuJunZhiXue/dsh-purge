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

/** 手动「应用」成功后也要打戳，否则重启后 settle 会以为补丁未对齐再要求重启。 */
export function markPatchesApplied(sha) {
  writeAppliedStamp(sha == null ? installedRev() : sha);
}

/**
 * 先把宿主文件从备份还原，再按当前这份插件的补丁重写。
 * 低版本带着自己的补丁列表，高版本带着自己的；回退到哪一版就打哪一版。
 */
export async function reapplyInstalled(options = {}) {
  core.applyRuntimeEnv();
  let aiBase = null;
  let handoff = null;
  let freshExtract = null;
  try {
    const state = await core.gatherState();
    aiBase = state.ai_base;
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
  const sealed = core.sealedAsarHandoff();
  if (!aiBase || sealed) {
    try {
      const opened = await core.openSealedDesktopHost({ upgrade: options.upgrade === true });
      if (opened.aiBase) aiBase = opened.aiBase;
      if (opened.swapAsar) handoff = opened;
      if (opened.extracted) freshExtract = opened;
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  } else {
    core.rememberUnpackedArchive();
  }
  if (!aiBase) return { ok: false, error: core.missingAiBaseMessage() };
  // 刚解开的是官方原件。已经在用的目录仍先还原再按这一版重打。
  const reverted = freshExtract ? { reverted: [] } : await core.revertAll(aiBase);
  if (!freshExtract) await core.revertAllShims();
  await core.backupAll(aiBase);
  const report = await core.applyPatches(aiBase);
  await core.patchAllShims();
  const flash = core.silenceCmdFlash(aiBase);
  const summary = core.summarizeApplyReport(report);
  const clean = summary.failed.length === 0 && flash.ok === true && core.hostCleanMarkersPresent(aiBase);
  if (!clean && freshExtract) {
    const restored = core.restoreSealedExtract(freshExtract.appDir, freshExtract.prev);
    return {
      ok: false,
      error: restored ? "清洗没有完成，已放回上一份解开目录" : "清洗没有完成",
      restored,
      version: pluginVersion(),
      reverted: 0,
      applied: summary.applied || 0,
      failed: summary.failed.length,
      renamed: false,
      needsFullQuit: false,
      cmdFlashOk: flash.ok === true,
    };
  }
  if (clean) {
    writeAppliedStamp(installedRev());
    if (freshExtract?.archive) core.writeUnpackedAsarStamp(freshExtract.archive);
  }
  let renamed = false;
  if (clean && handoff?.asar && options.scheduleSwap !== false) {
    const swapped = core.scheduleSealedDesktopRestart(handoff);
    renamed = Boolean(swapped?.renamed);
  }
  const pending = Boolean(handoff?.asar && !renamed && options.scheduleSwap !== false);
  // 只有真的挪开了 app.asar，当前进程才还在旧包上，需要再开一次。
  // 官方端已经在 resources/app 里跑时，不能仅因 ELECTRON_RUN_AS_NODE 再弹「需要重启」，
  // 否则每次打开面板都会再要一次重启。
  return {
    ok: clean,
    error: clean ? "" : "清洗没有完成",
    version: pluginVersion(),
    reverted: reverted.reverted?.length || 0,
    applied: summary.applied || 0,
    failed: summary.failed.length,
    renamed,
    needsFullQuit: renamed || pending,
    cmdFlashOk: flash.ok === true,
  };
}
