/**
 * 技能修复文案（零依赖，纯 ESM）
 *
 * 用途：给控制台「技能库」页签用 —— 每个**不可用**的技能都要能直接告诉用户"怎么修"，
 * 而不是只报"缺什么"。`skill-availability.js` 负责判定（缺环境变量 / 缺工具 / 占位符没填 / 被同名技能盖住），
 * 这里负责把每一类判定翻译成可执行的中文步骤：
 *   · `TOOL_FIXES`   —— 逐工具的装法（与 `scripts/redteam-setup.sh` 保持一致：能自动装的就让人跑该脚本）
 *   · `SKILL_FIXES`  —— 逐技能的额外修复步骤（FOFA_KEY、VPS 地址、浏览器扩展…）
 *   · `toolNameOfPath` / `fixesForIssue` —— 把"某个路径不存在"这类判定转成具体建议
 *
 * 文案约定：中文、一句话说清"这是什么/怎么补"、命令一律用反引号包住、不编造 URL 与版本号、
 * 正文不用 markdown 强调符（面板按纯文本渲染）。`fixesForIssue()` 按判定分支给出的建议是**单行**的
 * （当列表项渲染不会塌）；回退到 `SKILL_FIXES` 时可能带换行 —— 技能文案允许 1–3 行。
 */

/** 仓库自带的一键修复入口（工具下载、FOFA_KEY/VPS 引导都在这一个脚本里）。 */
const SETUP = 'bash $DSH_HOME/redteam/setup.sh --yes'

/** 完全不知道缺什么时的兜底建议。 */
const GENERIC_FIX = '跑 `' + SETUP + '` 补齐工具与配置（幂等，可反复跑；缺的会下载，损坏的会删掉重下），'
  + '改了 `$DSH_HOME/.env` 后重启 `dsh web` 才生效；仍不行就重新安装 redteam 插件再体检一次。'

/** 工具箱附件实际装了什么。不要写成「缺了就从附件里解出来」。 */
const TOOLKIT_TARBALL = '上游 dsh-redteam-mode 的 release 资产 `dsh-redteam-mode-<版本>-toolkit.tar.gz`（里面目前只有 README、若干技能 md 和 redteam-setup.sh，不含下面这些二进制或脚本）'

/* ── 逐工具修法 ───────────────────────────────────────────────────────────── */

const FRP_FIX = {
  what: 'frp 内网穿透：`frps` 跑在 VPS 上做服务端，`frpc` 跑在目标上做客户端（同一个 release 包里的两个二进制）',
  install: '跑 `' + SETUP + '` 一次解出 `frpc` + `frps` 到 `$DSH_HOME/redteam/toolkit/frp/`；'
    + '脚本没覆盖时就手工从 fatedier/frp 的 GitHub releases 取 `frp_<版本>_linux_amd64.tar.gz`，解压后把 `frpc`/`frps` 放进同一目录并 `chmod +x`',
}

const LIGOLO_FIX = {
  what: 'ligolo-ng TUN 隧道（`proxy` 服务端 + `agent` 目标侧），chisel/frp 之外的备选通道，需要 root 建虚拟网卡',
  install: '跑 `' + SETUP + '` 装到 `$DSH_HOME/redteam/toolkit/ligolo/proxy` 与 `.../ligolo/agent`；'
    + '或从 nicocha30/ligolo-ng 的 GitHub releases 取 `proxy_*_linux_amd64.tar.gz` / `agent_*_linux_amd64.tar.gz`，解压后按上面的名字放到 `toolkit/ligolo/` 并 `chmod +x`',
}

