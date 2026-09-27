#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# 红队模式一键铺环境 —— 首次使用跑这一条就够
#
#   bash $DSH_HOME/redteam/setup.sh            # 交互式引导（推荐）
#   bash $DSH_HOME/redteam/setup.sh --yes      # 全自动，缺啥装啥（VPS/key 用已有值）
#   bash $DSH_HOME/redteam/setup.sh --check    # 只体检不安装（CI / 排障用）
#
# 做四件事：
#   ① 装工具：把红队技能用到的二进制补齐到 $DSH_HOME/redteam/toolkit/
#   ② 装技能：确认技能目录存在且可见（技能随包分发，这里只做体检与提示）
#   ③ 收配置：引导用户提供 FOFA_KEY（测绘）与 VPS 登录方式（反弹 Shell 落地）
#   ④ 验通道：实测载荷服务、模板库、二进制可执行性，最后写完成标记
#
# 设计原则：
#   · **幂等**：随时可重跑，已装的不重装（带 --force 才强制重下）
#   · **零依赖**：只用 curl / python3 / tar / unzip，Node 也不需要
#   · **不猜 URL**：一律走 GitHub releases/latest API 拿真实资产
#   · **不静默失败**：每一步都打印结论，最后给一份体检表
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
TK="$DSH_HOME/redteam/toolkit"
ENV_FILE="$DSH_HOME/.env"
MARKER="$DSH_HOME/redteam/.setup-complete"
LOG_DIR="$DSH_HOME/redteam"
LOG="$LOG_DIR/setup.log"
ASSUME_YES=0
CHECK_ONLY=0
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --yes|-y)   ASSUME_YES=1 ;;
    --check)    CHECK_ONLY=1 ;;
    --force)    FORCE=1 ;;
    -h|--help)  sed -n '2,20p' "$0"; exit 0 ;;
  esac
done

mkdir -p "$TK" "$LOG_DIR"

# ── 输出工具 ────────────────────────────────────────────────────────────────
C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
say()  { printf '%s\n' "$*" | tee -a "$LOG"; }

# 运行环境提醒：本脚本会往本机落 VPS 私钥、WebShell 马与扫描器，只应在演练专用环境里跑
if [ -z "${REDTEAM_NO_VM_WARN:-}" ]; then
  say ""
  say "⚠️  请在【专供演练的 Kali 虚拟机】里运行红队模式，不要跑在日常办公电脑/宿主机上："
  say "    · 本机会落 VPS 私钥、冰蝎/哥斯拉马与各类扫描器，安全软件/EDR 拦查会误伤日常环境；"
  say "    · 扫描与爆破流量会从你常用出口 IP 出去，影响正常上网与 IP 信誉；"
  say "    · 演练结束直接丢弃虚拟机最干净。（设置 REDTEAM_NO_VM_WARN=1 可跳过本提示）"
  say ""
fi
ok()   { say "  ${C_OK}✓${C_OFF} $*"; }
warn() { say "  ${C_WARN}!${C_OFF} $*"; }
bad()  { say "  ${C_ERR}✗${C_OFF} $*"; }
dim()  { say "  ${C_DIM}$*${C_OFF}"; }
head_() { say ""; say "── $* ──────────────────────────────────────────"; }

ask() { # ask <提示> <默认值>  → 回显用户输入（无 tty 或 --yes 时用默认值）
  local prompt="$1" def="${2:-}"
  if [ "$ASSUME_YES" = 1 ] || [ ! -t 0 ]; then printf '%s' "$def"; return; fi
  local ans
  printf '%s' "$prompt" > /dev/tty
  [ -n "$def" ] && printf ' [%s]' "$def" > /dev/tty
  printf ': ' > /dev/tty
  read -r ans < /dev/tty || ans=""
  printf '%s' "${ans:-$def}"
}

