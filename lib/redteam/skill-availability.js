/**
 * 技能可用性自检（零依赖，tools 与 UI 共用的**唯一一份**判定逻辑）
 *
 * 为什么要有它：技能正文里写着"本机路径 / 环境变量 / VPS 地址"，但**技能能列出来 ≠ 能跑**。
 * 缺 `FOFA_KEY`、工具没落到 `$DSH_HOME/redteam/toolkit/`、VPS 还是占位符，都要等真正动手
 * 才发现，那时候人已经在靶场里了。这里把判定收成一份：
 *   · 智能体侧 —— `redteam_preflight` 开工前跑一次，缺什么直接找用户要；
 *   · 面板侧 —— 「技能库」页签给每个技能标出可用性状态。
 *
 * 每条问题都同时给出**修复方法**（`issues[].fix`，文案见 `skill-fixes.js`）：面板上
 * 不只是说"哪里不可用"，而是直接告诉用户"怎么修"。`problems` 保留为纯文本视图（兼容旧调用方）。
 *
 * 判定维度（都是能从技能正文里客观读出来的）：
 *   ① 正文能否加载 —— 只有"正文也读不到、文件又确实不在这台机器上"才把整条技能标成不可用。
 *      正文在手（宿主给了 content）就等于模型能加载这条技能；此时记录路径不存在只是**旧安装 /
 *      另一台机器**留下的痕迹（技能路径是绝对路径，换机器必然指空），不能再据此报不可用；
 *   ② 环境变量（`os.environ["X"]` / `process.env.X`；带默认值的 `os.environ.get("X", "…")` 不算）；
 *   ③ 正文里引用的本机路径（toolkit / bin / local 下的绝对路径、`$DSH_HOME`、`~/`）；
 *   ④ 外部基础设施占位符（如 `<你的VPS_IP>` 没填）。
 * ②③④ 只记在缺口里。技能正文里写了替代做法，缺工具或缺密钥时仍然可以加载。
 *
 * 不判定：语义正确性、权限、目标可达性 —— 那些只有真打一次才知道。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixesForIssue } from './skill-fixes.js'

/** 解析 $DSH_HOME / ${DSH_HOME} / ~（技能正文里几种写法都有）。 */
export function expandSkillPath(p, env = process.env) {
  const dshHome = env.DSH_HOME || resolve(homedir(), '.dsh')
  let out = String(p).trim()
  out = out.replace(/\$\{DSH_HOME\}/g, dshHome).replace(/\$DSH_HOME/g, dshHome)
  if (out.startsWith('~/')) out = resolve(homedir(), out.slice(2))
  return out
}

/**
 * 这台机器上 `$DSH_HOME` 的两个可能来源。
 *
 * 插件进程按 `process.env.DSH_HOME || homedir()/.dsh` 解析；宿主侧的 `dshHomePath()`
 * 走的是它自己的 home。换过盘 / 换过 profile / `HOME` 为空的机器上两者会分叉，只认一边
 * 就会把技能副本、toolkit 路径全判成"不存在"（别人电脑上技能显示不可用的主因）。
 */
export function dshHomeCandidates(env = process.env) {
  const out = []
  const push = (p) => { if (p && !out.includes(p)) out.push(p) }
  push(env.DSH_HOME)
  push(resolve(homedir(), '.dsh'))
  return out
}

/** 正文里的本机路径在**任一**候选 home 下存在就算存在（只认 env 会误报整片 toolkit 缺失）。 */
export function existsUnderAnyHome(raw, env = process.env) {
  for (const home of dshHomeCandidates(env)) {
    if (existsSync(expandSkillPath(raw, { ...env, DSH_HOME: home }))) return true
  }
  return false
}