export const TOOL_FIXES = {
  /* ── setup.sh 会下载到 toolkit/ 的二进制 ── */
  fscan: {
    what: '内网综合扫描（存活/端口/服务识别/28 类弱口令/未授权/高危漏洞，v2.2.1）',
    install: '跑 `' + SETUP + '` 补到 `$DSH_HOME/redteam/toolkit/fscan/fscan`；'
      + '若只下到 `fscan.zip` 没解压，手动解压出 `fscan` 二进制并 `chmod +x`；脚本仍补不上就从 shadow1ng/fscan 的 GitHub releases 下载对应平台二进制（含 `fscan_windows_x64.exe`、`fscan_linux_arm64`）放进该目录',
  },
  gogo: {
    what: '内网测绘与指纹引擎（v2.15.0，主动+被动指纹、关键信息提取、nuclei 模板 POC）',
    install: 'setup.sh 对 gogo 只做提示、不自动下载（上游资产命名不固定）：跑 `' + SETUP + '` 看提示，'
      + '再自己从 chainreactors/gogo 的 GitHub releases 按平台取二进制，主程序放 `$DSH_HOME/redteam/toolkit/gogo/gogo`，Windows/arm64 变体（`gogo_windows_amd64.exe`、`gogo_linux_arm64`）放同目录，全部 `chmod +x`',
  },
  suo5: {
    what: 'suo5：通过 WebShell/HTTP 建立 SOCKS5 隧道的内网突破核心工具（v2.2.0，静态 Go 无依赖）',
    install: '跑 `' + SETUP + '` 装到 `$DSH_HOME/redteam/toolkit/suo5/suo5-linux-amd64`；'
      + '或从 zema1/suo5 的 GitHub releases 取 `suo5-linux-amd64` 放到该路径并 `chmod +x`',
  },
  chisel: {
    what: 'chisel HTTP 隧道（服务端与客户端是同一个二进制，v1.12.0）',
    install: '跑 `' + SETUP + '` 装到 `$DSH_HOME/redteam/toolkit/chisel/chisel`；'
      + '或从 jpillora/chisel 的 GitHub releases 取 `chisel_<版本>_linux_amd64.gz`，`gunzip` 后 `chmod +x`',
  },
  frp: FRP_FIX,
  frpc: FRP_FIX,
  frps: FRP_FIX,
  subfinder: {
    what: '被动子域枚举（ProjectDiscovery，v2.16.0，多源聚合）',
    install: '跑 `' + SETUP + '` 装到 `$DSH_HOME/redteam/toolkit/subfinder/subfinder`；'
      + '或从 projectdiscovery/subfinder 的 GitHub releases 取 `subfinder_<版本>_linux_amd64.zip` 解压后放进去并 `chmod +x`',
  },
  dnsx: {
    what: '批量 DNS 解析/爆破/泛解析过滤（ProjectDiscovery，v1.3.1）',
    install: '跑 `' + SETUP + '` 装到 `$DSH_HOME/redteam/toolkit/dnsx/dnsx`；'
      + '或从 projectdiscovery/dnsx 的 GitHub releases 取 `dnsx_<版本>_linux_amd64.zip` 解压后放进去并 `chmod +x`',
  },
  naabu: {
    what: '高速端口扫描（ProjectDiscovery，v2.6.1；SYN 需要 root，非 root 加 `-scan-type c`）',
    install: '跑 `' + SETUP + '` 装到 `$DSH_HOME/redteam/toolkit/naabu/naabu`；'
      + '或从 projectdiscovery/naabu 的 GitHub releases 取 `naabu_<版本>_linux_amd64.zip` 解压后放进去并 `chmod +x`',
  },
  httpx: {
    what: 'HTTP 存活/标题/状态码/技术栈探测（ProjectDiscovery 版，v1.12.0；`/usr/bin/httpx` 是 Python httpx 库的 CLI，不是这个）',
    install: '跑 `' + SETUP + '` 装到 `$DSH_HOME/redteam/toolkit/httpx/httpx`；'
      + '或从 projectdiscovery/httpx 的 GitHub releases 取 `httpx_<版本>_linux_amd64.zip` 解压后放进去并 `chmod +x`；'
      + '命令行里请配合包装脚本 `pd-httpx` 调用（见 `pd-httpx` 条目）',
  },
  ksubdomain: {
    what: '无状态子域爆破（knownsec ksubdomain v0.7，比 dnsx 爆破快，需要 root 发包）',
    install: '跑 `' + SETUP + '` 装到 `$DSH_HOME/redteam/toolkit/ksubdomain/ksubdomain`；'
      + '或从 knownsec/ksubdomain 的 GitHub releases 取 linux 版本压缩包解压后放进去并 `chmod +x`',
  },
  ligolo: LIGOLO_FIX,
  'ligolo-proxy': LIGOLO_FIX,
  'ligolo-agent': LIGOLO_FIX,
  gowitness: {
    what: '批量网页截图留证（sensepost/gowitness）',
    install: '跑 `' + SETUP + '` 装到 `$DSH_HOME/redteam/toolkit/gowitness/gowitness`；'
      + '或从 sensepost/gowitness 的 GitHub releases 取 `gowitness-<版本>-linux-amd64` 放进去并 `chmod +x` —— '
      + '注意下载必须完整（截断的二进制文件在、权限也对，跑起来却零输出）',
  },
  oneforall: {
    what: 'OneForAll 子域收集全家桶（v0.4.5，源码 + `.venv`，慢但全）',
    install: '跑 `' + SETUP + '` 会把源码落到 `$DSH_HOME/redteam/toolkit/oneforall/OneForAll-0.4.5/` 并建好 `.venv` 依赖；'
      + '装不上不影响主线 —— 用 `subfinder` + `ksubdomain` 替代即可',
  },
  vps: {
    what: 'VPS 登录方式（`REDTEAM_VPS_HOST` / `REDTEAM_VPS_KEY`）与中转脚本 `vps.sh`：反弹 Shell、载荷投递、隧道出口的落地端',
    install: '跑 `' + SETUP + '` 会引导写入 VPS 地址与私钥路径；私钥放 `$DSH_HOME/redteam/toolkit/vps/id_rsa` 并 `chmod 600`（连通性用 '
      + '`ssh -i $DSH_HOME/redteam/toolkit/vps/id_rsa -o BatchMode=yes <user>@<ip> \'echo ok\'` 验）；'
      + '脚本 `$DSH_HOME/redteam/toolkit/vps/vps.sh` 不在工具箱附件里：按技能 `vps-reverse-shell` 的子命令自己写成可执行脚本（至少要有 `serve <port>` 和 `exec`）并 `chmod +x`',
  },
  'nuclei-templates': {
    what: 'nuclei 模板库（13,000+ 模板，`nuclei -t` 与 `redteam_poc_search` 都靠它）',
    install: '跑 `' + SETUP + '` 会装到 `~/.local/nuclei-templates`；也可单独跑 `nuclei -update-templates`（频率不超过每周一次）；'
      + '模板数少于 1000 说明没下全，重跑一次并 `nuclei -tl` 确认模板库没坏',
  },

  /* ── 技能里引用、但 setup.sh 不下载，工具箱附件里也没有 ── */
  dirsearch: {
    what: '目录/文件爆破（Python，v0.5.0，字典全、报告友好，带自带运行时）',
    install: '不在 setup.sh 的下载清单里：从 maurosoria/dirsearch 的 GitHub releases 取源码包，放到 `$DSH_HOME/redteam/toolkit/dirsearch/` '
      + '（保证 `toolkit/dirsearch/dirsearch` 可执行、`chmod +x`）；临时可用 `feroxbuster` / `ffuf` / `gobuster` 顶上',
  },
  behinder: {
    what: '冰蝎 v4.1 客户端 + 加密马模板（`toolkit/Behinder/server/*.jsp|php|aspx`，WebShell 交付主力）',
    install: 'setup.sh 不下载，' + TOOLKIT_TARBALL + '。到冰蝎发布页自行取客户端，放到 `toolkit/Behinder/`；'
      + '只需要马模板时保持 `toolkit/Behinder/server/` 七个模板在位即可（无 GUI 也能用 `sed` 换密钥生成）；需要 `java -jar` 所以本机要有 Java',
  },
  godzilla: {
    what: '哥斯拉 v4.0.1 客户端（`godzilla.jar`，GUI 生成 JSP/PHP/ASPX 全加密 payload）',
    install: 'setup.sh 不下载，' + TOOLKIT_TARBALL + '。到哥斯拉发布页自行取 `godzilla.jar`，放到 `toolkit/Godzilla/`；'
      + '启动需要 Java（`apt install openjdk-17-jre`）与图形会话（`DISPLAY=:10.0`）',
  },
  antsword: {
    what: '中国蚁剑 AntSword（Loader + 源码目录，首次启动要选源码目录 `antSword-2.1.16`）',
    install: 'setup.sh 不下载，' + TOOLKIT_TARBALL + '。到 AntSword 官方仓库取 Loader 与源码目录，放到 `toolkit/AntSword/`（'
      + '`toolkit/AntSword/AntSword-Loader-v4.0.3-linux-x64/AntSword` 需可执行）',
  },
  netexec: {
    what: 'netexec（nxc）内网横向/协议枚举工具（`toolkit/netexec/`，Kali 上也可 `apt install netexec`）',
    install: '`apt install netexec`；本机工具箱版本在 `$DSH_HOME/redteam/toolkit/netexec/`，'
      + '缺失就从 ' + TOOLKIT_TARBALL + ' 解出，或按官方文档用 `pipx install netexec`',
  },

  /* ── 技能里出现、setup.sh 不管的本机脚本/二进制 ── */
  'pd-httpx': {
    what: 'ProjectDiscovery httpx 的包装脚本（`~/.local/bin/pd-httpx`）—— 避免与 Python httpx 库的 CLI 撞名',
    install: '先跑 `' + SETUP + '` 装好 `$DSH_HOME/redteam/toolkit/httpx/httpx`，再重建包装脚本并赋权：'
      + '`printf \'#!/usr/bin/env bash\\nexec "\${DSH_HOME:-$HOME/.dsh}/redteam/toolkit/httpx/httpx" "$@"\\n\' > ~/.local/bin/pd-httpx && chmod +x ~/.local/bin/pd-httpx`',
  },
  'kimi-chrome': {
    what: '启动「能被 Kimi WebBridge 扩展驱动」的浏览器的启动脚本（`~/.local/bin/kimi-chrome`）',
    install: '先装浏览器：`apt install google-chrome-stable`（或 `apt install chromium`）；再建 `~/.local/bin/kimi-chrome`：'
      + '默认 `exec /usr/bin/google-chrome --no-first-run --no-default-browser-check "$@"`，`KIMI_BROWSER=chromium` 时改用 `/usr/bin/chromium`，'
      + '开头顺带 `systemctl start kimi-webbridge` 兜底拉起守护进程，最后 `chmod +x ~/.local/bin/kimi-chrome`',
  },
  'kimi-webbridge': {
    what: 'Kimi WebBridge 本地守护进程（systemd 服务 `kimi-webbridge`，监听 `127.0.0.1:10086`，技能靠它驱动真实浏览器）',
    install: '守护进程在 `~/.kimi-webbridge/bin/kimi-webbridge`，由 `/etc/systemd/system/kimi-webbridge.service` 管理：'
      + '重装后 `sudo systemctl enable --now kimi-webbridge`，再用 `~/.kimi-webbridge/bin/kimi-webbridge status` 确认 `"running": true`；'
      + '浏览器扩展由企业策略从 Chrome 应用商店自动安装（ID `fldmhceldgbpfpkbgopacenieobmligc`），Chrome 137+ 不要走解压加载',
  },
  chromium: {
    what: 'Chromium 浏览器（headless 抓渲染后 DOM / 截图 / 生成 PDF 的零依赖方案，`/usr/bin/chromium`）',
    install: '`apt install chromium`（也可装 `google-chrome-stable`）；用法：`/usr/bin/chromium --headless=new --no-sandbox --dump-dom <url>`，'
      + '截图加 `--screenshot=runs/shot.png`',
  },
  'playwright-cli': {
    what: 'Playwright CLI（需要点击/等待/多标签页时的浏览器自动化，`npx --yes @playwright/cli@latest`）',
    install: '`npx --yes @playwright/cli@latest`；浏览器缺了跑 `npx playwright install chromium`；'
      + '调用时务必加 `--browser chromium`（默认走 chrome 通道会报 `Chromium distribution \'chrome\' is not found`）',
  },

  /* ── 系统工具（setup.sh 只体检，缺了用 apt 补） ── */
  nmap: {
    what: '端口/服务/脚本扫描（Kali 自带，主动扫描主力）',
    install: '`apt install nmap`；SYN 扫描（`-sS`）需要 `sudo`，无权限时用 `-sT`',
  },
  masscan: {
    what: '超高速度端口扫描（大网段铺面，噪声大）',
    install: '`apt install masscan`；发包需要 root，务必先限定 `--rate` 与授权范围',
  },
  nuclei: {
    what: '模板化漏洞扫描（Nday/1day 检测主力，本机在 `/usr/bin/nuclei`）',
    install: '`apt install nuclei`；装完把模板库也补上：`nuclei -update-templates`（模板在 `~/.local/nuclei-templates`）',
  },
  sqlmap: {
    what: 'SQL 注入检测与利用',
    install: '`apt install sqlmap`',
  },
  ffuf: {
    what: 'Web fuzz / 目录爆破（最快最灵活，支持多字典、vhost、参数 fuzz）',
    install: '`apt install ffuf`',
  },
  feroxbuster: {
    what: '递归目录爆破（Rust，自动跟随目录层级，目录爆破首选）',
    install: '`apt install feroxbuster`',
  },
  gobuster: {
    what: '轻量目录/DNS/vhost 爆破（dir/dns/vhost 三模式）',
    install: '`apt install gobuster`',
  },
  hydra: {
    what: '在线弱口令爆破（50+ 协议：SSH/FTP/RDP/SMB/MySQL/MSSQL/Web 表单）',
    install: '`apt install hydra`',
  },
  john: {
    what: 'John the Ripper 离线哈希破解（CPU 路线，适合小字典/规则）',
    install: '`apt install john`；字典缺了先 `apt install wordlists` 再 `gunzip /usr/share/wordlists/rockyou.txt.gz`',
  },
  hashcat: {
    what: 'hashcat 离线哈希/口令破解（GPU 优先，CPU 会很慢）',
    install: '`apt install hashcat`；先 `hashcat --identify hashes.txt` 确认模式号（如 NTLM `-m 1000`、Kerberoast `-m 13100`）',
  },
  wpscan: {
    what: 'WordPress 漏洞与用户枚举扫描',
    install: '`apt install wpscan`；需要漏洞库时按提示 `wpscan --update`',
  },
  nikto: {
    what: 'Web 服务器配置与已知问题扫描',
    install: '`apt install nikto`',
  },
  whatweb: {
    what: 'Web 指纹识别（CMS/框架/中间件/版本）',
    install: '`apt install whatweb`',
  },
  amass: {
    what: '子域枚举与资产测绘（OWASP Amass）',
    install: '`apt install amass`；被动模式 `amass enum -passive -d <domain>`',
  },
  theharvester: {
    what: '公开源邮箱/子域/主机收集（theHarvester）',
    install: '`apt install theharvester`',
  },
  msfconsole: {
    what: 'Metasploit 框架（`exploit/multi/handler` 接收反弹 Shell、`web_delivery` 投递载荷）',
    install: '`apt install metasploit-framework`（提供 `msfconsole`）；首次用先 `msfdb init`',
  },
  searchsploit: {
    what: '本地 Exploit-DB 检索（按组件/版本找公开 POC）',
    install: '`apt install exploitdb`（提供 `searchsploit`）；更新库用 `searchsploit -u`',
  },
  proxychains4: {
    what: '把单条命令的 TCP 流量代理进内网（配合 socks5 隧道使用）',
    install: '`apt install proxychains4`；只用 `-f` 指向 `runs/` 下的临时配置（如 `proxychains4 -f runs/proxychains-1080.conf ...`），不要改 `/etc/proxychains4.conf`',
  },
  socat: {
    what: '全 TTY 反弹 Shell 监听 / 端口转发（比 nc 稳，可拿 PTY）',
    install: '`apt install socat`',
  },
  nc: {
    what: 'netcat：反弹 Shell 监听与连通性测试（`nc -lvnp <port>`）',
    install: '`apt install netcat-traditional`（提供 `nc`；Debian 系的 `netcat-openbsd` 也可）',
  },
  tmux: {
    what: '会话保持：监听与隧道必须跑在 tmux 里，否则 SSH 断开即丢',
    install: '`apt install tmux`；用法：`tmux new -s handler`、`tmux a -t handler`',
  },
  impacket: {
    what: 'Impacket 协议套件（PtH/PsExec/WMI/DCOM/Kerberos/凭据转储，Kali 自带 61 个 `impacket-*` 命令）',
    install: '`apt install python3-impacket`；常用命令 `impacket-wmiexec` / `impacket-psexec` / `impacket-secretsdump` / `impacket-GetNPUsers`',
  },
  enum4linux: {
    what: 'SMB/域环境信息枚举（用户、共享、组、密码策略）',
    install: '`apt install enum4linux`（新版另有 `enum4linux-ng`）',
  },
  'redis-cli': {
    what: 'Redis 客户端（未授权 Redis 的只读探测与写马）',
    install: '`apt install redis-tools`（提供 `redis-cli`）',
  },
  mysql: {
    what: 'MySQL/MariaDB 客户端（未授权/弱口令 MySQL 连库取数）',
    install: '`apt install default-mysql-client`（Kali 上是 `mariadb-client`）',
  },
}

