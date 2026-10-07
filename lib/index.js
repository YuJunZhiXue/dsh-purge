import { fsFor } from "./extract-asar.js";
import * as core from "./core.js";
import * as hostctl from "./host.js";
import * as rules from "./rules.js";
import * as skills from "./skills.js";
import * as updater from "./update.js";
import * as reapply from "./reapply.js";
import * as officialUpdate from "./official-update.js";
import {
  GLOBAL_PROMPT_ORDER,
  isMnemonPluginMessage,
  isRedteamSession,
  installAssembleGuard,
  modePromptText,
  rewritePromptAssembly,
} from "./identity.js";
import { capabilityProtocolText, CAPABILITY_SECTION } from "./capability-protocol.js";
import { installSubagentRoleCapture, resolveSubagentRoleText } from "./redteam/role-section.js";
import * as rewind from "./rewind.js";
import * as continueRetry from "./continue-retry.js";
import * as uninstaller from "./uninstall.js";
import { readDrillGrant, writeDrillGrant } from "./drill-grant.js";
import { installRegionGate, readAllowText, writeAllowText } from "./net-scope.js";
import * as refusalRecover from "./refusal-recover.js";
import {
  applyShouldRestart,
  isInactiveContextError,
  settleDelayMs,
  settleMayReapply,
  settleMayRestart,
  watchContextLife,
} from "./settle-policy.js";

export const name = "dsh-purge";

export const inject = ["systemPrompt", "tools"];

let bootFullQuit = false;

const DEFAULTS = {
  enabled: true,
  autoApplyOnStart: true,
  autoUpdateOnStart: false,
  autoRevertOnMissing: false,
  injectOnce: false,
  stripMnemon: true,
  postPrompt: "",
  postPromptOrder: 5100,
  verbose: false,
  autoRetry: true,
  retryMax: 3,
  autoContinue: true,
  continueMax: 3,
  continueText: "继续",
  refusalRecover: true,
  refusalRecoverMax: 2,
  refusalRecoverText: "",
  // Codex 风格：教模型主动发现 skill / MCP；不改官方注册与工具面。
  capabilityProtocol: true,
};

const log = (config, ...args) => {
  if (config?.verbose) console.log("[dsh-purge]", ...args);
};

let webTreeReady = false;
let continueRuntime = null;
let refusalRecoverRuntime = null;
let savedContinueSettings = {};
let continuePluginCfg = { ...DEFAULTS };

function currentContinueConfig() {
  return continueRetry.mergeConfig(continuePluginCfg, savedContinueSettings);
}

function continueStatusPayload(ctx, sessionId) {
  const cfg = currentContinueConfig();
  const agent = sessionId ? continueRetry.resolveAgent(ctx, sessionId) : null;
  if (agent && continueRuntime) return continueRuntime.status(agent);
  return {
    ok: true,
    sessionId: sessionId || "",
    canContinue: false,
    reason: "",
    userAbort: false,
    retryUsed: 0,
    continueUsed: 0,
    retryMax: cfg.retryMax,
    continueMax: cfg.continueMax,
    autoRetry: cfg.autoRetry,
    autoContinue: cfg.autoContinue,
    continueText: cfg.continueText,
  };
}

function watchWebTreeReady(ctx) {
  // 必须挂在 connection 上再 await，与官方打印 URL 同一时刻。
  // apply() 里立刻 await 会在后续入口尚未入树时提前结束，session.list 仍是空的。
  const mark = () => {
    webTreeReady = true;
  };
  if (typeof ctx?.inject !== "function") {
    mark();
    return;
  }
  try {
    ctx.inject(["connection"], (host) => {
      const settled = host.get?.("loader")?.await?.();
      if (!settled || typeof settled.then !== "function") {
        mark();
        return;
      }
      settled.then(() => {
        if (host.get?.("webServer") !== undefined && host.get?.("connection") !== undefined) mark();
      }, mark);
    });
  } catch {
    mark();
  }
}

function fsExists(fp) {
  const list = Array.isArray(fp) ? fp : [fp];
  return list.some((p) => {
    if (!p || typeof p !== "string") return false;
    try {
      return fsFor(p).existsSync(p);
    } catch {
      return false;
    }
  });
}

function line(title, value, ok = null) {
  const mark = ok === null ? "·" : ok ? "✓" : "✗";
  return `${mark} ${title}: ${value}`;
}

function renderStatus(state) {
  const out = [];
  out.push("dsh-purge 状态 / Status");
  out.push(line("宿主 / surface", state.surface || hostctl.currentSurface()));
  out.push(line("DSH_HOME", state.dsh_home));
  if (state.desktop_install) out.push(line("桌面安装 / desktop", state.desktop_install));
  if (state.ai_base) {
    out.push(line("插件根 / plugin root", state.ai_base));
    for (const [key, fp] of Object.entries(state.files)) {
      const list = Array.isArray(fp) ? fp : [fp];
      const shown = list.length <= 1 ? String(list[0] || "") : `${list[0]} (+${list.length - 1})`;
      out.push(`    ${fsExists(fp) ? "✓" : "✗"} ${key.padEnd(22)} ${shown}`);
    }
  } else {
    out.push(line("插件根 / plugin root", core.missingAiBaseMessage(), false));
  }
  out.push(line("shim 目录", state.shim_dir || "未定位 / not found", !!state.shim_dir));
  if (state.desktop_runtimes?.length) {
    out.push(line("Desktop runtime", `${state.desktop_runtimes.length} sealed (shim OK; bak external)`, true));
    for (const d of state.desktop_runtimes) out.push(`    · ${d}`);
  }
  out.push(line("备份 / backup", state.has_backup ? "有 / yes" : "无 / no", state.has_backup));
  out.push(line("注入文件 / inject", state.override_path));
  out.push(line("注入状态 / override", state.override_status));
  if (state.asar_still_sealed) {
    out.push(line("app.asar", "还在。补丁写在解开目录，当前进程读不到", false));
  }
  out.push("");
  out.push(`补丁 / patches: ${state.patches_applied}/${state.patches_total || 0} applied, ${state.patches_pending} pending`);
  for (const p of core.ALL_PATCHES) {
    const s = state.patch_status[p.id] || "n/a";
    const mark = s === "applied" ? "✓" : s === "pending" ? "✗" : "·";
    out.push(`  ${mark} [#${String(p.id).padEnd(2)}] ${p.name.padEnd(30)} ${p.layer}/${p.layer_en} — ${s}`);
  }
  out.push("");
  out.push(`shim: dsh.cmd=${state.shim_cmd}  dsh.ps1=${state.shim_ps1}  dsh=${state.shim_bin}`);
  return out.join("\n");
}

function injectAllowedNow(config) {
  return config.enabled !== false;
}

/** 提示词框自改 > prompt-inject.md > 加密默认（见 rules.resolveInjectText）。 */
function refreshHungOperator(dshHome = core.findDshHome()) {
  const home = dshHome || core.findDshHome();
  const resolved = rules.resolveInjectText(home);
  core.hangOperatorPrompt(resolved.text);
  return resolved;
}

function injectSnapshot(dshHome = core.findDshHome()) {
  const resolved = rules.resolveInjectText(dshHome);
  return {
    injectSource: resolved.source,
    injectRuleId: resolved.ruleId,
    needPrompt: resolved.source === "none",
  };
}

/** 框里正在显示的字优先；框空则 resolveInjectText（含 prompt-inject.md）。 */
function injectSnapshotFromBox(dshHome, boxText) {
  if (typeof boxText === "string" && core.normalizeOverride(boxText)) {
    return { injectSource: "prompt", injectRuleId: null, needPrompt: false };
  }
  const resolved = rules.resolveInjectText(dshHome);
  if (resolved.text) {
    return { injectSource: resolved.source, injectRuleId: null, needPrompt: false };
  }
  return { injectSource: "none", injectRuleId: null, needPrompt: true };
}

const NEED_PROMPT_ERROR = "提示词和规则集都是空的，必须先添加提示词";

function rejectIfNeedPrompt(dshHome, boxText) {
  const snap = injectSnapshotFromBox(dshHome, boxText);
  if (!snap.needPrompt) return null;
  return { ...snap, error: NEED_PROMPT_ERROR };
}

async function ensureRestartReady() {
  return core.ensureHostClean();
}

/** 提示词服务自己的 ctx 多半没有 scope，段会进全局层。插件若挂在某个 scope 上，预设代理的父链看不到那一层。 */
function addPromptSection(ctx, section) {
  const hosts = [];
  const push = (host) => {
    if (host && !hosts.includes(host)) hosts.push(host);
  };
  try { push(ctx?.systemPrompt?.ctx); } catch { /* 代理未注入时点属性会抛 */ }
  push(ctx);
  let registered = false;
  let lastError = null;
  for (const host of hosts) {
    try {
      host.systemPrompt.section(section);
      registered = true;
    } catch (error) {
      const msg = String(error && error.message || error);
      if (msg.includes("already registered")) registered = true;
      else lastError = error;
    }
  }
  if (!registered && lastError) throw lastError;
}

export function registerPromptSections(ctx, config, _injectFile) {
  addPromptSection(ctx, {
    name: "dsh-purge",
    order: GLOBAL_PROMPT_ORDER + 1,
    interpolate: false,
    text: (context) => {
      if (!injectAllowedNow(config)) return "";
      return readInjectFallback(context);
    },
  });

  if (config.capabilityProtocol !== false) {
    addPromptSection(ctx, {
      name: CAPABILITY_SECTION,
      order: GLOBAL_PROMPT_ORDER,
      interpolate: false,
      text: (context) => {
        if (!injectAllowedNow(config)) return "";
        const redteam = isRedteamSession(context);
        return capabilityProtocolText({
          redteam,
          redteamChild: redteam && context?.agent?.session?.header?.origin === "subagent",
          enabled: true,
        });
      },
    });
  }

  const postPrompt = typeof config.postPrompt === "string" ? config.postPrompt.trim() : "";
  if (!postPrompt) return;
  if (!Number.isFinite(config.postPromptOrder) || config.postPromptOrder <= GLOBAL_PROMPT_ORDER) {
    throw new TypeError(`postPromptOrder must be a finite number greater than ${GLOBAL_PROMPT_ORDER}`);
  }
  ctx.systemPrompt.section({
    name: "dsh-purge:post",
    order: config.postPromptOrder,
    text: () => (injectAllowedNow(config) ? postPrompt : ""),
  });
}

