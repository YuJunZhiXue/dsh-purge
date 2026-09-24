# 1.1.15

## 中文

- 设置页点「应用」会把输入框里的提示词写入 `prompt-inject.md`。以前只检查有没有字，重启后读的还是旧文件，所以注入像没生效。
- 带 `complete: true` 的预设在重启后不再丢掉 `dsh-purge` 注入段。点「应用」之后必须再点「重启」，宿主重新打开后新开一轮对话，注入才进入当前会话。
- bash 超时补丁不再和状态检查共用同一条正则。点「应用」会把 60 秒写成 10 分钟，不会一直停在待应用（#35）。
- bash 超时写进 `cordis.patch.yml` 时用 `#` 注释。`//` 会被 YAML 当成字符串，`timeoutMs` 校验失败，`dsh` 一启动就崩（#36）。已经起不来的，先把 `@deepseek-ai/dsh-base` 里那一行的 `//` 改成 `#`，或改回 `timeoutMs: 600000`，再更新插件。
- 去掉点了也不变的「启用 fetch」补丁，后面的编号依次前移。没装 `dsh-web-fetch-http` 时不再占着一条待应用。
- README 开头写明必须应用并重启。工作原理改成流程图，去掉 0.1.5 适配表和生效验证。

## English

- Apply on the settings page writes the prompt box into `prompt-inject.md`. It used to only check that the box was not empty, so after a restart the host still read the old file and the inject looked like it never happened.
- Presets with `complete: true` no longer drop the `dsh-purge` inject section after a restart. After Apply you must click Restart. When the host is back, start a new chat; that is when the inject enters the session.
- The bash timeout patch no longer shares one regular expression with the status check. Apply now writes 60 seconds as 10 minutes instead of staying on pending (#35).
- The bash timeout note in `cordis.patch.yml` is a `#` comment. A `//` comment is a YAML string, so `timeoutMs` fails validation and `dsh` dies on startup (#36). If it already will not start, change that `//` to `#` in `@deepseek-ai/dsh-base`, or put the line back to `timeoutMs: 600000`, then update the plugin.
- The fetch-enable patch that stayed pending is gone, and later patch numbers move up by one. A missing `dsh-web-fetch-http` package no longer occupies a pending row.
- The README now says at the top that Apply must be followed by Restart. How it works is a flowchart. The 0.1.5 notes table and the verify list are removed.
