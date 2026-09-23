# 1.1.14

## 中文

- 回退清队列时会等 `updateQueue` 结束。条目已经不在时不再变成未处理的拒绝，避免把宿主带崩（#32）。
- 兜底回退按钮成功后会记下这次的时间。1.2 秒后的轮询不会把同一次回退再打开、再回填一遍（#33）。
- 回填的是还没结束的那一句时，切点改到最后一个已闭合回合。不再多丢上一整轮。回合还在进行、8 秒内等不到结束时，仍然直接失败，不会按不完整日志去切（#34）。
- bash 超时补丁改成整行正则，并把已经多写出来的 0 收回到 10 分钟。每次启动不再给超时再补一个 0（#22，#31）。
- 补丁替换支持正则，`$1` 会展开。bundle 布局清洗完成后能认出 `persona: ""`，面板不再一直显示待应用。#39 改为可选。跳过说明改为「当前版本不需要或组件未安装」。
- 正式版已经追上的测试版不再出现在版本列表里。提交号对不上时，按本机版本号标「当前」。
- phase-1 不再清空 runtime context，也不改消息白名单。梁神和官方插件的消息照旧保留。

## English

- Rewind waits for `updateQueue` to finish. A queue item that is already gone no longer becomes an unhandled rejection that can take down the host (#32).
- The fallback rewind button records this rewind’s timestamp. The 1.2s poll does not open and refill the same rewind a second time (#33).
- When the text being restored belongs to a turn that is still open, the fork point is the last closed turn. The previous completed turn is no longer dropped. If that turn is still running and does not close within 8 seconds, rewind still fails instead of cutting an incomplete log (#34).
- The bash timeout patch is now one whole-line regular expression, and values that grew extra zeros are pulled back to 10 minutes. Startup no longer appends another zero (#22, #31).
- Patch replacement accepts regular expressions, and `$1` expands. A finished bundle-layout clean matches `persona: ""`, so the panel does not stay on pending. #39 is optional. The skipped hint now says the patch is not needed for this version, or the component is not installed.
- Beta versions already covered by the current stable release are hidden from the version list. When the commit does not match, 「当前」follows the local version number.
- Phase-1 no longer clears runtime context or the message allowlist. 梁神 and official plugin messages stay as they are.
