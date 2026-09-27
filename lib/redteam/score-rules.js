/**
 * 计分规则：判定口径 + 默认得分点（零依赖，只用 node: 内置模块）。
 *
 * 从 core.js 抽出来的模块，也是本项目**最该单独读的一份代码**：
 * 面板 / 报告 / 攻击链三处总分必须一致，靠的就是这里的 applyScoreCaps 与
 * evaluateScoreBoard 是**唯一实现**（此前三处各写一遍，已经漂移出
 * "报告不看 enabled""攻击链丢了档位分值"两个真实事故）。
 *
 * 分工：
 *   · applyScoreCaps       —— 给定命中行，标出哪条计分、哪条被封顶/超上限；
 *   · evaluateScoreBoard   —— 把"读元数据 + 调 applyScoreCaps + 回填标记"包成一个入口；
 *   · DEFAULT_SCORE_POINTS —— 规则文档展开后的得分点定义（src/rule/cap/dedup_scope）。
 */

/* targetHasIpv6Host 要判定 IPv6 字面量：复用 ip-utils 的同一份实现，避免两套正则漂移 */
import { isIpv6 } from './ip-utils.js'

/* ------------------------------------------------------------------ 判定规则 */

/* ------------------------------------------------------------------ 判定规则 */

/**
 * 什么算"真隧道"（算边界突破/内网突破的凭证）：**必须跨越了靶标边界**，
 * 即通道的一端在目标侧。三种情况：
 *   · target-outbound：目标主动连出到我的服务器（反弹 shell 落地、目标上跑 frp/Stowaway 客户端）
 *   · target-http：经目标 WebShell/HTTP 通道（suo5、Neo-ReGeorg、reGeorg、自研 HTTP 隧道）
 *   · target-agent：经目标上已控进程/会话转发的隧道（SSH -R 由目标发起等）
 * 不算的：self-only —— 只在自己 VPS / 自建服务器上开的代理或服务端，没碰到目标。
 */
const TUNNEL_ENTRY_KINDS = {
  'target-outbound': '目标主动连出（反弹 shell / 目标上跑 frp 客户端）',
  'target-http': '经目标 WebShell/HTTP 通道（suo5 / Neo-ReGeorg）',
  'target-agent': '经目标已控进程/会话转发（SSH -R 等）',
  'self-only': '只在自己 VPS/自建服务器上（不算突破）',
}
export { TUNNEL_ENTRY_KINDS }

/** 这条隧道算不算"跨越了靶标边界"。未声明（老数据/没填）返回 null，界面按"待确认"显示。 */
export function tunnelIsLegit(entryKind) {
  const k = String(entryKind || '').trim()
  if (k === '') return null
  return k !== 'self-only'
}

/**
 * 账号/权限类得分点：**自己注册、自己创建的账号不算拿到权限**（演练得分针对"拿到别人已有的"）。
 * 这些得分点命中时会要求声明 self_created，避免把自助注册当成战果。
 */
const ACCOUNT_POINT_CODES = ['web-account-user', 'web-account-admin', 'server-shell', 'db-access', 'internal-pivot', 'core-system']
export { ACCOUNT_POINT_CODES }

/**
 * 按「服务」封顶的得分点：**同一个资产的同一个端口只算一次分**。
 *
 *   · 账号类（web-account-user / web-account-admin）——拿到最高权限账号即该服务拿满：
 *     普通账号 10 分、管理员 20 分，同一服务上再刷几个账号都不再累加
 *     （两种账号算**同一类**：先拿普通账号、后拿管理员，只有管理员那条计分，总分按最高那条算）。
 *   · 数据库类（db-access）——同口径：一个库权限拿满，同服务再刷第二个库账号不重复计分。
 *
 * 其它得分点（webshell/rce/sensitive-data/boundary/…）仍然不设上限，按命中次数累加。
 */
const SERVICE_CAPPED_POINT_CODES = ['web-account-user', 'web-account-admin', 'db-access']
export { SERVICE_CAPPED_POINT_CODES }

/**
 * 从 target 里解析端口：`http://h:8080/x`、`10.0.0.5:6379`、`10.0.0.5:22`。
 * 没有端口或解析不出返回 null（**不要编造 80/443**，否则会把不同服务并成一个）。
 */
