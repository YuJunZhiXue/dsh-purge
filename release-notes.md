# 1.1.43

## 中文

- 版本升级到 1.1.43。
- 还没定位到本机 Harness 时，不再把每一条显示成跳过，分组计数也不再把跳过算成已完成。
- 补丁列表补齐到全部 52 条，总数和分组对得上。
- 启动时如果暂时找不到宿主目录，不再把这个空结果缓存住。

## English

- Version 1.1.43.
- Before this install is located, rows are no longer shown as skipped, and a skip no longer counts as done in the group total.
- The patch list now includes all 52 items, so the total matches the groups.
- A miss while looking up the host directory is not cached for the rest of the process.

# 1.1.42

## 中文

- 版本升级到 1.1.42。
- 清洗页提示词下面可以登记自己的服务器：每行一个 IP 或完整主机名，点保存名单。说明里写了步骤，并附了截图。
- 新对话把提示词放在系统提示最前。面板改为白墨玻璃，两种主题都能看清字。
- 补丁进度只计已应用的项。网页身份那条在后一条改写句子之后，仍显示已应用。
- 补上 0.1.x 的入口针。已经打过的 0.2.0 不会被重写。

## English

- Version 1.1.42.
- Under Prompt on the Clean page, register your own server: one IP or exact hostname per line, then Save list. The docs include the steps and a screenshot.
- New chats place the prompt at the front of the system prompt. The dock is frosted glass, and both the light and ink themes stay readable.
- The patch count includes only applied items. The web-surface identity row stays applied after the later sentence rewrite.
- Needles for 0.1.x entry points were added. An already patched 0.2.0 host is not rewritten.

# 1.1.41

## 中文

- 版本升级到 1.1.41。
- 官方模式只注入当前提示词；启用规则集后以规则集为主。红队再附上红队操作要求。
- 回退留在当前会话：先选回退一次或上一轮，上一句放回输入框，并清掉已经发出去的内容。
- 宿主没清洗完，或没有可注入的提示词时，不重启。
- 默认已是完全权限时，新会话不再被钉回受限权限。官方模型的 Session Log 上传默认关闭。
- 目标地址落在中国大陆、香港、澳门时停止。

## English

- Version 1.1.41.
- Official modes inject the editable prompt, or the active rule set when one is enabled. Red team also keeps its operating section.
- Rewind stays on the current session: choose one step or the last round, return the last line to the composer, and clear what was already sent.
- Restart is cancelled unless the host is cleaned and inject text is present.
- A full-access default is no longer pinned back to a restricted preset. Official model Session Log upload is off by default.
- Targets whose addresses fall in mainland China, Hong Kong, or Macau are stopped.

# 1.1.40

## 中文

- 版本升级到 1.1.40。
- 适配 **DSH 0.2.0-rc.2**：Anthropic OAuth 不再在系统提示最前面强插「You are Claude Code…」，自定义 `prompt-inject` 不会被压到后面。
- 去掉在 0.2 里已不存在的 **patch 41**（developer 角色改写），避免无效补丁占位。
- 设置页点 **应用** 成功后 **自动重启** 宿主，不必再打开插件点第二次重启。

## English

- Version 1.1.40.
- For **DSH 0.2.0-rc.2**, Anthropic OAuth no longer prepends “You are Claude Code…” ahead of your system prompt, so custom `prompt-inject` is not pushed behind a Claude identity block.
- Removed **patch 41** (developer-role remap) because those needles are gone in 0.2.
- After **Apply** in settings, the host **restarts automatically**; you no longer need to open the plugin again to confirm restart.

# 1.1.39

## 中文

- 版本升级到 1.1.39。
- 中文 Windows 上，官方桌面版点「安装并重启」不再停在「正在准备重启」。更新脚本首行改为纯 ASCII，路径里的中文写成 `\u` 转义，避免 Windows Script Host 按 GBK 把换行吞进注释。
- macOS 和 Linux 不走这条脚本，重启方式不变。

## English

- Version 1.1.39.
- On Chinese Windows, the official desktop install-and-restart no longer stays on preparing to restart. The update script starts with an ASCII comment, and non-ASCII paths are written as `\u` escapes, so Windows Script Host does not swallow the newline when it reads the file as GBK.
- macOS and Linux do not use this script. Their restart path is unchanged.

# 1.1.38

## 中文