/* ── 逐技能修法 ───────────────────────────────────────────────────────────── */

export const SKILL_FIXES = {
  'active-scan': '装扫描器：`apt install nmap masscan`；`toolkit/naabu/naabu` 缺就跑 `' + SETUP + '`。'
    + '非 root 时 naabu 加 `-scan-type c`，nmap/masscan 的 SYN 扫描必须 `sudo`；开扫前先确认目标在授权范围内。',

  'asset-correlation': '纯落库/关联技能，不依赖外部工具也不读环境变量；不可用一般是技能文件缺失或插件版本旧 —— '
    + '重新安装 redteam 插件后重启 `dsh web`，再确认 `redteam_asset_link` 工具可用。',

  'browser-automation': '装浏览器：`apt install chromium`（或 `google-chrome-stable`）；playwright 路线再 `npx playwright install chromium`。'
    + '调用时务必加 `--browser chromium`（默认走 chrome 通道会报 `Chromium distribution \'chrome\' is not found`）。',

  'chisel-tunnel': '补二进制 `toolkit/chisel/chisel`：跑 `' + SETUP + '`。\n'
    + '隧道两端要用 VPS：确认 `$DSH_HOME/.env` 里有 `REDTEAM_VPS_HOST` / `REDTEAM_VPS_USER` / `REDTEAM_VPS_KEY`，'
    + '命令前 `set -a; . "$DSH_HOME/.env"; set +a`；改完 `.env` 必须重启 `dsh web`，安全组记得放行隧道端口。',

  'cn-proxy-pool': '只依赖 `curl` / `python3`（缺就 `apt install curl`）；不可用多为技能文件缺失 —— 重新安装插件后重启 `dsh web`。'
    + '代理只在单条命令上用 `-proxy` / `-x` / `--proxy` 指定，不要动本机系统代理或 `/etc/proxychains4.conf`。',

  'credential-attack': '`apt install hydra hashcat john`；字典用 `sudo apt install wordlists` 后 `gunzip /usr/share/wordlists/rockyou.txt.gz`。'
    + '本机无 GPU 时 `hashcat` 很慢，优先小字典 + 规则（`-r /usr/share/hashcat/rules/best64.rule`）。',

  'dir-bruteforce': '`apt install feroxbuster ffuf gobuster`；`toolkit/dirsearch/dirsearch` 不在 setup.sh 的下载清单里 —— '
    + '从 maurosoria/dirsearch 的 GitHub releases 取源码放到 `$DSH_HOME/redteam/toolkit/dirsearch/` 并保证可执行。',

  'fofa-recon': '配 `FOFA_KEY`：<https://fofa.info> 登录 → 个人中心 → API Key。\n'
    + '写进 `$DSH_HOME/.env`（`FOFA_KEY=你的key`，`chmod 600`）或临时 `export FOFA_KEY=…`，然后重启 `dsh web` 才在本进程生效；'
    + '自测 `curl -s "https://fofa.info/api/v1/info/my?key=$FOFA_KEY"` 要返回 `"error":false`。\n'
    + '也可以直接跑 `' + SETUP + '`，由脚本代写并当场校验。',

  'frp-tunnel': '补 `toolkit/frp/frps`、`toolkit/frp/frpc`：跑 `' + SETUP + '`（一次解出两个二进制）。\n'
    + 'VPS 侧要 `REDTEAM_VPS_HOST` / `REDTEAM_VPS_KEY`（`$DSH_HOME/.env`），命令前 `set -a; . "$DSH_HOME/.env"; set +a`，'
    + '改完重启 `dsh web`，并在云安全组放行 frps 监听端口。',

  'fscan-intranet': '补 `toolkit/fscan/fscan`：跑 `' + SETUP + '`；若只下到 `fscan.zip`，手动解压出 `fscan` 并 `chmod +x`。\n'
    + '技能正文里的 `<你的VPS_IP>` 是占位符：在 `$DSH_HOME/.env` 写 `REDTEAM_VPS_HOST=<真实IP>` 后重启 `dsh web`，'
    + '或直接编辑 `$DSH_HOME/skills/fscan-intranet.md` 把 `<你的VPS_IP>` 换成真实地址（载荷服务：VPS 上跑 `vps.sh serve 9100`）。',

  'gogo-intranet': '`gogo` setup.sh 不自动下载：从 chainreactors/gogo 的 GitHub releases 按平台取二进制，'
    + '放到 `$DSH_HOME/redteam/toolkit/gogo/gogo`（Windows/arm64 变体放同目录）并 `chmod +x`。\n'
    + '`<你的VPS_IP>` 占位符按 `fscan-intranet` 的办法填：`.env` 里写 `REDTEAM_VPS_HOST` 后重启 `dsh web`，'
    + '或直接编辑 `$DSH_HOME/skills/gogo-intranet.md` 替换占位符。',

  'kimi-webbridge': '浏览器扩展 + 启动器两件事：扩展由企业策略从 Chrome 应用商店自动安装（ID `fldmhceldgbpfpkbgopacenieobmligc`），'
    + 'Chrome 137+ 不要再走 `--load-extension`；没有 Chrome/Chromium 就先 `apt install chromium` 或装 `google-chrome-stable`。\n'
    + '建启动器 `~/.local/bin/kimi-chrome`（默认起 `/usr/bin/google-chrome`，`KIMI_BROWSER=chromium` 切 Chromium）并 `chmod +x`；'
    + '守护进程用 `sudo systemctl enable --now kimi-webbridge` 拉起。\n'
    + '`curl -s http://127.0.0.1:10086/status` 里 `extension_connected` 为 `false` 时，先开浏览器（`kimi-chrome`）再查。',

  'lateral-movement': '`apt install python3-impacket enum4linux smbclient`（Kali 自带 61 个 `/usr/bin/impacket-*`）；离线破解 `apt install hashcat`。'
    + '内网目标的所有命令都要走隧道：`proxychains4 -f runs/proxychains-<port>.conf ...`，不要改系统 `proxychains` 配置。',

  'nuclei-scan': '`apt install nuclei`；模板库 `~/.local/nuclei-templates` 缺了就 `nuclei -update-templates`（跑 `' + SETUP + '` 也会装）。'
    + '更新后先 `nuclei -tl` 确认模板库没坏，模板数少于 1000 说明没下全。',

  'passive-recon': '只依赖 `curl` / `dig` / `jq`：`apt install curl dnsutils jq`；本技能不需要任何 API key。'
    + '不可用一般是技能文件缺失或插件版本旧 —— 重新安装插件后重启 `dsh web`。',

  'recon-pipeline': '一次补齐工具箱：跑 `' + SETUP + '`（subfinder / dnsx / naabu / httpx / ksubdomain 都在里面）。\n'
    + '`~/.local/bin/pd-httpx` 是指向 `toolkit/httpx/httpx` 的包装脚本，缺了就按 `TOOL_FIXES["pd-httpx"]` 重建；'
    + 'OneForAll 装不上不影响主线，用 subfinder + ksubdomain 替代。',

  'redteam-setup': '环境脚本在 `$DSH_HOME/redteam/setup.sh`；没有这个文件说明是 npm 版，去项目 GitHub Release 下载 '
    + '`dsh-redteam-mode-<版本>-toolkit.tar.gz`，解压后由用户自己执行其中的 README 步骤。\n'
    + '配完 `FOFA_KEY` 与 VPS 后重启 `dsh web`，并写完成标记：`mkdir -p "$DSH_HOME/redteam" && date -Is > "$DSH_HOME/redteam/.setup-complete"`，最后再跑一次 `redteam_preflight` 复核。',

  'shell-handler': '本机监听工具：`apt install netcat-traditional socat tmux`（MSF 路线再加 `apt install metasploit-framework`）。\n'
    + 'VPS 变量从 `$DSH_HOME/.env` 读：命令前 `set -a; . "$DSH_HOME/.env"; set +a`；缺 `REDTEAM_VPS_HOST` 就跑 `' + SETUP + '` 补，'
    + '改完 `.env` 必须重启 `dsh web`。监听一律放 tmux 里，别让 SSH 断开把会话带走。',

  'suo5-tunnel': '补 `toolkit/suo5/suo5-linux-amd64`：跑 `' + SETUP + '`（或从 zema1/suo5 的 GitHub releases 取同名二进制）并 `chmod +x`。\n'
    + '隧道出口/中转依赖 VPS：`$DSH_HOME/.env` 里配 `REDTEAM_VPS_HOST` / `REDTEAM_VPS_KEY` 后重启 `dsh web`；'
    + '隧道入口的 WebShell 必须是冰蝎马/哥斯拉马（见技能 `webshell-toolkit`），否则用户无法复用。',

  'unauth-exploit': '装客户端：`apt install redis-tools default-mysql-client python3-impacket`（MSSQL 用 `impacket-mssqlclient`）。\n'
    + '内网目标要隧道：`apt install proxychains4` 后用 `-f runs/proxychains-<port>.conf`，或先按技能 `suo5-tunnel` 建好 socks5；'
    + '`REDTEAM_VPS_HOST` 没配时依赖 VPS 的步骤会被判不可用。',

  'vps-reverse-shell': '填 VPS：跑 `' + SETUP + '` 引导写入 `REDTEAM_VPS_HOST`（`用户@主机`）与 `REDTEAM_VPS_KEY`（私钥路径，默认 `$DSH_HOME/redteam/toolkit/vps/id_rsa`）。\n'
    + '也可以手动写 `$DSH_HOME/.env` 后重启 `dsh web`，或直接编辑 `$DSH_HOME/skills/vps-reverse-shell.md`，把 `<你的VPS_IP>` / `<VPS 主机名>` 换成真实地址。\n'
    + '私钥必须 `chmod 600`，连通性用 `ssh -i $DSH_HOME/redteam/toolkit/vps/id_rsa -o BatchMode=yes <user>@<ip> \'echo ok\'` 验；安全组放行 22 与 9000-9999。',

  'web-fingerprint': '`~/.local/bin/pd-httpx` 缺了就按 `TOOL_FIXES["pd-httpx"]` 重建（它 exec `toolkit/httpx/httpx`）；'
    + '`nuclei` 缺就 `apt install nuclei`，技术识别模板库用 `nuclei -update-templates` 补。',

  'webshell-toolkit': '`toolkit/Behinder`、`toolkit/Godzilla`、`toolkit/AntSword` 不在 setup.sh 里，也不在' + TOOLKIT_TARBALL + '：'
    + '到各自的发布页自行取，放到对应目录。\n'
    + 'GUI 需要 Java 与图形会话：`java -version` 确认（缺就 `apt install openjdk-17-jre`）、`DISPLAY=:10.0`；'
    + '无 GUI 时用 `sed` 换密钥直接生成冰蝎马（模板在 `toolkit/Behinder/server/`）。',
}

