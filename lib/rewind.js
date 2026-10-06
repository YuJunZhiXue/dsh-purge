const DRAFT_TTL_MS = 10 * 60 * 1000;
const pendingDrafts = new Map();
let lastPending = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ignoreSettled(value) {
  Promise.resolve(value).catch(() => {});
}

function errorText(err) {
  if (!err) return "回退失败";
  if (typeof err === "string") return err;
  return err.message || err.code || String(err);
}

function asEventList(events) {
  if (Array.isArray(events)) return events;
  if (events && typeof events[Symbol.iterator] === "function") {
    try {
      return [...events];
    } catch {
      return [];
    }
  }
  return [];
}

function service(ctx, name) {
  if (!ctx || typeof ctx.get !== "function") return undefined;
  try {
    return ctx.get(name);
  } catch {
    return undefined;
  }
}

function userTextFromEvent(event) {
  const data = event?.data;
  const content = data?.content ?? data?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts = [];
  for (const block of content) {
    if (!block) continue;
    if (typeof block === "string") {
      parts.push(block);
      continue;
    }
    if (block.type === "text" || typeof block.text === "string") {
      parts.push(String(block.text ?? ""));
    }
  }
  return parts.join("").trim();
}

function isPluginDraft(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  return /^\[MNEMON\]/i.test(value)
    || /MNEMON RUNTIME MEMORY SNAPSHOT/i.test(value)
    || /^MNEMON VIEW TOOLS/im.test(value);
}

function isRewindMarkerEvent(event) {
  if (!event || event.type !== "user/message") return false;
  const id = event.data?.id;
  return typeof id === "string" && id.startsWith("rewind-");
}

function isHumanUserEvent(event) {
  if (event?.type !== "user/message") return false;
  const source = event.data?.source;
  if (source?.kind === "plugin") return false;
  if (source?.kind && source.kind !== "user") return false;
  const text = userTextFromEvent(event);
  if (!text || isPluginDraft(text)) return false;
  return true;
}

/** 这一轮真正发出去的那句。手打是 user；goal 各轮也算（含 round 0 的首轮 goal）。 */
function isRoundPromptEvent(event) {
  if (!event || event.type !== "user/message" || isRewindMarkerEvent(event)) return false;
  const source = event.data?.source;
  const kind = source?.kind;
  if (kind === "plugin") return false;
  const text = userTextFromEvent(event);
  if (!text || isPluginDraft(text)) return false;
  if (!kind || kind === "user") return true;
  if (kind === "goal") return Number.isFinite(Number(source.round)) && Number(source.round) >= 0;
  return false;
}

/** 最近一轮已经 turn/end 的边界。用 turn 窗口找提示，避免第二轮完成却退回第一句。 */
function lastClosedTurnBounds(events) {
  const list = asEventList(events);
  let endIdx = -1;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.type === "turn/end") {
      endIdx = i;
      break;
    }
  }
  if (endIdx < 0) return null;
  const endEvent = list[endIdx];
  const endSeq = Number(endEvent.seq);
  const turnNum = endEvent.data?.turn;
  let floorSeq = -1;
  for (let i = 0; i < endIdx; i += 1) {
    if (list[i]?.type === "turn/end") floorSeq = Math.max(floorSeq, Number(list[i].seq));
  }
  let startSeq = -1;
  if (turnNum != null) {
    for (const e of list) {
      if (e?.type !== "turn/start" || e.data?.turn !== turnNum) continue;
      const seq = Number(e.seq);
      if (seq <= endSeq && seq > floorSeq) startSeq = seq;
    }
  }
  return { turn: turnNum, startSeq, endSeq, floorSeq };
}

function eventsInOrder(events) {
  return asEventList(events)
    .map((event, index) => ({ event, seq: Number.isFinite(Number(event?.seq)) ? Number(event.seq) : index }))
    .sort((left, right) => left.seq - right.seq);
}

function lastOpenTurn(events) {
  const list = asEventList(events);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const type = list[i]?.type;
    if (type === "turn/start") return list[i];
    if (type === "turn/end") return null;
  }
  return null;
}