function readInjectFallback(context) {
  let home = "";
  try { home = core.findDshHome(); } catch { home = ""; }
  const raw = rules.ensureOperatorBody(home);
  if (!raw) return "";
  let redteam = false;
  try { redteam = isRedteamSession(context); } catch { redteam = false; }
  return modePromptText(raw, redteam);
}

function installMnemonMessageStrip(ctx, config = {}) {
  if (typeof ctx.on !== "function") return;
  if (ctx.__dshPurgeMnemonStrip) return;
  ctx.__dshPurgeMnemonStrip = true;
  const strip = config.stripMnemon !== false;
  const wrap = async (_payload, next) => {
    const decision = await next();
    if (!decision) return decision;
    // agent-loop 会读 decision.messages.length；缺数组时第二轮直接 gateway/internal 炸掉。
    const incoming = Array.isArray(decision.messages) ? decision.messages : [];
    const messages = strip ? incoming.filter((message) => !isMnemonPluginMessage(message)) : incoming;
    if (messages.length === incoming.length && Array.isArray(decision.messages)) return decision;
    return { ...decision, messages };
  };
  const late = () => {
    try {
      ctx.on("agent/pre-step", wrap, { global: true, prepend: true });
    } catch {}
  };
  late();
  queueMicrotask(late);
  setTimeout(late, 1500);
}

function rewriteLiveAssembly(config, assembled, context) {
  const enabled = config.enabled !== false;
  const redteam = enabled && isRedteamSession(context);
  const inject = enabled ? readInjectFallback(context) : "";
  return rewritePromptAssembly(assembled, {
    fallbackInject: inject,
    dropMnemon: config.stripMnemon !== false,
    dropPurgeAfterFold: false,
    capabilityProtocol: config.capabilityProtocol !== false,
    context,
    roleText: redteam ? resolveSubagentRoleText(context) : "",
  });
}

/** 注册表若已经按旧文件算过 rev，立刻 rebuilt，让页面拿到的地址和缓存一致（#63）。 */
function publishClientBundleRevs(ctx, packageNames) {
  if (!Array.isArray(packageNames) || packageNames.length === 0) return;
  let mods = null;
  try {
    mods = ctx?.get?.("clientModules", false);
  } catch {
    mods = null;
  }
  if (!mods || typeof mods.rebuilt !== "function") return;
  for (const id of packageNames) {
    try { mods.rebuilt(id); } catch { /* 这一包还没进注册表，下次快照会读到新文件 */ }
  }
}

/** Cordis 的 ctx 是 Proxy：未声明 inject 时点属性会抛 "cannot get property ... without inject"，所以两段都要包 try。 */
function permissionPresetsOf(ctx) {
  try {
    const direct = ctx?.permissionPresets;
    if (direct && typeof direct.set === "function") return direct;
  } catch {
    /* 未 inject 这项服务时，Cordis 代理会抛，不能让新会话的全开权限钉死失败。 */
  }
  try {
    const svc = ctx?.get?.("permissionPresets");
    if (svc && typeof svc.set === "function") return svc;
  } catch {
    /* 没有这项服务。 */
  }
  return null;
}

function shouldKeepFreshFullAccess(session, svc) {
  if (session?.header?.origin === "subagent") return false;
  const state = typeof svc.permissionState === "function" ? svc.permissionState(session) : null;
  const preset = state?.preset;
  if (preset === "danger-full-access" || preset === "auto" || preset === "custom") return false;
  const events = typeof session?.snapshotEvents === "function" ? session.snapshotEvents() : [];
  const pins = Array.isArray(events) ? events.filter((event) => event?.type === "permission/preset") : [];
  if (pins.length > 1) return false;
  return preset == null || preset === "workspace-write" || preset === "read-only";
}

function upgradeFreshSessionAccess(ctx, session) {
  try {
    const svc = permissionPresetsOf(ctx);
    if (!svc || !shouldKeepFreshFullAccess(session, svc)) return;
    svc.set(session, "danger-full-access");
  } catch (error) {
    console.warn("[dsh-purge] full-access pin:", error instanceof Error ? error.message : String(error));
  }
}

/** 空会话界面按部署默认显示完全权限；建会话时若钉成 workspace-write，发消息后芯片会掉下去。 */
function installFreshFullAccess(ctx) {
  if (typeof ctx.on !== "function" || ctx.__dshPurgeFullPin) return;
  ctx.__dshPurgeFullPin = true;
  try {
    ctx.on("session/created", (session) => {
      queueMicrotask(() => upgradeFreshSessionAccess(ctx, session));
    });
  } catch {}
}

function installRewindDeriveFilter(ctx) {
  if (!ctx || ctx.__dshPurgeRewindDerive) return;
  ctx.__dshPurgeRewindDerive = true;
  const wrapOne = (session) => {
    try { rewind.wrapSessionDeriveMessages(session); } catch { /* ignore */ }
  };
  try {
    const store = ctx.get?.("sessions");
    const all = typeof store?.all === "function" ? store.all()
      : typeof store?.list === "function" ? store.list()
      : [];
    for (const session of all || []) wrapOne(session);
  } catch { /* ignore */ }
  try {
    ctx.on("session/created", (session) => wrapOne(session));
  } catch { /* ignore */ }
}

function installIdentityOverride(ctx, config = {}) {
  if (typeof ctx.on !== "function") return;
  installSubagentRoleCapture(ctx);
  const wrapAssemble = () => {
    try {
      return installAssembleGuard(ctx.systemPrompt, (assembled, context) => (
        rewriteLiveAssembly(config, assembled, context)
      ));
    } catch {
      return false;
    }
  };
  if (!ctx.__dshPurgeAssembleHook) {
    ctx.__dshPurgeAssembleHook = true;
    ctx.on("system-prompt/assemble", async (_assembly, context, next) => {
      const assembled = typeof next === "function" ? await next() : _assembly;
      return rewriteLiveAssembly(config, assembled, context);
    }, { global: true, prepend: true });
  }
  // 切换预设会换掉 assemble。pre-step 瀑布在 assemble 之后才跑，第一次发送包不上。
  // 宿主在 assemble 之前调用这个函数，用的就是当前模式自己的 systemPrompt。
  const prepareAssemble = (loopCtx) => {
    try { rules.ensureOperatorBody(core.findDshHome()); } catch { /* 主目录还没有提示词 */ }
    const prompt = loopCtx && loopCtx.systemPrompt;
    if (prompt) {
      try {
        installAssembleGuard(prompt, (assembled, context) => (
          rewriteLiveAssembly(config, assembled, context)
        ));
      } catch { /* 这一层代理包不上时，下面再包插件自己的 */ }
    }
    wrapAssemble();
  };
  globalThis.__dshPurgePrepareAssemble = prepareAssemble;
  // complete:true 会在 waterfall 之后盖掉 sections；包住 assemble 返回值，每轮都补回注入。
  wrapAssemble();
  const started = Date.now();
  const timer = setInterval(() => {
    wrapAssemble();
    if (Date.now() - started > 20000) clearInterval(timer);
  }, 400);
  if (typeof timer.unref === "function") timer.unref();
  try { ctx.effect(() => () => clearInterval(timer)); } catch { /* 无 effect 时靠 unref */ }
  try { ctx.on("session/created", wrapAssemble); } catch { /* ignore */ }
  try {
    ctx.on("agent-preset/selected", () => {
      try { rules.ensureOperatorBody(core.findDshHome()); } catch { /* 主目录还没有提示词 */ }
      wrapAssemble();
    }, { global: true });
  } catch { /* ignore */ }
  try {
    ctx.on("agent/pre-step", (payload, next) => {
      wrapAssemble();
      return typeof next === "function" ? next() : payload;
    }, { global: true, prepend: true });
  } catch { /* ignore */ }
}

function shimNeedsPatch(state) {
  if (hostctl.currentSurface() === "desktop") return false;
  return (
    state.shim_cmd === "original" ||
    state.shim_ps1 === "original" ||
    state.shim_bin === "original"
  );
}

function currentSettleScope() {
  let sealed = false;
  try { sealed = core.desktopAsarStillSealed(); } catch { /* 非桌面或还没定位安装目录 */ }
  return { surface: hostctl.currentSurface(), sealed };
}