ask_secret() { # 不回显读取
  local prompt="$1"
  if [ "$ASSUME_YES" = 1 ] || [ ! -t 0 ]; then printf ''; return; fi
  local ans
  printf '%s: ' "$prompt" > /dev/tty
  read -rs ans < /dev/tty || ans=""
  printf '\n' > /dev/tty
  printf '%s' "$ans"
}

# ── 工具函数 ────────────────────────────────────────────────────────────────
have() { command -v "$1" >/dev/null 2>&1; }

gh_api() { # gh_api <repo> → 输出 releases/latest JSON（有 gh token 就用，配额高）
  local repo="$1" tok=""
  have gh && tok="$(gh auth token 2>/dev/null || true)"
  if [ -n "$tok" ]; then
    curl -s -m 30 -H "Authorization: Bearer $tok" "https://api.github.com/repos/$repo/releases/latest"
  else
    curl -s -m 30 "https://api.github.com/repos/$repo/releases/latest"
  fi
}

dl_asset() { # dl_asset <repo> <asset-regex> <输出路径> [可执行]
  local repo="$1" pat="$2" out="$3" chmod_x="${4:-1}"
  if [ -s "$out" ] && [ "$FORCE" != 1 ]; then ok "已存在 $(basename "$out")"; return 0; fi
  local json url name
  json="$(gh_api "$repo")"
  read -r name url <<<"$(printf '%s' "$json" | python3 -c "
import json,sys,re
pat=re.compile(sys.argv[1], re.I)
try: j=json.load(sys.stdin)
except Exception: sys.exit(1)
for a in j.get('assets') or []:
    if pat.search(a['name']): print(a['name'], a['browser_download_url']); break
" "$pat")"
  if [ -z "${url:-}" ]; then bad "$repo 无匹配资产（$pat）"; return 1; fi
  # API 声明的字节数：下载后必须一字不差，否则就是截断（静默损坏比下载失败更危险——
  # 文件存在、可执行位也在，运行时却什么都不做。gowitness 踩过：少 7MB，跑起来零输出零产物）
  local want
  want="$(printf '%s' "$json" | python3 -c "
import json,sys,re
pat=re.compile(sys.argv[1], re.I)
try: j=json.load(sys.stdin)
except Exception: sys.exit(0)
for a in j.get('assets') or []:
    if pat.search(a['name']): print(a.get('size') or 0); break
" "$pat")"
  dim "下载 $name（期望 ${want:-?} 字节）"
  if curl -sL --retry 3 --retry-delay 2 --fail -m 600 "$url" -o "$out"; then
    local got; got="$(stat -c%s "$out" 2>/dev/null || echo 0)"
    if [ -n "$want" ] && [ "$want" != "0" ] && [ "$got" != "$want" ]; then
      bad "$name 下载不完整：期望 $want 字节、实际 $got（截断），已删除，请重跑"
      rm -f "$out"; return 1
    fi
    [ "$chmod_x" = 1 ] && chmod +x "$out" 2>/dev/null
    ok "$name → $out（$got 字节，与官方一致）"
  else
    bad "$name 下载失败（curl 退出码 $?）"; return 1
  fi
}

untar_all() { # untar_all <tarfile> <目录> <期望的二进制名...> → 全解压后摊平到 <目录>/
  local tf="$1" dir="$2"; shift 2
  ( cd "$dir" && tar xzf "$tf" 2>/dev/null ) || { bad "$(basename "$tf") 解压失败"; return 1; }
  local name found sz
  for name in "$@"; do
    found="$(find "$dir" -maxdepth 3 -type f -name "$name" ! -name "*.tar.gz" 2>/dev/null | head -1)"
    if [ -n "$found" ]; then
      [ "$(dirname "$found")" != "$dir" ] && mv -f "$found" "$dir/$name"
      chmod +x "$dir/$name"
      sz="$(stat -c%s "$dir/$name" 2>/dev/null || echo 0)"
      # 冒烟测试：真跑一次版本/帮助，跑不起来（截断/.so 缺失）当场报出来
      if "$dir/$name" --version >/dev/null 2>&1 || "$dir/$name" -version >/dev/null 2>&1 \
         || "$dir/$name" -h >/dev/null 2>&1 || "$dir/$name" --help >/dev/null 2>&1; then
        ok "$name 就位（$sz 字节，冒烟测试通过）"
      else
        warn "$name 就位（$sz 字节）但冒烟测试无响应 —— 手动跑一次确认：$dir/$name --help"
      fi
    else
      bad "$name 未在包内找到"
    fi
  done
}

