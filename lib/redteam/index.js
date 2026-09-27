/**
 * dsh-purge 演练台自举（host 半侧）
 *
 * 资产库、工具、预设、技能都在本插件目录内。本文件负责：
 *   1. 首次把 `presets/redteam` 落到 `$DSH_HOME/.agent-presets/redteam/`
 *   2. 把技能目录写成 `skills/redteam` 的真实绝对路径
 *   3. 已有用户预设时只修失效路径 / 旧包名，不整份覆盖
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis 插件名。 */
export const name = 'dsh-purge-redteam'

/** 无硬依赖：即使 skills 服务缺失也不该阻断挂载。 */
export const inject = []

/** 插件根目录（lib/redteam → 上两级）。 */
export function packagePaths() {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  return {
    root,
    presets: join(root, 'presets'),
    presetDir: join(root, 'presets', 'redteam'),
    skills: join(root, 'skills', 'redteam'),
    setupScript: join(root, 'scripts', 'redteam-setup.sh'),
  }
}

/** 环境数据目录（与 store/tools 用的同一份约定）。 */
export function redteamDataDir() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'redteam')
}

/**
 * 把随包分发的环境安装脚本落到 `$DSH_HOME/redteam/setup.sh`。
 *
 * 市场包用户装完只有 node_modules，仓库不在盘上；预检若只说"从仓库取脚本"，
 * 用户拿不到脚本、首次引导就断了。所以脚本随包走，启动时落一份可执行的副本。
 * 语义：目标不存在 → 装；已存在但内容不同 → 覆盖（脚本无用户可改状态）；
 *       内容相同 → 不动（避免每次启动都写盘）。
 *
 * @returns `{ action: 'installed'|'updated'|'kept'|'missing', path }`
 */
export function installSetupScript() {
  const paths = packagePaths()
  const target = join(redteamDataDir(), 'setup.sh')
  if (!existsSync(paths.setupScript)) return { action: 'missing', path: target }
  let wanted
  try {
    wanted = readFileSync(paths.setupScript, 'utf8')
  } catch {
    return { action: 'missing', path: target }
  }
  try {
    mkdirSync(redteamDataDir(), { recursive: true })
    if (existsSync(target)) {
      let current
      try { current = readFileSync(target, 'utf8') } catch { current = '' }
      if (current === wanted) {
        /* 权限可能被外部改掉，这里顺手补回来（脚本要能直接 bash 执行） */
        try { chmodSync(target, 0o755) } catch { /* 忽略 */ }
        return { action: 'kept', path: target }
      }
      writeFileSync(target, wanted, { encoding: 'utf8', mode: 0o755 })
      return { action: 'updated', path: target }
    }
    writeFileSync(target, wanted, { encoding: 'utf8', mode: 0o755 })
    return { action: 'installed', path: target }
  } catch (error) {
    return { action: 'missing', path: target, error: error && error.message ? error.message : String(error) }
  }
}

/** 用户 preset 根（与 dsh-agent-presets 的 USER_PRESET_DIR 保持一致）。 */
export function userPresetRoot() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, '.agent-presets')
}

/**
 * 预设模板里技能目录的占位符（build.mjs 写进打包预设，落地时才替换）。
 * 扩展名等都不允许写成别的形式，否则替换会漏。
 */
const SKILLS_PLACEHOLDER = '{{REDTEAM_SKILLS_DIR}}'

/** customSkillDirs 里"像本包 skills/ 目录"的那一行（老的绝对路径 / 占位符都算）。 */
function isSkillsDirLine(line) {
  const text = line.trim().replace(/^-\s*/, '')
  if (text === SKILLS_PLACEHOLDER) return true
  return /[/\\](dsh-redteam-mode|redteam-bundle)[/\\]skills\/?$/.test(text)
    || /[/\\]vendor[/\\]redteam[/\\]skills\/?$/.test(text)
    || /[/\\]skills[/\\]redteam\/?$/.test(text)
}

/**
 * 把预设正文里的技能目录占位符 / 失效的绝对路径渲染成**当前**包内 skills/ 路径。
 *
 * 为什么不能只替换占位符：
 *   · 占位符没被替换时，YAML 会把它解析成对象 → `skill-filesystem` 配置校验失败
 *     → **整个预设挂载失败** → 该会话建不了、发不出消息（v0.9.0 真出过这个事故：
 *     部署时把打包模板直接 cp 进了用户预设目录）；
 *   · 包换过位置（npx 缓存换了 hash、profile 重装、从源码包切到市场包）时，上次写下的
 *     绝对路径会指向不存在的目录 —— 技能"静默变少"，比直接报错更难发现。
 * 两种都在这里就地修正；只有真的改动了才写盘。
 */
function renderSkillsDir(text, skillsDir) {
  if (text.includes(SKILLS_PLACEHOLDER)) {
    return { text: text.split(SKILLS_PLACEHOLDER).join(skillsDir), changed: true, reason: 'placeholder' }
  }
  let changed = false
  const out = text.split('\n').map((line) => {
    if (!isSkillsDirLine(line)) return line
    const indent = /^(\s*)/.exec(line)[1]
    const wanted = indent + '- ' + skillsDir
    if (line === wanted) return line
    changed = true
    return wanted
  }).join('\n')
  return { text: out, changed, reason: changed ? 'stale-path' : 'none' }
}