async function settleInstalledPatches(config, ctx, life) {
  if (life && !life.alive) return "skip:inactive";
  try { core.rememberUnpackedArchive(); } catch { /* 没有官方安装目录时不必记归档 */ }
  try {
    reapply.ensureInstalledRevSeed();
  } catch (e) {
    log(config, "seed installed-rev failed:", String(e && e.message ? e.message : e));
  }
  try {
    if (reapply.healEmptyAppliedStamp()) log(config, "healed empty applied stamp");
  } catch (e) {
    log(config, "heal applied stamp failed:", String(e && e.message ? e.message : e));
  }

  const scope = currentSettleScope();
  if (!reapply.patchesMatchInstall()) {
    if (!settleMayReapply(scope)) {
      log(config, "sealed desktop: skip startup reapply (wait for Apply)");
      return "skip:sealed-wait-apply";
    }
    if (await reapply.hostCleanEnoughToKeep()) {
      reapply.markPatchesApplied();
      log(config, "host already clean; kept patches and refreshed stamp");
      return "already-clean";
    }
    if (officialUpdate.upgradeMarkerExists(process.execPath)) {
      const upgraded = await reapply.reapplyInstalled({ scheduleSwap: false, upgrade: true });
      if (life && !life.alive) return "skip:inactive";
      if (!upgraded.ok) {
        log(config, "official upgrade reapply failed:", upgraded.error || "");
        return "reapply-failed";
      }
      officialUpdate.clearUpgradeMarker(process.execPath);
      officialUpdate.clearStaleExtractedApps(process.execPath);
      if (!settleMayRestart(currentSettleScope()) || reapply.shouldSkipSettleRestart()) {
        if (upgraded.needsFullQuit) bootFullQuit = true;
        log(config, "official upgrade reapplied; skip settle restart");
        return "reapplied-no-restart";
      }
      reapply.markSettleRestart();
      log(config, "official upgrade reapplied; restarting onto the new build");
      try {
        hostctl.scheduleRestart(null, ctx, { openBrowser: false });
      } catch (e) {
        log(config, "restart after official upgrade failed:", String(e && e.message ? e.message : e));
        return "restart-failed";
      }
      return "restarting";
    }

    // 启动自愈只写盘，不 swap asar / 不杀进程，避免官方 Host Fiber._reload 撞 INACTIVE_EFFECT。
    const result = await reapply.reapplyInstalled({ scheduleSwap: false });
    if (life && !life.alive) return "skip:inactive";
    if (!result.ok) {
      log(config, "reapply failed:", result.error || "");
      return "reapply-failed";
    }
    // reapply 成功后强制保证非空戳，避免 clean 路径漏写又空转（#59/#60）。
    try { reapply.markPatchesApplied(); } catch { /* ignore */ }
    if (result.needsFullQuit) {
      bootFullQuit = true;
      log(config, "reapply wrote patches; official host needs a full quit");
      return "full-quit";
    }
    if (!settleMayRestart(currentSettleScope())) {
      log(config, "reapply wrote patches; desktop settle does not restart");
      return "reapplied-no-restart";
    }
    if (reapply.shouldSkipSettleRestart()) {
      log(config, "reapply wrote patches; skip settle restart (cooldown)");
      return "reapplied-no-restart";
    }
    // 已对齐则不必再重启；只在 stamp/宿主仍不一致时重启一次。
    if (reapply.patchesMatchInstall()) {
      log(config, "reapply wrote patches; already aligned, no restart");
      return "reapplied";
    }
    reapply.markSettleRestart();
    log(config, "reapply wrote patches; restarting");
    try {
      // web：自愈重启不弹浏览器，关窗后不应再被反复拉起新窗口（#59/#61）。
      hostctl.scheduleRestart(null, ctx, { openBrowser: false });
    } catch (e) {
      log(config, "restart after reapply failed:", String(e && e.message ? e.message : e));
      return "restart-failed";
    }
    return "restarting";
  }

  const applied = await autoApply(config);
  if (config.autoUpdateOnStart === true) {
    updater.autoUpdateIfNeeded()
      .then((r) => {
        log(config, "auto-update:", JSON.stringify(r));
        if (r && r.needsFullQuit) bootFullQuit = true;
        if (r && r.restartAfter && settleMayRestart(currentSettleScope())) {
          try { hostctl.scheduleRestart(null, ctx, { openBrowser: false }); } catch (e) {
            console.warn("[dsh-purge] auto-update restart failed:", e);
          }
        }
      })
      .catch((e) => console.warn("[dsh-purge] auto-update error:", String(e)));
  }
  return applied;
}

async function autoApply(config) {
  try {
    core.applyRuntimeEnv();
    const sanitized = core.sanitizeDesktopCommandRuntimes();
    if (sanitized.length) log(config, "desktop runtime sanitized:", JSON.stringify(sanitized));

    const state = await core.gatherState();
    if (!state.ai_base) {
      log(config, "skip auto-apply: plugin root not found");
      return "skip:plugin_root_not_found";
    }
    try {
      const flash = core.silenceCmdFlash(state.ai_base);
      log(config, "cmd-flash:", JSON.stringify(flash));
      if (!flash.ok) log(config, "cmd-flash incomplete:", flash.entry);
    } catch (e) {
      log(config, "cmd-flash failed:", String(e));
    }

    if (state.patches_pending === 0) {
      if (config.autoApplyOnStart && shimNeedsPatch(state)) {
        await core.patchAllShims();
        core.silenceCmdFlash(state.ai_base);
        log(config, "auto-apply: patches clean, shim refreshed");
        return "already_clean:shim_patched";
      }
      log(config, "auto-apply: already clean");
      return "already_clean";
    }
    if (!config.autoApplyOnStart) {
      log(config, "auto-apply disabled");
      return "disabled";
    }
    const autoMulti = await core.applyPatchesAllHosts(core.ALL_PATCHES, { preserveClientBundles: true });
    await core.patchAllShims();
    const report = autoMulti.report;
    const flash = core.silenceCmdFlash(autoMulti.hosts[0]?.aiBase || state.ai_base);
    const applied = report.filter((r) => r.status === "applied").length;
    log(config, `auto-apply done: ${applied} applied; cmd-flash=${flash.entry} ok=${flash.ok}`);
    return flash.ok ? `applied:${applied}` : `applied:${applied}:cmd_flash_incomplete`;
  } catch (e) {
    console.warn("[dsh-purge] auto-apply error:", String(e));
    return `error:${e}`;
  }
}

/** 应用之后的那一次重启。密封包退出再打开，不再干等用户自己退出。 */
function scheduleApplyRestart(shouldRestart) {
  if (!shouldRestart) return { restarting: false };
  if (core.desktopAsarStillSealed()) {
    const planned = core.restartSealedDesktopIfNeeded();
    return {
      ...(planned || {}),
      restarting: Boolean(planned && (planned.restarting || planned.asarSwap)),
    };
  }
  try {
    const planned = hostctl.scheduleRestart(null, null);
    if (planned && (planned.restarting === false || planned.clean === false)) return planned;
    return planned || { restarting: true };
  } catch (error) {
    return { restarting: false, error: String(error && error.message ? error.message : error) };
  }
}

async function handlePurgeCommand(rawInput, config) {
  const args = (rawInput || "").trim().split(/\s+/).filter(Boolean);
  const sub = (args[0] || "status").toLowerCase();

  switch (sub) {
    case "status":
    case "s": {
      const state = await core.gatherState();
      return { kind: "success", text: renderStatus(state) };
    }
    case "apply":
    case "a": {
      core.applyRuntimeEnv();
      core.clearDesktopLocateCache();
      const home = core.pinDshHome();
      const scrubbed = core.sanitizeDesktopCommandRuntimes();
      const state = await core.gatherState();
      if (home) state.dsh_home = home;
      let located;
      try {
        located = await core.resolveOfficialAiBase(state.ai_base, { forApply: true });
      } catch (e) {
        return { kind: "error", text: String(e && e.message ? e.message : e) };
      }
      if (!located.aiBase) return { kind: "error", text: core.missingAiBaseMessage() };
      state.ai_base = located.aiBase;
      if (located.extracted && located.handoff?.archive) {
        core.writeUnpackedAsarStamp(located.handoff.archive);
      }
      const blocked = rejectIfNeedPrompt(state.dsh_home);
      if (blocked) return { kind: "error", text: blocked.error };
      const applyMulti = await core.applyPatchesAllHosts(core.ALL_PATCHES, {
        preserveClientBundles: false,
        forApply: true,
      });
      const report = applyMulti.report;
      const shimResult = await core.patchAllShims();
      const flash = core.silenceCmdFlash(applyMulti.hosts[0]?.aiBase || state.ai_base);
      const lines = [];
      for (const h of applyMulti.hosts) lines.push(`  宿主 / host → ${h.aiBase}`);
      lines.push(...report.map((r) => {
        const m = r.status === "applied" ? "✓ 已清洗" : r.status === "already" ? "- 已是最新" : r.status === "missing_file" ? "⚠ 文件缺失" : `✗ ${r.status}`;
        return `  ${m} patch #${String(r.patch_id).padEnd(2)} ${r.name}`;
      }));
      lines.push("", "shim:");
      for (const [dir, st] of Object.entries(shimResult)) {
        lines.push(`  · ${dir} → ${typeof st === "object" ? JSON.stringify(st) : st}`);
      }
      lines.push(`  cmd-flash=${flash.entry} phase-1=${flash.phase1} ok=${flash.ok}`);
      if (scrubbed.length) {
        lines.push("", "Desktop in-bin .bak scrub:");
        for (const row of scrubbed) lines.push(`  ✓ ${row.dir} → ${row.cleaned.join(", ")}`);
      }
      lines.push("Desktop: host-commands 密封目录只清理不注入；bak 禁止写进 bin（issue #9）。");
      const summary = core.summarizeApplyReport(report);
      const hostWritten = core.allPatchHostsWritten(applyMulti.hosts) || core.hostCleanMarkersPresent(state.ai_base);
      const complete = summary.failed.length === 0 && flash.ok === true && hostWritten;
      const promptReady = summary.failed.length > 0 && summary.failed.every((item) => item.status === "pattern_not_found");
      const shouldRestart = applyShouldRestart({
        complete: complete || (promptReady && hostWritten),
        sealed: core.desktopAsarStillSealed(),
        appliedCount: summary.applied,
        promptReady: promptReady && hostWritten,
      });
      if (shouldRestart) reapply.markSettleRestart();
      const planned = scheduleApplyRestart(shouldRestart);
      if (planned && planned.clean === false) {
        lines.push("", "清洗没有写进当前宿主，已取消重启。");
      } else if (planned && planned.restarting === false && planned.error) {
        lines.push("", String(planned.error));
      } else if (shouldRestart && planned && planned.restarting !== false) {
        lines.push("", "正在重启。");
      } else if (!complete) {
        lines.push("", "清洗没有完成，没有重启。");
      } else {
        lines.push("", "补丁已经在宿主里，不再重启。");
      }
      return { kind: "success", text: lines.join("\n") };
    }
    case "revert":
    case "r": {
      const state = await core.gatherState();
      const lines = [];
      if (state.ai_base) {
        const { reverted, errors } = await core.revertAll(state.ai_base);
        lines.push(...reverted.map((p) => `  ✓ 已还原 / Reverted ${p}`));
        for (const [p, e] of errors) lines.push(`  ⚠ 还原失败 ${p}: ${e}`);
        if (reverted.length === 0) lines.push("  - 没有补丁备份可还原 / no patch backup");
      }
      const shimRevert = await core.revertAllShims();
      for (const [dir, st] of Object.entries(shimRevert)) {
        lines.push(`  shim ${dir}: ${typeof st === "object" ? JSON.stringify(st) : st}`);
      }
      lines.push("", "回滚完成 / Revert done。重启 dsh 后恢复 / restart to restore.");
      lines.push("注: prompt-inject.md 保留（用户文件）/ prompt-inject.md kept (user file)");
      return { kind: "success", text: lines.join("\n") };
    }
    case "uninstall":
    case "remove": {
      const result = await uninstaller.uninstallPurge();
      const lines = [];
      if (result.applied) lines.push("已检测到补丁，已还原回原版。");
      else lines.push("未检测到已应用补丁，仍会清除插件文件。");
      if (result.patches) {
        lines.push(`  还原文件 ${result.patches.reverted?.length || 0} 个`);
      }
      if (result.override?.removed) lines.push(`  已删除 ${result.override.path}`);
      if (result.stripped?.length) lines.push(`  已从 profile 移除: ${result.stripped.join(", ")}`);
      if (result.errors?.length) {
        for (const e of result.errors) lines.push(`  ⚠ ${e}`);
      }
      lines.push("", "请重启 dsh。重启后插件不再加载。");
      return { kind: result.ok ? "success" : "error", text: lines.join("\n") };
    }
    case "edit":
    case "e": {
      const state = await core.gatherState();
      const r = core.editOverride(state.dsh_home);
      if (!r.ok && r.needCreate) {
        await core.installOverride(state.dsh_home, true);
        const r2 = core.editOverride(state.dsh_home);
        return {
          kind: "success",
          text: `已创建默认注入文件并打开编辑器：${r2.path}\n重启 dsh 生效。`,
        };
      }
      return {
        kind: "success",
        text: `已打开 ${r.editor} 编辑注入文件：${r.path}\n编辑完成后重启 dsh 生效。`,
      };
    }
    case "help":
    case "h":
    default:
      return {
        kind: "success",
        text: "dsh-purge 命令：\n" +
          "  /purge status     显示状态\n" +
          "  /purge apply      应用全部清洗（提示词+代码+shim+override）\n" +
          "  /purge revert     回滚还原\n" +
          "  /purge uninstall  卸载插件（已应用则先还原）\n" +
          "  /purge edit       编辑注入文件 prompt-inject.md\n" +
          "  /purge help       显示帮助\n" +
          "规则集切换见 /rules（list | use <id> | create | delete | reset）\n" +
          "官方 Skill 安装见 /skills（list | import <路径> | create <id> [说明] | delete <id>）",
      };
  }
}