/** 从技能正文里抽出"必需但没有设"的环境变量名。 */
export function requiredEnvOf(content) {
  const names = new Set()
  const body = String(content || '')
  /* Node 侧：process.env.X（没有默认值这一说） */
  for (const m of body.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) names.add(m[1])
  /* Python 侧：os.environ["X"] 必需；os.environ.get("X", "默认") 有兜底，不算必需 */
  for (const m of body.matchAll(/os\.environ(?:\.get)?[\[(]\s*["']([A-Z][A-Z0-9_]{2,})["']\s*(,)?/g)) {
    if (m[2] === undefined) names.add(m[1])
  }
  /* shell 侧：${X:?必填} 是显式必需；裸 $X 不判定（技能里大量出现 $TARGET 这类占位） */
  for (const m of body.matchAll(/\$\{([A-Z][A-Z0-9_]{2,}):\?/g)) names.add(m[1])
  return Array.from(names)
}

/** 说明文件不是工具。另一套系统、另一套 CPU 的文件名也不拿来判当前系统不可用。 */
export function pathCountsOnThisHost(raw, platform = process.platform, arch = process.arch) {
  const base = String(raw).replace(/\\/g, '/').split('/').pop() || ''
  if (/\.(md|txt|json|ya?ml|csv)$/i.test(base)) return false
  const token = (name) => new RegExp('(?:^|[._-])(?:' + name + ')(?:[._-]|$)', 'i').test(base)
  if (platform === 'win32' && /\.(sh|bash)$/i.test(base)) return false
  if (platform === 'win32' && /\/\.local\/|\/\.kimi-webbridge\//.test(String(raw).replace(/\\/g, '/'))) return false
  const isWinName = /\.exe$/i.test(base) || token('windows|win32|win64')
  const isDarwin = token('darwin|macos')
  const isLinux = token('linux')
  const isArm = token('arm64|aarch64')
  const isAmd = token('amd64|x64|x86_64')
  if (platform === 'win32' && (isLinux || isDarwin)) return false
  if (platform === 'darwin' && (isWinName || isLinux)) return false
  if (platform !== 'win32' && platform !== 'darwin' && (isWinName || isDarwin)) return false
  if (isArm && arch !== 'arm64') return false
  if (isAmd && arch !== 'x64') return false
  return true
}

/** 正文里引用的、可判定存在性的本机路径（toolkit / bin / local 下的绝对路径）。 */
export function referencedPathsOf(content) {
  const out = new Set()
  for (const m of String(content || '').matchAll(/(?:~|\$DSH_HOME|\/home\/[^\s"'`,)]+?)\/[\w./\u4e00-\u9fa5-]+/g)) {
    const raw = m[0].replace(/[，。；、：)）\]]+$/, '')
    if (!/\/(toolkit|bin|local)\//.test(raw)) continue
    if (/[<>{}*|]/.test(raw)) continue
    if (!pathCountsOnThisHost(raw)) continue
    out.add(raw)
  }
  return Array.from(out)
}

/** 宿主技能服务列不出来时，用本包 skills/redteam 和 $DSH_HOME/redteam/skills。 */
export function bundledSkillSummaries() {
  const here = dirname(fileURLToPath(import.meta.url))
  /* 两个候选 home 都扫：宿主按 dshHomePath 列技能时用的是它自己的 home，
     只扫 env 那一份会在分叉的机器上"装了却列不出来"。 */
  const dirs = [join(here, '..', '..', 'skills', 'redteam')]
  for (const home of dshHomeCandidates()) {
    const dir = join(home, 'redteam', 'skills')
    if (!dirs.includes(dir)) dirs.push(dir)
  }
  const seen = new Set()
  const out = []
  for (const dir of dirs) {
    let names
    try { names = readdirSync(dir) } catch { continue }
    for (const file of names) {
      if (!file.endsWith('.md')) continue
      const name = file.slice(0, -3)
      if (seen.has(name)) continue
      const filePath = join(dir, file)
      let content = ''
      try { content = readFileSync(filePath, 'utf8') } catch { content = '' }
      if (!content.trim()) continue
      seen.add(name)
      const title = (content.match(/^#\s+(.+)$/m) || [])[1] || name
      out.push({
        name,
        description: String(title).trim(),
        content,
        path: filePath,
        library: 'redteam',
        resourceBase: { kind: 'directory', path: dir },
      })
    }
  }
  return out
}

/** 官方技能在 `$DSH_HOME/skills`。红队技能在本包 `skills/redteam` 或 `$DSH_HOME/redteam/skills`。 */
export function skillLibraryOf(summary) {
  if (!summary || typeof summary !== 'object') return ''
  if (summary.library === 'official' || summary.library === 'redteam') return summary.library
  const n = [summary.path, summary.dir, summary.root, summary.resourceBase && summary.resourceBase.path]
    .filter((item) => typeof item === 'string')
    .join('\n')
    .replace(/\\/g, '/')
  if (/\/skills\/redteam(\/|$)/.test(n) || /\/redteam\/skills(\/|$)/.test(n)) return 'redteam'
  if (/\/skills(\/|$)/.test(n)) return 'official'
  return ''
}

/** 官方用户技能。不拿红队工具路径去判它们可不可用。 */
export function officialSkillSummaries() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const dir = join(home, 'skills')
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return [] }
  const out = []
  const seen = new Set()
  for (const entry of entries) {
    if (!entry || entry.name === '.system' || entry.name.startsWith('.')) continue
    let filePath = ''
    let name = ''
    if (entry.isDirectory()) {
      filePath = join(dir, entry.name, 'SKILL.md')
      name = entry.name
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'SKILL.md') {
      filePath = join(dir, entry.name)
      name = entry.name.slice(0, -3)
    } else {
      continue
    }
    if (seen.has(name) || !existsSync(filePath)) continue
    let content = ''
    try { content = readFileSync(filePath, 'utf8') } catch { continue }
    if (!content.trim()) continue
    seen.add(name)
    const title = (content.match(/^description:\s*(.+)$/m) || content.match(/^#\s+(.+)$/m) || [])[1] || name
    out.push({
      name,
      description: String(title).trim().replace(/^['"]|['"]$/g, ''),
      content,
      path: filePath,
      library: 'official',
      resourceBase: { kind: 'directory', path: dir },
    })
  }
  return out
}

/** 红队自检只用红队技能。官方技能即使出现在宿主列表里也不参与路径判断。 */
export function redteamSummariesForCheck(summaries, bundled, scoped) {
  const base = Array.isArray(bundled) ? bundled : []
  const names = new Set(base.map((item) => item && item.name).filter(Boolean))
  const picked = []
  const seen = new Set()
  for (const summary of Array.isArray(summaries) ? summaries : []) {
    if (!summary || !summary.name || seen.has(summary.name)) continue
    const library = skillLibraryOf(summary)
    if (library === 'official') continue
    if (library === 'redteam' || scoped === true || names.has(summary.name)) {
      seen.add(summary.name)
      picked.push(summary)
    }
  }
  for (const item of base) {
    if (!item || !item.name || seen.has(item.name)) continue
    seen.add(item.name)
    picked.push(item)
  }
  return picked
}

/** 从某个技能根里读同名技能的正文（读不到返回 null）。 */
export function readSkillFromRoot(root, name) {
  if (typeof root !== 'string' || root === '') return null
  for (const dir of [root, resolve(root, String(name || ''))]) {
    for (const file of [resolve(dir, String(name || '') + '.md'), resolve(dir, 'SKILL.md')]) {
      try { if (existsSync(file)) return { path: file, content: readFileSync(file, 'utf8') } } catch { /* 继续试下一个 */ }
    }
  }
  return null
}

/** 调修复文案生成器，任何异常都退化成空串（可用性判定不能因为文案出错而挂）。 */
function safeFix(issue) {
  try { return String(fixesForIssue(issue) || '') } catch { return '' }
}

/**
 * 检查一个技能的可用性。
 *
 * @param skill - `{ name, description?, content?, path?, root? }`（content 是技能正文，root 是它来自哪个技能根）。
 * @param options - `{ env?: NodeJS.ProcessEnv, sameNameIn?: string[] }`。
 *   `sameNameIn` 是**其它也注册了同名技能**的根目录：同名技能会按根顺序择优，被排在后面的那份
 *   会被"盖住"。这里用它兜底识别"实际加载的是随包占位符版本、而你自己的已配置版本排在后面"的情况。
 * @returns `{ name, status: 'available'|'broken'|'unknown', issues, problems, needs_user, checked, shadowed_by? }`
 *   `issues` 是 `{ kind, detail, fix }` 列表（`kind` ∈ file-missing / content-missing /
 *   env-missing / path-missing / placeholder / shadowed），`problems` 是它的 detail 文本视图。
 *   缺路径、缺密钥、占位符未填都留在 issues 里，不把 status 打成 broken。
 *   status='unknown' 表示"正文读不到，判不了"（例如只有元数据、正文加载失败的远端技能）。
 */
export function checkSkill(skill, options = {}) {
  const env = options.env || process.env
  const name = skill && skill.name ? String(skill.name) : '(未命名)'
  const content = skill && typeof skill.content === 'string' ? skill.content : ''
  const file = skill && typeof skill.path === 'string' ? skill.path : null
  const root = skill && typeof skill.root === 'string' ? skill.root : null
  const issues = []
  const needsUser = []
  /** 记一条问题：detail 是给用户看的"不可用原因"，fix 是"怎么修"（见 skill-fixes.js）。 */
  const addIssue = (kind, detail, extra) => {
    const payload = Object.assign({ kind, skill: name }, extra || {})
    let fix = ''
    try { fix = String(fixesForIssue(payload) || '') } catch { fix = '' }
    issues.push(Object.assign({ kind, detail, fix }, extra || {}))
  }

  if (content.trim() === '') {
    /* 正文读不到，再分两种：文件本来该在本机却没有（真的加载不出来 → broken），
       其余（只有元数据 / 远端技能源 / 宿主没给正文 → 判不了 → unknown）。 */
    const gone = file !== null && !existsSync(file)
    const detail = gone
      ? '技能文件在本机不存在，正文也读不到：' + file
      : '技能正文读不到（只有元数据）：无法判断可用性，需要时用 `skill` 工具实际加载一次'
    const kind = gone ? 'file-missing' : 'content-missing'
    return {
      name,
      status: gone ? 'broken' : 'unknown',
      issues: [{ kind, detail, fix: safeFix({ kind, skill: name, file: file || undefined }) }],
      problems: [detail],
      needs_user: [],
      checked: { file, env: [], paths: [] },
    }
  }
  /* 正文在手 = 技能能加载。这里的路径只作提示：它是上一次在某台机器上解析出来的绝对路径，
     换机器必然指空 —— 记一条非阻塞的 file-stale，不把整条技能标成不可用。 */
  if (file !== null && !existsSync(file)) {
    addIssue('file-stale', '技能记录的文件路径在本机不存在（技能正文仍可加载）：' + file, { file })
  }

  const envNames = requiredEnvOf(content)
  const missingEnv = envNames.filter((n) => !env[n])
  for (const n of missingEnv) {
    addIssue('env-missing', '缺环境变量 ' + n, { env: n })
  }

  const paths = referencedPathsOf(content)
  const missingPaths = paths.filter((p) => !existsUnderAnyHome(p, env))
  if (missingPaths.length > 0) {
    addIssue('path-missing', '引用的本机路径不存在：' + missingPaths.slice(0, 6).join('、')
      + (missingPaths.length > 6 ? ' 等 ' + missingPaths.length + ' 处' : ''), { paths: missingPaths })
  }

  /* 外部基础设施占位符：技能里出现 `<你的VPS_IP>` 这类说明还没配。
     但**已经配好的部署不该被误报**：只要 REDTEAM_VPS_HOST 有值，
     技能正文里的占位符就只是文档写法（实际命令会用配置值替换），不再算缺口。
     判定顺序必须是"先看配置、再看占位符"，否则配好 VPS 的机器上
     这几个技能会永远显示 broken（模板占位符与真实配置混在一起）。 */
  const vpsConfigured = typeof env.REDTEAM_VPS_HOST === 'string' && env.REDTEAM_VPS_HOST.trim() !== ''
  const placeholders = []
  if (!vpsConfigured) {
    if (content.includes('<你的VPS_IP>') || content.includes('<VPS_IP>')) placeholders.push('VPS 地址')
    if (content.includes('<你的VPS_主机名>') || content.includes('<VPS 主机名>')) placeholders.push('VPS 主机名')
  }
  for (const p of placeholders) {
    addIssue('placeholder', p + '还是占位符（技能里写的是占位符，说明本机/本环境还没配）', { placeholder: p })
    needsUser.push(p)
  }
  for (const n of missingEnv) needsUser.push('环境变量 ' + n)

  /* 兜底：同名技能在别的根里有一份"问题更少"的版本（通常是用户自己配过的那份，
     但被排在前面的随包占位符版本盖住了）。这时如实说明，而不是让用户以为环境没配。 */
  let shadowed = null
  for (const other of Array.isArray(options.sameNameIn) ? options.sameNameIn : []) {
    if (other === root) continue
    const alt = readSkillFromRoot(other, name)
    if (alt === null || alt.content === content) continue
    const verdict = checkSkill({ name, content: alt.content, path: alt.path }, { env })
    if (verdict.status === 'available' || verdict.problems.length < issues.length) {
      shadowed = { root: other, path: alt.path, status: verdict.status }
      addIssue('shadowed', '`' + other + '` 里还有一份同名技能（' + verdict.status + '），'
        + '但按技能根顺序当前加载的是这一份（上面这些不可用原因来自这一份）', { other_root: other })
      break
    }
  }

  /* 走到这里正文一定读到了 → 可用。缺工具 / 缺密钥 / 占位符 / 路径来自别的机器都只记缺口。 */
  return {
    name,
    status: 'available',
    issues,
    problems: issues.map((x) => x.detail),
    needs_user: Array.from(new Set(needsUser)),
    ...(shadowed === null ? {} : { shadowed_by: shadowed.root, shadowed_path: shadowed.path }),
    checked: { file, env: envNames, missing_env: missingEnv, paths, missing_paths: missingPaths },
  }
}

/** 汇总一批技能的状态（面板顶部标签与 preflight 的返回值都用它）。 */
export function summarizeSkills(results) {
  const out = { total: results.length, available: 0, broken: 0, unknown: 0 }
  for (const r of results) out[r.status] = (out[r.status] || 0) + 1
  return out
}
