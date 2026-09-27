---
name: browser-automation
description: 无依赖驱动 Chrome/Chromium 抓取 JS 渲染页面、截图、执行 JS、抓接口清单（headless 兜底 + playwright-cli）
whenToUse: 需要渲染 SPA / 取 JS 生成的内容 / 截图留证 / 批量抓页面时（Kimi 扩展不可用时首选）
role: recon
enabled: true
---

# 浏览器自动化（headless Chrome）

本机：`/usr/bin/chromium` 150.0.7871.181，`DISPLAY=:10.0`，Node v22.23.2。

## 一、零依赖：chromium 命令行（最稳）
```bash
CHROME=/usr/bin/chromium
FLAGS="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --virtual-time-budget=8000"

# 1) 抓渲染后的 DOM（SPA 也能拿到内容）
$CHROME $FLAGS --dump-dom "https://target.example.com/" 2>/dev/null > runs/page.html

# 2) 只取纯文本
$CHROME $FLAGS --dump-dom "https://target.example.com/" 2>/dev/null \
  | python3 -c "import sys,re;h=sys.stdin.read();print(re.sub(r'<[^>]+>',' ',re.sub(r'(?is)<(script|style).*?</\1>',' ',h)))" | head -200

# 3) 截图留证
$CHROME $FLAGS --window-size=1440,900 --screenshot=runs/shot-$(date +%s).png "https://target.example.com/"

# 4) 带 Cookie 访问（登录态复用：从 Burp/浏览器导出 Cookie 后写入）
$CHROME $FLAGS --user-data-dir=/tmp/rt-profile --dump-dom "https://target.example.com/admin"

# 5) 生成 PDF
$CHROME $FLAGS --print-to-pdf=runs/page.pdf "https://target.example.com/"
```

### 抓前端接口清单（信息收集重点）
```bash
# 用 chromium 跑一段 JS 并输出结果
$CHROME $FLAGS --dump-dom "https://target.example.com/" 2>/dev/null > runs/page.html
python3 - <<'PY'
import re, json, pathlib
html = pathlib.Path('runs/page.html').read_text(errors='ignore')
paths = set(re.findall(r'["\'](/(?:api|rest|v[0-9]|admin|user|order|upload|file)[A-Za-z0-9_\-/{}.:]{0,80})["\']', html))
print('\n'.join(sorted(paths)))
PY
# 再结合 JS 资源逐个下载提取：
grep -oE 'src="[^"]+\.js[^"]*"' runs/page.html | sed 's/src="//;s/"$//' | while read u; do
  case "$u" in http*) url="$u";; /*) url="https://target.example.com$u";; *) url="https://target.example.com/$u";; esac
  curl -s "$url" | grep -oE '["\'](/(api|rest|v[0-9])[A-Za-z0-9_\-/{}.:]{0,80})["\']' | tr -d '"'"'" >> runs/interfaces.txt
done
sort -u runs/interfaces.txt
```

## 二、playwright-cli（需要交互/等待/多页时）
**本机已装好浏览器**（`~/.cache/ms-playwright/chromium-1243`，一次性 `npx playwright install chromium` 已完成）。注意：**默认走 chrome 通道会报 `Chromium distribution 'chrome' is not found`，必须加 `--browser chromium`**。

```bash
PW="npx --yes @playwright/cli@latest"
$PW -s=recon1 open --browser chromium "https://target.example.com/"   # 打开（-s 指定会话名）
$PW -s=recon1 snapshot                                                # 无障碍树 + @e 元素引用
$PW -s=recon1 eval "() => document.title"                             # 执行 JS
$PW -s=recon1 find "登录"                                              # 在快照里搜文本
$PW -s=recon1 click "@e5"                                             # 点击
$PW -s=recon1 fill "@e7" "admin"                                      # 填表
$PW -s=recon1 screenshot --path runs/pw.png                           # 截图
$PW -s=recon1 --persistent --profile runs/pw-profile open --browser chromium URL   # 复用登录态
$PW -s=recon1 close                                                   # 关闭会话
```

登录态复用：`--persistent --profile <dir>`；首次登录后该 profile 保留 Cookie，后续直接用同一 profile 打开即为已登录。
常用子命令：`open / goto / snapshot / find / eval / click / fill / press / upload / screenshot / resize / reload / go-back / close / list`。

## 三、选择建议
| 场景 | 用哪个 |
|---|---|
| 只需页面内容/截图/接口清单 | chromium 命令行（零依赖、最快） |
| 需要点击/填表/等待/多标签 | playwright-cli（`--browser chromium`）|
| 需要复用用户真实登录态 | Kimi WebBridge（技能 `kimi-webbridge`，需扩展） |

## 注意事项
- `--no-sandbox` 仅在本机演练环境使用；不要把该参数带进生产。
- 抓到的 URL/标题写回 `redteam_asset_add`（`url`/`title` 字段），接口清单写 `runs/` 并在攻击链里引用。
- 截图与页面内容可能含敏感数据，只落 `runs/`，不要写进资产库。