function renderRulesStatus(st) {
  const out = [];
  out.push("规则集 / Rule Sets");
  out.push(`  存储目录 / store  ${st.rules_dir}`);
  const targetLine = st.active
    ? `${st.agents_path} (${st.active_target})`
    : "(无激活)";
  out.push(`  目标文件 / target ${targetLine} — exists=${st.agents_exists}, synced=${st.agents_synced}`);
  out.push("");
  if (st.rules.length === 0) {
    out.push("  (暂无规则 / no rules — 用 /rules create <id> 或设置页新建)");
  }
  for (const r of st.rules) {
    const isActive = r.id === st.active;
    const label = r.name !== r.id ? `${r.name} (${r.id})` : r.id;
    out.push(`  ${isActive ? "▶" : "·"} ${label}${isActive ? " ★ 当前" : ""} [${r.target}] (${rules.formatSize(r.size)})`);
  }
  return out.join("\n");
}

async function handleRulesCommand(rawInput) {
  const args = (rawInput || "").trim().split(/\s+/).filter(Boolean);
  const sub = (args[0] || "list").toLowerCase();
  const dshHome = core.findDshHome();

  switch (sub) {
    case "list":
    case "ls":
    case "s":
      return { kind: "success", text: renderRulesStatus(await rules.rulesStatus(dshHome)) };
    case "use":
    case "activate":
    case "u": {
      const id = args[1];
      if (!id) return { kind: "error", text: "用法: /rules use <id>" };
      try {
        const meta = await rules.activateRule(dshHome, id);
        refreshHungOperator(dshHome);
        return {
          kind: "success",
          text: `✓ 已激活规则 ${meta.name}（${id}）→ 写入 ${rules.targetPath(dshHome, meta.target)}，并注入 systemPrompt。新会话生效。`,
        };
      } catch (e) {
        return { kind: "error", text: `激活失败: ${e.message}` };
      }
    }
    case "create":
    case "new":
    case "c": {
      const id = args[1];
      if (!id) return { kind: "error", text: "用法: /rules create <id> [别名] [AGENTS.md|CLAUDE.md]" };
      const name = args[2] || id;
      const target = args[3] || "AGENTS.md";
      if (!rules.validTarget(target)) {
        return { kind: "error", text: `无效目标: ${target}（只能是 AGENTS.md 或 CLAUDE.md）` };
      }
      try {
        await rules.saveRule(dshHome, id, "", { name, target });
        return {
          kind: "success",
          text: `✓ 已创建规则 ${name}（${id} → ${target}）。在设置页「规则设定」编辑内容后保存。`,
        };
      } catch (e) {
        return { kind: "error", text: `创建失败: ${e.message}` };
      }
    }
    case "delete":
    case "rm":
    case "d": {
      const id = args[1];
      if (!id) return { kind: "error", text: "用法: /rules delete <id>" };
      try {
        await rules.deleteRule(dshHome, id);
        refreshHungOperator(dshHome);
        return { kind: "success", text: `✓ 已删除规则 ${id}。` };
      } catch (e) {
        return { kind: "error", text: `删除失败: ${e.message}` };
      }
    }
    case "reset":
    case "restore":
    case "还原": {
      try {
        const r = await rules.resetToOriginal(dshHome);
        refreshHungOperator(dshHome);
        const lines = [];
        if (r.removed.length > 0) lines.push(`✓ 已删除插件写入的目标文件: ${r.removed.join(", ")}`);
        if (r.skipped.length > 0) {
          lines.push(`⚠ 跳过（文件内容与规则不一致，可能被手动修改）: ${r.skipped.join(", ")}`);
        }
        lines.push("已清空激活状态。规则库内容保留，随时可重新激活。现在回到出厂状态：无全局指令。");
        return { kind: "success", text: lines.join("\n") };
      } catch (e) {
        return { kind: "error", text: `还原失败: ${e.message}` };
      }
    }
    case "help":
    case "h":
    default:
      return {
        kind: "success",
        text: "规则集命令：\n" +
          "  /rules list                         列出所有规则\n" +
          "  /rules use <id>                     激活规则（写入 AGENTS.md/CLAUDE.md，并注入 systemPrompt）\n" +
          "  /rules create <id> [别名] [目标]     新建规则\n" +
          "  /rules delete <id>                  删除规则\n" +
          "  /rules reset                        还原原始状态\n" +
          "  /rules help                         显示帮助",
      };
  }
}

function renderSkillsStatus(st) {
  const out = [];
  out.push("官方用户 Skill / $DSH_HOME/skills");
  out.push(`  ${st.skills_dir}`);
  out.push("  插件只安装目录。调用走官方：任务对上 description/whenToUse 时模型调 skill 工具；聊天输入 /名称 立即加载。");
  out.push("  正文里写「激活」不会触发。官方认 name、description、whenToUse、disable-model-invocation、user-invocable。");
  out.push("");
  if (!st.skills.length) {
    out.push("  (暂无用户 Skill — 用 /skills import <压缩包或文件夹> 或设置页导入)");
    return out.join("\n");
  }
  for (const item of st.skills) {
    const mark = item.valid ? "·" : "!";
    const desc = item.description || "(无说明)";
    const how = item.valid
      ? [
        item.userInvocable ? `/${item.id}` : "不可 /名称",
        item.modelInvocable ? "模型可调" : "模型不可调",
      ].join(" · ")
      : "";
    out.push(`  ${mark} ${item.id}  ${desc}  (${skills.formatSize(item.size)})`);
    if (how) out.push(`      ${how}`);
    if (!item.valid && item.error) out.push(`      ${item.error}`);
  }
  return out.join("\n");
}