- 版本升级到 1.1.38。
- 红队不再替用户下载工具。没有安装脚本时，引导改走演练台「环境适配」，由用户自己填路径。
- 长时间任务会在系统提示词里放一张「本次目标」卡。指挥和子代理看的是同一张：只打这个单位，回报里带出来的其它单位不打。子代理按角色使用自己的提示词，派活时的单位名称必须和这张卡一致。
- 工具查找认发行版上的真实文件名，例如 Kali 的 `httpx-toolkit`、`impacket-secretsdump`，不再把 Python 的 `httpx` 当成扫描器。
- 官方桌面在 macOS、Linux 上也能找到 `app.asar`（Mac 用 `Contents/Resources`）。Windows 以外不再包一层会把 `require` 弄坏的控制台隐藏。
- 红队接入锚点门：开头几步输出上限 1024；第一段思考里有 `we`、没有 `let me` 就放开，否则同一轮最多再走 4 步。上下文压缩后再关一次。红队工具和人设保持原样。
- 随包技能同步到 `$DSH_HOME/redteam/skills`，预设用 `dshHomePath` 指向它，不再把某一台电脑的 `node_modules` 路径写进预设。你自己的技能仍在 `$DSH_HOME/skills`，同名以你的为准。
- 修好红队模式不显示：声明预设时漏了路径变量，插件中途退出，模式下拉就没有这一项。
- 说明里加回赞助地址。

## English

- Version 1.1.38.
- Red team no longer downloads tools for you. When the setup script is missing, the guide points at the drill console environment page so you fill in the paths.
- Long jobs keep a target card in the system prompt. The commander and subagents see the same card: stay on that organization, and do not switch to other names that show up in results. Each subagent loads its own role text, and dispatched work must use the name on the card.
- Tool lookup accepts distro filenames such as Kali's `httpx-toolkit` and `impacket-secretsdump`, and does not treat Python's `httpx` as the scanner.
- The official desktop app can find `app.asar` on macOS and Linux (`Contents/Resources` on Mac). Outside Windows, the console-hide wrapper that broke `require` is not installed.
- Red team uses an anchor gate: the first steps are capped at 1024 output tokens, the cap lifts when the first reasoning block contains `we` and not `let me`, otherwise it lasts at most 4 steps in that turn, and a context compaction closes the gate again. Red team tools and the persona stay as they are.
- Bundled skills are copied to `$DSH_HOME/redteam/skills` and the preset points there with `dshHomePath`, instead of a machine-specific `node_modules` path. Your own skills stay in `$DSH_HOME/skills` and win on the same name.
- Red team mode shows in the mode list again. Declaring the preset no longer exits early because a path variable was missing.
- The sponsor addresses are back in the readme.

# 1.1.37

## 中文

- 版本升级到 1.1.37。
- 修改演示台环境配置滚动问题。

## English

- Version 1.1.37.
- The drill console environment page scrolls, so the rest of the settings can be filled in.

# 1.1.36

## 中文

- 版本升级到 1.1.36。
- 解决红队模式拒绝问题。

## English

- Version 1.1.36.
- Fix red team mode refusing the cleaned prompt.

# 1.1.35

## 中文

- 版本升级到 1.1.35。
- 启动时不再自动更新，要自己在面板里选择。
- dsh-purge 入口改到「上下文」旁边，不再挡住别的插件按钮。
- 得分口径对齐上游：25 项，Web 应用增加兜底归类。
- 知识库 14 类计数包含本机 nuclei 模板，点某一类可以筛选。
- 技能路径跟随 `$DSH_HOME`，不再因为示例路径在本机不存在就把整条技能标成不可用。

## English

- Version 1.1.35.
- Startup no longer auto-updates; choose the update in the panel.
- The dsh-purge entry sits beside Context, so it no longer covers other plugin buttons.
- Scoring matches upstream: 25 items, with a fallback bucket for other web apps.
- The 14 knowledge categories count local nuclei templates, and a category filters the list.
- Skill paths follow `$DSH_HOME`. A skill is no longer marked unavailable just because an example path is missing on this machine.

# 1.1.34

## 中文

- 版本升级到 1.1.34。
- **演练台知识库直接列出本机模板**。打开「知识库 · POC / EXP」就能看到一页 nuclei 模板，并可以翻页、按 CVE 或组件搜索。不再只显示「本机模板 N」、下面是空的。
- **更新包在 Windows、macOS、Linux 上都能解压**。Linux 不再调用 PowerShell。顺序是：Windows 用 tar，不行再用 PowerShell；macOS 和 Linux 用 tar、unzip、python3、bsdtar。这些都没有时，用 Node 自己解 zip。感谢 @cracer4869 在 #44 报出 Kali 上的 `spawnSync powershell ENOENT`。