export function parseTargetPort(target) {
  const t = String(target || '').trim()
  if (t === '') return null
  const url = /^[a-z][a-z0-9+.-]*:\/\/([^/?#\s]+)/i.exec(t)
  const authority = url !== null ? url[1] : (/^([^\s/?#]+)/.exec(t) || [])[1]
  if (!authority) return null
  const m = /:(\d{1,5})$/.exec(authority)
  if (m === null) return null
  const n = Number(m[1])
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : null
}

/** 库列的 port 值（老库可能是 null/0/空串）。 */
function normalizePort(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : null
}

/**
 * 从 target 里取「服务标识」：host[:port]。
 *   · 端口取显式写的那个；没写就按协议推默认端口（http→80、https→443、其它→不推断），
 *     这样 `http://h/x` 与 `http://h:80/y` 会归到同一个服务；
 *   · 路径/参数/查询串一律丢掉（`http://h:8080/a/b?c=1` → `h:8080`）。
 * 解析不出 host 时返回 null。
 */
function targetAuthority(target) {
  const t = String(target || '').trim()
  if (t === '') return null
  const url = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]+)/i.exec(t)
  const scheme = url !== null ? url[1].toLowerCase() : null
  const authority = url !== null ? url[2] : (/^([^\s/?#]+)/.exec(t) || [])[1]
  if (!authority) return null
  const host = authority.replace(/:\d{1,5}$/, '').toLowerCase()
  if (host === '') return null
  let port = parseTargetPort(t)
  /* 没写端口时按协议补默认端口：避免同一个服务的两种写法被算成两个服务而被重复计分 */
  if (port === null) {
    if (scheme === 'http') port = 80
    else if (scheme === 'https') port = 443
  }
  return port === null ? host : host + ':' + port
}

/**
 * 「服务」键：得分封顶的粒度 = 同一个资产的同一个端口。
 *   · target 能解析出 host[:port] → 就用它（`t10.20.30.40:3306`）——
 *     同一个服务可能由不同的人记分，有的带 asset_id、有的只写 target，
 *     以目标为准才能把它们归到一起；
 *   · target 解析不出（缺失/只写了名字）→ 退到资产：有端口用 `a<id>:<port>`，
 *     没端口记 `a<id>:0`（该资产的未知端口）；
 *   · 两样都没有 → null（拿不到服务信息，这条不参与封顶）。
 */
export function scoreServiceKey(hit = {}) {
  const authority = targetAuthority(hit.target)
  if (authority !== null) return 't' + authority
  const assetId = hit.asset_id === null || hit.asset_id === undefined || hit.asset_id === '' ? null : Number(hit.asset_id)
  if (assetId === null) return null
  const port = normalizePort(hit.port)
  return 'a' + assetId + ':' + (port === null ? 0 : port)
}

/** 「服务」的可读标签，给告警/报告用（如 `10.1.2.3:8080`）。 */
export function serviceLabel(hit = {}, assetIp) {
  const ip = assetIp || hit.asset_ip || ''
  const port = normalizePort(hit.port) ?? parseTargetPort(hit.target)
  if (ip !== '') return port === null ? ip : ip + ':' + port
  /* 没有资产 id 时用 target 的 host[:port]（去掉路径与参数，别把整条 URL 当服务名）；
     端口来自库列而 target 里没写时补上，便于一眼看出是哪个服务。 */
  const authority = targetAuthority(hit.target)
  if (authority === null) return hit.target ? String(hit.target) : '(未标注服务)'
  if (port !== null && !/:\d{1,5}$/.test(authority)) return authority + ':' + port
  return authority
}

/**
 * 得分封顶与去重的**唯一实现**（数据驱动，v0.11.0 起）。
 *
 * 判定字段来自得分点本身（`score_point.rule / cap / dedup_scope`），不再靠代码里的硬编码名单：
 *   · `dedup_scope = service` —— 同一（资产, 端口）只算分值最高的一条；
 *   · `dedup_scope = system`  —— 同一（资产, 端口, 系统名）只算最高权限一条，
 *     用于"同一个系统只计算一次最高权限分"（邮箱/OA/集权系统等）；
 *   · `dedup_scope = target`  —— 整个目标只算一次（突破网络边界、IPv6 加成）；
 *   · `dedup_scope = none`    —— 不去重，按台/卡/节点数累加（算力卡等）。
 * 之后按 `rule` 分组累计，超过该规则 `cap` 的部分标 `capped`（cap = 0 表示不设上限）。
 *
 * `self_created = 1`（自己注册/自建的账号）本来就不计分，既不参与竞争也不占位。
 *
 * @param {Array} rows - 命中行（需带 code / points / asset_id / port / target / recorded_at；
 *                       可选 system_key 供 system 口径使用）
 * @param {Map|Object|null} pointsByCode - code → `{rule, cap, dedup_scope, points}`；
 *                       省略时退化为"每个 code 自成一组、只去重不封顶"（兼容旧调用）
 * @returns {{capped:number, items:Array, caps:Map}} 打过标记的行 + 被封顶条数 + 各规则上限用量
 */
export function applyScoreCaps(rows = [], pointsByCode = null, nameByAsset = null) {
  const metaOf = (r) => {
    const m = pointsByCode === null || pointsByCode === undefined
      ? undefined
      : (typeof pointsByCode.get === 'function' ? pointsByCode.get(r.code) : pointsByCode[r.code])
    const rule = m && m.rule !== null && m.rule !== undefined ? Number(m.rule) : null
    const legacyScope = legacyCapGroup(r.code)
    return {
      group: rule === null ? 'code:' + String(r.code || '') : 'rule:' + rule,
      cap: m && Number(m.cap) > 0 ? Number(m.cap) : 0,
      scope: (m && m.dedup_scope) || legacyScope || 'none',
      rule,
    }
  }
  const flagged = (rows || []).map((r) => {
    const m = metaOf(r)
    return {
      ...r, capped: false, capped_by_id: null, capped_reason_kind: null,
      service_key: null, cap_group: m.group, dedup_scope: m.scope, rule: m.rule, rule_cap: m.cap,
    }
  })

  /* ① 计分口径去重：同一口径键内只保留分值最高的一条（同分取更早记的） */
  const buckets = new Map()
  for (const r of flagged) {
    if (Number(r.self_created) === 1) continue
    const scope = r.dedup_scope
    if (scope === 'none' || scope === null || scope === undefined) continue
    let key
    if (scope === 'target') key = 'target'
    else if (scope === 'system') key = 'sys:' + String(systemKeyOf(r, nameByAsset) || '')
    else {
      /* `service` 口径必须有真正的服务键（`t<host[:port]>` / `a<id>:<port>`）。
         拿不到服务信息时**不参与去重**，而不是退回"每条自成一键" —— 后者会让
         `svc:#hit7` 这种键把同一口径的命中全部互相顶掉：实测 62 条无 target 的
         terminal-access 命中里 61 条被判 dedup 不计分、只留 1 条，等于静默吃掉成果。
         宁可少封顶也不能错封：认不出服务就各算各的。 */
      const svc = scoreServiceKey(r)
      if (svc === null || svc === undefined || String(svc) === '') continue
      key = 'svc:' + String(svc)
    }
    if (key === '' || key === 'svc:null' || key === 'sys:null') continue
    const k = r.cap_group + '|' + key
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(r)
  }
  let capped = 0
  for (const list of buckets.values()) {
    if (list.length < 2) continue
    const best = pickBestHit(list)
    for (const r of list) {
      if (r === best) continue
      r.capped = true
      r.capped_by_id = best.id
      r.capped_by_points = Number(best.points) || 0
      r.capped_by_evidence = best.evidence || null
      r.capped_reason_kind = 'dedup'
      capped += 1
    }
  }

  /* ② 规则上限：同一 rule 的计分命中累计不得超过 cap（按分值从高到低累计，超出的标 capped） */
  const caps = new Map()
  const byRule = new Map()
  for (const r of flagged) {
    if (r.capped === true || Number(r.self_created) === 1) continue
    if (r.rule_cap <= 0) continue
    if (!byRule.has(r.cap_group)) byRule.set(r.cap_group, [])
    byRule.get(r.cap_group).push(r)
  }
  for (const [group, list] of byRule.entries()) {
    const cap = list[0].rule_cap
    const ordered = [...list].sort((a, b) => {
      const pa = Number(a.points) || 0; const pb = Number(b.points) || 0
      if (pb !== pa) return pb - pa
      return Number(a.id) - Number(b.id)
    })
    let used = 0; let nCapped = 0
    for (const r of ordered) {
      const pts = Number(r.points) || 0
      if (used + pts > cap) {
        r.capped = true
        r.capped_reason_kind = 'cap'
        r.capped_by_points = null
        nCapped += 1
        capped += 1
      } else {
        used += pts
      }
    }
    caps.set(group, { rule: list[0].rule, cap, used, capped: nCapped })
  }
  return { capped, items: flagged, caps }
}

/**
 * 参与 `system` 口径去重的"系统键"。
 *
 * 规则原文是"同一个系统只计算一次最高权限分"（邮箱、OA、集权系统等）。
 * 判定顺序：
 *   ① 命中自带的 `system_key`（调用方显式指定，最准）；
 *   ② 资产的 `primary_name`（系统名/域名的首选名）；资产名往往是同一套系统，最接近"同一个系统"；
 *   ③ 退回服务键（资产:端口）。
 * 三条都拿不到返回 null —— 此时**不参与该口径去重**，宁可不封顶也不要错封。
 */
function systemKeyOf(hit = {}, nameByAsset = null) {
  const svc = scoreServiceKey(hit)
  const svcText = svc === null || svc === undefined ? '' : String(svc)

  /* ① 调用方显式给的 system_key：**只有它带上服务键前缀（t<host[:port]> / a<id>:<port>）才采信**。
     调用方（listScorePoints / scoreReport / scoreChain）会预造 `资产名|端口` 这种键，
     资产还没有名字时会退化成 `"|8080"` —— 若直接采信，10.7.7.7:8080 与 10.7.7.8:8080
     会被并成"同一个系统"，把另一台主机的成果白白封顶。
     不能采信时**继续往下走**，用服务键兜底，而不是丢掉整个 system 口径。 */
  const explicit = String(hit.system_key || '').trim()
  if (explicit !== '' && (svcText === '' || explicit.includes(svcText))) {
    /* 没有服务键可校验时，要求"名字段非空"（避免只认端口的野键把所有服务并在一起） */
    const head = explicit.split('|')[0]
    if (svcText !== '' || String(head).trim() !== '') return explicit
  }

  /* ② 资产名（系统名/域名首选名）+ 服务键 —— **这是 system 口径的主力路径**。
     规则原文是"同一个系统只计算一次最高权限分"，覆盖面是"同一系统 + 同一端口"：
     同一套系统跑在多台主机、多个端口时是不同实例，各自算一次最高权限。
     ⚠️ 真的需要"跨主机、跨端口只算一次"时，应显式给 system_key 并用同一个值
     （见上 ①）——但那时请自己确认这些命中确实是同一个系统实例。 */
  const id = hit.asset_id === null || hit.asset_id === undefined || hit.asset_id === '' ? null : Number(hit.asset_id)
  const nameOf = (assetId) => {
    if (assetId === null || nameByAsset === null || nameByAsset === undefined) return null
    const raw = typeof nameByAsset.get === 'function' ? nameByAsset.get(assetId) : nameByAsset[assetId]
    const text = raw === null || raw === undefined ? '' : String(raw).trim()
    return text === '' ? null : text
  }
  const name = nameOf(id)
  if (name !== null) return name + '|' + svcText

  /* ③ 退到服务键：同（资产, 端口）只算一次最高权限 —— 与 service 口径等效，
     这是"同一主机上的系统权限、应用权限、数据库权限按最高权限只得一次分"（G1）的兜底。 */
  if (svcText !== '') return svcText

  /* ④ 三条都拿不到（没有 asset_id、没有系统名、target 也解析不出 host）：
     退回**本条命中自己的 id** —— 即"互不相同"，各算各的。
     宁可少封顶也不能错封：把两条无从区分的命中判成"同一个系统"会白白吃掉用户的成果。
     ⚠️ 这里**不能**用 Math.random()：同一个 hit 在两次调用（面板 / 报告 / 攻击链）里
     会拿到不同的键，计分口径就不稳定了。 */
  return '#hit' + String(hit.id ?? '0')
}

/** 从一组同口径命中里挑"计分的那一条"：分值最高，同分取更早记的（id 小的）。 */
function pickBestHit(list) {
  return list.reduce((a, b) => {
    const pa = Number(a.points) || 0; const pb = Number(b.points) || 0
    if (pb !== pa) return pb > pa ? b : a
    return Number(b.id) < Number(a.id) ? b : a
  }, list[0])
}

/** 旧口径分组（兼容 v0.10 及以前：账号类与数据库类按"同资产同端口"封顶）。 */
function legacyCapGroup(code) {
  const c = String(code || '').trim()
  if (c === 'web-account-user' || c === 'web-account-admin') return 'service'
  return SERVICE_CAPPED_POINT_CODES.includes(c) ? 'service' : null
}


/**
 * 读取得分点元数据（code → `{ rule, cap, dedup_scope, points, enabled, builtin, src }`）。
 * 面板 / 报告 / 攻击链三处共用，避免"同一份规则三处各读一遍、字段各漏一个"。
 * @param db - 靶标库句柄。
 */
function loadScoreMeta(db) {
  return new Map(db.prepare('SELECT code, rule, cap, dedup_scope, points, enabled, builtin, src FROM score_point')
    .all()
    .map((r) => [String(r.code), {
      rule: r.rule === null || r.rule === undefined ? null : Number(r.rule),
      cap: Number(r.cap) || 0,
      dedup_scope: r.dedup_scope || 'service',
      points: Number(r.points) || 0,
      enabled: r.enabled === null || r.enabled === undefined ? 1 : Number(r.enabled),
      builtin: Number(r.builtin) === 1,
      src: r.src === null || r.src === undefined ? null : Number(r.src),
    }]))
}

/**
 * 资产 id → 系统名（primary_name），`system` 口径要用它把"同一套系统"归到一起。
 * @param db - 靶标库句柄。
 */
function loadAssetNames(db) {
  return new Map(db.prepare('SELECT id, primary_name FROM asset').all()
    .filter((a) => a.primary_name).map((a) => [Number(a.id), a.primary_name]))
}

/**
 * 本条命中的**实际分值** = 档位分值 × 倍率。
 *   · 档位分值：命中自带优先（合并版同一条含多档），缺省回落到得分点默认分值；
 *   · 倍率：G5 数据规模翻倍（超 1 亿条 / 10TB，或控制知识库相关系统）×2、
 *     G6 IPv6 成果 ×3。倍率作用在**权限分**上，所以乘在分值里、随上限一起被 cap 约束
 *     （文档要求"上限仍按对应系统类型的原上限计算，不因倍数突破上限"）。
 */
function hitPointsOf(hit = {}, metaByCode = null) {
  let base = 0
  if (hit.points !== null && hit.points !== undefined && hit.points !== '') {
    base = Number(hit.points) || 0
  } else {
    const code = hit.code === null || hit.code === undefined ? null : String(hit.code)
    if (code !== null && metaByCode !== null && metaByCode !== undefined) {
      const meta = typeof metaByCode.get === 'function' ? metaByCode.get(code) : metaByCode[code]
      if (meta !== undefined && meta !== null) base = Number(meta.points) || 0
    }
  }
  const mult = Number(hit.multiplier)
  return Math.round(base * (Number.isFinite(mult) && mult > 0 ? mult : 1))
}

/**
 * 这个 target 的主机部分是 IPv6 字面量吗（http://[2001:db8::1]:8080/x、2001:db8::1、[::1]:22）。
 *
 * 不能用一条粗糙的字符类正则代替：IPv6 里混着十六进制字母（a-f），
 * 写成 /^\[[0-9a-f:]+\]/ 这类"只看冒号和十六进制"的写法会把带字母的地址漏判
 * （实测 2001:db8::1 里的 db8 就被漏掉，G6 的 ×3 完全不生效）。
 * 所以把主机部分交给 isIpv6() 判定 —— 与 cidrOf / scopeOfIp 用同一份实现。
 */
function targetHasIpv6Host(target) {
  const text = String(target || "").trim()
  if (text === "") return false
  const bracket = /^[a-z][a-z0-9+.-]*:\/\/(\[[^\]]+\])/i.exec(text)
  if (bracket !== null) return isIpv6(bracket[1].replace(/^\[|\]$/g, ""))
  const url = /^[a-z][a-z0-9+.-]*:\/\/([^/?#\s]+)/i.exec(text)
  const authority = url !== null ? url[1] : (/^([^\s/?#]+)/.exec(text) || [])[1]
  if (!authority) return false
  /* 裸写 IPv6 想带端口必须加方括号，所以这里去掉方括号后再尝试剥端口 */
  const host = authority.replace(/^\[|\]$/g, "").replace(/:\d{1,5}$/, "")
  return isIpv6(host)
}

/**
 * 把 G5 / G6 的倍率规则算成倍率值（只对权限分生效，且不突破原上限 —— 由 cap 兜住）。
 *   · `ip_version === 6` 或 target 是 IPv6 字面量 → ×3（G6）；
 *   · `data_scale === "large"` → ×2（G5：超 1 亿条 或 10TB）；
 *   · `data_scale === "knowledge-base"` → ×2（G5：控制知识库相关系统）；
 *   · 两者都命中 → 相乘。文档没写禁止叠加，取对演练方有利的解释并**如实标注原因**。
 * @param hit - 命中参数（ip_version / data_scale / target）。
 * @returns `{ multiplier, reasons }`
 */
function scoreMultiplierOf(hit = {}) {
  const reasons = []
  let multiplier = 1
  const target = String(hit.target || "")
  const ipv6 = Number(hit.ip_version) === 6 || targetHasIpv6Host(target)
    || /(^|\/\/)[0-9a-f]{0,4}:[0-9a-f:]+/i.test(target)
  if (ipv6) { multiplier *= 3; reasons.push("G6 IPv6 成果 ×3") }
  const scale = String(hit.data_scale || "").trim().toLowerCase()
  if (scale === "large") { multiplier *= 2; reasons.push("G5 数据规模超 1 亿条 / 10TB ×2") }
  else if (scale === "knowledge-base" || scale === "kb") { multiplier *= 2; reasons.push("G5 控制知识库相关系统 ×2") }
  return { multiplier, reasons }
}

/**
 * **统一的计分评估**：面板 / 报告 / 攻击链都调这一个函数算出"哪条计分、哪条被封顶"。
 *
 * 输入为一组"命中行"，输出它们的计分标记。调用方只需保证每行带
 * `{ id, code, points, asset_id, port, target, self_created }` 与**本条命中的实际分值**
 * （`points` 字段；不要传得分点默认值 —— 合并版里同一条含多档，传默认值会把哪条计分判反）。
 *
 * @param db - 靶标库句柄。
 * @param rows - 命中行数组。
 * @param options - `{ meta?, names?, enabledOnly? }`：可复用已读好的元数据；`enabledOnly` 为 true
 *                  时"停用得分点"的命中直接标为不计分（报告与面板口径必须一致）。
 * @returns `{ byId, items, caps, meta, names, disabledIds }`
 */
function evaluateScoreBoard(db, rows = [], options = {}) {
  const meta = options.meta || loadScoreMeta(db)
  const names = options.names || loadAssetNames(db)
  const prepared = (rows || []).map((h) => {
    const code = h.code === null || h.code === undefined ? null : String(h.code)
    const m = code === null ? undefined : meta.get(code)
    const nm = h.asset_id === null || h.asset_id === undefined ? null : names.get(Number(h.asset_id))
    return Object.assign({}, h, {
      code,
      /* points 必须是"本条命中的实际分值"（见上方说明） */
      points: hitPointsOf(h, meta),
      rule: m === undefined || m.rule === undefined ? null : m.rule,
      cap: m === undefined ? 0 : m.cap,
      dedup_scope: m === undefined ? 'service' : m.dedup_scope,
      cap_group: m === undefined || m.rule === null || m.rule === undefined ? 'code:' + String(code) : 'rule:' + m.rule,
      rule_cap: m === undefined ? 0 : m.cap,
      system_key: [nm || '', normalizePort(h.port) ?? parseTargetPort(h.target) ?? ''].join('|'),
    })
  })
  const evaluated = applyScoreCaps(prepared, meta, names)
  const byId = new Map(evaluated.items.map((x) => [x.id, x]))
  const disabledIds = new Set()
  if (options.enabledOnly === true) {
    for (const h of prepared) {
      const m = h.code === null ? undefined : meta.get(h.code)
      if (m !== undefined && Number(m.enabled) !== 1) disabledIds.add(h.id)
    }
  }
  return { byId, items: evaluated.items, caps: evaluated.caps, meta, names, disabledIds }
}

/**
 * 这条命中为什么不计分（告警 / 界面 / 报告共用一句话，避免三处口径写歪）。
 * @param hit - 命中行（带 code / target / port / rule / rule_cap / capped_reason_kind）
 * @param bestPoints - 去重时被哪条压住（该条的分值）
 */
export function scoreCapReasonText(hit = {}, bestPoints) {
  const label = serviceLabel(hit)
  if (hit.capped_reason_kind === 'cap') {
    return '「' + label + '」这条不计分：'
      + (hit.rule === null || hit.rule === undefined ? '' : '规则 ' + hit.rule + ' ')
      + '的**累计得分已达该规则上限（' + (Number(hit.rule_cap) || 0) + ' 分）**——同一规则超出上限的部分不再累加。'
      + '把精力换到别的规则或别的资产上，不要在已达上限的规则里继续刷。'
  }
  return '「' + label + '」这个目标上的权限已经拿满（计分口径：同一目标只算分值最高的那条'
    + (bestPoints === undefined || bestPoints === null ? '' : '，+' + bestPoints + ' 分')
    + '）——这条按规则不再计分，只作过程留痕；**换目标或换规则推进，不要在同一个目标上刷同类成果**。'
}

/** 兼容旧名（v0.10 及以前叫 serviceCapReason）。 */
export const serviceCapReason = scoreCapReasonText


/**
 * 数据规模的**粗判门槛**：100 万条/行。
 * 用途已经从「大量敏感信息得分项」改成 G5 翻倍的量级自检 —— 见 addScoreHit 里的警告。
 * 文档里 G5 的正式门槛是「超 1 亿条 或 10TB」；这里用更低的一档做"有没有写量级"的粗筛，
 * 低于它会提示核对，但不阻断记分。
 */
export const SENSITIVE_DATA_MIN_ROWS = 1000000

/**
 * 从证据文本里解析数据量（行/条/记录数）。
 * 支持「120 万条」「1300万行」「1,200,000 条记录」「2.5万行」「1200000 records」。
 * **只认带量词（条/行/记录/records/rows）或中文量级（亿/万…）的写法**——
 * 裸数字不认，否则会把口令里的 `123456`、端口号当成数据量。
 * 解析不出来返回 null（由调用方提示补齐量级，不猜、不编数）。
 */
export function parseRowCount(evidence) {
  const text = String(evidence || '')
  if (text.trim() === '') return null
  const units = { 亿: 1e8, 千万: 1e7, 百万: 1e6, 十万: 1e5, 万: 1e4, 千: 1e3 }
  const nums = []
  /* 「数字 + 单位 + 条/行/记录」：单位是中文量词，或英文 records/rows/entries */
  const cn = /(\d[\d,]*(?:\.\d+)?)\s*(亿|千万|百万|十万|万|千)?\s*(条|行|记录|数据|records?|rows?|entries)/gi
  for (const m of text.matchAll(cn)) {
    const base = Number(String(m[1]).replace(/,/g, ''))
    if (!Number.isFinite(base)) continue
    const mult = m[2] === undefined ? 1 : units[m[2]]
    nums.push(Math.round(base * mult))
  }
  if (nums.length > 0) return Math.max(...nums)
  /* 只写了「导出 120 万」这类（没写条/行）也认，但必须带中文量级 */
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(亿|千万|百万|十万|万|千)/g)) {
    const base = Number(String(m[1]).replace(/,/g, ''))
    if (Number.isFinite(base)) nums.push(Math.round(base * units[m[2]]))
  }
  return nums.length === 0 ? null : Math.max(...nums)
}

/** 千分位展示，告警里读数更直观。 */
export function formatRows(n) {
  return Number(n).toLocaleString('en-US')
}


/* ------------------------------------------------------------------ 默认得分点 */

/**
 * 得分点 → 交付口径（怎么算拿到、拿什么自证、怎么复现）。
 *
 * 为什么单独一张表而不是塞进 `score_point.description`：
 * 描述是"规则文档的条款"（给智能体判档位用），这张表是"给验收人看的复现口径"，
 * 两者受众不同、详略也不同。报告与界面按 code 取这里的说明，
 * 规则文档更新时不必动这张表，反之亦然。
 *
 * 字段：
 *   · need   —— 判定标准：满足什么才算拿到这一项（给验收人对账用）
 *   · proof  —— 自证材料：该附什么证据（G7 的证明材料要求）
 *   · replay —— 复现入口：用哪条请求 / 哪条命令重放（"可复现"最直接的答案）
 *   · script —— 一线可直接照做的动作（尽量是可复制执行的）
 */
export const SCORE_CONFIRM = {
  'domain-control': {
    need: '目标域名解析记录被改为我方可控（NS/A 记录生效），或域名管理后台可操作',
    proof: '管理后台截图 + 改记录前后的 dig/nslookup 对比',
    replay: 'nslookup <域名> <我方 NS>；或后台操作请求原文',
    script: 'dig NS <域名> @8.8.8.8\ndig <域名> @<我方NS>',
  },
  'terminal-access': {
    need: '能对终端下发指令并取回执行结果（不是"发现了一台设备"）',
    proof: '被控终端执行 id/hostname 的回显 + 与目标单位的关系证明（G7）',
    replay: '远控会话里执行 id；或木马/远控的 agent 上线记录',
    script: 'id; whoami; hostname',
  },
  'server-host': {
    need: '在主机上执行了命令并拿到回显（WebShell / 反弹 Shell / 远控均可）',
    proof: '命令回显（id / hostname）+ WebShell 连接要素或会话记录',
    replay: 'WebShell 请求原文（可直接重放）；或反弹 Shell 的监听记录',
    script: 'id; uname -a; cat /etc/passwd | head',
  },
  'db-credential': {
    need: '用账号成功连上数据库并执行了查询（未授权访问也算：能连上即成立）',
    proof: '登录成功后的查询回显（select user(), version()）+ 账号权限级别',
    replay: 'mysql -h <host> -P <port> -u <user> -p\'<pass>\' -e "select user(),version()"',
    script: 'mysql -h <host> -u <user> -p -e "select user(),version(),current_user()"',
  },
  'web-app': {
    need: '以目标已有账号登录进系统（普通或管理员），并访问了受保护页面',
    proof: '登录后的页面内容/回显 + 会话 Cookie 或 Token（证明不是只拿到口令）',
    replay: '登录请求原文（含见证 Cookie/Token）+ 一次带会话的受保护页面请求',
    script: 'curl -i -s -X POST <登录URL> -d "username=<u>&password=<p>" -c cookie.txt\ncurl -s -b cookie.txt <受保护页面>',
  },
  'central-system': {
    need: '登录进堡垒机/域控/SSO/终端管理后台等集权系统并取得管理权限',
    proof: '管理后台页面截图 + 能体现"可管控下属节点"的操作（登录 20% 托管节点或 20 台）',
    replay: '登录请求原文 + 一次管控操作（如列举托管主机）的请求与响应',
    script: 'curl -s -b cookie.txt "<管控列表接口>"',
  },
  'bigdata-system': {
    need: '获得大数据平台（Hadoop/Spark/ES 等）管理或普通权限',
    proof: '平台管理页/接口回显 + 可访问的数据规模（条数或容量）',
    replay: '平台接口请求原文（如 ES _cat/indices、YARN /ws/v1/cluster/apps）',
    script: 'curl -s "<平台接口>" | head -50',
  },
  netdev: {
    need: '登录网络设备（防火墙/路由器/交换机/VPN/网闸）并取得权限',
    proof: '设备管理页截图 + 路由表或连接量截图（G7 明确要求）',
    replay: '设备登录请求原文 + 读取路由表的命令回显',
    script: 'show ip route    # 或 display ip routing-table',
  },
  'netdev-redirect': {
    need: '借助该设备实际改变了流量走向（策略/路由/DNS 改动生效）',
    proof: '改动前后的路由表或策略对比 + 我方节点收到流量的证据',
    replay: '策略配置请求原文 + 我方可控节点上的抓包/访问日志',
    script: 'tcpdump -ni any port <端口> -c 10',
  },
  'netdev-implant': {
    need: '设备上植入了可执行的远控/持久化，**并且**借助它完成了后续攻击',
    proof: '远控进程或持久化项的证据 + 经该设备发起的后续成果记录',
    replay: '植入动作的请求/命令原文 + 后续经由该设备的访问日志',
    script: '',
  },
  iiot: {
    need: '获得工业互联网系统管理权限，或批量控制其下的互联设备',
    proof: '管理后台截图 + 被控设备清单与数量',
    replay: '登录请求原文 + 设备列表接口响应',
    script: '',
  },
  'cloud-platform': {
    need: '云管理平台管理员权限；或通过 ak/sk 批量控制云上节点（≥100 个才计节点分）',
    proof: '平台管理页截图；ak/sk 场景需给出被控节点清单与数量、或管理员证明（新增节点/改权限）',
    replay: '平台接口请求原文（列举实例、创建用户等）',
    script: 'curl -s -H "Authorization: Bearer <token>" "<平台/实例列表接口>"',
  },
  'iot-platform': {
    need: '获得物联网管控平台权限，或按其连接点批量控制设备',
    proof: '平台管理页截图 + 连接点/设备数量',
    replay: '平台登录与设备列表接口原文',
    script: '',
  },
  'iot-corenet': {
    need: '从物联网端点设备横向进入核心网，并控制了业务生产等重要系统',
    proof: '路径说明（哪个端点→核心网→哪个系统）+ 该系统的控制证据',
    replay: '从端点发起的横向动作命令 + 核心网系统的登录/操作请求',
    script: '',
  },
  secdev: {
    need: '获得非集权类安全设备（IPS/IDS/审计/WAF）管理员权限',
    proof: '设备管理页截图 + 能体现策略可控的操作',
    replay: '登录请求原文 + 一条策略读取接口响应',
    script: '',
  },
  'file-storage': {
    need: '获得文件存储系统后台权限（FTP/NAS/网盘/对象存储），或拿到其普通账号',
    proof: '目录列举截图 + 可读文件清单（数据成果另有计分，见 G2）',
    replay: '列举目录的请求原文（FTP LIST / S3 ListObjects / WebDAV PROPFIND）',
    script: 'curl -s "<存储接口>" | head -50',
  },
  'ai-agent': {
    need: '控制模型智能体/skill 等 agent 工具，并**实际驱动它执行了动作**',
    proof: '对话或调用记录 + 被驱动执行的动作与其结果（区间分按控制深度研判）',
    replay: '驱动 agent 的请求原文 + 它执行动作的回显',
    script: '',
  },
  'model-compute': {
    need: '获得算力管理平台/训练数据与知识库系统的系统管理权限',
    proof: '管理后台截图 + 能体现算力调度或数据可读写的操作',
    replay: '平台登录与调度/数据接口原文',
    script: '',
  },
  'model-data': {
    need: '获得模型相关数据系统管理员权限（可影响训练/推理/运营或窃取篡改权重）',
    proof: '管理后台截图 + 可读写的模型/数据集清单',
    replay: '平台接口原文（列举模型、下载权重）',
    script: '',
  },
  'computepower-admin': {
    need: '获得算力基础设施管理员权限',
    proof: '管理后台截图 + 可调度资源证明',
    replay: '平台登录与资源列表接口原文',
    script: '',
  },
  'computepower-cards': {
    need: '实际取得算力卡资源（10 分/卡）或卡池化平台控制权',
    proof: '卡资源清单（数量）+ 能提交任务或独占卡的证据',
    replay: 'nvidia-smi 回显 / 平台卡列表接口',
    script: 'nvidia-smi -L',
  },
  'boundary-logical': {
    need: '从靶标侧建立了通往内网的通道，并能**实际访问内网目标**',
    proof: '隧道登记（入口必须是目标侧）+ 经隧道访问内网目标的回显/截图（G7）',
    replay: '经隧道访问内网目标的那条命令与回显；隧道搭建命令',
    script: 'curl --socks5-hostname 127.0.0.1:<端口> http://<内网IP>/ -i',
  },
  'boundary-strong': {
    need: '突破网闸类强隔离，进入强隔离业务内网并实际访问到内网目标',
    proof: '网闸类隔离设备的控制截图 + 能访问内网的截图证明（G7）',
    replay: '经强隔离通道访问内网目标的命令与回显',
    script: '',
  },
  'boundary-physical': {
    need: '突破物理隔离/进入核心生产网并实际访问到目标',
    proof: '防火墙/VPN/多网卡主机/网闸的控制截图 + 能访问内网的截图（G7）',
    replay: '进入核心网后访问目标的命令与回显',
    script: '',
  },
  'boundary-supply': {
    need: '借助供应链运维通道或云服务进入主防单位内网（按情形分别计分）',
    proof: '供应链/云侧的控制证据 + 进入主防单位内网的证明；写明属于哪种情形',
    replay: '从供应链通道进入内网的命令与回显',
    script: '',
  },
}

/** 取某个得分点的交付口径；没有专门条目时返回 null（报告会退回只显示 evidence）。 */
export function scoreConfirmOf(code) {
  const key = String(code || '').trim()
  return SCORE_CONFIRM[key] === undefined ? null : SCORE_CONFIRM[key]
}

export const DEDUP_SCOPES = ['service', 'system', 'target', 'none']

/**
 * 一条得分点的完整定义（工厂函数，避免 22 个对象重复字段）。
 *
 * 两个编号各司其职，**不要混用**：
 *   · `src`  —— 《突破入侵类得分规则（合并版）》里的"原序号"（合并行写首个原序号），
 *               只用于与原表逐条对账，出现在文档与代码注释里；
 *   · `rule` —— 本实现内部的**上限分组键**（`applyScoreCaps` 按它累计 cap）。
 *               它必须**唯一**：历史上曾直接用原序号当分组键，导致 16/17 合并行与
 *               19 的两个子项共用同一个键 —— 一条命中会把另一条的上限吃掉，
 *               而且 `rule` 编号出现重复（两个 19）与空号（6/17/20/21），
 *               模型读到"规则 19 已达上限"时分不清是哪一条。
 *               现在统一为 1..N 连续唯一，与数组顺序一一对应。
 */
const sp = (src, rule, tier, code, name, category, points, cap, dedup_scope, description) => ({
  src, rule, tier, code, name, category, points, cap, dedup_scope, description,
})

/* ── 通用规则（G1–G8，横切全部条目；不单独计分，写进说明与提示词）────────────
   G1 权限取高只计一次 ｜ G2 数据成果另行计分 ｜ G3 上限针对单个防守单位 ｜
   G4 设备按台（个）计分 ｜ G5 数据规模翻倍 ｜ G6 IPv6 ×3（不突破原上限）｜
   G7 证明材料要求 ｜ G8 兜底：其他系统由专项组研判后给分。
   完整原文见 docs/得分规则-合并版.md。 */
export const SCORE_GENERAL_RULES = [
  { code: 'G1', name: '权限取高、只计一次', detail: '同一系统、同一主机、同一数据库上取得多种权限时，只按最高权限计一次分（既获取管理员又获取普通权限的，只给管理员权限分）。' },
  { code: 'G2', name: '数据成果另行计分', detail: '邮件数据、业务数据、数据资产等成果按数据重要程度单独计分，不与权限分混算。' },
  { code: 'G3', name: '上限口径', detail: '各项分值上限针对单个防守单位及其所有下属机构，达到上限后不再累计。' },
  { code: 'G4', name: '设备/终端按台（个）计分', detail: '打印机、wifi 路由器 5 分/台；PC、Pad、手机、摄像头、电子大屏 10 分/台；云上主机、容器、托管互联设备、物联网连接点等按 10 分/台（个）。批量控制按"被控节点"折算。' },
  { code: 'G5', name: '数据规模翻倍', detail: '含大量数据系统（重要数据量超 1 亿条或 10TB）得分翻倍；控制知识库相关系统得分翻倍。不含系统产生的普通日志数据。' },
  { code: 'G6', name: 'IPv6 倍数', detail: '利用 IPv6 取得的成果分数 ×3，但上限仍按对应系统类型的原上限计算，不因倍数突破上限。' },
  { code: 'G7', name: '证明材料', detail: '突破网络边界须提供隔离设备控制截图、能访问内网的截图证明等；控制的手机、Pad 等终端设备应能证明与目标单位的关系；网络设备权限需提供路由表等证据或连接量截图。' },
  { code: 'G8', name: '兜底条款', detail: '其他系统、服务器、设备等权限不预设分值，由专项组研判后给分。' },
]

/**
 * 默认得分点 —— **严格对齐《突破入侵类得分规则（合并版）》，共 22 项**
 * （一、获取权限 18 条 + 二、突破网络边界 4 条；其中"同一行的不同计费单位"拆为独立得分点，如算力基础设施的管理员权限与算力卡）。
 *
 * 与上一版的区别：不再按"同一规则内的权限档位"拆条 —— 一条 = 合并版里的一行
 * （`tier` 字段写清该条的档位/子项），只有**计费单位不同**的多档才保留子项
 * （如算力基础设施的"管理员权限"与"算力卡 10 分/卡"）。
 *
 * 字段含义：
 *   · src    合并版里的"原序号"（用于与原表逐条对账）；
 *   · group  界面分组：GENERAL = 控制一般系统，WEB = 控制 Web 应用系统，
 *            CENTRAL = 控制集权系统，BIGDATA = 控制大数据系统，
 *            NETINFRA = 控制网络基础设施，STORAGE = 文件存储类系统，
 *            MODEL = 控制模型相关系统，BOUNDARY = 突破网络边界；
 *   · points 单次分值（一条内多档时取该条的主档，说明里写清各档）；
 *   · cap    该条上限（0 = 不设上限）；dedup_scope 计分口径。
 */
export const SCORE_GROUPS = [
  { code: 'GENERAL', name: '控制一般系统' },
  { code: 'WEB', name: '控制 Web 应用系统' },
  { code: 'CENTRAL', name: '控制集权系统' },
  { code: 'BIGDATA', name: '控制大数据系统' },
  { code: 'NETINFRA', name: '控制网络基础设施' },
  { code: 'STORAGE', name: '文件存储类系统' },
  { code: 'MODEL', name: '控制模型相关系统' },
  { code: 'BOUNDARY', name: '突破网络边界' },
]

export const DEFAULT_SCORE_POINTS = [
  /* ══ 一、获取权限（18 条）══════════════════════════════════════════════ */

  /* 1 域名控制权限 */
  sp(1, 1, '一级 50 / 二级 20 分/个', 'domain-control', '域名控制权限', 'GENERAL', 50, 400, 'system',
    '**一级域名 50 分/个，二级域名 20 分/个**，按域名类型给分；本项上限 400 分（G3）。\n'
    + '记分时在 evidence 里写明域名与其类型；拿到二级域名时把单次分值调整为 20。'),

  /* 2 终端权限 */
  sp(2, 2, '5 / 10 分/台', 'terminal-access', '终端权限（手机、Pad、PC、打印机、摄像头、wifi 路由器等）', 'GENERAL', 10, 600, 'system',
    '**打印机、wifi 路由器 5 分/台；PC、Pad、手机、摄像头、电子大屏 10 分/台**（G4），按台累加；本项上限 600 分（G3）。\n'
    + '控制的终端设备需能证明与目标单位的关系（G7）；拿到 5 分档设备时把单次分值调整为 5。\n'
    + '钓鱼获取的终端同样按本项计分，在 evidence 里写明目标人员角色（普通办公 / IT 运维 / 业务运营）。'),

  /* 3 服务器主机权限 */
  sp(3, 3, '普通 10 / 管理员 50 分/个', 'server-host', '服务器主机权限（含 webshell 权限）', 'GENERAL', 50, 600, 'system',
    '**普通权限 10 分/个，管理员权限 50 分/个**；本项上限 600 分（G3）。\n'
    + '同一主机只按最高权限计一次（G1）——拿到 root/SYSTEM 后同主机不再累加普通权限。\n'
    + '获取 1 台服务器主机不扣分；拿到普通权限时把单次分值调整为 10。'),

  /* 4 数据库连接账号密码 */
  sp(4, 4, '普通 10 / 管理员 50 / 未授权 10 分/个', 'db-credential', '数据库连接账号密码（含 SQL 注入）', 'GENERAL', 50, 400, 'system',
    '**普通用户权限 10 分/个，管理员权限 50 分/个；redis 和其他空密码、未授权访问成果统一 10 分/个**；本项上限 400 分（G3）。\n'
    + '同一数据库的同等权限（含管理员）只得一次分；同一主机上的系统权限、应用权限、数据库权限按最高权限只得一次分（G1）。\n'
    + '数据成果单独计分（G2）；拿到普通权限/未授权时把单次分值调整为 10。'),

  /* 5、6 邮箱与业务生产系统（原表两项共用规则与上限） */
  sp(5, 5, '管理员 100 / 普通 50 分/个', 'web-app', '邮箱系统 / 办公自动化与业务生产系统权限', 'WEB', 100, 2000, 'system',
    '**管理员权限 100 分/个，普通用户权限 50 分/个；同一个系统只计算一次最高权限分**（G1）；本项上限 2000 分（G3）。\n'
    + '本项合并原表第 5、6 项（规则与上限完全相同），记分时在 evidence 里写明是哪类系统：\n'
    + '· **邮箱系统**；\n'
    + '· **办公自动化与业务生产系统**（办公 OA、ERP、直报即时通讯、财务系统、业务生产系统、数据仓库等被控或瘫痪后影响行业或单位业务生产、运行管理、日常办公的系统）。\n'
    + '邮件数据按重要程度再单独计分（G2）；拿到普通用户权限时把单次分值调整为 50。'),

  /* 7 集权系统 */
  sp(7, 6, '管理员 500 / 普通 50 分/个', 'central-system', '集权系统权限（运维 / 身份 / 组网 / 终端管理后台）', 'CENTRAL', 500, 4000, 'system',
    '**系统管理员权限 500 分/个，普通权限 50 分/个**；同一权限只给一次分，即获取管理员和普通权限只给管理员权限分（G1）；本项上限 4000 分（G3）。\n'
    + '集权系统包括四类：\n'
    + '· **运维集权类**：堡垒机、集中监控、统一资源发布等；\n'
    + '· **身份权限管理类**：SSO、4A、IAM 等；\n'
    + '· **组网集权类**：域控、证书认证、SDWAN 统一控制器等；\n'
    + '· **终端主机管理后台类**：终端管理软件后台、零信任控制中心等。\n'
    + '⚠️ 集权系统**托管的主机、终端等设备跨类引用"控制一般系统"的分值**（如 PC、移动终端 10 分/台，G4）——'
    + '**不要按集权系统最高档 500 分算**，那会严重偏高；批量控制需提供证明：至少登录托管节点数量的 20%，最多登录 20 台即可。'),

  /* 8 大数据系统 */
  sp(8, 7, '管理员 1000 / 普通 100 分/个', 'bigdata-system', '大数据系统权限', 'BIGDATA', 1000, 4000, 'system',
    '**管理员权限 1000 分，普通权限 100 分/个**；同一权限只给一次分，既获取管理员和普通权限只给管理员权限分（G1）；本项上限 4000 分（G3）。\n'
    + '数据单独计分（G2）；**有效数据量小于 5 亿条或 1TB 的按普通数据库计算**（即改用第 4 项分值）。'),

  /* 9 网络设备权限 */
  sp(9, 8, '普通 100 / 管理员 200 / 加成 200·1000 分', 'netdev', '网络设备权限（防火墙、路由器、交换机、网闸、光闸、摆渡机、VPN 等）', 'NETINFRA', 200, 2000, 'service',
    '**普通用户权限 100 分，管理员权限 200 分**；本项上限 2000 分（G3）。需提供路由表等证据或连接量截图（G7）。\n'
    + '在同一台设备上做到下列动作**再加分**（按做到的那一档记分）：\n'
    + '· 借助该设备进行**网络重定向或业务劫持**：+200 分；\n'
    + '· 在该设备上**植入远控程序并成功进行后续攻击**：1000 分。\n'
    + '拿到普通权限或加成分时，把单次分值按实际档位调整。'),

  /* 10 工业互联网系统 */
  sp(10, 9, '管理员 200 / 设备 10 分/个', 'iiot', '工业互联网系统权限', 'NETINFRA', 200, 2000, 'system',
    '**管理后台管理员权限 200 分；托管的互联设备 10 分/个**（G4）；本项上限 2000 分（G3）。\n'
    + '含车联网、智能制造、远程诊断、智能交通等。设备按个累加时用另起的命中记录（分值调为 10）。'),

  /* 11 云管理平台 */
  sp(11, 10, '管理员 500 / 节点 10 分/台', 'cloud-platform', '云管理平台控制权（含 PaaS 云平台，如 K8S、红帽 OpenShift 等）', 'NETINFRA', 500, 2000, 'system',
    '**管理员权限 500 分；云上主机、容器 10 分/台**（G4）；本项上限 2000 分（G3）。云上业务系统按重要系统规则单独计分。\n'
    + '通过 ak/sk 批量控制默认**只计算被控节点分数、不计算管理员分数**，除非提供证明具有管理员权限（如新增云上节点、用户权限管理等）。\n'
    + '⚠️ **节点数量小于 100 的按普通 Web 应用给分，节点不给分**（即走第 5、6 项口径）。'),

  /* 12 物联网设备管控平台 */
  sp(12, 11, '平台 200 / 连接点 10 / 核心网 +5000 分', 'iot-platform', '物联网设备管控平台权限', 'NETINFRA', 200, 2000, 'system',
    '**带控制功能的物联网平台 200 分；按平台上连接点数计算 10 分/台**（G4）；本项上限 2000 分（G3）。\n'
    + '**通过物联网端点设备打入核心网并控制业务生产等重要系统的，单独加 5000 分**（不受本项 2000 分上限约束，单独记一条命中）。'),

  /* 13 安全设备 */
  sp(13, 12, '管理员 200 分', 'secdev', '安全设备权限（IPS、IDS、审计设备、WAF 等非集权类安全设备）', 'NETINFRA', 200, 1000, 'service',
    '**管理员权限 200 分**；本项上限 1000 分（G3）。仅限非集权类安全设备（集权类走第 7 项）。'),

  /* 14 文件存储类系统 */
  sp(14, 13, '管理员 50 / 普通 10 分/个', 'file-storage', '文件存储类系统权限（FTP、对象存储、企业 NAS、企业网盘等）', 'STORAGE', 50, 500, 'system',
    '**管理员权限 50 分/个；普通用户权限、空系统或只含有测试数据的系统 10 分/个**；本项上限 500 分（G3）。\n'
    + '含 FTP、对象存储（按系统计分）、企业 NAS、企业网盘等；数据单独计分（G2）。拿到普通权限时把单次分值调整为 10。'),

  /* 15 模型智能体 / agent 工具 */
  sp(15, 14, '100–500 分/个', 'ai-agent', '模型智能体、skill 等 agent 工具（并能操作 agent 进行攻击）', 'MODEL', 100, 4000, 'service',
    '**100–500 分/个**，区间分，按控制与操作深度研判；本项上限 4000 分（G3）。\n'
    + '含模型智能体、skill 等 agent 工具；记分时在 evidence 里写明控制/操作深度，并按研判档位调整单次分值。'),

  /* 16、17 算力管理平台 + 训练数据/知识库系统（原表两项规则逐字相同） */
  sp(16, 15, '系统管理权限 500 分/个', 'model-compute', '算力管理平台权限 / 训练数据与知识库系统权限', 'MODEL', 500, 4000, 'system',
    '**获取系统管理权限 500 分/个**；本项上限 4000 分（G3）。\n'
    + '本项合并原表第 16、17 项（规则逐字相同），记分时在 evidence 里写明是哪类系统：\n'
    + '· **算力管理平台**（可管控调度算力资源等）；\n'
    + '· **训练数据、知识库等相关系统**（可窃取篡改训练数据或知识库、实施数据投毒等）。\n'
    + '含大量数据系统（超 1 亿条或 10TB）**得分翻倍**、控制知识库相关系统**得分翻倍**（G5）。'),

  /* 18 模型相关数据系统 */
  sp(18, 16, '系统管理员权限 500 分/个', 'model-data', '模型相关数据系统权限', 'MODEL', 500, 4000, 'system',
    '**获取系统管理员权限 500 分/个**；本项上限 4000 分（G3）。\n'
    + '可干扰模型训练、推理、运营服务，窃取篡改模型权重文件等。\n'
    + '⚠️ 与第 16、17 项的差异**不可抹平**：本项**没有"控制知识库相关系统得分翻倍"**，但有"数据资产成果参照数据评分"（G2）；'
    + '超大数据规模系统（超 1 亿条或超 10TB）得分翻倍（G5）。'),

  /* 19 算力基础设施（权限与算力卡两种计费单位，保留两条） */
  sp(19, 17, '管理员 500 分/个', 'computepower-admin', '算力基础设施 · 管理员权限', 'MODEL', 500, 2000, 'system',
    '**管理员权限 500 分/个**；本项上限 2000 分（含路径分，G3）。\n'
    + '本项与「算力基础设施 · 算力卡资源」同属第 19 项、共用 2000 分上限，三项（管理员权限 / 大量算力卡资源 / 算力卡池化平台）可分别得分但受本条总上限约束。'),
  sp(19, 18, '10 分/卡', 'computepower-cards', '算力基础设施 · 算力卡资源 / 算力卡池化平台', 'MODEL', 10, 2000, 'none',
    '**10 分/卡**，按卡累加（G4）；获取大量算力卡资源得分、获取算力卡池化平台直接得分，各上限 2000 分，且与「管理员权限」共用第 19 项总上限 2000 分。\n'
    + '记分时在 evidence 里写明卡数或平台名称。'),

  /* ══ 二、突破网络边界（4 项，整个目标单位同一类边界只给一次分）══════════ */

  sp(22, 19, '1000 分', 'boundary-logical', '进入逻辑隔离业务内网', 'BOUNDARY', 1000, 0, 'target',
    '**1000 分**。适用范围：整个目标单位突破同一类网络边界只给一次分。\n'
    + '证明材料（G7）：防火墙隔离设备的控制截图、能访问内网的截图证明等。'),
  sp(23, 20, '10000 分', 'boundary-strong', '进入逻辑强隔离业务内网', 'BOUNDARY', 10000, 0, 'target',
    '**10000 分**。适用范围：整个目标单位突破同一类网络边界只给一次分。\n'
    + '证明材料（G7）：网闸类隔离设备的控制截图、能访问内网的截图证明等。'),
  sp(24, 21, '30000 分', 'boundary-physical', '进入物理隔离内网、核心生产网', 'BOUNDARY', 30000, 0, 'target',
    '**30000 分**。适用范围：整个目标单位突破同一类网络边界只给一次分。\n'
    + '证明材料（G7）：防火墙、VPN、多网卡主机、网络设备、网闸类隔离设备的控制截图，能访问内网的截图证明等。\n'
    + '如铁路调度专网、银行核心账务网、电力生产控制大区、运营商信令网、能源生产物联网等。'),
  sp(25, 22, '1000 分（最多 3000）', 'boundary-supply', '借助供应链运维通道或云服务进入内网', 'BOUNDARY', 1000, 3000, 'service',
    '按三种情形计分：\n'
    + '· 进入**同一主防单位内网**：1000 分；\n'
    + '· 借助**一家**供应链单位或云服务进入**多家**主防单位内网：1000 分/每家主防单位；\n'
    + '· 借助**多家**供应链单位或云服务进入**一家**主防单位内网不同网络区域：1000 分/个，最多 3000 分。\n'
    + '记分时在 evidence 里写明属于哪种情形、涉及哪家主防单位/哪个网络区域。'),

  /* ══ 附加成果加成（依附于上面某条权限，但**独立计分、独立上限**）══════════
     这些条目不是「再拿一个系统权限」，而是「在已拿到的权限上又做到了某件事」（文档里的 +N 分）。
     压在基础条目里会共用它的 rule 上限、被基础分吃掉，所以拆成独立得分点。 */

  /* 9 网络设备加成：能够借助该设备进行网络重定向或业务劫持 +200 分 */
  sp(9, 23, '重定向 / 业务劫持 +200 分', 'netdev-redirect', '网络设备 · 借助该设备进行网络重定向或业务劫持', 'NETINFRA', 200, 2000, 'none',
    '**在原「网络设备权限」分之上另加 200 分**（文档第 9 项）。\n'
    + '适用：改路由/策略把流量引向我方可控节点、DNS 劫持、业务流量劫持等实际生效的重定向。\n'
    + '需要提供证据（G7）：路由表、策略配置或连接量截图；evidence 里写清重定向方向与验证方式。'),

  /* 9 网络设备加成：能在设备上植入远控程序并成功进行后续攻击 1000 分 */
  sp(9, 24, '植入远控 + 后续攻击 1000 分', 'netdev-implant', '网络设备 · 植入远控程序并成功进行后续攻击', 'NETINFRA', 1000, 2000, 'none',
    '**在原「网络设备权限」分之上另加 1000 分**（文档第 9 项）。\n'
    + '需要证明「植入成功 **且** 借它完成了后续攻击」两件事：远控进程/持久化证据 + 经该设备发起的后续成果。'),

  /* 12 物联网：通过端点设备打入核心网并控制业务生产等重要系统，单独加 5000 分 */
  sp(12, 25, '核心网 +5000 分', 'iot-corenet', '物联网 · 经端点设备打入核心网并控制重要系统', 'NETINFRA', 5000, 5000, 'none',
    '**文档第 12 项明确「单独加 5000 分」**，不占该条 2000 分的上限。\n'
    + '适用：从物联网端点设备横向进入核心网，并控制业务生产等重要系统；\n'
    + 'evidence 里写清：从哪个端点进、核心网里控了什么系统、拿到了什么权限。'),
]

/* ------------------------------------------------------------------ 内部辅助的导出 */

/**
 * 下面这些原本是 core.js 里的模块级函数（不对外导出），拆出来之后 core.js 需要用到，
 * 所以显式导出。它们不属于"给别人用的 API"，改签名前先看 core.js 的用法。
 */
export {
  normalizePort, targetAuthority, systemKeyOf, pickBestHit, legacyCapGroup,
  targetHasIpv6Host, evaluateScoreBoard, loadScoreMeta, loadAssetNames, hitPointsOf,
  scoreMultiplierOf,
}