async function handleSkillsCommand(rawInput) {
  const args = (rawInput || "").trim().split(/\s+/).filter(Boolean);
  const sub = (args[0] || "list").toLowerCase();
  const dshHome = core.findDshHome();

  switch (sub) {
    case "list":
    case "ls":
    case "s":
      return { kind: "success", text: renderSkillsStatus(await skills.skillsStatus(dshHome)) };
    case "create":
    case "new":
    case "c": {
      const id = args[1];
      if (!id) return { kind: "error", text: "用法: /skills create <id> [说明]" };
      if (!skills.validSkillName(id)) {
        return { kind: "error", text: "id 必须是 kebab-case，例如 code-review" };
      }
      const description = args.slice(2).join(" ").trim() || id;
      try {
        const saved = skills.toPublicSkill(dshHome, await skills.saveSkill(dshHome, id, "", description));
        return {
          kind: "success",
          text: `✓ 已写入官方目录 ${saved.path}\n新会话会进官方 Skill 目录；任务对上或输入 /${id} 时由官方加载。`,
        };
      } catch (e) {
        return { kind: "error", text: `安装失败: ${e.message}` };
      }
    }
    case "import":
    case "i": {
      const src = args.slice(1).join(" ").trim();
      if (!src) return { kind: "error", text: "用法: /skills import <压缩包或文件夹>" };
      try {
        const packed = await skills.importFromPath(dshHome, src);
        const names = packed.imported.map((item) => item.id).join(", ");
        return { kind: "success", text: `✓ 已导入到官方 $DSH_HOME/skills：${names}` };
      } catch (e) {
        return { kind: "error", text: `导入失败: ${e.message}` };
      }
    }
    case "delete":
    case "rm":
    case "d": {
      const id = args[1];
      if (!id) return { kind: "error", text: "用法: /skills delete <id>" };
      try {
        const removed = skills.toPublicSkill(dshHome, await skills.deleteSkill(dshHome, id));
        return {
          kind: "success",
          text: `✓ 已从官方目录删除 ${id}${removed.backup ? `\n备份：${removed.backup}` : ""}`,
        };
      } catch (e) {
        return { kind: "error", text: `删除失败: ${e.message}` };
      }
    }
    case "help":
    case "h":
    default:
      return {
        kind: "success",
        text: "官方 Skill 安装：\n" +
          "  /skills list                 列出 $DSH_HOME/skills\n" +
          "  /skills create <id> [说明]   写入 <id>/SKILL.md\n" +
          "  /skills import <路径>        导入压缩包或文件夹到官方目录\n" +
          "  /skills delete <id>          删除该目录（官方会从目录拿掉）\n" +
          "  也可自己删 $DSH_HOME/skills/<id>\n" +
          "  调用：聊天输入 /<id>，或让模型按 description 调 skill 工具\n" +
          "  不注入 systemPrompt，不替代提示词",
      };
  }
}

export function apply(ctx, config) {
  const cfg = { ...DEFAULTS, ...(config || {}) };
  if (!cfg.enabled) return;
  const life = watchContextLife(ctx);
  if (!life.alive) {
    console.warn("[dsh-purge] skip apply: inactive context");
    return;
  }
  log(cfg, "plugin enabled");

  try {
    const hide = core.ensureHiddenConsole();
    log(cfg, "hide-console:", JSON.stringify(hide));
  } catch (e) {
    console.warn("[dsh-purge] hide-console error:", String(e));
  }
  core.applyRuntimeEnv();
  // 页面打开前写前端 client.js。settle 在数秒之后，那时再写会让已发出的 rev 404（#63）。
  try {
    const written = core.patchWatchedClientBundlesSync();
    publishClientBundleRevs(ctx, written);
    if (written.length) log(cfg, "client bundles patched before page:", written.join(","));
  } catch (e) {
    console.warn("[dsh-purge] client bundle boot patch:", String(e && e.message ? e.message : e));
  }
  try {
    const home = core.pinDshHome() || core.findDshHome();
    refreshHungOperator(home);
  } catch { /* 主目录还没有时，组装会再挂内置默认 */ }
  try {
    const scrubbed = core.sanitizeDesktopCommandRuntimes();
    if (scrubbed.length) log(cfg, "desktop runtime scrub on load:", JSON.stringify(scrubbed));
  } catch (e) {
    console.warn("[dsh-purge] desktop runtime scrub error:", String(e));
  }

  const settleTimer = setTimeout(() => {
    if (!life.alive) {
      log(cfg, "settle skipped: inactive context");
      return;
    }
    settleInstalledPatches(cfg, ctx, life)
      .then((r) => log(cfg, "settle:", r))
      .catch((e) => {
        if (isInactiveContextError(e)) {
          log(cfg, "settle skipped: inactive context");
          return;
        }
        console.warn("[dsh-purge] settle error:", String(e));
      });
    rules.ensureInitialState(core.findDshHome())
      .then((r) => log(cfg, "rules init:", JSON.stringify(r)))
      .catch((e) => console.warn("[dsh-purge] rules init error:", String(e)));
  }, settleDelayMs(hostctl.currentSurface()));
  try {
    ctx.effect(() => () => clearTimeout(settleTimer));
  } catch (e) {
    if (isInactiveContextError(e)) {
      clearTimeout(settleTimer);
      console.warn("[dsh-purge] skip apply: inactive context");
      return;
    }
    throw e;
  }

  try {
    applyHostHooks(ctx, cfg);
  } catch (e) {
    if (isInactiveContextError(e)) {
      console.warn("[dsh-purge] skip apply: inactive context");
      return;
    }
    throw e;
  }
}

function applyHostHooks(ctx, cfg) {
  try {
    const home = core.pinDshHome() || core.findDshHome();
    rules.ensureOperatorBody(home);
  } catch { /* 主目录尚未就绪 */ }
  installIdentityOverride(ctx, cfg);
  installRegionGate(ctx);
  try {
    refusalRecoverRuntime?.dispose?.();
  } catch { /* ignore */ }
  refusalRecoverRuntime = refusalRecover.installRefusalRecover(ctx, {
    getConfig: () => ({
      enabled: cfg.refusalRecover !== false,
      maxPerTurn: cfg.refusalRecoverMax ?? DEFAULTS.refusalRecoverMax,
      recoverText: cfg.refusalRecoverText ?? DEFAULTS.refusalRecoverText,
    }),
  });
  installFreshFullAccess(ctx);
  installRewindDeriveFilter(ctx);
  installMnemonMessageStrip(ctx, cfg);
  const injectFile = core.findOverrideFile(core.findDshHome());
  registerPromptSections(ctx, cfg, injectFile);

  continuePluginCfg = cfg;
  savedContinueSettings = continueRetry.loadSettings(core.findDshHome());
  try { continueRuntime?.dispose?.(); } catch { /* ignore */ }
  continueRuntime = continueRetry.installContinueRetry(ctx, { getConfig: currentContinueConfig });

  const commands = ctx.get?.("commands");
  if (commands) {
    commands.register({
      name: "purge",
      description: "dsh 指令权威性清洗（status/apply/revert/uninstall/edit/help）",
      input: { hint: "status | apply | revert | uninstall | edit | help" },
      handler: async (invocation) => handlePurgeCommand(invocation.rawInput ?? "", cfg),
    });
    commands.register({
      name: "rules",
      description: "规则集切换（写入 AGENTS.md/CLAUDE.md）: list | use <id> | create <id> [别名] [目标] | delete <id> | reset | help",
      input: { hint: "list | use <id> | create <id> [别名] [目标] | delete <id> | reset | help" },
      handler: async (invocation) => handleRulesCommand(invocation.rawInput ?? ""),
    });
    commands.register({
      name: "skills",
      description: "官方用户 Skill（$DSH_HOME/skills）：list | import <路径> | create <id> [说明] | delete <id> | help",
      input: { hint: "list | import <路径> | create <id> [说明] | delete <id> | help" },
      handler: async (invocation) => handleSkillsCommand(invocation.rawInput ?? ""),
    });
    commands.register({
      name: "rewind",
      description: "回退：子代理直接回退一次；主代理 /rewind once 或 /rewind round",
      input: { hint: "once | round" },
      handler: async (invocation) => {
        const sessionId = rewind.invocationSessionId(invocation);
        const arg = String(invocation.rawInput || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
        const info = await rewind.analyzeRewind(ctx, sessionId);
        if (info.ok && info.kind === "main" && arg !== "once" && arg !== "round") {
          return {
            kind: "success",
            text: "主代理请选择：/rewind once 回退一次，/rewind round 回退上一轮（含本轮子代理）。",
          };
        }
        const mode = arg === "round" ? "round" : "once";
        const result = await rewind.applyRewind(ctx, sessionId, mode);
        if (!result.ok) return { kind: "error", text: result.error };
        return {
          kind: "success",
          text: mode === "round"
            ? "已回退上一轮。还在这条对话里，上一句已放回输入框。再发送时，之前的回复不会带上。"
            : "已回退一次。还在这条对话里，上一句已放回输入框。再发送时，之前的回复不会带上。",
        };
      },
    });
    // commands.register({
    //   name: "continue",
    //   description: "异常停止或中断后发送继续（计入继续次数）",
    //   input: { hint: "继续当前异常停止的会话" },
    //   handler: async (invocation) => {
    //     const sessionId = rewind.invocationSessionId(invocation);
    //     const agent = continueRetry.resolveAgent(ctx, sessionId);
    //     if (!agent || !continueRuntime) return { kind: "error", text: "当前会话不能继续" };
    //     const result = continueRuntime.continueNow(agent);
    //     if (!result.ok) return { kind: "error", text: result.error };
    //     return { kind: "success", text: `已发送继续（${result.used}/${result.max}）` };
    //   },
    // });
  }

  if (ctx.tools) {
    ctx.tools.register({
      name: "purge_status",
      description: `查看 dsh 指令权威性清洗状态（${core.ALL_PATCHES.length} patch 清洗进度、shim 注入、override 文件）。`,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { text: { type: "string" } },
        },
        render: (_args, value) => [{ type: "text", text: String(value?.text ?? "") }],
      },
      async execute() {
        const state = await core.gatherState();
        return { text: renderStatus(state) };
      },
    });
    ctx.tools.register({
      name: "purge_apply",
      description: `应用 dsh 指令权威性清洗：${core.ALL_PATCHES.length} patch（提示词层+代码默认+引擎级审批/沙箱绕过）+ shim 注入 + override 文件。需重启 dsh 完全生效。`,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { text: { type: "string" } },
        },
        render: (_args, value) => [{ type: "text", text: String(value?.text ?? "") }],
      },
      async execute() {
        core.applyRuntimeEnv();
        const scrubbed = core.sanitizeDesktopCommandRuntimes();
        const state = await core.gatherState();
        if (!state.ai_base) return { text: "ERROR: " + core.missingAiBaseMessage() };
        const blocked = rejectIfNeedPrompt(state.dsh_home);
        if (blocked) return { text: "ERROR: " + blocked.error };
        const toolMulti = await core.applyPatchesAllHosts(core.ALL_PATCHES, {
          preserveClientBundles: false,
          forApply: true,
        });
        await core.patchAllShims();
        const flash = core.silenceCmdFlash(toolMulti.hosts[0]?.aiBase || state.ai_base);
        const report = toolMulti.report;
        const applied = report.filter((r) => r.status === "applied").length;
        const already = report.filter((r) => r.status === "already").length;
        const scrubNote = scrubbed.length ? ` desktop_scrub=${scrubbed.length}` : "";
        return { text: `清洗完成 / applied=${applied}, already=${already}.${scrubNote} phase-1=${flash.phase1} 重启 dsh 生效.` };
      },
    });
    ctx.tools.register({
      name: "purge_revert",
      description: "回滚 dsh 指令权威性清洗到备份原件（保留 prompt-inject.md 用户文件）。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { text: { type: "string" } },
        },
        render: (_args, value) => [{ type: "text", text: String(value?.text ?? "") }],
      },
      async execute() {
        const state = await core.gatherState();
        const lines = [];
        if (state.ai_base) {
          const { reverted, errors } = await core.revertAll(state.ai_base);
          lines.push(`reverted=${reverted.length}${errors.length ? ` errors=${errors.length}` : ""}`);
        }
        const shimRevert = await core.revertAllShims();
        lines.push(`shim_dirs=${Object.keys(shimRevert).length}`);
        return { text: `回滚完成 / ${lines.join(", ")}. 重启 dsh 恢复.` };
      },
    });
  }

  installWebServer(ctx, cfg);
}