## English

- Version 1.1.34.
- **The drill knowledge page lists local templates.** Opening Knowledge shows a page of nuclei templates, with paging and search by CVE or component. It no longer shows only the template count.
- **Update archives extract on Windows, macOS, and Linux.** Linux does not call PowerShell. Windows tries tar, then PowerShell. macOS and Linux try tar, unzip, python3, then bsdtar. If none of those exist, Node extracts the zip itself. Thanks to @cracer4869 for reporting `spawnSync powershell ENOENT` on Kali in #44.

# 1.1.33

## 中文

- 版本升级到 1.1.33。
- **修复已经重启后，打开面板仍弹出「需要重启」**。官方客户端已经从解开的 `resources/app` 运行时，不再仅因为当前是官方进程就再要求退出一次。只有这次真的挪开了 `app.asar`，才会提示重启。

## English

- Version 1.1.33.
- **Fix the restart dialog coming back after you already restarted.** When the official app is already running from the unpacked `resources/app`, opening the panel no longer asks you to quit again just because this is the official process. The restart prompt appears only when `app.asar` was actually moved aside in this run.

# 1.1.32

## 中文

- 版本升级到 1.1.32。
- **按测试版接上演练台布局**：面板可拖动、可改大小，浅色和深色跟宿主主题走。
- **设置页不再出现本插件**。从会话标题旁的 dsh-purge 打开右侧栏，清洗和演练台都在里面。

## English

- Version 1.1.32.
- **Bring the beta dock layout onto stable**: the panel can be dragged and resized, and light and dark follow the host theme.
- **The plugin no longer appears on the Settings page.** Open the right dock from dsh-purge beside the session title. Clean and Drill are both in that dock.

# 1.1.31

## 中文

- 版本升级到 1.1.31。
- **演练台进入正式版**。右侧栏两页：清洗、演练台。第一次进入演练台要读声明并确认授权。资产、技能和本机环境都在本插件里，不再单独装测试版红队包。
- **修复回退堆分支**：宿主不能在原会话里截断，回退后会把旧会话从侧边栏移出，多退几次不会留下一串分支。

## English

- Version 1.1.31.
- **Drill console is on the stable release.** The right dock has two pages: Clean and Drill. The first time you open Drill you read the notice and confirm authorization. Assets, skills, and the local environment ship inside this plugin.
- **Fix rewind leaving a branch every time.** The host cannot truncate a session in place. After rewind the old session leaves the sidebar, so repeated undo does not pile up branches.

# 1.1.30

## 中文

- 版本升级到 1.1.30。
- **修复正式版和 web 切换版本失败**：不再用 `dsh plugin add` 拉包。pnpm 请求 GitHub 压缩包会 `http 302` 或 `fetch failed`。改由插件自己下载。
- **修复思考和输出死循环**：去掉默认提示词里没有终止条件的重置。

## English

- Version 1.1.30.
- **Fix version switching on the desktop app and web**: stop installing through `dsh plugin add`. pnpm's fetch of the GitHub archive returns `http 302` or `fetch failed`. The plugin downloads the package itself.
- **Fix the thinking and output loop**: remove the default-prompt reset that had no stop condition.

# 1.1.28

## 中文

- **修复更新失败 `http 302`**：下载改为直连 `codeload.github.com`，并手动跟随跳转，避免 Electron/部分 Node 对 github.com → codeload 的 302 处理失败。
- **修复测试版列表空白**：前端 `keepListedVersion` 与后端一致，正式版已发布时仍保留 beta tip / `beta` 分支；tip SHA 拉不到时回退 raw/jsDelivr 探测。

## English

- **Fix update failure `http 302`**: download via `codeload.github.com` and follow redirects manually so Electron/some Node builds no longer stall on github.com → codeload 302.
- **Fix empty beta list**: client `keepListedVersion` matches the server — keep the beta tip / `beta` branch after stable ships; fall back to raw/jsDelivr when tip SHA cannot be fetched.

# 1.1.27

## 中文

