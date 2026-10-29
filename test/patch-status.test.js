import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PATCHES,
  applyReplacementsToText,
  parseHostVersion,
  patchStatusReady,
  rollupDisplayStatus,
  rollupPatchStatus,
  tallyDisplayPatches,
} from "../lib/core.js";

const base = {
  applied: 0,
  already: 0,
  missing: 0,
  notFound: 0,
  drifted: 0,
  lastError: null,
  keyCount: 1,
  layoutSoft: false,
  strictFiles: false,
};

/* ---------------------------------------------------------------------------
 * 判据：上游漂移必须显性，不能落成 skipped（软成功）。
 * 这是"官方升级后插件静默失效、状态页却全绿"的唯一入口。
 * ------------------------------------------------------------------------- */

test("rollupPatchStatus: 文件在、原文对不上 → drifted 而不是 skipped", () => {
  assert.equal(rollupPatchStatus({ ...base, drifted: 1 }), "drifted");
});

test("rollupPatchStatus: pattern 还在 → pending（可以打）", () => {
  assert.equal(rollupPatchStatus({ ...base, notFound: 1 }), "pattern_not_found");
});

test("rollupPatchStatus: 有文件真的写成功就仍算 applied，不制造半打假告警", () => {
  assert.equal(rollupPatchStatus({ ...base, applied: 1, drifted: 1 }), "applied");
});

test("rollupPatchStatus: 写错误优先于 applied，不能把 EACCES 吞成绿", () => {
  assert.equal(
    rollupPatchStatus({ ...base, applied: 1, lastError: "write_error:EACCES" }),
    "write_error:EACCES",
  );
});

test("rollupPatchStatus: 文件全缺 → missing_file", () => {
  assert.equal(rollupPatchStatus({ ...base, missing: 1 }), "missing_file");
});

/* ---------------------------------------------------------------------------
 * 就绪口径：drifted 必须让"已就绪"变红（可选补丁不阻断 apply，但状态仍在）。
 * ------------------------------------------------------------------------- */

test("patchStatusReady: drifted 的非可选补丁不算就绪", () => {
  assert.equal(patchStatusReady("drifted", { optional: false }), false);
});

test("patchStatusReady: drifted 的可选补丁不阻断就绪", () => {
  assert.equal(patchStatusReady("drifted", { optional: true }), true);
});

test("patchStatusReady: applied / already 算就绪", () => {
  assert.equal(patchStatusReady("applied"), true);
  assert.equal(patchStatusReady("already"), true);
});

test("patchStatusReady: pending 不算就绪", () => {
  assert.equal(patchStatusReady("pending"), false);
});

/* ---------------------------------------------------------------------------
 * 展示层统计：drifted 不能被算进 ready。
 * ------------------------------------------------------------------------- */

test("tallyDisplayPatches: drifted 不计入 ready", () => {
  const out = tallyDisplayPatches([
    { status: "applied" },
    { status: "drifted" },
    { status: "skipped" },
  ]);
  assert.equal(out.applied, 1);
  assert.equal(out.drifted, 1);
  assert.equal(out.ready, 2, "只有 applied + skipped 计入 ready");
});

test("rollupDisplayStatus: 一组里只要有一条漂移，这组就不是干净绿", () => {
  assert.equal(rollupDisplayStatus(["applied", "drifted"]), "drifted");
  assert.equal(rollupDisplayStatus(["applied", "applied"]), "applied");
  assert.equal(rollupDisplayStatus(["pending", "drifted"]), "pending");
});

/* ---------------------------------------------------------------------------
 * 幂等：二次应用不得继续增长（历史事故是每次 apply +841 字符、永不收敛）。
 * ------------------------------------------------------------------------- */

test("applyReplacementsToText: 全部字面量 pattern 二次应用不叠加", () => {
  const offenders = [];
  for (const p of ALL_PATCHES) {
    const reps = (p.replacements || []).filter((r) => r.pattern && !(r.pattern instanceof RegExp));
    if (reps.length === 0) continue;
    // 用 pattern 本体合成输入：保证第一遍一定命中，从而真正检验收敛性。
    const src = reps.map((r) => String(r.pattern)).join("\n");
    const once = applyReplacementsToText(src, p, "");
    const twice = applyReplacementsToText(once.text, p, "");
    if (twice.text !== once.text) offenders.push(`#${p.id} ${p.name}`);
  }
  assert.deepEqual(offenders, [], `这些补丁二次应用还在变：${offenders.join(", ")}`);
});

test("applyReplacementsToText: 没有残留 pattern 时 changed=false", () => {
  const patch = { id: 9901, replacements: [{ pattern: "NOT_PRESENT_ANYWHERE", replace: "x" }] };
  const r = applyReplacementsToText("hello world", patch, "");
  assert.equal(r.changed, false);
  assert.equal(r.text, "hello world");
});

/* ---------------------------------------------------------------------------
 * 命中数契约：官方同名代码多一处就该拒写，而不是把两处一起改掉。
 * ------------------------------------------------------------------------- */

test("applyReplacementsToText: expect 命中数不符时拒写并回传实际命中数", () => {
  const patch = { id: 9902, replacements: [{ pattern: "NEEDLE", replace: "X", expect: 1 }] };
  const r = applyReplacementsToText("NEEDLE NEEDLE", patch, "");
  assert.ok(r.hitMismatch, "应当回传 hitMismatch");
  assert.equal(r.hitMismatch.expected, 1);
  assert.equal(r.hitMismatch.actual, 2);
  assert.equal(r.text, "NEEDLE NEEDLE", "拒写时原文必须原样返回");
  assert.equal(r.changed, false);
});

test("applyReplacementsToText: expect 命中数一致时正常替换", () => {
  const patch = { id: 9903, replacements: [{ pattern: "NEEDLE", replace: "X", expect: 1 }] };
  const r = applyReplacementsToText("a NEEDLE b", patch, "");
  assert.equal(r.hitMismatch, undefined);
  assert.equal(r.text, "a X b");
});

test("applyReplacementsToText: 未声明 expect 时保持旧行为（全量替换）", () => {
  const patch = { id: 9904, replacements: [{ pattern: "N", replace: "X" }] };
  const r = applyReplacementsToText("N N", patch, "");
  assert.equal(r.hitMismatch, undefined);
  assert.equal(r.text, "X X");
});

/* ---------------------------------------------------------------------------
 * 宿主版本门禁
 * ------------------------------------------------------------------------- */

test("parseHostVersion: 拆出主次修订与预发布段", () => {
  assert.deepEqual(parseHostVersion("0.2.1-rc.3"), {
    major: 0, minor: 2, patch: 1, pre: ["rc", "3"],
  });
  assert.equal(parseHostVersion("not-a-version"), null);
  assert.deepEqual(parseHostVersion("v1.2.3"), { major: 1, minor: 2, patch: 3, pre: [] });
});