function headerOf(request, name) {
  const headers = request?.headers;
  if (!headers) return "";
  const value = headers[name] ?? headers[String(name).toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || "");
  return String(value || "");
}

function denyCrossOrigin(response) {
  response.writeHead(403, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify({ ok: false, error: "cross-origin blocked" }));
}

function allowPluginRequest(request, response) {
  const site = headerOf(request, "sec-fetch-site").toLowerCase();
  if (site === "cross-site") {
    denyCrossOrigin(response);
    return false;
  }
  const origin = headerOf(request, "origin").trim();
  if (origin === "null") {
    denyCrossOrigin(response);
    return false;
  }
  if (!origin) return true;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    denyCrossOrigin(response);
    return false;
  }
  const host = headerOf(request, "host").trim();
  if (!host || originHost.toLowerCase() !== host.toLowerCase()) {
    denyCrossOrigin(response);
    return false;
  }
  return true;
}

function installWebServer(ctx, cfg) {
  // 桌面端内嵌 @deepseek-ai/dsh-web-app，设置页同样走 webServer（常见 43120），不是只给官方 dsh web。
  watchWebTreeReady(ctx);
  ctx.inject(["webServer"], (host) => {
    host.effect(() => {
      const registerPluginRoute = (spec, label) => host.webServer.register({
        ...spec,
        handler: async (request, response) => {
          if (!allowPluginRequest(request, response)) return;
          return spec.handler(request, response);
        },
      }, label);
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/status",
        handler: async (request, response) => {
          if (request.method !== "GET") {
            response.writeHead(405, { allow: "GET" });
            response.end();
            return;
          }
          try {
            if (!webTreeReady) {
              sendJson(response, 503, { ok: false, ready: false });
              return;
            }
            const state = await core.gatherState();
            const patch_names = {};
            for (const p of core.ALL_PATCHES) patch_names[String(p.id)] = p.name;
            sendJson(response, 200, {
              ok: true,
              ready: true,
              surface: state.surface || hostctl.currentSurface(),
              ai_base: state.ai_base,
              desktop_install: state.desktop_install || "",
              desktop_exe: state.desktop_exe || "",
              asar_still_sealed: state.asar_still_sealed || false,
              missing_ai_base: state.ai_base ? "" : core.missingAiBaseMessage(),
              patches_applied: state.patches_applied,
              patches_pending: state.patches_pending,
              patches_skipped: state.patches_skipped || 0,
              patches_ready: state.patches_ready || 0,
              patches_na: state.patches_na || 0,
              patches_total: state.ai_base ? (state.patches_total || 0) : 0,
              patches_lost: reapply.patchesLostAfterHostReset(),
              patch_status: state.patch_status,
              patches: core.ALL_PATCHES.map((p) => ({
                id: p.id,
                layer: p.layer || "",
                status: state.patch_status[p.id] || (state.ai_base ? "missing_file" : "unlocated"),
              })).filter((p) => p.status !== "na"),
              patch_names,
              shim_cmd: state.shim_cmd,
              shim_ps1: state.shim_ps1,
              shim_bin: state.shim_bin,
              has_backup: state.has_backup,
              override_status: state.override_status,
              override_path: state.override_path,
              dsh_home: state.dsh_home,
              plugin_version: updater.localVersion(),
              boot_full_quit: bootFullQuit,
              update: updater.lastUpdateResult(),
              ...updater.channelPublic(),
              ...(await skills.skillsStatus(core.findDshHome()).catch(() => ({ skills: [] }))),
            });
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e) });
          }
        },
      }, "dsh-purge: status");
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/last-user",
        handler: async (request, response) => {
          if (request.method !== "GET") {
            response.writeHead(405, { allow: "GET" });
            response.end();
            return;
          }
          try {
            const url = new URL(request.url, "http://127.0.0.1");
            const sessionId = String(url.searchParams.get("sessionId") || "").trim();
            sendJson(response, 200, await rewind.readLastUserText(ctx, sessionId));
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e) });
          }
        },
      }, "dsh-purge: last user");
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/rewind/options",
        handler: async (request, response) => {
          if (request.method !== "GET") {
            response.writeHead(405, { allow: "GET" });
            response.end();
            return;
          }
          try {
            const url = new URL(request.url, "http://127.0.0.1");
            const sessionId = String(url.searchParams.get("sessionId") || "").trim();
            sendJson(response, 200, await rewind.analyzeRewind(ctx, sessionId));
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e) });
          }
        },
      }, "dsh-purge: rewind options");
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/rewind",
        handler: async (request, response) => {
          if (request.method === "GET") {
            try {
              const url = new URL(request.url, "http://127.0.0.1");
              const sessionId = url.searchParams.get("sessionId");
              if (sessionId) {
                const draft = rewind.takeDraft(sessionId);
                sendJson(response, 200, { ok: true, ...(draft || {}) });
                return;
              }
              const pending = rewind.getPending();
              sendJson(response, 200, { ok: true, ...(pending || {}) });
            } catch (e) {
              sendJson(response, 500, { ok: false, error: String(e) });
            }
            return;
          }
          if (request.method === "POST") {
            try {
              const body = await readJsonBody(request);
              const sessionId = String(body?.sessionId || "").trim();
              if (!sessionId) {
                sendJson(response, 400, { ok: false, error: "需要 sessionId" });
                return;
              }
              const mode = body?.mode === "round" ? "round" : "once";
              const result = await rewind.applyRewind(ctx, sessionId, mode);
              sendJson(response, result.ok ? 200 : 409, result);
            } catch (e) {
              sendJson(response, 500, { ok: false, error: String(e) });
            }
            return;
          }
          response.writeHead(405, { allow: "GET, POST" });
          response.end();
        },
      }, "dsh-purge: rewind");
      // registerPluginRoute({
      //   kind: "exact",
      //   path: "/dsh-purge/continue",
      //   handler: async (request, response) => {
      //     if (request.method === "GET") {
      //       try {
      //         const url = new URL(request.url, "http://127.0.0.1");
      //         const sessionId = String(url.searchParams.get("sessionId") || "").trim();
      //         sendJson(response, 200, continueStatusPayload(ctx, sessionId));
      //       } catch (e) {
      //         sendJson(response, 500, { ok: false, error: String(e) });
      //       }
      //       return;
      //     }
      //     if (request.method === "POST") {
      //       try {
      //         const body = await readJsonBody(request);
      //         const sessionId = String(body?.sessionId || "").trim();
      //         if (!sessionId) {
      //           sendJson(response, 400, { ok: false, error: "需要 sessionId" });
      //           return;
      //         }
      //         const agent = continueRetry.resolveAgent(ctx, sessionId);
      //         if (!agent || !continueRuntime) {
      //           sendJson(response, 409, { ok: false, error: "当前会话不能继续" });
      //           return;
      //         }
      //         const result = continueRuntime.continueNow(agent, { force: Boolean(body?.force) });
      //         sendJson(response, result.ok ? 200 : 409, result);
      //       } catch (e) {
      //         sendJson(response, 500, { ok: false, error: String(e) });
      //       }
      //       return;
      //     }
      //     response.writeHead(405, { allow: "GET, POST" });
      //     response.end();
      //   },
      // }, "dsh-purge: continue");
      // registerPluginRoute({
      //   kind: "exact",
      //   path: "/dsh-purge/continue/settings",
      //   handler: async (request, response) => {
      //     if (request.method === "GET") {
      //       try {
      //         sendJson(response, 200, { ok: true, ...currentContinueConfig() });
      //       } catch (e) {
      //         sendJson(response, 500, { ok: false, error: String(e) });
      //       }
      //       return;
      //     }
      //     if (request.method === "POST") {
      //       try {
      //         const body = await readJsonBody(request);
      //         savedContinueSettings = await continueRetry.saveSettings(core.findDshHome(), {
      //           ...currentContinueConfig(),
      //           ...body,
      //         });
      //         sendJson(response, 200, { ok: true, ...currentContinueConfig() });
      //       } catch (e) {
      //         sendJson(response, 500, { ok: false, error: String(e) });
      //       }
      //       return;
      //     }
      //     response.writeHead(405, { allow: "GET, POST" });
      //     response.end();
      //   },
      // }, "dsh-purge: continue settings");
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/update",
        handler: async (request, response) => {
          if (request.method === "GET") {
            try {
              sendJson(response, 200, await updater.checkUpdate());
            } catch (e) {
              sendJson(response, 500, { ok: false, error: String(e) });
            }
            return;
          }
          if (request.method === "POST") {
            try {
              const body = await readJsonBody(request);
              const result = await updater.handleUpdateOp(body || {});
              if (result && result.needsFullQuit) bootFullQuit = true;
              sendJson(response, 200, result);
              if (result && result.restartAfter) {
                try { hostctl.scheduleRestart(request, ctx); } catch (e) {
                  console.warn("[dsh-purge] update restart failed:", e);
                }
              }
            } catch (e) {
              sendJson(response, 500, { ok: false, error: String(e) });
            }
            return;
          }
          response.writeHead(405, { allow: "GET, POST" });
          response.end();
        },
      }, "dsh-purge: update");
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/apply",
        handler: async (request, response) => {
          if (request.method !== "POST") {
            response.writeHead(405, { allow: "POST" });
            response.end();
            return;
          }
          try {
            const body = await readJsonBody(request);
            const incoming = typeof body?.content === "string" ? body.content : null;
            core.applyRuntimeEnv();
            core.clearDesktopLocateCache();
            const home = core.pinDshHome();
            const scrubbed = core.sanitizeDesktopCommandRuntimes();
            const state = await core.gatherState();
            if (home) state.dsh_home = home;
            let located;
            try {
              located = await core.resolveOfficialAiBase(state.ai_base, { forApply: true });
            } catch (e) {
              sendJson(response, 500, { ok: false, error: String(e && e.message ? e.message : e) });
              return;
            }
            if (!located.aiBase) {
              sendJson(response, 500, { ok: false, error: core.missingAiBaseMessage() });
              return;
            }
            state.ai_base = located.aiBase;
            if (located.extracted) {
              const arch = located.handoff?.archive;
              if (arch) core.writeUnpackedAsarStamp(arch);
            }
            const handoff = located.handoff && located.handoff.swapAsar ? located.handoff : null;
            const blocked = rejectIfNeedPrompt(state.dsh_home, incoming === null ? undefined : incoming);
            if (blocked) {
              const ui = await core.readOverrideForUi(state.dsh_home);
              sendJson(response, 400, {
                ok: false,
                needPrompt: true,
                override_content: incoming || "",
                defaultContent: ui.defaultContent,
                ...blocked,
              });
              return;
            }
            if (incoming !== null) {
              await core.saveOverrideContent(state.dsh_home, incoming);
            }
            const httpMulti = await core.applyPatchesAllHosts(core.ALL_PATCHES, {
              preserveClientBundles: false,
              forApply: true,
            });
            const report = httpMulti.report;
            const shim = await core.patchAllShims();
            let cliRepair = null;
            try {
              cliRepair = core.repairOfficialCliAfterUnpack();
            } catch (e) {
              cliRepair = { ok: false, error: String(e && e.message ? e.message : e) };
            }
            const flash = core.silenceCmdFlash(httpMulti.hosts[0]?.aiBase || state.ai_base);
            const summary = core.summarizeApplyReport(report);
            const hostWritten =
              core.allPatchHostsWritten(httpMulti.hosts) || core.hostCleanMarkersPresent(state.ai_base);
            const complete = summary.failed.length === 0 && flash.ok === true && hostWritten;
            const sealedNow = core.desktopAsarStillSealed();
            const promptReady = summary.failed.length > 0 && summary.failed.every((item) => item.status === "pattern_not_found");
            if (flash.ok === true && (complete || promptReady) && hostWritten) {
              reapply.markPatchesApplied();
            }
            // 全部洗完且标记进宿主才弹重启；密封包重启时换走 asar。
            const shouldRestart = applyShouldRestart({
              complete: complete || (promptReady && hostWritten),
              sealed: sealedNow,
              appliedCount: summary.applied,
              promptReady: promptReady && hostWritten,
            });
            if (shouldRestart && handoff && sealedNow) bootFullQuit = true;
            else bootFullQuit = false;
            if (shouldRestart) reapply.markSettleRestart();
            let promptInjectInstall = "skipped";
            if (hostWritten && flash.ok === true) {
              promptInjectInstall = await core.installOverride(state.dsh_home, false);
            }
            const hung = refreshHungOperator(state.dsh_home);
            const override = await core.readOverrideForUi(state.dsh_home);
            sendJson(response, 200, {
              ok: true,
              complete,
              restarting: shouldRestart,
              restart_after_apply: shouldRestart,
              unpacked_asar: shouldRestart,
              needs_full_quit: shouldRestart,
              asar_still_sealed: sealedNow,
              asar_swap_started: Boolean(shouldRestart && handoff && sealedNow),
              applied: summary.applied,
              already: summary.already,
              failed: summary.failed.length,
              failed_items: summary.failed.map((r) => ({
                id: r.patch_id,
                name: r.name,
                status: r.status,
              })),
              report: report.map((r) => ({ id: r.patch_id, name: r.name, status: r.status })),
              override_content: hung.text || override.content,
              defaultContent: override.defaultContent,
              ...injectSnapshot(state.dsh_home),
              override_path: override.path,
              override_installed: promptInjectInstall,
              shim,
              desktop_scrubbed: scrubbed,
              cli_repair: cliRepair,
              cmd_flash: flash,
            });
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e) });
          }
        },
      }, "dsh-purge: apply");
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/revert",
        handler: async (request, response) => {
          if (request.method !== "POST") {
            response.writeHead(405, { allow: "POST" });
            response.end();
            return;
          }
          try {
            const state = await core.gatherState();
            const result = {};
            if (state.ai_base) {
              const { reverted, errors } = await core.revertAll(state.ai_base);
              result.reverted = reverted.length;
              result.errors = errors.length;
            }
            result.shim = await core.revertAllShims();
            sendJson(response, 200, { ok: true, ...result, note: "重启 dsh 恢复; prompt-inject.md 保留" });
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e) });
          }
        },
      }, "dsh-purge: revert");
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/uninstall",
        handler: async (request, response) => {
          if (request.method !== "POST") {
            response.writeHead(405, { allow: "POST" });
            response.end();
            return;
          }
          try {
            const result = await uninstaller.uninstallPurge();
            sendJson(response, result.ok ? 200 : 500, {
              ...result,
              surface: hostctl.currentSurface(),
              fullApp: hostctl.currentSurface() === "desktop",
              note: result.ok ? hostctl.restartNote() : undefined,
            });
            if (result.ok) {
              uninstaller.scheduleCleanupRestart({
                request,
                cleanup: result.cleanup,
                ctx,
              });
            }
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e && e.message ? e.message : e) });
          }
        },
      }, "dsh-purge: uninstall");
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/drill-grant",
        handler: async (request, response) => {
          const home = core.findDshHome();
          if (request.method === "GET") {
            sendJson(response, 200, { ok: true, ...readDrillGrant(home) });
            return;
          }
          if (request.method === "POST") {
            sendJson(response, 200, { ok: true, ...writeDrillGrant(home) });
            return;
          }
          response.writeHead(405, { allow: "GET, POST" });
          response.end();
        },
      }, "dsh-purge: drill-grant");
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/override",
        handler: async (request, response) => {
          if (request.method === "GET") {
            try {
              const home = core.findDshHome();
              const ui = await core.readOverrideForUi(home);
              sendJson(response, 200, { ok: true, ...ui, ...injectSnapshot(home) });
            } catch (e) {
              sendJson(response, 500, { ok: false, error: String(e) });
            }
            return;
          }
          if (request.method === "POST") {
            try {
              const body = await readJsonBody(request);
              const content = typeof body?.content === "string" ? body.content : null;
              if (content === null) {
                sendJson(response, 400, { ok: false, error: "content must be a string" });
                return;
              }
              const home = core.findDshHome();
              const blocked = rejectIfNeedPrompt(home, content);
              if (blocked) {
                sendJson(response, 400, {
                  ok: false,
                  content,
                  ...blocked,
                });
                return;
              }
              const saved = await core.saveOverrideContent(home, content);
              const hung = refreshHungOperator(home);
              const ui = await core.readOverrideForUi(home);
              sendJson(response, 200, {
                ok: true,
                content: hung.text,
                defaultContent: saved.defaultContent,
                customized: ui.customized,
                usingDefault: ui.usingDefault,
                path: ui.path,
                ...injectSnapshot(home),
              });
            } catch (e) {
              sendJson(response, 500, { ok: false, error: String(e) });
            }
            return;
          }
          response.writeHead(405, { allow: "GET, POST" });
          response.end();
        },
      }, "dsh-purge: override");
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/own-servers",
        handler: async (request, response) => {
          const home = core.findDshHome();
          if (request.method === "GET") {
            sendJson(response, 200, { ok: true, content: readAllowText(home) });
            return;
          }
          if (request.method === "POST") {
            try {
              const body = await readJsonBody(request);
              const content = typeof body?.content === "string" ? body.content : null;
              if (content === null) {
                sendJson(response, 400, { ok: false, error: "content must be a string" });
                return;
              }
              const saved = await writeAllowText(home, content);
              sendJson(response, 200, { ok: true, content: saved.text, dropped: saved.dropped });
            } catch (e) {
              sendJson(response, 500, { ok: false, error: String(e && e.message ? e.message : e) });
            }
            return;
          }
          response.writeHead(405, { allow: "GET, POST" });
          response.end();
        },
      }, "dsh-purge: own-servers");
      installRulesHttp(host.webServer);
      installSkillsHttp(host.webServer);
      registerPluginRoute({
        kind: "exact",
        path: "/dsh-purge/restart",
        handler: async (request, response) => {
          if (request.method !== "POST") {
            response.writeHead(405, { allow: "POST" });
            response.end();
            return;
          }
          try {
            const ready = await ensureRestartReady();
            if (!ready.ok) {
              bootFullQuit = false;
              sendJson(response, 200, {
                ok: false,
                error: ready.error || "清洗没有完成，已取消重启",
                restarting: false,
                pending: ready.pending || [],
              });
              return;
            }
            const surface = hostctl.currentSurface();
            let planned = null;
            if (core.desktopAsarStillSealed()) {
              planned = core.restartSealedDesktopIfNeeded();
            } else {
              planned = hostctl.scheduleRestart(request, ctx);
            }
            if (planned && planned.clean === false) {
              bootFullQuit = false;
              sendJson(response, 200, {
                ok: false,
                error: "清洗没有写进当前宿主，已取消重启",
                restarting: false,
              });
              return;
            }
            // 用户已点重启：清掉粘性标记，避免同进程误刷新/再进面板又弹一次。
            bootFullQuit = false;
            const restarting = Boolean(planned && (planned.restarting || planned.asarSwap));
            const restartError = planned && planned.error ? String(planned.error) : "";
            sendJson(response, 200, {
              ok: restarting || !restartError,
              surface,
              fullApp: surface === "desktop",
              restarting,
              already: Boolean(planned && planned.already),
              needsFullQuit: Boolean(planned && planned.asarSwap),
              asar_still_sealed: core.desktopAsarStillSealed(),
              error: restartError || undefined,
              note: restarting ? "正在重启。" : restartError,
            });
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e) });
          }
        },
      }, "dsh-purge: restart");
    }, "dsh-purge: http routes");
  });
}