/* ── 内部工具 ─────────────────────────────────────────────────────────────── */

/** 常见扩展名（`fscan_windows_x64.exe`、`vps.sh`、`godzilla.jar` …）。 */
const EXT_RE = /\.(exe|zip|tar\.gz|tgz|gz|bz2|xz|jar|sh|py|bin|txt|md|json)$/i
/** 平台后缀（`_windows_x64`、`-linux-amd64`、`_darwin_arm64` …）。 */
const PLATFORM_RE = /[-_](windows|win32|win64|win|linux|darwin|macos|osx|freebsd)[-_][a-z0-9_.]+$/
/** 架构后缀（裸的 `_amd64` / `-arm64`）。 */
const ARCH_RE = /[-_](amd64|x86_64|x64|arm64|aarch64|arm|386|i386|i686|mips[a-z0-9]*)$/

/**
 * 把二进制/目录名字清成工具名：剥扩展名、剥平台与架构后缀、转小写。
 * 清完不含 ASCII 字母（例如 `清单.md`、纯符号）就返回 null —— 那就不是工具名。
 */
function cleanToolName(raw) {
  let out = String(raw == null ? '' : raw).trim()
  if (out === '') return null
  out = out.replace(EXT_RE, '')
  let prev = ''
  while (out !== '' && out !== prev) {
    prev = out
    out = out.replace(PLATFORM_RE, '').replace(ARCH_RE, '')
  }
  out = out.toLowerCase()
  return /[a-z]/.test(out) ? out : null
}

