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

function isHumanUserEvent(event) {
  if (event?.type !== "user/message") return false;
  const source = event.data?.source;
  if (source?.kind === "plugin") return false;
  if (source?.kind && source.kind !== "user") return false;
  const text = userTextFromEvent(event);
  if (!text || isPluginDraft(text)) return false;
  return true;
}

function lastOpenTurn(events) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const type = events[i]?.type;
    if (type === "turn/start") return events[i];
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

export function lastTurnSubagentIds(events) {
  const list = Array.isArray(events) ? events : [];
  let lastStart = -1;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.type === "turn/start") {
      lastStart = list[i].seq;
      break;
    }
  }
  if (lastStart < 0) return [];
  const ids = [];
  const seen = new Set();
  for (const event of list) {
    if (!event || event.seq < lastStart) continue;
    if (event.type !== "subagent/catalog" && event.type !== "subagent/descriptor") continue;
    const id = event.data?.childId || event.data?.sessionId || event.data?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function planRewind(events) {
  const list = Array.isArray(events) ? events : [];
  const turnEnds = list.filter((event) => event?.type === "turn/end");
  const turnStarts = list.filter((event) => event?.type === "turn/start");
  const lastStart = turnStarts[turnStarts.length - 1];
  const usersInLastTurn = lastStart
    ? list.filter((event) => isHumanUserEvent(event) && event.seq >= lastStart.seq)
    : [];
  const lastUser = usersInLastTurn[0]
    || list.filter(isHumanUserEvent).at(-1);
  if (!lastUser) {
    return { ok: false, error: "没有可回退的上一句" };
  }
  const text = userTextFromEvent(lastUser);
  const open = lastOpenTurn(list);
  const fromOpenTurn = Boolean(open && lastUser.seq >= open.seq);
  // 开放回合的那句还没进历史，切在最后一个已闭合 turn/end。
  // 已闭合的上一句要整轮拿掉，所以再往前一个 end。
  const cutIndex = fromOpenTurn ? turnEnds.length - 1 : turnEnds.length - 2;
  if (cutIndex >= 0) {
    return {
      ok: true,
      mode: "fork",
      atSeq: turnEnds[cutIndex].seq,
      text,
    };
  }
  return { ok: true, mode: "blank", text };
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
      events: live.snapshotEvents(),
      header: live.header,
      cwd: live.header?.cwd,
    };
  }

  const controller = service(ctx, "sessionController");
  if (typeof controller?.inspect === "function") {
    const inspected = await controller.inspect(sessionId);
    return {
      events: inspected.events || [],
      header: inspected.meta || inspected.header,
      cwd: inspected.meta?.cwd || inspected.header?.cwd,
    };
  }

  const query = service(ctx, "sessionQuery");
  if (typeof query?.observeSession === "function") {
    const observed = await query.observeSession(sessionId, { projectionMode: "none" });
    try {
      return {
        events: observed.events || [],
        header: observed.header,
        cwd: observed.header?.cwd,
      };
    } finally {
      disposeObservation(observed);
    }
  }

  throw new Error("找不到当前会话");
}

function findWorkspace(ctx, sessionId, cwd) {
  const registry = service(ctx, "workspaceRegistry");
  const list = registry?.list?.() || [];
  return list.find((workspace) => (workspace?.sessionIds || []).includes(sessionId))
    || (cwd ? list.find((workspace) => workspace?.path === cwd) : undefined);
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

async function disarmRewoundSession(ctx, sessionId) {
  if (!sessionId) return;
  const controller = service(ctx, "sessionController");
  const disarmOnce = async () => {
    const agent = getAgent(ctx, sessionId);
    try { agent?.inbox?.clear?.(); } catch { /* ignore */ }
    try { ignoreSettled(agent?.cancel?.({ kind: "user" }, { keepInbox: false })); } catch { /* ignore */ }

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

    try { agent?.inbox?.clear?.(); } catch { /* ignore */ }
    if (agent?.status === "running") {
      try { ignoreSettled(agent.cancel({ kind: "user" }, { keepInbox: false })); } catch { /* ignore */ }
    }
  };

  await disarmOnce();
  await sleep(20);
  await disarmOnce();
  try {
    const idle = getAgent(ctx, sessionId)?.whenIdle?.();
    if (idle && typeof idle.then === "function") {
      await Promise.race([idle, sleep(800)]);
    }
  } catch { /* ignore */ }
  await disarmOnce();
}

async function createBlank(ctx, controller, sourceId, cwd) {
  const workspace = findWorkspace(ctx, sourceId, cwd);
  if (workspace?.id) {
    return controller.create({ workspaceId: workspace.id });
  }
  if (cwd) return controller.create({ cwd });
  return controller.create({});
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

async function rewindOneSession(ctx, controller, sessionId) {
  let log = await readSessionLog(ctx, sessionId);
  if (lastOpenTurn(log.events)) {
    try { ignoreSettled(controller.cancel?.({ sessionId })); } catch { /* ignore */ }
    log = await waitTurnClosed(ctx, sessionId);
  }
  const plan = planRewind(log.events);
  if (!plan.ok) return plan;

  let created;
  if (plan.mode === "fork") {
    created = await controller.fork({ sessionId, atSeq: plan.atSeq });
  } else {
    created = await createBlank(ctx, controller, sessionId, log.cwd);
  }
  const childId = created?.sessionId || (typeof created === "string" ? created : "");
  if (!childId) return { ok: false, error: "回退会话创建失败" };

  await disarmRewoundSession(ctx, childId);

  const rec = rememberDraft(childId, plan.text, sessionId);
  return {
    ok: true,
    sessionId: childId,
    parentId: sessionId,
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
  if (!controller || typeof controller.fork !== "function" || typeof controller.create !== "function") {
    return { ok: false, error: "当前 dsh 没有会话回退接口" };
  }

  const action = mode === "round" ? "round" : "once";
  try {
    if (action === "round") {
      const target = await resolveMainSession(ctx, sessionId);
      if (sessionId !== target.sessionId) {
        try { ignoreSettled(controller.cancel?.({ sessionId })); } catch { /* ignore */ }
      }
      const result = await rewindOneSession(ctx, controller, target.sessionId);
      if (!result.ok) return result;
      return { ...result, sourceId: sessionId, mode: "round" };
    }

    const result = await rewindOneSession(ctx, controller, sessionId);
    if (!result.ok) return result;
    return { ...result, sourceId: sessionId, mode: "once" };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}