verify_bin() { # verify_bin <路径> → 能跑起来返回 0（截断的二进制在这里就被挡住）
  local p="$1"
  [ -x "$p" ] || return 1
  timeout 15 "$p" --version >/dev/null 2>&1 && return 0
  timeout 15 "$p" -version  >/dev/null 2>&1 && return 0
  timeout 15 "$p" -h        >/dev/null 2>&1 && return 0
  timeout 15 "$p" --help    >/dev/null 2>&1 && return 0
  timeout 15 "$p" version   >/dev/null 2>&1 && return 0
  return 1
}

# 安装前体检：文件在但跑不起来（截断/缺依赖）→ 删掉，让下面的安装分支重新下载。
# 为什么必须这样：先前只判"文件是否可执行"，一个被截断的二进制（文件在、权限也对、
# 运行却零输出）会一直留在盘上；而脚本还提示"重跑加 --force"，实际 --force 又不重下，
# 提示与行为不一致 → 用户按提示做也修不好。改成"坏文件自动清掉再装"，重跑一次即自愈。
doctor() { # doctor <路径> <名字>
  if [ -e "$1" ] && ! verify_bin "$1"; then
    warn "$2 已损坏或截断（跑不起来），删除后重新下载"
    rm -f "$1"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
head_ "红队模式环境体检 $(date '+%F %T')"
say "DSH_HOME = $DSH_HOME"
say "工具箱   = $TK"

# ═══ ① 工具安装 ════════════════════════════════════════════════════════════
head_ "① 安装工具（缺失的才下）"

# --- 已在 PATH 的系统工具（Kali 自带，只体检） ---
PATHD="nmap masscan nuclei sqlmap ffuf feroxbuster gobuster hydra john hashcat wpscan nikto whatweb amass theHarvester msfconsole searchsploit proxychains4 socat nc tmux"
MISSING_PATH=""
for t in $PATHD; do have "$t" || MISSING_PATH="$MISSING_PATH $t"; done
if [ -n "$MISSING_PATH" ]; then
  warn "PATH 缺少：$MISSING_PATH"
  dim "这些多为 Kali 自带包，用 apt 补：sudo apt install -y$MISSING_PATH"
else
  ok "PATH 系统工具齐全（nmap/masscan/nuclei/sqlmap/ffuf/feroxbuster/gobuster/hydra/hashcat/john/wpscan/nikto/whatweb/msfconsole…）"
fi

# --- 工具箱二进制（随包/下载） ---
declare -A BIN=(
  [fscan]="$TK/fscan/fscan"
  [gogo]="$TK/gogo/gogo"
  [suo5]="$TK/suo5/suo5-linux-amd64"
  [chisel]="$TK/chisel/chisel"
  [frpc]="$TK/frp/frpc"
  [frps]="$TK/frp/frps"
  [subfinder]="$TK/subfinder/subfinder"
  [dnsx]="$TK/dnsx/dnsx"
  [naabu]="$TK/naabu/naabu"
  [httpx]="$TK/httpx/httpx"
  [ksubdomain]="$TK/ksubdomain/ksubdomain"
  [ligolo-proxy]="$TK/ligolo/proxy"
  [ligolo-agent]="$TK/ligolo/agent"
  [gowitness]="$TK/gowitness/gowitness"
)

if [ "$CHECK_ONLY" != 1 ]; then
  # fscan / gogo（内网渗透主力，国内工具，走 GitHub release）
  doctor "${BIN[fscan]}" fscan
  [ -x "${BIN[fscan]}" ] || { mkdir -p "$TK/fscan"; dl_asset "shadow1ng/fscan" "fscan_linux_amd64|linux_amd64.*\.(zip|tar\.gz)$" "$TK/fscan/fscan.zip" 0; }
  [ -x "${BIN[gogo]}" ] || dim "gogo 需从 https://github.com/chainreactors/gogo/releases 手动取（无标准命名资产）"

  # suo5（WebShell 隧道核心）
  doctor "${BIN[suo5]}" suo5
  [ -x "${BIN[suo5]}" ] || { mkdir -p "$TK/suo5"; dl_asset "zema1/suo5" "suo5-linux-amd64" "${BIN[suo5]}"; }

  # chisel
  doctor "${BIN[chisel]}" chisel
  if [ ! -x "${BIN[chisel]}" ]; then
    mkdir -p "$TK/chisel"
    dl_asset "jpillora/chisel" "chisel_.*linux_amd64\.gz$" "$TK/chisel/chisel.gz" 0 && gunzip -f "$TK/chisel/chisel.gz" && mv -f "$TK/chisel/chisel" "${BIN[chisel]}" && chmod +x "${BIN[chisel]}"
  fi

  # frp（frpc + frps，同一个 release 包内）
  doctor "${BIN[frpc]}" frpc; doctor "${BIN[frps]}" frps
  if [ ! -x "${BIN[frpc]}" ] || [ ! -x "${BIN[frps]}" ]; then
    mkdir -p "$TK/frp"
    dl_asset "fatedier/frp" "linux_amd64\.tar\.gz$" "$TK/frp/frp.tar.gz" 0 \
      && untar_all "$TK/frp/frp.tar.gz" "$TK/frp" frpc frps
  fi

  # ProjectDiscovery 三件套
  doctor "${BIN[subfinder]}" subfinder
  [ -x "${BIN[subfinder]}" ] || { mkdir -p "$TK/subfinder"; dl_asset "projectdiscovery/subfinder" "linux_amd64\.zip$" "$TK/subfinder/s.zip" 0 && python3 -c "import zipfile;zipfile.ZipFile('$TK/subfinder/s.zip').extractall('$TK/subfinder')" && chmod +x "${BIN[subfinder]}"; }
  doctor "${BIN[dnsx]}" dnsx
  [ -x "${BIN[dnsx]}" ]      || { mkdir -p "$TK/dnsx";      dl_asset "projectdiscovery/dnsx"      "linux_amd64\.zip$" "$TK/dnsx/d.zip" 0      && python3 -c "import zipfile;zipfile.ZipFile('$TK/dnsx/d.zip').extractall('$TK/dnsx')"           && chmod +x "${BIN[dnsx]}"; }
  doctor "${BIN[naabu]}" naabu
  [ -x "${BIN[naabu]}" ]     || { mkdir -p "$TK/naabu";     dl_asset "projectdiscovery/naabu"     "linux_amd64\.zip$" "$TK/naabu/n.zip" 0     && python3 -c "import zipfile;zipfile.ZipFile('$TK/naabu/n.zip').extractall('$TK/naabu')"         && chmod +x "${BIN[naabu]}"; }
  doctor "${BIN[httpx]}" httpx
  [ -x "${BIN[httpx]}" ]     || { mkdir -p "$TK/httpx";     dl_asset "projectdiscovery/httpx"     "linux_amd64\.zip$" "$TK/httpx/h.zip" 0     && python3 -c "import zipfile;zipfile.ZipFile('$TK/httpx/h.zip').extractall('$TK/httpx')"         && chmod +x "${BIN[httpx]}"; }

  # ksubdomain（无状态子域爆破）
  doctor "${BIN[ksubdomain]}" ksubdomain
  [ -x "${BIN[ksubdomain]}" ] || { mkdir -p "$TK/ksubdomain"; dl_asset "knownsec/ksubdomain" "linux.*\.zip$" "$TK/ksubdomain/k.zip" 0 && python3 -c "import zipfile;zipfile.ZipFile('$TK/ksubdomain/k.zip').extractall('$TK/ksubdomain')" && chmod +x "${BIN[ksubdomain]}"; }

  # ligolo-ng（TUN 隧道备选）
  doctor "${BIN[ligolo-proxy]}" ligolo-proxy; doctor "${BIN[ligolo-agent]}" ligolo-agent
  if [ ! -x "${BIN[ligolo-proxy]}" ] || [ ! -x "${BIN[ligolo-agent]}" ]; then
    mkdir -p "$TK/ligolo"
    dl_asset "nicocha30/ligolo-ng" "proxy_.*linux_amd64\.tar\.gz$" "$TK/ligolo/proxy.tar.gz" 0 \
      && untar_all "$TK/ligolo/proxy.tar.gz" "$TK/ligolo" proxy
    dl_asset "nicocha30/ligolo-ng" "agent_.*linux_amd64\.tar\.gz$" "$TK/ligolo/agent.tar.gz" 0 \
      && untar_all "$TK/ligolo/agent.tar.gz" "$TK/ligolo" agent
  fi

  # gowitness（批量截图留证）
  doctor "${BIN[gowitness]}" gowitness
  [ -x "${BIN[gowitness]}" ] || { mkdir -p "$TK/gowitness"; dl_asset "sensepost/gowitness" "gowitness-[0-9.]+-linux-amd64$" "${BIN[gowitness]}"; }

  # OneForAll（子域收集，源码 + venv）
  OF_DIR="$TK/oneforall/OneForAll-0.4.5"
  if [ ! -f "$OF_DIR/oneforall.py" ]; then
    mkdir -p "$TK/oneforall"
    dim "下载 OneForAll 源码 v0.4.5"
    curl -sL --retry 3 -m 300 "https://github.com/shmilylty/OneForAll/archive/refs/tags/v0.4.5.tar.gz" -o "$TK/oneforall/of.tar.gz" \
      && python3 -c "import tarfile;tarfile.open('$TK/oneforall/of.tar.gz').extractall('$TK/oneforall')" 2>/dev/null \
      && ok "OneForAll 源码就位" || bad "OneForAll 源码下载失败"
  else
    ok "OneForAll 源码已存在"
  fi
  # venv 依赖（首次约 1-2 分钟）
  if [ -f "$OF_DIR/oneforall.py" ] && [ ! -x "$OF_DIR/.venv/bin/python" ]; then
    dim "为 OneForAll 建 venv 并装依赖（约 1-2 分钟）"
    ( cd "$OF_DIR" && python3 -m venv .venv >/dev/null 2>&1 \
      && .venv/bin/python -m pip install -q --no-cache-dir --upgrade pip setuptools wheel >/dev/null 2>&1 \
      && .venv/bin/python -m pip install -q --no-cache-dir requests exrex fire beautifulsoup4 dnspython loguru tqdm PySocks tenacity termcolor treelib colorama future "SQLAlchemy<2" >/dev/null 2>&1 ) \
      && ok "OneForAll 依赖就绪" || warn "OneForAll 依赖安装失败（子域收集改用 subfinder + ksubdomain 替代）"
  elif [ -x "$OF_DIR/.venv/bin/python" ]; then
    ok "OneForAll venv 已存在"
  fi
else
  dim "--check 模式：跳过安装"
fi

# ═══ ② nuclei 模板 ═════════════════════════════════════════════════════════
head_ "② nuclei 模板库"
NT="$HOME/.local/nuclei-templates"
if [ -d "$NT" ]; then
  NTC="$(find "$NT" -name '*.yaml' 2>/dev/null | wc -l | tr -d ' ')"
  ok "模板库就位：$NT（$NTC 个模板）"
  [ "$NTC" -lt 1000 ] && warn "模板数偏少，跑一次：nuclei -update-templates"
elif have nuclei; then
  if [ "$CHECK_ONLY" != 1 ]; then
    dim "首次更新模板库（约 100MB，1-3 分钟）"
    nuclei -update-templates >/dev/null 2>&1 && ok "模板库安装完成（$NT）" || bad "模板更新失败，稍后手动跑：nuclei -update-templates"
  else
    warn "模板库不存在（跑 nuclei -update-templates）"
  fi
else
  warn "未安装 nuclei，跳过"
fi

# ═══ ③ 配置：FOFA_KEY 与 VPS ══════════════════════════════════════════════
head_ "③ 配置（FOFA 测绘 key + VPS 登录方式）"

# 已有值（环境变量优先，其次 .env 文件）
cur_env() { # cur_env <NAME> → 输出当前生效值（变量未设时不报错）
  local n="$1" v=""
  v="${!n-}"                                   # 必须带 - ：set -u 下未定义变量会直接中断
  [ -n "$v" ] && { printf '%s' "$v"; return; }
  [ -f "$ENV_FILE" ] && grep -E "^${n}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'
}
env_set() { # env_set <NAME> <VALUE> → 写/更新 $DSH_HOME/.env，权限 600
  local n="$1" v="$2"
  mkdir -p "$(dirname "$ENV_FILE")"; touch "$ENV_FILE"; chmod 600 "$ENV_FILE"
  if grep -qE "^${n}=" "$ENV_FILE" 2>/dev/null; then
    python3 - "$ENV_FILE" "$n" "$v" <<'PY'
import sys
path, name, value = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path, encoding='utf-8').read().splitlines()
out, done = [], False
for line in lines:
    if line.startswith(name + '='):
        out.append(f'{name}={value}'); done = True
    else:
        out.append(line)
if not done: out.append(f'{name}={value}')
open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
PY
  else
    printf '%s=%s\n' "$n" "$v" >> "$ENV_FILE"
  fi
}

