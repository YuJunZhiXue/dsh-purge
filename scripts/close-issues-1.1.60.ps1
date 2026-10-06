# Close GitHub issues for release 1.1.60. Requires: gh auth login
$sha = "af13e8c201b526dc3bbce949351fb46a762eb1eb"
$repo = "YuJunZhiXue/dsh-purge"

$comments = @{
  66 = "已在 **1.1.60**（``$sha``）继续加固：`lib/desktop.js` 探测 JScript 不可用时走 PowerShell 换包，且不再用 inflight 标记误杀 PS 兜底。请用 tag **v1.1.60** 验证。"
  67 = "``$sha``（1.1.60）：``lib/desktop.js`` 的 ``patchOfficialCliCmdText`` 优先解包路径、修复 ``set `"entry=%entry%`"`` 自引用；再点一次应用即可。"
  68 = "``$sha``（1.1.60）：README 写明官方桌面用 ``dsh plugin --profile desktop add …/master.tar.gz``；Hub 市场一键仍走 git（无 ``prepare``），文档已说明，不按 Hub 一键修复关闭。"
  69 = "``$sha``（1.1.60）：演练台 ``.rt-dock`` 默认 ``position:fixed``，嵌入清洗面板时为 ``relative``，见 ``lib/redteam/client.js``。"
  70 = "``$sha``（1.1.60）：``lib/redteam/skill-availability.js`` 按本机 OS/CPU 判定技能路径，不把其它平台文件名当缺失。"
  71 = "``$sha``（1.1.60）：``lib/identity.js`` ``installAssembleGuard`` 幂等，避免重复 Proxy 栈溢出。"
}

foreach ($n in 66, 67, 68, 69, 70, 71) {
  gh issue comment $n -R $repo -b $comments[$n]
  gh issue close $n -R $repo -r completed
}
