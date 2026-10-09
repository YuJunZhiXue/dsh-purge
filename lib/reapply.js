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

function installedRevPath() {
  return path.join(core.findDshHome(), "dsh-purge", "installed-rev");
}

function installedRev() {
  try {
    return fs.readFileSync(installedRevPath(), "utf8").trim();
  } catch {
    return "";
  }
}

function appliedStampPath() {
  return path.join(core.findDshHome(), "dsh-purge", "applied.json");
}

function settleGuardPath() {
  return path.join(core.findDshHome(), "dsh-purge", "settle-restart.guard");
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

function isApplyPlaceholder(sha) {
  const text = String(sha || "");
  return text.startsWith("apply:") || text === "applied";
}

/** 手动应用未必写过 installed-rev；空 sha 会让 settle 永远判未对齐并无限重启。 */
export function resolveApplySha(explicit) {
  const wanted = String(explicit == null ? "" : explicit).trim();
  if (wanted) return wanted;
  const rev = installedRev();
  if (rev) return rev;
  const ver = pluginVersion();
  return ver ? `apply:${ver}` : "applied";
}

function writeInstalledRev(sha) {
  const value = String(sha || "").trim();
  if (!value) return;
  const fp = installedRevPath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, `${value}\n`, "utf8");
}

function writeAppliedStamp(sha) {
  const fp = appliedStampPath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, `${JSON.stringify({
    version: pluginVersion(),
    sha: String(sha || "").trim(),
    at: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
}

/** 当前插件版本和已写入补丁的版本一致时，启动不必再还原重打。 */
export function stampMatches(stamp, version, rev) {
  if (!stamp || !stamp.version || stamp.version !== version) return false;
  // sha 为空表示 stamp 不完整（曾误写空串），不能当作已对齐（#56）。
  if (!stamp.sha) return false;
  const current = String(rev || "").trim();
  if (!current) return true;
  // 手动应用占位戳与后续 git rev 并存时，只认 version，避免再空转重启。
  if (isApplyPlaceholder(stamp.sha) || isApplyPlaceholder(current)) return true;
  if (!sameRev(current, stamp.sha)) return false;
  return true;
}

/**
 * stamp 对上了，但宿主被官方更新打回 sealed / 清洗标记没了时仍算未对齐（#57）。
 * 找不到插件根（web 启动早期、纯 CLI）不等于补丁丢失，否则会无限重打+重启（#59）。
 */
export function hostStillHasAppliedPatches() {
  try {
    if (core.desktopAsarStillSealed()) return false;
  } catch {
    /* 非桌面面 */
  }
  try {
    const aiBase = core.findAiBase();
    if (!aiBase) return true;
    return core.hostCleanMarkersPresent(aiBase);
  } catch {
    return true;
  }
}

/** 空 sha 只有在「不是密封、也不是明确缺标记」时才允许就地补戳。 */
export function canHealEmptyStamp({ sealed = false, hasAiBase = false, markersPresent = false } = {}) {
  if (sealed) return false;
  if (hasAiBase && !markersPresent) return false;
  return true;
}

export function patchesMatchInstall() {
  if (!stampMatches(readAppliedStamp(), pluginVersion(), installedRev())) return false;
  return hostStillHasAppliedPatches();
}

/**
 * 宿主上的清洗还在，只是版本戳旧了。启动时不能因此 revertAll，
 * 否则用户点应用并重启后，页面会回到「要重新清洗」。
 */
export async function hostCleanEnoughToKeep() {
  let aiBase = "";
  try {
    aiBase = core.findAiBase() || "";
  } catch {
    return false;
  }
  if (!aiBase || !core.hostCleanMarkersPresent(aiBase)) return false;
  const status = await core.patchStatus(aiBase);
  return !Object.values(status).some((row) => row === "pending");
}

/** 有 applied 戳但宿主已回到密封 asar / 清洗标记没了：面板提示「补丁已丢失」（#57）。找不到根不算丢失。 */
export function patchesLostAfterHostReset() {
  const stamp = readAppliedStamp();
  if (!stamp?.version || !stamp?.sha) return false;
  try {
    if (core.desktopAsarStillSealed()) return true;
  } catch {
    /* 非桌面面 */
  }
  try {
    const aiBase = core.findAiBase();
    if (aiBase && !core.hostCleanMarkersPresent(aiBase)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** 手动「应用」成功后也要打戳，否则重启后 settle 会以为补丁未对齐再要求重启。 */
export function markPatchesApplied(sha) {
  const resolved = resolveApplySha(sha);
  const current = installedRev();
  // 已有更新通道写入的 git rev 时沿用；否则用 resolve 结果（含 apply:version 占位）。
  const finalSha = current && !isApplyPlaceholder(current) ? current : resolved;
  writeInstalledRev(finalSha);
  writeAppliedStamp(finalSha);
  return finalSha;
}

/**
 * #59/#60：空 sha 或缺失 installed-rev 会让 settle 每次启动都 reapply+restart。
 * 版本已对齐时先补非空戳 / 种子 rev，打断自重启；真正缺补丁再由后续逻辑重打。
 */
export function healEmptyAppliedStamp() {
  const stamp = readAppliedStamp();
  const version = pluginVersion();
  if (!stamp || stamp.version !== version) return false;
  if (stamp.sha) {
    if (!installedRev()) writeInstalledRev(stamp.sha);
    return false;
  }
  let sealed = false;
  try { sealed = core.desktopAsarStillSealed(); } catch { /* ignore */ }
  let hasAiBase = false;
  let markersPresent = false;
  try {
    const aiBase = core.findAiBase();
    hasAiBase = Boolean(aiBase);
    markersPresent = Boolean(aiBase && core.hostCleanMarkersPresent(aiBase));
  } catch {
    /* 根还没定位 */
  }
  // 密封或明确没打上清洗标记：不能补戳装成已对齐，否则 #57 不再自愈。
  if (!canHealEmptyStamp({ sealed, hasAiBase, markersPresent })) return false;
  markPatchesApplied();
  return true;
}

/** 安装后还没有 installed-rev 时先落盘占位（tarball / 手动应用常见）。 */
export function ensureInstalledRevSeed() {
  const current = installedRev();
  if (current) return current;
  const stamp = readAppliedStamp();
  if (stamp?.sha) {
    writeInstalledRev(stamp.sha);
    return stamp.sha;
  }
  const sha = resolveApplySha();
  writeInstalledRev(sha);
  return sha;
}

/** settle 刚重启过则冷却，防止「重打→重启→再重打」打成死循环。 */
export function shouldSkipSettleRestart(windowMs = 180000) {
  try {
    const raw = JSON.parse(fs.readFileSync(settleGuardPath(), "utf8"));
    if (String(raw.version || "") !== pluginVersion()) return false;
    const at = Date.parse(String(raw.at || "")) || 0;
    return at > 0 && Date.now() - at < windowMs;
  } catch {
    return false;
  }
}

export function markSettleRestart() {
  const fp = settleGuardPath();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, `${JSON.stringify({
    version: pluginVersion(),
    at: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
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
      const opened = await core.openSealedDesktopHost({
        upgrade: options.upgrade === true,
        forApply: true,
      });
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
  const preserveClientBundles = options.preserveClientBundles !== false;
  const reverted = freshExtract ? { reverted: [] } : await core.revertAll(aiBase, { preserveClientBundles });
  if (!freshExtract) await core.revertAllShims();
  const multi = await core.applyPatchesAllHosts(core.ALL_PATCHES, { preserveClientBundles, forApply: true });
  await core.patchAllShims();
  const flash = core.silenceCmdFlash(multi.hosts[0]?.aiBase || aiBase);
  const summary = core.summarizeApplyReport(multi.report);
  const clean =
    summary.failed.length === 0 &&
    (core.allPatchHostsWritten(multi.hosts) || core.hostCleanMarkersPresent(aiBase));
  if (clean && flash.ok !== true) {
    console.warn("[dsh-purge] cmd flash patch did not apply cleanly; clean flow continues, UI shows cmdFlashOk=false");
  }
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
    markPatchesApplied(installedRev() || undefined);
    if (freshExtract?.archive) core.writeUnpackedAsarStamp(freshExtract.archive);
    try {
      const seed = core.seedPromptInjectAtBoot(core.findDshHome());
      if (seed && seed.action === "error") {
        console.warn("[dsh-purge] seed prompt-inject failed:", seed.reason);
      }
    } catch (e) {
      console.warn("[dsh-purge] seed prompt-inject exception:", String(e && e.message ? e.message : e));
    }
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