# --- FOFA_KEY ---
FOFA_NOW="$(cur_env FOFA_KEY)"
if [ -n "$FOFA_NOW" ]; then
  ok "FOFA_KEY 已配置（${FOFA_NOW:0:4}…${FOFA_NOW: -4}，长度 ${#FOFA_NOW}）"
  dim "来源：$([ -n "${FOFA_KEY:-}" ] && echo '环境变量' || echo "$ENV_FILE")"
  if [ "$CHECK_ONLY" != 1 ] && [ "$ASSUME_YES" != 1 ]; then
    NEW="$(ask_secret '更新 FOFA_KEY（直接回车保留现有）')"
    [ -n "$NEW" ] && env_set FOFA_KEY "$NEW" && ok "FOFA_KEY 已更新"
  fi
else
  warn "FOFA_KEY 未配置 —— 资产测绘（fofa-recon 技能）将降级"
  dim "获取：https://fofa.info 登录 → 个人中心 → API Key（个人版 10,000 次/月，1 秒 1 次）"
  dim "降级替代：crt.sh 证书透明 + subfinder/ksubdomain + 被动 DNS（技能 passive-recon / recon-pipeline）"
  if [ "$CHECK_ONLY" != 1 ]; then
    NEW="$(ask_secret '粘贴 FOFA_KEY（留空则跳过，稍后可用 setup.sh 再配）')"
    if [ -n "$NEW" ]; then
      env_set FOFA_KEY "$NEW"; ok "FOFA_KEY 已写入 $ENV_FILE（重启 dsh web 后生效）"
      # 立刻验一次有效性
      RESP="$(curl -s -m 20 "https://fofa.info/api/v1/info/my?key=$NEW" 2>/dev/null)"
      if printf '%s' "$RESP" | grep -q '"error":false'; then
        ok "FOFA_KEY 校验通过"
      else
        warn "FOFA_KEY 校验未通过：$(printf '%s' "$RESP" | head -c 120)"
      fi
    else
      warn "已跳过 FOFA_KEY（测绘能力降级，可随时重跑本脚本补）"
    fi
  fi