/**
 * 从路径里抽工具名（抽不出来返回 `null`）。
 *   · `…/redteam/toolkit/<工具>/…` → `toolkit/` 之后的第一段目录名（`suo5-linux-amd64` → `suo5`）
 *   · `~/.local/bin/xxx`、`/usr/bin/xxx`、`~/.local/xxx` → 文件名
 *   · 裸名字（`fscan_windows_x64.exe`、`gogo_linux_arm64`）→ 剥平台后缀后的名字
 *   · 其它路径（`/usr/share/wordlists/rockyou.txt`、`skills/x.md`）→ `null`
 */
export function toolNameOfPath(p) {
  if (typeof p !== 'string') return null
  const s = p.trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[，。；、：,;:)\]}>）】]+$/, '')
    .replace(/\\/g, '/')
  if (s === '') return null
  let candidate = null
  const at = s.lastIndexOf('toolkit/')
  if (at !== -1) {
    candidate = s.slice(at + 'toolkit/'.length).split('/').filter((seg) => seg !== '')[0] || null
  } else if (/\/bin\//.test(s) || /(^|\/)\.local\//.test(s)) {
    const segs = s.split('/').filter((seg) => seg !== '')
    candidate = segs.length > 0 ? segs[segs.length - 1] : null
  } else if (!s.includes('/')) {
    candidate = s
  }
  return candidate === null ? null : cleanToolName(candidate)
}

