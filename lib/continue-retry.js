import { promises as fsp } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const DEFAULT_CONTINUE_RETRY = Object.freeze({
  autoRetry: true,
  retryMax: 3,
  autoContinue: true,
  continueMax: 3,
  continueText: "继续",
});

const PERMANENT_CODES = new Set([
  "AUTH",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID",
  "INVALID_REQUEST",
  "QUOTA",
  "BILLING",
  "MODEL_NOT_FOUND",
  "CONTEXT_OVERFLOW",
  "CONTEXT_LENGTH",
]);

const ABNORMAL_KINDS = new Set(["error", "aborted", "interrupted", "max-tokens"]);

export function clampCount(value, fallback = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(20, Math.trunc(n)));
}

export function normalizeConfig(raw = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  const retryMax = clampCount(src.retryMax, DEFAULT_CONTINUE_RETRY.retryMax);
  const continueMax = clampCount(src.continueMax, DEFAULT_CONTINUE_RETRY.continueMax);
  const text = typeof src.continueText === "string" ? src.continueText.trim() : "";
  return {
    autoRetry: src.autoRetry !== false && retryMax > 0,
    retryMax,
    autoContinue: src.autoContinue !== false && continueMax > 0,
    continueMax,
    continueText: text || DEFAULT_CONTINUE_RETRY.continueText,
  };
}

export function settingsPath(dshHome) {
  return path.join(dshHome, "dsh-purge", "continue-retry.json");
}

