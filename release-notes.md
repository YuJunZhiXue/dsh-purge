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