/** 别名的规范化：`impacket-wmiexec` 这类命令归到 `impacket` 这一条修法上。 */
function canonicalTool(name) {
  const n = String(name || '')
  if (n.startsWith('impacket-')) return 'impacket'
  if (n.startsWith('enum4linux-')) return 'enum4linux'
  return n
}

/** 环境变量怎么拿（拿不准的就不编，直接让用户填值）。 */
const ENV_HINTS = {
  FOFA_KEY: '在 <https://fofa.info> 登录 → 个人中心 → API Key 取；自测 `curl -s "https://fofa.info/api/v1/info/my?key=$FOFA_KEY"` 返回 `"error":false` 即有效',
  REDTEAM_VPS_HOST: '填 VPS 登录地址 `用户@主机`（例如 `export REDTEAM_VPS_HOST=ubuntu@203.0.113.10`）',
  REDTEAM_VPS_USER: '填 VPS 登录用户（默认 `ubuntu`）',
  REDTEAM_VPS_KEY: '填 VPS 私钥路径（默认 `$DSH_HOME/redteam/toolkit/vps/id_rsa`，权限必须 `chmod 600`）',
}

function asArray(v) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim() !== '')
  if (typeof v === 'string' && v.trim() !== '') return [v]
  return []
}

/**
 * 由 `skill-availability.js` 的判定生成一条中文修复建议。
 *
 * @param issue - `{ kind, skill, paths?, env?, placeholder? }`，
 *   `kind` ∈ `'file-missing' | 'content-missing' | 'env-missing' | 'path-missing' | 'placeholder' | 'shadowed'`。
 *   也接受 `checkSkill()` 返回的 `problems` 之外的补充字段；字段类型宽松（字符串或数组都行）。
 * @returns 一条中文建议（不含换行；命令都在反引号里）。拿不准时回退到 `SKILL_FIXES[skill]`，再回退到通用建议。
 */
