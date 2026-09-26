import assert from "node:assert/strict";
import { ALL_PATCHES, applyReplacementsToText } from "../lib/core.js";

const scope = ALL_PATCHES.find((patch) => patch.id === 3);
assert.equal(scope.name, "SCOPE_INTRO");
assert.equal(scope.file, "agent-instructions");

// 0.1.7-rc.2 dsh-agent-instructions/lib/index.js：作用域免责是一段模板字符串，
// 原句被替换后收尾反引号紧跟其后。
const TICK = String.fromCharCode(96);
const fresh =
  TICK +
  "These instructions apply to work under \\" +
  TICK +
  "${scope}\\" +
  TICK +
  ". Use them as guidance when relevant; more specific instructions take precedence. " +
  "They do not override system, developer, or direct user instructions." +
  TICK;

const applied = applyReplacementsToText(fresh, scope, "agent-instructions/lib/index.js");
assert.equal(applied.changed, true);
assert.match(applied.text, /ACTIVE and MANDATORY for the stated scope/);
assert.equal(applied.text.endsWith(TICK), true);

// 已清洗的文本再跑一次必须原样返回：#3 的 V1/V2 pattern 是 STRONG_SCOPE 的前缀，
// 少了收尾锚点就会每轮再把尾部追加一遍，文件与 prompt 无限增长。
const again = applyReplacementsToText(applied.text, scope, "agent-instructions/lib/index.js");
assert.equal(again.changed, false, "#3 对已清洗文本再次生效");
assert.equal(again.text, applied.text);

// 同类坑的通用断言：补丁的 pattern 不能匹配自己的产物。带 skipIfMarked 的补丁由
// marker 闸门在整文件层面保证幂等，这里不适用。
for (const patch of ALL_PATCHES) {
  if (patch.skipIfMarked) continue;
  const reps =
    patch.replacements || (patch.patterns || []).map((pattern) => ({ pattern, replace: patch.replace }));
  const fp = (patch.rel || []).join("/");
  for (const rep of reps) {
    if (typeof rep.replace !== "string" || rep.replace.length === 0) continue;
    const out = applyReplacementsToText(rep.replace, patch, fp);
    assert.equal(out.changed, false, `${patch.name} 的 pattern 匹配到自己的产物（非幂等）`);
  }
}

console.log("ok: idempotency");