function isSubagentHeader(header) {
  if (!header) return false;
  return header.origin === "subagent" || (header.delegationDepth ?? 0) > 0;
}

export function climbToMain(startId, getHeader) {
  let currentId = startId;
  const seen = new Set();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const header = getHeader(currentId);
    if (!isSubagentHeader(header) || !header?.parentSession) {
      return currentId;
    }
    currentId = header.parentSession;
  }
  return startId;
}

export function pendingInboxInserts(events) {
  const list = Array.isArray(events) ? events : [];
  let lastEnd = -1;
  let lastStart = -1;
  for (const event of list) {
    if (event?.type === "turn/end") lastEnd = event.seq;
    if (event?.type === "turn/start") lastStart = event.seq;
  }
  const after = lastEnd >= 0 ? lastEnd : -1;
  const ids = [];
  const seen = new Set();
  for (const event of list) {
    if (!event || event.seq <= after) continue;
    if (lastStart > after && event.seq >= lastStart) continue;
    if (event.type !== "agent/inbox/spliced") continue;
    if (event.data?.target && event.data.target !== "next-turn") continue;
    for (const message of event.data?.inserted || []) {
      const id = message?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function lastTurnSubagentIds(events, fromSeq = -1) {
  const list = Array.isArray(events) ? events : [];
  let floor = Number(fromSeq);
  if (!Number.isFinite(floor) || floor < 0) {
    floor = -1;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i]?.type === "turn/start") {
        floor = list[i].seq;
        break;
      }
    }
  }
  if (floor < 0) return [];
  const ids = [];
  const seen = new Set();
  for (const event of list) {
    if (!event || event.seq < floor) continue;
    if (event.type !== "subagent/catalog" && event.type !== "subagent/descriptor") continue;
    const id = event.data?.childId || event.data?.sessionId || event.data?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function planRewind(events) {
  const ordered = eventsInOrder(events);
  const bounds = lastClosedTurnBounds(events);
  let candidates = ordered.filter((row) => isRoundPromptEvent(row.event));
  if (bounds) {
    candidates = candidates.filter((row) => row.seq > bounds.floorSeq && row.seq <= bounds.endSeq);
  }
  const last = candidates.at(-1);
  if (!last) {
    return { ok: false, error: "没有可回退的上一句" };
  }
  const fromSeq = bounds && bounds.startSeq >= 0 ? bounds.startSeq : last.seq;
  return {
    ok: true,
    mode: "input",
    text: userTextFromEvent(last.event),
    fromSeq,
  };
}

/** 回退标记只占表面位置，不能再进下一轮模型请求。 */
export function isRewindDerivedMessage(message) {
  if (!message) return true;
  const id = message.id;
  return typeof id === "string" && id.startsWith("rewind-");
}

/** 只拿掉 fromSeq 及之后的表面节点。系统提示停在节点 0 时不动它。前面连续的回退空标记一并清掉，避免下一次发送还带着上一轮。 */
export function cutSurfaceNodes(nodes, fromSeq, eventAt) {
  const list = (Array.isArray(nodes) ? nodes : []).map((seq) => Number(seq));
  const floor = Number(fromSeq);
  let startIdx = list.findIndex((seq) => Number.isFinite(floor) ? seq >= floor : true);
  if (startIdx < 0) return [];
  const lookup = typeof eventAt === "function" ? eventAt : () => null;
  if (startIdx === 0 && lookup(list[0])?.type === "system/message") startIdx = 1;
  while (startIdx > 0) {
    const prev = lookup(list[startIdx - 1]);
    if (!prev || prev.type === "system/message" || !isRewindMarkerEvent(prev)) break;
    startIdx -= 1;
  }
  if (startIdx === 0 && lookup(list[0])?.type === "system/message") startIdx = 1;
  if (startIdx >= list.length) return [];
  return list.slice(startIdx);
}

function rememberDraft(sessionId, text, parentId) {
  const rec = {
    sessionId,
    parentId,
    text: text || "",
    at: Date.now(),
  };
  pendingDrafts.set(sessionId, rec);
  lastPending = rec;
  const now = Date.now();
  for (const [id, row] of pendingDrafts) {
    if (now - row.at > DRAFT_TTL_MS) pendingDrafts.delete(id);
  }
  return rec;
}

export function getDraft(sessionId) {
  if (!sessionId) return null;
  const rec = pendingDrafts.get(sessionId);
  if (!rec) return null;
  if (Date.now() - rec.at > DRAFT_TTL_MS) {
    pendingDrafts.delete(sessionId);
    return null;
  }
  return rec;
}

export function takeDraft(sessionId) {
  const rec = getDraft(sessionId);
  if (rec) pendingDrafts.delete(sessionId);
  return rec;
}

export function getPending() {
  if (!lastPending) return null;
  if (Date.now() - lastPending.at > DRAFT_TTL_MS) {
    lastPending = null;
    return null;
  }
  return lastPending;
}

export function lastHumanUserText(events) {
  const list = Array.isArray(events) ? events : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (isHumanUserEvent(list[i])) return userTextFromEvent(list[i]);
  }
  return "";
}

export async function readLastUserText(ctx, sessionId) {
  if (!sessionId) return { ok: false, text: "", error: "没有当前会话" };
  try {
    const log = await readSessionLog(ctx, sessionId);
    return { ok: true, text: lastHumanUserText(log.events) };
  } catch (err) {
    return { ok: false, text: "", error: errorText(err) };
  }
}

function disposeObservation(observed) {
  try {
    observed?.[Symbol.dispose]?.();
  } catch {
    /* ignore */
  }
}

async function readSessionLog(ctx, sessionId) {
  const store = service(ctx, "sessions");
  const live = store?.get?.(sessionId);
  if (live?.snapshotEvents) {
    return {
      events: asEventList(live.snapshotEvents()),
      header: live.header,
      cwd: live.header?.cwd,
    };
  }

  const controller = service(ctx, "sessionController");
  if (typeof controller?.inspect === "function") {
    const inspected = await controller.inspect(sessionId);
    return {
      events: asEventList(inspected?.events),
      header: inspected?.meta || inspected?.header,
      cwd: inspected?.meta?.cwd || inspected?.header?.cwd,
    };
  }

  const query = service(ctx, "sessionQuery");
  if (typeof query?.observeSession === "function") {
    const observed = await query.observeSession(sessionId, { projectionMode: "none" });
    try {
      return {
        events: asEventList(observed?.events),
        header: observed?.header,
        cwd: observed?.header?.cwd,
      };
    } finally {
      disposeObservation(observed);
    }
  }

  throw new Error("找不到当前会话");
}

async function waitTurnClosed(ctx, sessionId, timeoutMs = 8000) {
  const started = Date.now();
  let last = await readSessionLog(ctx, sessionId);
  while (lastOpenTurn(last.events)) {
    if (Date.now() - started >= timeoutMs) {
      throw new Error("回合还在进行，请先点停止再回退");
    }
    await sleep(80);
    last = await readSessionLog(ctx, sessionId);
  }
  return last;
}

function getAgent(ctx, sessionId) {
  const agents = service(ctx, "agents");
  try {
    return agents?.get?.(sessionId) || agents?.agent?.(sessionId) || undefined;
  } catch {
    return undefined;
  }
}

/** 回退后下一句按新请求开，不要接着上一轮的 request/header series。 */
function resetRequestSeries(ctx, sessionId) {
  const agent = getAgent(ctx, sessionId);
  if (!agent) return;
  try { agent.requestHeaderLogged = false; } catch { /* ignore */ }
  try { agent.requestSurfaceGeneration = -1; } catch { /* ignore */ }
  try { agent.frozenMessages?.clear?.(); } catch { /* ignore */ }
}

/** surface replace 后强制丢掉 derive 缓存，避免仍带着被切掉的旧消息。 */
function invalidateDerivedCache(session) {
  if (!session) return;
  try { session.derived = []; } catch { /* ignore */ }
  try { session.derivedNodes = 0; } catch { /* ignore */ }
  try { session.derivedGeneration = -1; } catch { /* ignore */ }
}

export function wrapSessionDeriveMessages(session) {
  if (!session || typeof session.deriveMessages !== "function" || session.__dshPurgeRewindDerive) return session;
  const orig = session.deriveMessages.bind(session);
  session.deriveMessages = function deriveMessagesWithoutRewind() {
    // 抛错不能改成空数组。空历史仍会发出请求，界面停在进行中，模型没有可答的内容。
    const messages = orig();
    if (!Array.isArray(messages)) return [];
    return messages.filter((message) => !isRewindDerivedMessage(message));
  };
  session.__dshPurgeRewindDerive = true;
  return session;
}

async function disarmRewoundSession(ctx, sessionId) {
  if (!sessionId) return;
  const controller = service(ctx, "sessionController");
  const agent = getAgent(ctx, sessionId);
  // 只停回退开始时还在跑的那一轮。延迟再 cancel 会把用户刚发出的下一句一起掐掉，界面停在进行中，请求发不出去。
  const runningAbort = agent?.phase?.kind && agent.phase.kind !== "idle" ? agent.phase.abort : null;
  if (runningAbort) {
    try { ignoreSettled(agent.cancel({ kind: "user" }, { keepInbox: true })); } catch { /* ignore */ }
  }

  const ids = [];
  try {
    const log = await readSessionLog(ctx, sessionId);
    ids.push(...pendingInboxInserts(log.events));
  } catch { /* ignore */ }
  try {
    for (const message of [...(agent?.inbox?.nextTurn || []), ...(agent?.inbox?.nextStep || [])]) {
      if (message?.id) ids.push(message.id);
    }
  } catch { /* ignore */ }

  const seen = new Set();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    try {
      await controller?.updateQueue?.({
        sessionId,
        itemId: id,
        action: { kind: "remove" },
      });
    } catch { /* ignore */ }
  }
}

