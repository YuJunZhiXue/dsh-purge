/**
 * 红队子会话的角色稿。
 *
 * 指挥派活时在任务第一行写 `redteamRole: <code>`。
 * 子会话领到这条用户消息时记下角色，组装系统提示词时把
 * `engagements/<靶标>/agents/<code>.md` 原样放进清洗稿和运行环境前提之间。
 * 没有这一行就不猜角色。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isRedteamSession } from '../identity.js'
import { redteamRoot } from './platform-config.js'

const ROLE_TAG = /^[ \t]*redteamRole:[ \t]*(recon|assess|vuln-scan|exploit|internal)[ \t]*$/im

const roleBySession = new Map()

export function parseRedteamRole(text) {
  const matched = String(text || '').match(ROLE_TAG)
  return matched ? matched[1].toLowerCase() : ''
}

export function textOfMessage(message) {
  if (!message) return ''
  if (typeof message === 'string') return message
  const content = message.content ?? message.text
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((block) => (typeof block?.text === 'string' ? block.text : '')).join('\n')
}

function remember(agent, role) {
  const ids = [agent?.session?.id, agent?.id].filter((id) => id !== undefined && id !== null)
  for (const id of ids) roleBySession.set(String(id), role)
}

function isRedteamChild(session, agent) {
  const header = session?.header
  if (header?.origin !== 'subagent' && !((header?.delegationDepth ?? 0) > 0)) return false
  return isRedteamSession({ session, agent: agent ? { ...agent, session } : { session } })
}

export function noteClaimedMessage(payload) {
  const agent = payload?.agent
  const session = agent?.session
  if (!isRedteamChild(session, agent)) return
  const role = parseRedteamRole(textOfMessage(payload?.message))
  if (!role) return
  remember(agent, role)
}

function roleFromSessionEvents(session) {
  const events = []
  try {
    if (typeof session?.snapshotEvents === 'function') {
      const got = session.snapshotEvents()
      if (Array.isArray(got)) events.push(...got)
    }
  } catch { /* 读不到历史就只用已记下的角色 */ }
  if (Array.isArray(session?.events)) events.push(...session.events)
  let found = ''
  for (const event of events) {
    if (!event || event.type !== 'user/message') continue
    const data = event.data
    const role = parseRedteamRole(textOfMessage(data?.message || data))
    if (role) found = role
  }
  return found
}

function safeEngagementId(id) {
  const text = String(id || '').trim()
  if (!text || text.length > 200) return ''
  if (text.includes('..') || text.includes('/') || text.includes('\\') || text.includes('\0')) return ''
  return text
}

function currentEngagementId() {
  try {
    const root = redteamRoot()
    const id = safeEngagementId(readFileSync(join(root, 'current'), 'utf8'))
    if (!id) return ''
    if (!existsSync(join(root, 'engagements', id, 'agents'))) return ''
    return id
  } catch {
    return ''
  }
}

function readRoleFile(engagementId, role) {
  const id = safeEngagementId(engagementId)
  if (!id || !parseRedteamRole('redteamRole: ' + role)) return ''
  try {
    const path = join(redteamRoot(), 'engagements', id, 'agents', role + '.md')
    if (!existsSync(path)) return ''
    return readFileSync(path, 'utf8').trim()
  } catch {
    return ''
  }
}

export function resolveSubagentRoleText(context) {
  try {
    const agent = context?.agent
    const session = agent?.session || context?.session
    if (!isRedteamChild(session, agent)) return ''
    const sessionId = session?.id ?? agent?.id
    let role = sessionId !== undefined && sessionId !== null
      ? roleBySession.get(String(sessionId)) || ''
      : ''
    if (!role) {
      role = roleFromSessionEvents(session)
      if (role) remember(agent || { session }, role)
    }
    if (!role) return ''
    return readRoleFile(currentEngagementId(), role)
  } catch {
    return ''
  }
}

export function installSubagentRoleCapture(ctx) {
  if (!ctx || typeof ctx.on !== 'function') return
  if (ctx.__dshPurgeRoleCapture) return
  ctx.__dshPurgeRoleCapture = true
  const hook = (payload) => {
    try { noteClaimedMessage(payload) } catch { /* 记角色失败不阻断领消息 */ }
  }
  const install = () => {
    try { ctx.on('agent/inbox/claimed', hook, { global: true, prepend: true }) } catch { /* ignore */ }
  }
  install()
  queueMicrotask(install)
  setTimeout(install, 800)
}
