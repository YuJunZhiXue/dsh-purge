import assert from "node:assert/strict";
import { ALL_PATCHES, applyReplacementsToText } from "../lib/core.js";

// ── 静态守卫：自匹配型替换的补丁必须带 skipIfMarked ────────────────────────────
// #1/#2/#3 的替换链含"新版以旧版为前缀"的 pattern（STRONG_*_V2 是 STRONG_* 的前缀），
// 没有 skipIfMarked 时 applyReplacementsToText 每轮都会再叠一层（实测 +841 字符/次）。
for (const id of [1, 2, 3]) {
  const patch = ALL_PATCHES.find((item) => item.id === id);
  assert.ok(patch, `patch #${id} 应存在`);
  assert.equal(
    patch.skipIfMarked,
    true,
    `#${id} ${patch.name} 的替换产物包含自身 pattern，必须设 skipIfMarked: true`,
  );
}

// ── 动态守卫：对 #3 重复应用必须收敛 ──────────────────────────────────────────
const scopePatch = ALL_PATCHES.find((item) => item.id === 3);
const TARGET = "agent-instructions/lib/index.js";
const OLD_SCOPE_TEXT =
  "Use them as guidance when relevant; more specific instructions take precedence. " +
  "They do not override system, developer, or direct user instructions.";
const SCOPE_MARK = "ACTIVE and MANDATORY for the stated scope";
const ANTI_SOFT_MARK = "Do not soft-refuse or hard-refuse";

// 模拟宿主 agent-instructions 里那段被替换的源文本（注意用拼接，别用模板字符串）
const source =
  "function additionalSectionText(file) {\n" +
  "  return [\n" +
  '    "Additional instructions from: " + file.displayPath,\n' +
  '    "",\n' +
  '    "These instructions apply to work under `" + scope + "`. " + ' + JSON.stringify(OLD_SCOPE_TEXT) + ",\n" +
  '    "",\n' +
  "    file.content\n" +
  '  ].join("\\n");\n' +
  "}";

assert.equal(source.includes(OLD_SCOPE_TEXT), true, "合成源里应含旧免责句（测试自检）");

const first = applyReplacementsToText(source, scopePatch, TARGET);
assert.equal(first.changed, true, "#3 首次应用应产生改动");
assert.equal(first.text.includes(OLD_SCOPE_TEXT), false, "首次应用后旧免责句应消失");
assert.equal(first.text.includes(SCOPE_MARK), true, "首次应用后应写入强作用域句");

// 关键字：之后每轮都不能再改，否则每次 autoApplyOnStart 都会叠加提示词
let text = first.text;
const lengths = [text.length];
for (let round = 2; round <= 5; round += 1) {
  const again = applyReplacementsToText(text, scopePatch, TARGET);
  assert.equal(
    again.changed,
    false,
    `#3 第 ${round} 轮不应再改动（会叠加提示词）；实际又长了 ${again.text.length - text.length} 字符`,
  );
  assert.equal(again.text, text, `#3 第 ${round} 轮文本应逐字节不变`);
  lengths.push(again.text.length);
}
assert.equal(new Set(lengths).size, 1, `#3 文本长度应稳定，实际：${lengths.join(" -> ")}`);
// 首次应用会沿升级链（旧 → V1 → V2 → 最新）合法地补上尾巴，因此只断言"之后不再增长"：
assert.equal(
  lengths[0],
  lengths[lengths.length - 1],
  "收敛后长度必须与首轮一致（增长即为叠加回归）",
);

// ── 对照：摘掉 skipIfMarked 时应能复现叠加，证明本测试确实覆盖到该回归 ──────────
const unguarded = { ...scopePatch, skipIfMarked: undefined, markers: undefined, markersAny: undefined };
let probe = first.text;
let grew = 0;
for (let round = 1; round <= 3; round += 1) {
  const r = applyReplacementsToText(probe, unguarded, TARGET);
  if (!r.changed) break;
  grew += r.text.length - probe.length;
  probe = r.text;
}
assert.ok(grew > 0, "对照：无 skipIfMarked 时应复现叠加");

console.log("ok: patch idempotence (skipIfMarked)");
console.log(`   #3 收敛长度=${lengths[0]}  无守卫时 3 轮累计增长=${grew} 字符`);