export function invocationSessionId(invocation) {
  return invocation?.agent?.session?.id
    || invocation?.agent?.sessionId
    || invocation?.agent?.session?.header?.id;
}

async function resolveMainSession(ctx, sessionId) {
  const headers = new Map();
  let currentId = sessionId;
  const seen = new Set();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const log = await readSessionLog(ctx, currentId);
    const header = log.header || {};
    headers.set(currentId, header);
    if (!isSubagentHeader(header) || !header.parentSession) {
      return { sessionId: currentId, log };
    }
    currentId = header.parentSession;
  }
  return { sessionId, log: await readSessionLog(ctx, sessionId) };
}

function liveSession(ctx, sessionId) {
  const store = service(ctx, "sessions");
  try {
    return store?.get?.(sessionId) || null;
  } catch {
    return null;
  }
}

function flatMessageText(message) {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => {
    if (!block) return "";
    if (typeof block === "string") return block;
    return typeof block.text === "string" ? block.text : "";
  }).join("");
}

function derivedStillContains(session, text) {
  const needle = String(text || "").trim();
  if (!needle || typeof session?.deriveMessages !== "function") return false;
  let messages = [];
  try {
    messages = session.deriveMessages();
  } catch {
    return false;
  }
  if (!Array.isArray(messages)) return false;
  for (const message of messages) {
    if (!message || message.role === "system" || isRewindDerivedMessage(message)) continue;
    if (flatMessageText(message).includes(needle)) return true;
  }
  return false;
}