- **修复应用重启后进规则设定仍弹「需要重启」**：手动「应用」成功后写入 `applied` 戳，重启后 settle 不再误判补丁未对齐。
- 点「重启」清掉 `boot_full_quit` 粘性标记；status 按布尔值同步弹窗。
- web `waitForRestart` 必须先看到旧进程掉线再判定成功，避免同进程误刷新又弹窗。

## English

- **Fix restart prompt still showing after Apply + successful restart**: write the `applied` stamp on successful manual Apply so settle does not think patches are out of date.
- Clear sticky `boot_full_quit` when Restart is clicked; status syncs the modal from the boolean.
- Web `waitForRestart` requires the old process to go down before treating restart as success, avoiding same-process false refresh.

# 1.1.26

## 中文

- **修复测试通道被正式版同号藏掉**：`1.1.25` 正式发布后，`1.1.25-beta.*` 因「正式已追上」逻辑整通道不可见；现 **beta 分支 tip 始终列出**（正式/测试并行，测试带红队）。
- 已追上的旧 beta **标签**仍会隐藏；`1.1.11-beta` 仍下线。

## English

- **Fix beta lane hidden by same-number stable**: after `1.1.25` stable, `1.1.25-beta.*` vanished via the “stable caught up” filter; the **beta branch tip always stays listed** (parallel channels; beta carries red-team).
- Older caught-up beta **tags** still hide; `1.1.11-beta` stays withdrawn.
# 1.1.25

## 中文