/** 从独立红队包迁进 dsh-purge 后，预设里的工具行包名要跟着改。 */
function renderToolsPackage(text) {
  if (!text.includes('dsh-redteam-mode/tools')) {
    return { text, changed: false }
  }
  return {
    text: text.split('dsh-redteam-mode/tools').join('dsh-purge/redteam/tools'),
    changed: true,
  }
}

/**
 * 把包内预设落地到用户 preset 根。
 *
 * 语义（v0.9.0 起）：
 *   · 目标不存在 → 完整安装（占位符替换成真实路径）；
 *   · 目标已存在 → **默认不覆盖用户内容，但会自愈**：只要里面还留着
 *     `{{REDTEAM_SKILLS_DIR}}` 或指向不存在的旧包路径，就就地修正（这是唯一必需字段，
 *     不改就会整个预设挂载失败）。其余内容一律保留 —— 用户可以就地改预设。
 *   · `force: true` 才用包内模板整体覆盖。
 *
 * @param options - `{ force?: boolean, log?: (msg: string) => void }`
 * @returns `{ action: 'installed'|'kept'|'repaired', dir, skillsDir, skills, repaired? }`
 */
export function installPreset(options = {}) {
  const paths = packagePaths()
  const target = join(userPresetRoot(), 'redteam')
  const log = options.log ?? (() => {})
  const skillCount = existsSync(paths.skills)
    ? readdirSync(paths.skills).filter((f) => f.endsWith('.md')).length
    : 0
  const presetFile = join(target, 'agent.cordis.yml')

  if (existsSync(presetFile) && options.force !== true) {
    /* 自愈：占位符没替换 / 技能目录指向已失效的旧包路径 → 就地修好 */
    let text
    try {
      text = readFileSync(presetFile, 'utf8')
    } catch (error) {
      log(`读取 ${presetFile} 失败：${error && error.message ? error.message : String(error)}`)
      return { action: 'kept', dir: target, skillsDir: paths.skills, skills: skillCount }
    }
    const rendered = renderSkillsDir(text, paths.skills)
    const tools = renderToolsPackage(rendered.text)
    const next = tools.text
    if (rendered.changed || tools.changed) {
      writeFileSync(presetFile, next, 'utf8')
      log(
        (rendered.changed
          ? (rendered.reason === 'placeholder'
            ? '预设里还留着 ' + SKILLS_PLACEHOLDER + '（会导致整个预设挂载失败）'
            : '预设里的技能目录指向已失效的旧包路径')
            + `，已就地修正为 ${paths.skills}`
          : '')
        + (tools.changed ? (rendered.changed ? '；' : '') + '工具包名已改为 dsh-purge/redteam/tools' : ''),
      )
      return {
        action: 'repaired', dir: target, skillsDir: paths.skills, skills: skillCount,
        repaired: [rendered.changed ? rendered.reason : null, tools.changed ? 'tools-package' : null].filter(Boolean).join('+'),
      }
    }
    log(`已存在用户自己的预设 ${target}，保留不动（要覆盖：REDTEAM_PRESET_REFRESH=1 启动一次）`)
    return { action: 'kept', dir: target, skillsDir: paths.skills, skills: skillCount }
  }

  mkdirSync(target, { recursive: true })
  for (const file of readdirSync(paths.presetDir)) {
    const text = readFileSync(join(paths.presetDir, file), 'utf8')
    writeFileSync(join(target, file), renderToolsPackage(renderSkillsDir(text, paths.skills).text).text, 'utf8')
  }
  log(`预设已安装到 ${target}（打包技能 ${skillCount} 个：${paths.skills}）`)
  return { action: 'installed', dir: target, skillsDir: paths.skills, skills: skillCount }
}

/**
 * @param ctx - 插件上下文。
 */
export function apply(ctx) {
  const paths = packagePaths()
  let result
  try {
    result = installPreset({
      force: process.env.REDTEAM_PRESET_REFRESH === '1',
      log: (msg) => ctx.logger?.info?.('redteam-mode: ' + msg),
    })
  } catch (error) {
    /* 装不上不该拖垮整个 harness：把原因说清楚，面板与资产库照常可用 */
    ctx.logger?.error?.('redteam-mode: 预设安装失败：%s', error && error.message ? error.message : String(error))
    result = { action: 'failed', dir: join(userPresetRoot(), 'redteam'), skillsDir: paths.skills, skills: 0 }
  }
  /* 环境安装脚本也要落一份：市场包用户没有仓库，脚本必须随包走 */
  let setupResult
  try {
    setupResult = installSetupScript()
  } catch (error) {
    setupResult = { action: 'missing', error: error && error.message ? error.message : String(error) }
  }
  if (setupResult.action === 'installed' || setupResult.action === 'updated') {
    ctx.logger?.info?.('redteam-mode: 环境安装脚本已就位 %s（%s）', setupResult.path, setupResult.action)
  }
  /* Cordis 要求服务走 provide（直接赋值会报 "cannot set property without provide"） */
  ctx.provide('redteamMode', Object.freeze({ paths, preset: result, setup: setupResult }))
  ctx.logger?.info?.(
    'redteam-mode: 就绪（数据目录默认 $DSH_HOME/redteam；预设 %s；技能目录 %s）',
    result.dir, result.skillsDir,
  )
}

export default { name, inject, apply }