function methodNotAllowed(request, response, allow) {
  if (allow.includes(request.method)) return false;
  response.writeHead(405, { allow: allow.join(", ") });
  response.end();
  return true;
}

async function handleRulesOp(op, body, queryId) {
  const dshHome = core.findDshHome();
  const id = typeof body?.id === "string" ? body.id : String(queryId || "");
  if (op === "status") {
    return { ok: true, ...(await rules.rulesStatus(dshHome)) };
  }
  if (op === "read") {
    if (!rules.validRuleId(id)) return { status: 400, ok: false, error: "invalid id" };
    const content = await rules.readRule(dshHome, id);
    if (content === null) return { status: 404, ok: false, error: `rule not found: ${id}` };
    const meta = await rules.readRuleMeta(dshHome, id);
    return { ok: true, id, name: meta.name, target: meta.target, content };
  }
  if (op === "save") {
    const content = typeof body?.content === "string" ? body.content : null;
    if (!rules.validRuleId(id) || content === null) {
      return { status: 400, ok: false, error: "id and content (string) required" };
    }
    await rules.saveRule(dshHome, id, content, {
      name: typeof body?.name === "string" ? body.name : undefined,
      target: typeof body?.target === "string" ? body.target : undefined,
    });
    refreshHungOperator(dshHome);
    return { ok: true, id, ...injectSnapshot(dshHome) };
  }
  if (op === "activate") {
    if (!rules.validRuleId(id)) return { status: 400, ok: false, error: "invalid id" };
    const meta = await rules.activateRule(dshHome, id);
    refreshHungOperator(dshHome);
    return {
      ok: true,
      id,
      name: meta.name,
      target: meta.target,
      agents_path: rules.targetPath(dshHome, meta.target),
      note: "已写入目标文件并注入 systemPrompt，新会话生效",
      ...injectSnapshot(dshHome),
    };
  }
  if (op === "delete") {
    if (!rules.validRuleId(id)) return { status: 400, ok: false, error: "invalid id" };
    await rules.deleteRule(dshHome, id);
    refreshHungOperator(dshHome);
    return { ok: true, id };
  }
  if (op === "reset") {
    const r = await rules.resetToOriginal(dshHome);
    refreshHungOperator(dshHome);
    return { ok: true, ...r, note: "已还原出厂状态（无全局指令）；规则库保留" };
  }
  return { status: 400, ok: false, error: `unknown op: ${op}` };
}