- **修复 [#43](https://github.com/YuJunZhiXue/dsh-purge/issues/43)**：不再把 `profiles/*/cordis.patch.yml`（用户 patch 层）纳入 `backupAll`/`revertAll`；升级自愈时不会用旧 bak 覆盖用户后来追加的 `insert`。
- 启动/还原时主动丢掉历史上误建的 `cordis.patch.yml.dshpurge.bak`，保留当前用户文件。
- 新增 `npm run test:profile-patch`。

## English

- **Fix [#43](https://github.com/YuJunZhiXue/dsh-purge/issues/43)**: stop including `profiles/*/cordis.patch.yml` (user patch layer) in `backupAll`/`revertAll`, so upgrade reapply no longer restores an old bak over later user `insert`s.
- Drop stale `cordis.patch.yml.dshpurge.bak` without restoring; keep the live user file.
- Add `npm run test:profile-patch`.
# 1.1.24

## 中文

- **修复 [#40](https://github.com/YuJunZhiXue/dsh-purge/issues/40)**：`pathLooksDesktop` 不再仅凭路径里的 `deepseek-harness` 子串把源码版判成桌面端；需带 `resources/` / `.exe` / `.app` 等安装形态。
- **修复 [#41](https://github.com/YuJunZhiXue/dsh-purge/issues/41)**：源码部署的 `apps/cli`（tsdown 构建产物）禁止 hide-console 注入；`revertAll` 在无 `.dshpurge.bak` 时只跳过、绝不删除目标文件。
- 新增 `npm run test:surface` 回归。

## English

- **Fix [#40](https://github.com/YuJunZhiXue/dsh-purge/issues/40)**: `pathLooksDesktop` no longer treats source trees as desktop just because the path contains `deepseek-harness`; require install shapes (`resources/`, `.exe`, `.app`).
- **Fix [#41](https://github.com/YuJunZhiXue/dsh-purge/issues/41)**: skip hide-console injection into source `apps/cli` build output; `revertAll` never deletes targets when `.dshpurge.bak` is missing.
- Add `npm run test:surface`.
# 1.1.23

## 中文

- **修复 [#38](https://github.com/YuJunZhiXue/dsh-purge/issues/38)**：`#1`/`#2`/`#3` 提示词补丁每次 `apply` 叠加约 +841 字符、永不收敛。
- **原因**：替换产物仍以前一版文本为前缀，且未设 `skipIfMarked`，`autoApplyOnStart` 每轮都会再写一层。
- **修复**：为 `#1`/`#2`/`#3` 补 `skipIfMarked: true`（[#42](https://github.com/YuJunZhiXue/dsh-purge/pull/42)），并加 `npm run test:idempotence` 回归。
- 已膨胀的宿主文件不会自动缩回，需还原 `.dshpurge.bak` 或重装 dsh 后再 apply。

## English

- **Fix [#38](https://github.com/YuJunZhiXue/dsh-purge/issues/38)**: prompt patches `#1`/`#2`/`#3` grew by ~+841 chars on every `apply` and never converged.
- **Cause**: replacement text still starts with the previous pattern, and `skipIfMarked` was missing, so `autoApplyOnStart` rewrote every boot.
- **Fix**: set `skipIfMarked: true` on `#1`/`#2`/`#3` ([#42](https://github.com/YuJunZhiXue/dsh-purge/pull/42)); add `npm run test:idempotence`.
- Already-bloated host files are not auto-shrunk — restore `.dshpurge.bak` or reinstall dsh, then apply again.

# 1.1.22

## 中文

- **修复官方桌面点「应用」报 ENOENT**。`app.asar` 还在时，新建 `dsh-purge-child-process-hide.mjs` 会失败，路径被写成 `resources\app.asar\...\dsh-purge-child-process-hide.mjs`，补丁停在待应用。
- **原因**：官方客户端还带着 `app.asar` 时，Electron 会把 `resources\app` 映射进这个归档。归档里没有的新文件，用普通文件接口去创建就会 ENOENT。
- **两种写法都保留**。归档还在时，改写真实磁盘上的 `resources\app`。没有 `app.asar` 时仍用原来的 `node:fs`，包括 Web、社区桌面，以及官方包已经解开并把归档挪成 `app.asar.bak` 的情况。
- 安装目录不写死盘符。Web 和社区桌面的应用、重启保持原样。宿主仍对准 **dsh 0.1.7-rc.2**。

## English

- **Fixes ENOENT when Apply runs on the official desktop.** While `app.asar` is still present, creating `dsh-purge-child-process-hide.mjs` failed. The path was rewritten to `resources\app.asar\...\dsh-purge-child-process-hide.mjs`, and patches stayed pending.
- **Cause**: with the archive still in place, Electron maps `resources\app` into `app.asar`. Creating a file that is not already in the archive through the normal file API throws ENOENT.
- **Both write paths stay.** If the archive is still there, files are written on the real `resources\app` directory. If there is no `app.asar`, the previous `node:fs` path is unchanged. That covers Web, community desktop, and an official install that has already been unpacked and had the archive moved to `app.asar.bak`.
- Install paths are not pinned to a drive letter. Web and community desktop keep their existing Apply and restart. The host target remains **dsh 0.1.7-rc.2**.

# 1.1.21

## 中文

- **修复必需补丁失败 #43、#9、#15、#23、#42**。点「应用」不再因为这 5 条报「清洗未完成」。提示词本来就会写入；这 5 条没写上时，界面却把整次应用判失败，看起来像插件失效。
- **原因**：上级文件夹名叫 DeepSeek Harness 时，整棵目录被当成官方桌面。Web 的 npm 包因此被排除，这 5 条对得上的原文也没写进去。安装路径不写死盘符。现在只有旁边真有桌面程序，或路径在该安装的 `resources/app` 里，才算桌面安装。Web、社区桌面、官方桌面各自打自己的包。
- **#43**：去掉 Web 四个内置预设（standard、ptc、cordis、minimal）里的身份句。没写上时，预设里的原身份句会留在注入旁边。
- **#9**：审批请求自动放行。
- **#15**：沙箱 `confine` 不再包一层，命令按原样执行。
- **#23**：子代理默认深度从 1 提到 10。
- **#42**：给设置服务补回旧的 `register` / `get`，还在调旧接口的插件才能加载。
- 文件在、但这份原文不在当前版本里时，显示跳过，不再把整次应用判失败。原文还在时仍会写上。

## English

- **Fixes required-patch failures #43, #9, #15, #23, and #42.** Apply no longer reports the cleanse as incomplete because of these five. The prompt was already written; the failure made the plugin look dead.
- **Cause**: a parent folder named DeepSeek Harness was treated as the official desktop install, so the Web npm packages were excluded and these five were never written. Install paths are not pinned to a drive letter. A tree counts as the desktop install only when the desktop executable is beside it, or the path is under that install's `resources/app`. Web, community desktop, and official desktop each patch their own packages.
- **#43**: strips the identity sentence from the four built-in Web presets (standard, ptc, cordis, minimal). Left in place, that sentence stays next to the inject.
- **#9**: approval requests are auto-granted.
- **#15**: sandbox `confine` no longer wraps the command.
- **#23**: subagent default depth moves from 1 to 10.
- **#42**: the settings service gets the old `register` / `get` methods back, so plugins that still call them can load.
- When the file exists but this version does not contain that original text, the row shows skipped and Apply still completes. Text that is present is still written.

# 1.1.20

## 中文

- **宿主版本**：当前对准 **dsh 0.1.7-rc.2**。上一档 **0.1.7-rc.1**（含 `0.1.7-rc.1.20260924.1`）的旧锚点仍可用。
- **官方桌面升级**：已经下载的新版本会在重启，或在应用里点安装并重启时真正安装，然后解开新版本并重新打补丁。没有新版本时，重启仍是关掉再打开当前客户端。安装目录不写死盘符。
- **补丁**：#14、#35 跟上 rc.2 的升级写法，不再报必需补丁失败。#29、#33、#36 的新提示句也会打上。
- Web 和社区版 DSH Desktop 的应用、重启保持原样。

## English

- **Host version**: current target is **dsh 0.1.7-rc.2**. Anchors for the previous target, **0.1.7-rc.1** (including `0.1.7-rc.1.20260924.1`), still match.
- **Official desktop upgrade**: a downloaded update installs on Restart, or on the in-app install-and-restart action, then the new build is unpacked and patched. With no pending update, Restart still closes and reopens the current client. Install paths are not pinned to a drive letter.
- **Patches**: #14 and #35 match the rc.2 escalation text, so Apply no longer fails those required patches. #29, #33, and #36 follow the new prompt wording.
- Web and community DSH Desktop keep their existing Apply and restart.

# 1.1.19

## 中文

- **官方桌面 EXE**：支持官方 DeepSeek Harness。点「应用」解开 `app.asar` 并补上原生模块，再点「重启」，客户端自己关掉并重新打开。Web 和社区版 DSH Desktop 的应用、重启保持原样。
- **重启**：官方客户端退出不再被外壳当成崩溃，也不会留下后台 PowerShell。重启脚本不再调用 Windows 脚本宿主没有的 `toISOString`，避免弹出运行时错误。新进程不再继承 `ELECTRON_RUN_AS_NODE`，否则会刚打开就退出。
- **更新**：换版本或回退时，按落地的那一版自动还原再应用，不必每次手动先还原再应用再重启。
- **补丁列表**：宿主已经自带 `dsh-web-fetch-http` 时，不再显示一条永远跳过的 #20。安装目录不再写死盘符。

## English

- **Official desktop EXE**: Apply on official DeepSeek Harness unpacks `app.asar`, restores native modules, then Restart closes the client and opens it again. Web and community DSH Desktop keep their existing Apply and restart.
- **Restart**: exiting the official host is no longer treated as a crash, and no PowerShell process is left behind. The helper no longer calls `toISOString`, which made Windows Script Host pop a runtime error. The new process does not inherit `ELECTRON_RUN_AS_NODE`, which made it exit immediately.
- **Updates**: switching or rolling back a version restores and reapplies that version's patches without a manual revert first.
- **Patch list**: hosts that already depend on `dsh-web-fetch-http` no longer show a permanently skipped #20. Install paths are not pinned to a drive letter.

# 1.1.18

## 中文

- **重启**：点「重启」后旧页面的 token 会失效，只刷新等于打不开。现在会等端口释放（必要时结束旧进程），并按新进程打印的地址打开浏览器。请用新打开的页面，再新开一轮对话。
- **设置**：1.1.17 之前若已把 `legacyApplyPath` 叠进 `dsh-settings`，点「应用」会收成一份，提供商目录才能起来。收好之后再重启一次。

## English

- **Restart**: the old page token dies with the process, so a refresh looks like restart did nothing. Restart now frees the port and opens the browser at the new `dsh web:` URL. Use that page and start a new chat.
- **Settings**: Apply collapses duplicate `legacyApplyPath` left by earlier 1.1.17 patches so `dsh-settings` can load. Restart once after that apply.

# 1.1.17

## 中文

- **稳定性**：修复设置补丁 #42 在 dsh 0.1.7 上重复插入 `legacyApplyPath` 的问题。此前会导致 `@deepseek-ai/dsh-settings` 无法加载、提供商目录报错、mnemon 等插件连锁 pending。现改为 `skipIfMarked`，且不再与官方已自带的 `legacyApplyPath` 叠写。
- **工作区强指令**：#1/#2 同时识别 `WORKSPACE_*` 与 `AGENT_*` 常量名，避免「全局/替换式免责」在旧宿主上显示跳过、应用无效。
- **拒答与软拒**：官方 `agent-instructions` 强指令补充本机授权评测与反软拒话术；插件增加固定 `dsh-purge:rules` 段（与执行规则一致）。**新开会话并重启 dsh 后**生效。

## English

- **Stability**: patch #42 no longer stacks duplicate `legacyApplyPath` on dsh 0.1.7, which broke `@deepseek-ai/dsh-settings`, provider catalog loading, and downstream plugins. Uses `skipIfMarked` and does not re-insert the helper the official package already ships.
- **Workspace intros**: patches #1/#2 match both `WORKSPACE_*` and `AGENT_*` constant names so rows no longer show Skipped on older installs.
- **Refusal / soft refusal**: stronger official workspace intros plus a fixed `dsh-purge:rules` section. **Restart dsh and start a new chat** for prompt changes.

# 1.1.16

## 中文

- 对准 **dsh 0.1.7-rc.1**。工作区说明常量改名为 `AGENT_INSTRUCTIONS_INTRO`，句子没变，补丁跟着改。
- 沙箱 `confine()` 已是 `async confine(argv, policy, signal)`，补丁按新函数写。直通行为与上一版相同。
- 子代理深度改到 `dsh-subagent`，默认从 1 提到 10。深度检查还在。
- 设置服务补回旧的 `register` / `get`。`dsh-mnemon`、`dsh-better-reasoning-effort` 这类还在调旧接口的插件可以继续用。官方 `describe` / `update` 不动。补丁只打一次，不会在启动时重复插入。
- 删掉 0.1.7 里已经对不上的旧条文，包括单独给 `dsh-base` 补 `dsh-web-fetch-http` 依赖的那条。官方包已经自带。
- Web 四个内置预设（standard、ptc、cordis、minimal）只清空身份句。工作目录、工具列表、`ptc` 模式，以及 minimal 的 `complete: true` 和 `includeRuntimeContext: false` 不动。
- `complete: true` 时，`prompt-inject.md` 仍接在这段前面。换宿主版本或旧钩子删段之后，注入不会丢。点「应用」之后仍要再点「重启」，新开一轮对话才进当前会话。
- `dsh-compaction-instant` 网页端从已删除的 `settingsScope` 改到 `configForms`，页面不再停在 Failed to load plugins。
- 回退在 0.1.7 上会建出新会话，但界面仍停在旧对话，看起来像没反应。0.1.7 已没有 `sessions.open`。现在改用 `uiWorkspace.openSession` 切到新会话，并把上一句填回输入框。失败原因显示在按钮上。
- README 的赞赏区换成非盈利声明：严禁商业售卖、付费倒卖或黑灰产牟利，仅供技术参考。

## English

- Aligned with **dsh 0.1.7-rc.1**. The workspace-instruction constant is now `AGENT_INSTRUCTIONS_INTRO`. The sentence is unchanged, and the patch follows it.
- Sandbox `confine()` is now `async confine(argv, policy, signal)`, and the patch matches that function. Passthrough behavior is the same as the previous release.
- Subagent depth lives on `dsh-subagent`. The default moves from 1 to 10. The depth check remains.
- The settings service again exposes the old `register` / `get` methods, so plugins such as `dsh-mnemon` and `dsh-better-reasoning-effort` keep working. Official `describe` / `update` stay. The patch applies once and does not insert itself again on startup.
- Patch text that no longer exists in 0.1.7 is removed, including the extra `dsh-web-fetch-http` dependency on `dsh-base`. The official package already depends on it.
- The four built-in Web presets (standard, ptc, cordis, minimal) lose only the identity sentence. The working-directory suffix, tool lists, `ptc` mode, and minimal's `complete: true` plus `includeRuntimeContext: false` stay.
- When `complete: true`, `prompt-inject.md` is still prepended to that section. A host upgrade or an older hook that drops the section does not drop the inject. After Apply you still click Restart and start a new chat before it enters the session.
- The `dsh-compaction-instant` web client uses `configForms` instead of the removed `settingsScope`, so the page no longer stops on Failed to load plugins.
- Rewind on 0.1.7 created the new session and left the UI on the old chat, so the click looked dead. 0.1.7 has no `sessions.open`. The button now opens the new session with `uiWorkspace.openSession` and puts the previous user line back in the composer. A failure shows on the button.
- The README sponsor block is now a non-profit notice: no commercial resale and no gray-market profit; technical reference only.
