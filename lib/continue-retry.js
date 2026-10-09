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
  "ACCOUNT_QUOTA",
  "BILLING",
  "MODEL_NOT_FOUND",
  "CONTEXT_OVERFLOW",
  "CONTEXT_LENGTH",
  "CONTEXT_WINDOW_EXCEEDED",
  "NO_ADAPTER",
  "MISSING_CREDENTIAL",
  "INVALID_CREDENTIAL",
]);

/** Official already retried these; a new "继续" turn cannot clear them. */
const NO_CONTINUE_CODES = new Set([
  ...PERMANENT_CODES,
  "RATE_LIMIT",
  "TRANSPORT",
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

export function failureCodeOf(reason) {
  const raw = reason?.error?.code ?? reason?.failure?.code ?? reason?.code;
  return String(raw || "").toUpperCase();
}

export function shouldAutoContinue(reason) {
  if (!isAbnormalReason(reason) || isUserAbort(reason)) return false;
  const code = failureCodeOf(reason);
  return !code || !NO_CONTINUE_CODES.has(code);
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
      kind: "dsh-purge",
      form: "notice",
      summary: "continue",
    },
  };
}

// cordis 没有 session/removed 事件可挂,长开进程 session 一直累积。
// 用 Map 插入顺序做 FIFO 兜底:超过 CAP 就丢最早的一批。
const TRACKER_SESSION_CAP = 200;
const TRACKER_SESSION_EVICT = 50;

export function createTracker() {
  const bySession = new Map();

  function slot(sessionId) {
    const id = String(sessionId || "");
    if (!id) return null;
    let cur = bySession.get(id);
    if (!cur) {
      if (bySession.size >= TRACKER_SESSION_CAP) {
        let i = 0;
        for (const k of bySession.keys()) {
          if (i >= TRACKER_SESSION_EVICT) break;
          bySession.delete(k);
          i += 1;
        }
      }
      cur = { retry: 0, continue: 0, lastContinueSeq: 0, lastRetryKey: "" };
      bySession.set(id, cur);
    }
    return cur;
  }

  return {
    takeRetry(sessionId, key, max) {
      const cur = slot(sessionId);
      if (!cur || max <= 0) return false;
      if (key && cur.lastRetryKey === key) return false;
      if (cur.retry >= max) return false;
      cur.retry += 1;
      cur.lastRetryKey = key || "";
      return true;
    },
    takeContinue(sessionId, seq, max, maxFailStreak = 3) {
      const cur = slot(sessionId);
      if (!cur || max <= 0) return false;
      if (seq && cur.lastContinueSeq === seq) return false;
      if (cur.continue >= max) return false;
      if ((cur.failStreak || 0) >= maxFailStreak) return false;
      cur.continue += 1;
      cur.lastContinueSeq = seq || 0;
      return true;
    },
    refundContinue(sessionId, seq) {
      const cur = slot(sessionId);
      if (!cur || cur.continue <= 0) return;
      cur.continue -= 1;
      // 关键:不清 lastContinueSeq —— 同一 seq 的失败不再重复消耗 continue 预算
      // 关键:记录连续失败次数,达到 maxFailStreak 永久停手(Issue #85)
      cur.failStreak = (cur.failStreak || 0) + 1;
      if (seq) {
        cur.failedSeqs = cur.failedSeqs || new Set();
        cur.failedSeqs.add(seq);
      }
    },
    reset(sessionId) {
      const id = String(sessionId || "");
      if (id) bySession.delete(id);
    },
    resetIfCompleted(sessionId, reason) {
      if (reason?.kind === "completed" || reason?.kind === "blocked") {
        const cur = bySession.get(String(sessionId || ""));
        if (cur) { cur.failStreak = 0; cur.failedSeqs = undefined; }
        this.reset(sessionId);
      }
    },
  };
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

export function hasFreshHumanTurn(events) {
  const list = Array.isArray(events) ? events : [];
  const end = lastTurnEnd(list);
  const after = end ? list.filter((event) => (event?.seq || 0) > end.seq) : list;
  return after.some((event) => {
    if (event?.type !== "user/message") return false;
    const kind = event.data?.source?.kind;
    return kind !== "plugin" && kind !== "dsh-purge";
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
    if (!sent.ok) {
      tracker.refundContinue(id, info.seq);
      console.warn(`[dsh-purge] auto-continue send failed (session=${id}, seq=${info.seq}):`, sent.error);
    }
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
    // [方案2] 标记 retry pending,让下次 system-prompt/assemble 强制塞 inject
    // (消费一次后由 shouldInjectAssembly 清掉)。user 发消息自然塞,不需要;
    // retry 不是 user 触发,messages 结构没变,必须靠这个 flag 让 assemble 吃到。
    globalThis.__dshPurgeRetryPending = true;
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
    dispose() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      try { offError?.(); } catch { /* ignore */ }
      try { offStatus?.(); } catch { /* ignore */ }
    },
  };
}
