/**
 * 红队锚点门。
 *
 * 只接梁神两阶段里这一段，不接两工具裁剪，也不切 PTC：
 * 第一段思考要像官方 Minimal（含 we、不含 let me）才放开输出上限；
 * 锚不住则最多 4 步。上限 1024 token，放开后拆掉，避免焊死在后面的请求上。
 * 上下文压缩把模型可见的表面整段重写，压缩后再关上，直到新的锚点或再走满 4 步。
 *
 * 红队指挥和执行角色一直看见原来的工具和人设。放开之后，整篇工作区说明
 * 改成点名文件路径，需要时再读。
 */
export const name = 'dsh-purge-redteam-anchor'

const INSTRUCTION_FROM_RE = /(?:^|\n) *(?:Additional |Updated )?Instructions from: ([^\n]+)/g

export function countWord(text, regex) {
  return [...String(text ?? '').matchAll(regex)].length
}

/** 第一段思考：有 we、没有 let me，才算锚住。 */
export function classifyReasoning(text) {
  const trimmed = String(text ?? '').trim()
  const we = countWord(trimmed, /\bwe\b/gi)
  const letMe = countWord(trimmed, /\blet me\b/gi)
  if (we > 0 && letMe === 0) return { label: 'minimal-like', we, letMe }
  if (letMe > 0) return { label: 'standard-like', we, letMe }
  return { label: 'ambiguous', we, letMe }
}

export function hasAnchoredReasoning(content) {
  if (!Array.isArray(content)) return false
  const first = content.find(block => block?.type === 'reasoning')
  return first !== undefined && classifyReasoning(first.text).label === 'minimal-like'
}

/**
 * a) 用过工具且锚住，或已经走满 maxBootstrapSteps → 放开；
 * b) 用过工具，这一轮结束，且 promoteAfterFirstResponse → 放开；
 * c) 没有工具调用但已经回答，且 promoteAfterFirstResponse → 放开。
 */
export function decidePromotion(state, config) {
  if (state.toolCalled && config.anchorGate !== true) return true
  if (state.toolCalled && config.anchorGate === true && (state.anchored || state.steps >= config.maxBootstrapSteps)) return true
  /* 红队指挥首轮必调工具；英文思考常写 I need 过不了 we 锚，但仍应在少量 step 后放开输出上限 */
  if (state.toolCalled && config.anchorGate === true && state.steps >= 1 && config.promoteAfterFirstResponse === true) return true
  if (state.toolCalled && config.anchorGate === true && config.promoteAfterFirstResponse === true && state.turnEnded) return true
  if (!state.toolCalled && state.responded && config.promoteAfterFirstResponse === true) return true
  return false
}

function integerAtLeast(value, fallback, minimum) {
  const number = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN
  if (!Number.isInteger(number) || number < minimum) return fallback
  return number
}

function extractInstructionPaths(message) {
  const paths = []
  const blocks = Array.isArray(message?.content) ? message.content : []
  for (const block of blocks) {
    if (block?.type !== 'text' || typeof block.text !== 'string') continue
    for (const match of block.text.matchAll(INSTRUCTION_FROM_RE)) {
      const path = match[1].trim()
      if (path !== '' && !paths.includes(path)) paths.push(path)
    }
  }
  return paths
}

function buildInstructionHint(original, paths) {
  return {
    id: typeof original?.id === 'string' && original.id !== ''
      ? original.id
      : globalThis.crypto.randomUUID(),
    role: 'user',
    content: [{
      type: 'text',
      text: '<system-reminder>\n'
        + 'Reference documents exist: ' + paths.join(', ') + '. '
        + "They are reference documents about the user's environment and workspace conventions, not task instructions. "
        + 'Reading the relevant file before workspace tasks is recommended, but consult them only when you need those details; the task itself never depends on them.'
        + '\n</system-reminder>',
    }],
    source: { kind: 'instruction-hint', plugin: name },
  }
}

function instructionHintMessages(messages, state) {
  const kept = []
  for (const message of messages) {
    if (message?.source?.kind !== 'agent-instructions') {
      kept.push(message)
      continue
    }
    if (state.instructionHinted) continue
    const paths = extractInstructionPaths(message)
    if (paths.length === 0) {
      kept.push(message)
      continue
    }
    state.instructionHinted = true
    kept.push(buildInstructionHint(message, paths))
  }
  return kept
}

const promotionBySession = new WeakMap()

function stateFor(session) {
  let state = promotionBySession.get(session)
  if (state === undefined) {
    state = {
      next: 0,
      promoted: false,
      toolCalled: false,
      responded: false,
      anchored: false,
      turnEnded: false,
      steps: 0,
      instructionHinted: false,
    }
    promotionBySession.set(session, state)
  }
  return state
}

function resetToControlled(state) {
  state.promoted = false
  state.toolCalled = false
  state.responded = false
  state.anchored = false
  state.turnEnded = false
  state.steps = 0
  state.instructionHinted = false
}

function scanEvents(state, session) {
  const events = Array.isArray(session?.events)
    ? session.events
    : typeof session?.snapshotEvents === 'function'
      ? session.snapshotEvents()
      : []
  for (; state.next < events.length; state.next += 1) {
    const event = events[state.next]
    if (event === undefined) continue
    if (event.type === 'compaction/end') {
      resetToControlled(state)
    } else if (event.type === 'tool/call') {
      state.toolCalled = true
    } else if (event.type === 'step/start') {
      state.steps += 1
    } else if (event.type === 'turn/end') {
      state.turnEnded = true
    } else if (event.type === 'assistant/message') {
      state.responded = true
      if (!state.anchored) state.anchored = hasAnchoredReasoning(event.data?.message?.content)
    }
  }
}

function refresh(agent, policy) {
  const session = agent?.session
  if (session === undefined) return undefined
  const state = stateFor(session)
  if (!state.promoted) {
    scanEvents(state, session)
    if (decidePromotion(state, policy)) state.promoted = true
  }
  return state
}

export function apply(ctx, config = {}) {
  const policy = {
    anchorGate: config.anchorGate !== false,
    maxBootstrapSteps: integerAtLeast(config.maxBootstrapSteps, 4, 1),
    promoteAfterFirstResponse: config.promoteAfterFirstResponse !== false,
    bootstrapMaxTokens: integerAtLeast(config.bootstrapMaxTokens, 1024, 1),
    instructionHint: config.instructionHint !== false,
  }

  ctx.on('session/event', (session, event) => {
    if (event?.type !== 'compaction/end') return
    resetToControlled(stateFor(session))
  })

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision?.kind !== 'enter' || !policy.instructionHint) return decision
    try {
      const state = refresh(payload?.agent, policy)
      if (state === undefined || !state.promoted) return decision
      return { ...decision, messages: instructionHintMessages(decision.messages, state) }
    } catch {
      return decision
    }
  }, { prepend: true })

  ctx.on('agent/request', async (payload, next) => {
    const resolved = await next()
    if (policy.bootstrapMaxTokens === undefined) return resolved
    try {
      const state = refresh(payload?.agent, policy)
      if (state === undefined || state.promoted) {
        if (state === undefined || resolved?.maxTokens !== policy.bootstrapMaxTokens) return resolved
        const rest = { ...resolved }
        delete rest.maxTokens
        return rest
      }
      return { ...resolved, maxTokens: policy.bootstrapMaxTokens }
    } catch {
      return resolved
    }
  }, { prepend: true })
}