fi

# --- VPS（反弹 Shell 落地与中转） ---
VPS_KEY_NOW="$(cur_env REDTEAM_VPS_KEY)";   VPS_KEY_NOW="${VPS_KEY_NOW:-$TK/vps/id_rsa}"
VPS_HOST_NOW="$(cur_env REDTEAM_VPS_HOST)"
VPS_USER_NOW="$(cur_env REDTEAM_VPS_USER)"; VPS_USER_NOW="${VPS_USER_NOW:-ubuntu}"
say ""
if [ -f "$VPS_KEY_NOW" ]; then
  # 主机地址没配时（只有私钥、没有 user@host），技能里的 $REDTEAM_VPS_HOST 会解析成空
  # —— 必须在这里补问，否则"看起来配好了"但命令跑不通。
  if [ -z "$VPS_HOST_NOW" ]; then
    warn "有私钥但没有 VPS 地址（REDTEAM_VPS_HOST 未设）—— 技能里的 \$REDTEAM_VPS_HOST 会是空的"
    if [ "$CHECK_ONLY" != 1 ]; then
      ANS="$(ask 'VPS 主机地址（只填 IP 或域名，用户名默认 '"$VPS_USER_NOW"')' '')"
      if [ -n "$ANS" ]; then
        env_set REDTEAM_VPS_HOST "$ANS"; env_set REDTEAM_VPS_USER "$VPS_USER_NOW"
        VPS_HOST_NOW="$ANS"; ok "VPS 地址已写入 $ENV_FILE：$VPS_USER_NOW@$VPS_HOST_NOW"
      else
        warn "已跳过 —— 反弹 Shell / 载荷投递类技能会显示不可用"
      fi
    fi
  fi