export function fixesForIssue(issue) {
  const it = issue && typeof issue === 'object' ? issue : {}
  const kind = typeof it.kind === 'string' ? it.kind : ''
  const skill = typeof it.skill === 'string' ? it.skill : ''
  const skillName = skill === '' ? '<技能名>' : skill
  const skillHint = skill !== '' && Object.prototype.hasOwnProperty.call(SKILL_FIXES, skill) ? SKILL_FIXES[skill] : ''
  const parts = []

  if (kind === 'path-missing') {
    const tools = []
    const seen = new Set()
    for (const p of asArray(it.paths)) {
      const name = toolNameOfPath(p)
      if (name === null) continue
      const canon = canonicalTool(name)
      if (seen.has(canon)) continue          // 同一个工具只列一次
      seen.add(canon)
      tools.push({ name, canon, path: p })
    }
    if (tools.length > 0) {
      const items = tools.map(({ name, canon, path }) => {
        const fix = Object.prototype.hasOwnProperty.call(TOOL_FIXES, canon) ? TOOL_FIXES[canon] : null
        if (fix === null) {
          return '`' + name + '`（' + path + '）：本机没有这个工具，跑 `' + SETUP + '` 补齐；'
            + '仍缺就从该工具官方发布页取对应平台二进制放到这个路径并 `chmod +x`'
        }
        return '`' + name + '`（' + path + '）：' + fix.what + '。修法：' + fix.install
      })
      parts.push('缺 ' + tools.length + ' 个工具，逐条修：' + items.join('；'))
      parts.push('拿不准就先统一跑 `' + SETUP + '`（幂等：缺的下载、损坏的删掉重下），再重新体检。')
    }
  } else if (kind === 'env-missing') {
    const names = asArray(it.env)
    if (names.length > 0) {
      const items = names.map((n) => {
        const hint = Object.prototype.hasOwnProperty.call(ENV_HINTS, n) ? ENV_HINTS[n] : '值由你自己提供'
        return '`' + n + '`：`export ' + n + '=<值>`（' + hint + '）'
      })
      parts.push('缺环境变量：' + items.join('；') + '。')
      parts.push('持久化：写进 `$DSH_HOME/.env`（一行一个 `NAME=值`，建议 `chmod 600`），改完必须重启 `dsh web` 当前进程才读得到；'
        + '或跑 `' + SETUP + '` 由脚本代写（`FOFA_KEY`、VPS 相关变量它都会引导并当场校验）。')
    }
  } else if (kind === 'placeholder') {
    const ph = typeof it.placeholder === 'string' && it.placeholder.trim() !== '' ? it.placeholder.trim() : '外部基础设施地址'
    parts.push('技能正文里 `' + ph + '` 还是占位符（说明本环境还没配 VPS）。')
    parts.push('填法：跑 `' + SETUP + '` 引导写入 `REDTEAM_VPS_HOST`（`用户@主机`）与 `REDTEAM_VPS_KEY`（私钥路径，默认 `$DSH_HOME/redteam/toolkit/vps/id_rsa`）；'
      + '也可手动写 `$DSH_HOME/.env` 后重启 `dsh web`，或直接编辑 `$DSH_HOME/skills/' + skillName + '.md`，把占位符替换成真实地址（私钥记得 `chmod 600`）。')
  } else if (kind === 'shadowed') {
    parts.push('技能被同名版本盖住了：`' + skillName + '` 在别的技能根里还有一份（配置更全）的同名技能，'
      + '但按当前技能根顺序加载的是排在前面那份不完整的。')
    parts.push('修法：把已配置的那个技能根排到技能根顺序的最前面（插件/技能目录设置里调整顺序），重启 `dsh web` 后重新体检；'
      + '不需要另一份的话把它删掉或改个名，避免再次盖住。')
  } else if (kind === 'file-missing') {
    parts.push('技能文件不存在：重新安装 redteam 插件（或把技能目录挂回技能根）覆盖技能文件，然后重启 `dsh web` 再体检一次。')
    parts.push('若是自己放的技能，确认文件在技能根下且文件名与技能名一致（`<技能名>.md`）。')
  } else if (kind === 'content-missing') {
    parts.push('技能正文读不到（只有元数据，判不了可用性）：重新安装 redteam 插件覆盖技能文件；'
      + '若是远端技能源，确认源可达后重新拉取，再重启 `dsh web`。')
    parts.push('临时要确认能不能用，直接让智能体用 `skill` 工具实际加载一次 `' + skillName + '`。')
  }

  if (parts.length === 0) parts.push(skillHint !== '' ? skillHint : GENERIC_FIX)
  return parts.join(' ')
}