/** 留在当前会话，不另开会话、不开分支。把 fromSeq 起已发送的消息从模型请求里拿掉。 */
function clearModelHistory(session, text, fromSeq = 0) {
  if (!session || typeof session.append !== "function" || !session.surface) {
    throw new Error("没有清掉之前发送的内容");
  }
  const nodes = session.surface.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    if (derivedStillContains(session, text)) {
      throw new Error("没有清掉之前发送的内容");
    }
    return true;
  }
  const events = asEventList(typeof session.snapshotEvents === "function" ? session.snapshotEvents() : []);
  const eventAt = (seq) => events.find((event) => event?.seq === seq) || session.eventAt?.(seq);
  const shadowed = cutSurfaceNodes(nodes, fromSeq, eventAt);
  if (shadowed.length === 0) {
    if (derivedStillContains(session, text)) {
      throw new Error("没有清掉之前发送的内容");
    }
    return true;
  }
  const startSeq = shadowed[0];
  const endSeq = shadowed[shadowed.length - 1];
  if (!Number.isSafeInteger(startSeq) || !Number.isSafeInteger(endSeq)) {
    throw new Error("没有清掉之前发送的内容");
  }
  session.append("user/message", {
    id: `rewind-${Date.now().toString(36)}-${shadowed.length}`,
    role: "user",
    source: { kind: "user" },
    content: [],
  }, {
    surfaceOp: { op: "replace", startSeq, endSeq },
    sourceEventSeqs: shadowed,
  });
  invalidateDerivedCache(session);
  const left = new Set((session.surface.nodes || []).map((seq) => Number(seq)));
  if (shadowed.some((seq) => left.has(seq))) {
    throw new Error("没有清掉之前发送的内容");
  }
  if (derivedStillContains(session, text)) {
    throw new Error("没有清掉之前发送的内容");
  }
  return true;
}