function rulesHttpHandler(forcedOp) {
  return async (request, response) => {
    if (request.method === "OPTIONS") {
      sendOptions(response);
      return;
    }
    try {
      const url = new URL(request.url ?? "", "http://127.0.0.1");
      const tail = url.pathname.replace(/^\/dsh-purge\/rules\/?/, "").replace(/\/$/, "");
      let body = {};
      if (request.method === "POST") body = await readJsonBody(request);
      else if (methodNotAllowed(request, response, forcedOp ? ["GET", "POST"] : ["GET", "POST"])) return;
      const op = forcedOp || body.op || tail || "status";
      const result = await handleRulesOp(op, body, url.searchParams.get("id"));
      sendJson(response, result.status || 200, result);
    } catch (e) {
      sendJson(response, 500, { ok: false, error: String(e && e.message ? e.message : e) });
    }
  };
}

async function handleSkillsOp(op, body, queryId) {
  const dshHome = core.findDshHome();
  const id = typeof body?.id === "string" ? body.id : String(queryId || "");
  if (op === "status") {
    return { ok: true, ...(await skills.skillsStatus(dshHome)) };
  }
  if (op === "read") {
    if (!skills.validSkillName(id)) return { status: 400, ok: false, error: "invalid skill name" };
    const item = await skills.readSkill(dshHome, id);
    if (!item) return { status: 404, ok: false, error: `skill not found: ${id}` };
    return { ok: true, ...skills.toPublicSkill(dshHome, item) };
  }
  if (op === "save") {
    if (!skills.validSkillName(id)) return { status: 400, ok: false, error: "id 必须是 kebab-case，例如 code-review" };
    const content = typeof body?.content === "string" ? body.content : "";
    const description = typeof body?.description === "string" ? body.description : "";
    const saved = await skills.saveSkill(dshHome, id, content, description);
    return { ok: true, ...skills.toPublicSkill(dshHome, saved) };
  }
  if (op === "delete") {
    if (!skills.validSkillName(id)) return { status: 400, ok: false, error: "invalid skill name" };
    const removed = await skills.deleteSkill(dshHome, id);
    return { ok: true, ...skills.toPublicSkill(dshHome, removed) };
  }
  if (op === "import") {
    if (body?.path || body?.source || body?.folder) {
      return { status: 400, ok: false, error: "请在本机选择压缩包或文件夹导入" };
    }
    if (typeof body?.data === "string" && body.data.trim()) {
      const packed = await skills.importArchive(dshHome, Buffer.from(body.data, "base64"), body.name || "skill.zip");
      return { ok: true, ...packed };
    }
    if (Array.isArray(body?.files) && body.files.length) {
      const packed = await skills.importFileTree(dshHome, body.files, body.name || "");
      return { ok: true, ...packed };
    }
    return { status: 400, ok: false, error: "请选择压缩包或文件夹" };
  }
  return { status: 400, ok: false, error: `unknown op: ${op}` };
}

function skillsHttpHandler(forcedOp) {
  return async (request, response) => {
    if (request.method === "OPTIONS") {
      sendOptions(response);
      return;
    }
    if (request.method !== "GET" && request.method !== "POST") {
      response.writeHead(405, { allow: "GET, POST, OPTIONS" });
      response.end();
      return;
    }
    try {
      const url = new URL(request.url ?? "", "http://127.0.0.1");
      const tail = skillRouteTail(url.pathname);
      const body = request.method === "POST" ? await readJsonBody(request, 14 * 1024 * 1024) : {};
      const op = forcedOp
        || body.op
        || tail
        || url.searchParams.get("op")
        || (url.searchParams.get("id") ? "read" : "status");
      const result = await handleSkillsOp(op, body, url.searchParams.get("id"));
      sendJson(response, result.status || 200, result);
    } catch (e) {
      sendJson(response, 500, { ok: false, error: String(e && e.message ? e.message : e) });
    }
  };
}

function skillRouteTail(pathname) {
  const match = String(pathname || "").match(/^\/dsh-purge\/skills?(?:\/(.*))?$/i);
  if (!match) return "";
  return String(match[1] || "").replace(/\/$/, "");
}

function installSkillsHttp(webServer) {
  const stop = [];
  const add = (spec) => stop.push(registerRoute(webServer, spec));
  for (const routePath of ["/dsh-purge/skills", "/dsh-purge/skill"]) {
    add({ kind: "exact", path: routePath, handler: skillsHttpHandler("") });
  }
  add({ kind: "prefix", path: "/dsh-purge/skills", handler: skillsHttpHandler("") });
  for (const op of ["status", "read", "save", "delete", "import"]) {
    add({ kind: "exact", path: `/dsh-purge/skills/${op}`, handler: skillsHttpHandler(op) });
    add({ kind: "exact", path: `/dsh-purge/skill/${op}`, handler: skillsHttpHandler(op) });
  }
  return () => {
    for (let i = stop.length - 1; i >= 0; i -= 1) {
      try { stop[i]?.(); } catch { /* ignore */ }
    }
  };
}

function installRulesHttp(webServer) {
  const stop = [];
  stop.push(registerRoute(webServer, {
    kind: "exact",
    path: "/dsh-purge/rules",
    handler: rulesHttpHandler(""),
  }));
  stop.push(registerRoute(webServer, {
    kind: "prefix",
    path: "/dsh-purge/rules",
    handler: rulesHttpHandler(""),
  }));
  for (const op of ["status", "read", "save", "activate", "delete", "reset"]) {
    stop.push(registerRoute(webServer, {
      kind: "exact",
      path: `/dsh-purge/rules/${op}`,
      handler: rulesHttpHandler(op),
    }));
  }
  return () => {
    for (let i = stop.length - 1; i >= 0; i -= 1) {
      try { stop[i]?.(); } catch { /* ignore */ }
    }
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendOptions(response) {
  response.writeHead(204, { "cache-control": "no-store" });
  response.end();
}

function registerRoute(webServer, spec) {
  try {
    const handler = spec.handler;
    return webServer.register({
      ...spec,
      handler: async (request, response) => {
        if (!allowPluginRequest(request, response)) return;
        return handler(request, response);
      },
    });
  } catch (e) {
    console.warn("[dsh-purge] route", spec?.path, String(e && e.message ? e.message : e));
    return () => {};
  }
}

async function readJsonBody(request, maxBytes = 512 * 1024) {
  const chunks = [];
  let size = 0;
  const limit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : 512 * 1024;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error("request body too large");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

const plugin = {
  name,
  inject,
  apply,
};

export default plugin;