fi
if [ -f "$VPS_KEY_NOW" ] && [ -n "$VPS_HOST_NOW" ]; then
  ok "VPS 登录方式已就绪：$VPS_USER_NOW@$VPS_HOST_NOW（私钥 $VPS_KEY_NOW）"
  if ssh -i "$VPS_KEY_NOW" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8 "$VPS_USER_NOW@$VPS_HOST_NOW" 'echo ok' >/dev/null 2>&1; then
    ok "VPS SSH 连通性正常"
  else
    warn "VPS SSH 连不上 —— 反弹 Shell 与载荷投递会失败"
    dim "排查：私钥权限（chmod 600）、安全组 22 端口、用户名是否正确"
  fi
elif [ ! -f "$VPS_KEY_NOW" ]; then
  warn "未找到 VPS 私钥（$VPS_KEY_NOW）—— 反弹 Shell 落地能力不可用"
  dim "需要一台公网 VPS（用于接收反弹 Shell、中转载荷、做隧道出口）"
  if [ "$CHECK_ONLY" != 1 ]; then
    NEW_HOST="$(ask 'VPS 登录地址（user@ip）' 'ubuntu@')"
    NEW_KEY="$(ask 'VPS 私钥路径' "$TK/vps/id_rsa")"
    if [ -n "$NEW_HOST" ] && [ -f "$NEW_KEY" ]; then
      env_set REDTEAM_VPS_HOST "$NEW_HOST"; env_set REDTEAM_VPS_KEY "$NEW_KEY"
      ok "VPS 登录方式已记录（$NEW_HOST）"
      dim "把私钥放到 $NEW_KEY 并 chmod 600；或告知我们由你手动配置"
    else
      warn "已跳过 VPS 配置（无 VPS 时只能做不需要落地的成果：账号、数据、未授权）"
    fi
  fi