async function rewindOneSession(ctx, controller, sessionId, options = {}) {
  let log = await readSessionLog(ctx, sessionId);
  if (lastOpenTurn(log.events)) {
    try { ignoreSettled(controller.cancel?.({ sessionId })); } catch { /* ignore */ }
    log = await waitTurnClosed(ctx, sessionId);
  }
  const plan = planRewind(log.events);
  if (!plan.ok) return plan;

  await disarmRewoundSession(ctx, sessionId);
  const session = wrapSessionDeriveMessages(liveSession(ctx, sessionId));
  let cleared = false;
  try {
    cleared = clearModelHistory(session, plan.text, plan.fromSeq);
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
  resetRequestSeries(ctx, sessionId);

  const rec = rememberDraft(sessionId, plan.text, sessionId);
  return {
    ok: true,
    sessionId,
    parentId: sessionId,
    archived: false,
    cleared,
    text: rec.text,
    cut: plan.mode,
    at: rec.at,
  };
}

export async function analyzeRewind(ctx, sessionId) {
  if (!sessionId) return { ok: false, error: "没有当前会话" };
  try {
    const log = await readSessionLog(ctx, sessionId);
    const kind = isSubagentHeader(log.header) ? "subagent" : "main";
    const subagentIds = kind === "main" ? lastTurnSubagentIds(log.events) : [];
    return {
      ok: true,
      kind,
      sessionId,
      hasSubagents: subagentIds.length > 0,
      subagentIds,
    };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function applyRewind(ctx, sessionId, mode) {
  if (!sessionId) return { ok: false, error: "没有当前会话" };
  const controller = service(ctx, "sessionController");

  const action = mode === "round" ? "round" : "once";
  try {
    if (action === "round") {
      const target = await resolveMainSession(ctx, sessionId);
      if (sessionId !== target.sessionId) {
        try { ignoreSettled(controller.cancel?.({ sessionId })); } catch { /* ignore */ }
      }
      const preview = planRewind(target.log?.events || []);
      const children = preview.ok ? lastTurnSubagentIds(target.log.events, preview.fromSeq) : [];
      const result = await rewindOneSession(ctx, controller, target.sessionId);
      if (!result.ok) return result;
      for (const childId of children) {
        if (!childId || childId === target.sessionId) continue;
        if (!liveSession(ctx, childId)) continue;
        const child = await rewindOneSession(ctx, controller, childId);
        if (!child.ok) return child;
      }
      return { ...result, sourceId: sessionId, mode: "round" };
    }

    const result = await rewindOneSession(ctx, controller, sessionId);
    if (!result.ok) return result;
    return { ...result, sourceId: sessionId, mode: "once" };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}
