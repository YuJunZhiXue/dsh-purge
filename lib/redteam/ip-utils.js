/**
 * IP / 文本归一化工具（纯函数，零依赖）。
 *
 * 从 core.js 抽出来的第一批模块之一：这些函数不碰数据库、不依赖 Store 实例，
 * 却散落在 5000 行的 core.js 里，单测只能连同 SQLite 一起加载。
 * 抽出来后可以单独测、单独读，也便于 core.js 专注在"事实库语义"上。
 *
 * 导出面与原来完全一致（core.js 会原样再导出一次），所以调用方无需改动。
 */

/**
 * IPv4 → 32 位整数（用于 ORDER BY 的自然排序）。
 * IPv6 走不了这条路（字符串 split('.') 只会得到一段），返回 null ——
 * 让 ip_int 保持 NULL，排序退回按 ip 文本，不要编造一个 0 或把地址拼坏。
 */
export const ipToInt = (ip) => {
  const text = String(ip || '').trim()
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) return null
  return text.split('.').reduce((n, o) => (n * 256 + Number(o)) >>> 0, 0)
}

/** 是不是 IPv6 字面量（含 :: 缩写与 IPv4-mapped 写法）。 */
export function isIpv6(ip) {
  const text = String(ip || '').trim()
  if (!text.includes(':')) return false
  return /^[0-9a-fA-F:]+(:\d{1,3}(\.\d{1,3}){3})?$/.test(text) && text.split(':').length <= 9
}

/** 把 IPv6 展开成 8 组十六进制（只用于取前 4 组算 /64，不追求完全严谨）。 */
export function expandIpv6(ip) {
  const text = String(ip || '').trim().replace(/^\[|\]$/g, '')
  const [head, tail] = text.split('::')
  const left = head === '' ? [] : head.split(':')
  const right = tail === undefined || tail === '' ? [] : tail.split(':')
  const missing = 8 - left.length - right.length
  const groups = left.concat(new Array(Math.max(missing, 0)).fill('0')).concat(right)
  return groups.map((g) => (g === '' ? '0' : g.toLowerCase()))
}

/**
 * 这个 IP 属于哪个"段"（资产测绘左侧按 C 段分组）。
 *   · IPv4 → 前三段 + .0/24（保持原行为）；
 *   · IPv6 → 前四组 + ::/64（IPv6 的"一个网段"就是 /64，与 IPv4 的 /24 对应）；
 *   · 认不出来 → 返回原文，绝不拼出一个像 `2001:db8::1.0/24` 这种四不像。
 *     曾经的问题是直接 split('.') 拼 ".0/24"，IPv6 资产会得到脏 CIDR，
 *     面板左侧就多出一个假网段、资产归属也错。
 */
export const cidrOf = (ip) => {
  const text = String(ip || '').trim()
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) return text.split('.').slice(0, 3).join('.') + '.0/24'
  if (isIpv6(text)) {
    const groups = expandIpv6(text)
    return groups.slice(0, 4).join(':') + '::/64'
  }
  return text
}

/**
 * 判断 IP 属于内网还是外网（面板按它分组「内网 C 段 / 外网 C 段」）。
 *   · IPv4：10/8、192.168/16、127/8、169.254/16、172.16-31/12、100.64-127/10（CGNAT）；
 *   · IPv6：ULA（fc00::/7）与链路本地（fe80::/10）算内网；
 *   · IPv4-mapped 的 ::ffff:a.b.c.d 剥壳后按 IPv4 判。
 * @param ip - 待判定地址。
 * @returns 'internal' | 'external'
 */
export function scopeOfIp(ip) {
  const s = String(ip || '')
  /* IPv6：ULA（fc00::/7）与链路本地（fe80::/10）是内网；IPv4-mapped 的 ::ffff:a.b.c.d 剥壳后按 IPv4 判 */
  const mapped = /^::ffff:(\d{1,3}(\.\d{1,3}){3})$/i.exec(s)
  if (mapped !== null) return scopeOfIp(mapped[1])
  if (/^f[cd][0-9a-f]{2}:/i.test(s) || /^fe[89ab][0-9a-f]:/i.test(s)) return 'internal'
  if (/^(10\.|192\.168\.|127\.|169\.254\.)/.test(s)) return 'internal'
  const m = /^172\.(\d{1,3})\./.exec(s)
  if (m !== null) {
    const n = Number(m[1])
    if (n >= 16 && n <= 31) return 'internal'
  }
  const c = /^100\.(\d{1,3})\./.exec(s)
  if (c !== null) {
    const n = Number(c[1])
    if (n >= 64 && n <= 127) return 'internal'
  }
  return 'external'
}

/** 把任意名字归一化成 slug（全小写、非字母数字转短横线）。 */
export function slugify(name) {
  const s = String(name || '').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return s === '' ? 'engagement-' + Date.now() : s
}

/**
 * 把目标（IP / URL / C 段）归一化成攻击文件目录名。
 *  · IP 或 ip:port → 只取 IP（同一 IP 的多个端口归一个文件夹）
 *  · URL → 只取 host（去掉协议、端口、路径）
 *  · C 段 10.0.0.0/24 → 10.0.0.0_24
 */
export function slugTarget(target) {
  const raw = String(target || '').trim()
  if (raw === '') return 'unknown'
  const ipMatch = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/.exec(raw)
  if (ipMatch !== null) return ipMatch[1]
  const urlMatch = /^https?:\/\/([^/?#]+)/i.exec(raw)
  const hostPort = urlMatch !== null ? urlMatch[1] : raw
  const host = hostPort.replace(/:(\d+)$/, '')
  return host.replace(/[^\w.\-]/g, '_').replace(/_+$/, '') || 'unknown'
}

/** 生成知识库条目的稳定标识：组件 + 编号/标题，便于智能体直接引用。 */
export function slugPoc(title, cve) {
  const t = String(title || '').trim()
  const c = String(cve || '').trim()
  /* 标题里往往已经写了 CVE，别再拼一遍（否则 code 会变成 xxx-cve-2023-21839-cve-2023-21839） */
  const flat = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
  const base = (c !== '' && !flat(t).includes(flat(c))) ? c + ' ' + t : t
  const slug = base.toLowerCase()
    .replace(/cve[-_ ]?(\d{4})[-_ ]?(\d+)/g, 'cve-$1-$2')
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return slug === '' ? 'poc-' + Date.now() : slug
}

/** 按语言给正文一个合适的文件名（智能体可以直接照着运行）。 */
export function defaultPocFilename(title, kind, language) {
  const ext = {
    python: 'py', py: 'py', go: 'go', java: 'java', bash: 'sh', sh: 'sh', shell: 'sh',
    js: 'js', node: 'js', php: 'php', ruby: 'rb', powershell: 'ps1', http: 'http', nuclei: 'yaml', yaml: 'yaml',
  }[String(language || '').toLowerCase()]
  if (ext) return 'poc.' + ext
  if (kind === 'template') return 'poc.yaml'
  return 'poc.txt'
}

/** ISO 时间戳（统一出口，便于测试注入）。 */
export const nowIso = () => new Date().toISOString()
