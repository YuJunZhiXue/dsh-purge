# Close GitHub issues for release 1.1.60. Requires: gh auth login
$sha = "af13e8c201b526dc3bbce949351fb46a762eb1eb"
$repo = "YuJunZhiXue/dsh-purge"

$comments = @{
  66 = "已在 1.1.60 ($sha) 继续加固：lib/desktop.js JScript 不可用时走 PowerShell 换包。tag v1.1.60"
  67 = "$sha (1.1.60): lib/desktop.js patchOfficialCliCmdText 解包路径与 dsh.cmd 自引用修复。"
  68 = "$sha (1.1.60): README desktop profile + master.tar.gz；Hub 一键仍 git，文档已说明。"
  69 = "$sha (1.1.60): lib/redteam/client.js .rt-dock position fixed。"
  70 = "$sha (1.1.60): lib/redteam/skill-availability.js 本机 OS 技能路径。"
  71 = "$sha (1.1.60): lib/identity.js installAssembleGuard 幂等。"
}

foreach ($n in 66, 67, 68, 69, 70, 71) {
  gh issue comment $n -R $repo -b $comments[$n]
  gh issue close $n -R $repo -r completed
}