else
  warn "有私钥但 VPS 地址仍为空（REDTEAM_VPS_HOST 未设）—— 反弹 Shell / 载荷投递类技能会判为不可用"
  dim "补配：在 $ENV_FILE 里写 REDTEAM_VPS_HOST=<IP 或域名> 与 REDTEAM_VPS_USER=<登录用户>"
fi

# 环境变量生效提示
if [ ! -f "$ENV_FILE" ] || ! grep -q 'FOFA_KEY' "$ENV_FILE" 2>/dev/null; then
  dim "提示：$ENV_FILE 由 dsh web 启动时加载；改完需重启 dsh web 才在本进程生效"
fi

# ═══ ④ 体检表 ══════════════════════════════════════════════════════════════
head_ "④ 体检（二进制可执行性）"
FAILED=""; WEAK=""
for name in "${!BIN[@]}"; do
  p="${BIN[$name]}"
  if [ ! -x "$p" ]; then bad "$name 缺失（$p）"; FAILED="$FAILED $name"; continue; fi
  # 光有可执行位不算通过：真跑一次 --version/-version/-h，防止"截断的二进制"混过去
  if timeout 15 "$p" --version >/dev/null 2>&1 || timeout 15 "$p" -version >/dev/null 2>&1 \
     || timeout 15 "$p" -h >/dev/null 2>&1 || timeout 15 "$p" --help >/dev/null 2>&1 \
     || timeout 15 "$p" version >/dev/null 2>&1; then
    ok "$name（$(stat -c%s "$p") 字节，冒烟通过）"
  else
    warn "$name 存在但无响应（可能截断/缺依赖）—— 重跑本脚本加 --force 重下"
    WEAK="$WEAK $name"
  fi