export function loadSettings(dshHome) {
  const fp = settingsPath(dshHome);
  try {
    if (!fs.existsSync(fp)) return {};
    const parsed = JSON.parse(fs.readFileSync(fp, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveSettings(dshHome, raw) {
  const next = normalizeConfig(raw);
  const dir = path.dirname(settingsPath(dshHome));
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(settingsPath(dshHome), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export function mergeConfig(pluginCfg, saved) {
  return normalizeConfig({ ...DEFAULT_CONTINUE_RETRY, ...pluginCfg, ...saved });
}

export function lastTurnEnd(events) {
  const list = Array.isArray(events) ? events : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const event = list[i];
    if (event?.type === "turn/end") return event;
  }
  return null;
}

export function isUserAbort(reason) {
  if (!reason || reason.kind !== "aborted") return false;
  const cause = reason.reason;
  if (cause === "user" || cause === "cancel") return true;
  if (cause && typeof cause === "object") {
    return cause.kind === "user" || cause.kind === "cancel";
  }
  return false;
}

export function isAbnormalReason(reason) {
  return Boolean(reason && ABNORMAL_KINDS.has(reason.kind));
}

export function shouldAutoContinue(reason) {
  return isAbnormalReason(reason) && !isUserAbort(reason);
}

export function isPermanentFailure(code) {
  return PERMANENT_CODES.has(String(code || "").toUpperCase());
}

export function shouldAutoRetry(failure, signal) {
  if (signal?.aborted) return false;
  return !isPermanentFailure(failure?.code);
}

export function makeContinueMessage(text) {
  const body = String(text || DEFAULT_CONTINUE_RETRY.continueText).trim() || DEFAULT_CONTINUE_RETRY.continueText;
  return {
    id: `dsh-purge-continue-${randomUUID()}`,
    role: "user",
    content: [{ type: "text", text: body }],
    source: {
      kind: "plugin",
      plugin: "dsh-purge",
      form: "notice",
      summary: "continue",
    },
  };
}

export function createTracker() {
  const bySession = new Map();

  function slot(sessionId) {
    const id = String(sessionId || "");
    if (!id) return null;
    let cur = bySession.get(id);
    if (!cur) {
      cur = { retry: 0, continue: 0, lastContinueSeq: 0, lastRetryKey: "" };
      bySession.set(id, cur);
    }
    return cur;
  }

  return {
    retryUsed(sessionId) {
      return slot(sessionId)?.retry || 0;
    },
    continueUsed(sessionId) {
      return slot(sessionId)?.continue || 0;
    },
    lastContinueSeq(sessionId) {
      return slot(sessionId)?.lastContinueSeq || 0;
    },
    takeRetry(sessionId, key, max) {
      const cur = slot(sessionId);
      if (!cur || max <= 0) return false;
      if (key && cur.lastRetryKey === key) return false;
      if (cur.retry >= max) return false;
      cur.retry += 1;
      cur.lastRetryKey = key || "";
      return true;
    },
    takeContinue(sessionId, seq, max) {
      const cur = slot(sessionId);
      if (!cur || max <= 0) return false;
      if (seq && cur.lastContinueSeq === seq) return false;
      if (cur.continue >= max) return false;
      cur.continue += 1;
      cur.lastContinueSeq = seq || 0;
      return true;
    },
    refundContinue(sessionId) {
      const cur = slot(sessionId);
      if (!cur || cur.continue <= 0) return;
      cur.continue -= 1;
      cur.lastContinueSeq = 0;
    },
    reset(sessionId) {
      const id = String(sessionId || "");
      if (id) bySession.delete(id);
    },
    resetIfCompleted(sessionId, reason) {
      if (reason?.kind === "completed" || reason?.kind === "blocked") this.reset(sessionId);
    },
  };
}

function service(ctx, name) {
  if (!ctx || typeof ctx.get !== "function") return undefined;
  try {
    return ctx.get(name);
  } catch {
    return undefined;
  }
}

export function sessionEventsOf(agent) {
  const session = agent?.session;
  if (!session) return [];
  try {
    if (typeof session.snapshotEvents === "function") return session.snapshotEvents() || [];
  } catch { /* ignore */ }
  try {
    if (Array.isArray(session.events)) return session.events;
  } catch { /* ignore */ }
  return [];
}

export function inspectTurn(events) {
  const end = lastTurnEnd(events);
  const reason = end?.data?.reason || null;
  return {
    seq: end?.seq || 0,
    turn: end?.data?.turn || 0,
    reason,
    abnormal: isAbnormalReason(reason),
    userAbort: isUserAbort(reason),
    auto: shouldAutoContinue(reason),
  };
}

export function resolveAgent(ctx, sessionId) {
  const agents = service(ctx, "agents");
  if (!agents || typeof agents.get !== "function") return null;
  try {
    return agents.get(sessionId) || null;
  } catch {
    return null;
  }
}

export function hasFreshHumanTurn(events) {
  const list = Array.isArray(events) ? events : [];
  const end = lastTurnEnd(list);
  const after = end ? list.filter((event) => (event?.seq || 0) > end.seq) : list;
  return after.some((event) => {
    if (event?.type !== "user/message") return false;
    return event.data?.source?.kind !== "plugin";
  });
}

export function inboxBusy(agent) {
  try {
    const inbox = agent?.inbox;
    if (!inbox) return false;
    if (typeof inbox.hasPending === "function" && inbox.hasPending()) return true;
    if (typeof inbox.size === "number" && inbox.size > 0) return true;
    if (typeof inbox.length === "number" && inbox.length > 0) return true;
  } catch { /* ignore */ }
  return false;
}

export function sendContinue(agent, text) {
  if (!agent || typeof agent.followup !== "function") {
    return { ok: false, error: "当前会话没有可续跑的 agent" };
  }
  try {
    agent.followup(makeContinueMessage(text));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

export function installContinueRetry(ctx, options = {}) {
  const getConfig = typeof options.getConfig === "function" ? options.getConfig : () => normalizeConfig(options.config);
  const tracker = options.tracker || createTracker();
  const timers = new Set();

  function sessionIdOf(agent) {
    return agent?.id || agent?.session?.id || "";
  }

  function schedule(fn, ms) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
    return timer;
  }

  function listen(event, handler) {
    if (typeof ctx?.on !== "function") return null;
    try {
      return ctx.on(event, handler, { global: true });
    } catch {
      try {
        return ctx.on(event, handler);
      } catch {
        return null;
      }
    }
  }

  function maybeAutoContinue(agent) {
    const cfg = getConfig();
    if (!cfg.autoContinue) return;
    const id = sessionIdOf(agent);
    if (!id) return;
    if (agent.status === "running" || inboxBusy(agent)) return;
    const events = sessionEventsOf(agent);
    if (hasFreshHumanTurn(events)) return;
    const info = inspectTurn(events);
    if (!info.auto) return;
    if (!tracker.takeContinue(id, info.seq, cfg.continueMax)) return;
    const sent = sendContinue(agent, cfg.continueText);
    if (!sent.ok) tracker.refundContinue(id);
  }

  const offError = listen("agent/request-error", async (payload, next) => {
    const downstream = typeof next === "function" ? await next() : undefined;
    if (downstream?.kind === "retry") return downstream;
    const cfg = getConfig();
    if (!cfg.autoRetry) return downstream;
    if (!shouldAutoRetry(payload?.failure, payload?.signal)) return downstream;
    const id = sessionIdOf(payload?.agent);
    const key = `${payload?.turn || 0}:${payload?.step || 0}:${payload?.failure?.code || ""}`;
    if (!tracker.takeRetry(id, key, cfg.retryMax)) return downstream;
    return { kind: "retry" };
  });

  const offStatus = listen("agent/status", (payload) => {
    const agent = payload?.agent;
    if (!agent) return;
    const id = sessionIdOf(agent);
    const events = sessionEventsOf(agent);
    if (payload.status === "running" && hasFreshHumanTurn(events)) tracker.reset(id);
    if (payload.status !== "idle") return;
    tracker.resetIfCompleted(id, inspectTurn(events).reason);
    schedule(() => maybeAutoContinue(agent), 280);
  });

  return {
    tracker,
    inspect(agentOrEvents) {
      const events = Array.isArray(agentOrEvents) ? agentOrEvents : sessionEventsOf(agentOrEvents);
      return inspectTurn(events);
    },
    continueNow(agent, opts = {}) {
      const cfg = getConfig();
      const id = sessionIdOf(agent);
      const info = inspectTurn(sessionEventsOf(agent));
      if (!info.abnormal && !opts.force) return { ok: false, error: "当前不是中断或失败状态" };
      const max = opts.ignoreBudget ? Number.MAX_SAFE_INTEGER : cfg.continueMax;
      if (info.seq && tracker.lastContinueSeq(id) === info.seq) {
        return { ok: false, error: "这一轮已经在继续" };
      }
      if (!tracker.takeContinue(id, info.seq, max)) {
        return { ok: false, error: `继续次数已用完（${cfg.continueMax}）` };
      }
      const sent = sendContinue(agent, opts.text || cfg.continueText);
      if (!sent.ok) {
        tracker.refundContinue(id);
        return sent;
      }
      return { ok: true, used: tracker.continueUsed(id), max: cfg.continueMax, reason: info.reason?.kind || "" };
    },
    status(agent) {
      const cfg = getConfig();
      const id = sessionIdOf(agent);
      const info = inspectTurn(sessionEventsOf(agent));
      return {
        ok: true,
        sessionId: id,
        canContinue: Boolean(
          info.abnormal
          && tracker.continueUsed(id) < cfg.continueMax
          && tracker.lastContinueSeq(id) !== info.seq
        ),
        reason: info.reason?.kind || "",
        userAbort: info.userAbort,
        retryUsed: tracker.retryUsed(id),
        continueUsed: tracker.continueUsed(id),
        retryMax: cfg.retryMax,
        continueMax: cfg.continueMax,
        autoRetry: cfg.autoRetry,
        autoContinue: cfg.autoContinue,
        continueText: cfg.continueText,
      };
    },
    dispose() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      try { offError?.(); } catch { /* ignore */ }
      try { offStatus?.(); } catch { /* ignore */ }
    },
  };
}