done
[ -f "$TK/oneforall/OneForAll-0.4.5/oneforall.py" ] && ok "oneforall（源码）" || warn "oneforall（未装，可用 subfinder+ksubdomain 替代）"
[ -d "$TK/Behinder" ] && ok "Behinder 冰蝎（WebShell 交付）" || warn "Behinder 未就位"
[ -d "$TK/Godzilla" ] && ok "Godzilla 哥斯拉（WebShell 交付）" || warn "Godzilla 未就位"
[ -d "$TK/AntSword" ] && ok "AntSword 蚁剑" || dim "AntSword 未就位（可选）"

# ═══ ⑤ 完成标记 ════════════════════════════════════════════════════════════
head_ "总结"
if [ -n "$FAILED" ]; then
  warn "以下工具缺失，相关技能会降级：$FAILED"
elif [ -n "$WEAK" ]; then
  warn "以下工具存在但冒烟未通过（重跑本脚本加 --force 重下）：$WEAK"
else
  ok "工具箱完整（全部二进制冒烟通过）"
fi

if [ "$CHECK_ONLY" != 1 ]; then
  {
    echo "# 红队模式环境完成标记 —— 由 setup.sh 写入"
    echo "completed_at=$(date -Iseconds)"
    echo "dsh_home=$DSH_HOME"
    echo "toolkit=$TK"
    echo "missing_tools=${FAILED:-none}"
    echo "fofa_key=$([ -n "$(cur_env FOFA_KEY)" ] && echo configured || echo missing)"
    echo "vps=$([ -f "$VPS_KEY_NOW" ] && echo configured || echo missing)"
  } > "$MARKER"
  ok "已写完成标记：$MARKER"
  dim "智能体在 preflight 里会读它来确认环境已就绪"
fi

say ""
say "下一步："
say "  1) 若刚改了 $ENV_FILE（FOFA_KEY / VPS），重启 dsh web 让本进程读到新值"
say "  2) 进红队模式，指挥智能体第一个动作会跑 redteam_preflight 复核"
say "  3) 直接给靶标单位名开工"
say ""
say "日志：$LOG"
exit 0
