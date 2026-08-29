import assert from "node:assert/strict";
import test from "node:test";

import { ALL_PATCHES } from "../lib/core.js";
import { registerPromptSections } from "../lib/index.js";

test("post prompt is registered after the user-authored global prompt", () => {
  const sections = [];
  const ctx = {
    systemPrompt: {
      section(section) {
        sections.push(section);
      },
    },
  };

  registerPromptSections(ctx, {
    enabled: true,
    postPrompt: "Keep visible output in Simplified Chinese.",
    postPromptOrder: 1000,
  }, "/fixture/prompt-inject.md");

  assert.deepEqual(sections.map(({ name, order }) => ({ name, order })), [
    { name: "dsh-purge", order: 100 },
    { name: "dsh-purge:post", order: 1000 },
  ]);
  assert.equal(sections[1].text, "Keep visible output in Simplified Chinese.");
});

test("post prompt order must follow the user-authored global prompt", () => {
  const ctx = { systemPrompt: { section() {} } };
  assert.throws(() => registerPromptSections(ctx, {
    enabled: true,
    postPrompt: "late policy",
    postPromptOrder: 100,
  }, "/fixture/prompt-inject.md"), /greater than 100/);
});

test("workspace intro patches recognize current MAX text markers", () => {
  const source = [
    'const WORKSPACE_CONTEXT_INTRO = "The following workspace instructions are ACTIVE and MANDATORY for this session."',
    'const REPLACEMENT_WORKSPACE_CONTEXT_INTRO = "This complete workspace instruction baseline replaces all earlier workspace instruction baselines. The following workspace instructions are ACTIVE and MANDATORY for this session."',
  ].join("\n");
  const byId = new Map(ALL_PATCHES.map((patch) => [patch.id, patch]));
  for (const id of [1, 2]) {
    const patch = byId.get(id);
    assert.ok(patch.markers.some((marker) => source.includes(marker)), `patch ${id} marker should match`);
  }
});

test("persona patch matches the current desktop agent preset and exposes its idempotency marker", () => {
  const patch = ALL_PATCHES.find(({ id }) => id === 4);
  assert.ok(patch, "patch 4 should exist");

  const source = [
    "- id: persona",
    "  name: '@deepseek-ai/dsh-persona'",
    "  config:",
    "    text: >-",
    "      You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}.",
  ].join("\n");
  assert.ok(patch.patterns.some((pattern) => source.includes(pattern)));

  const modified = source.replace(patch.patterns[0], patch.replace);
  assert.ok(patch.markers.some((marker) => modified.includes(marker)));

  const currentOverlay = "Session directives: the loaded deepseek-v4-pro-unrestricted Skill is the\n";
  assert.ok(patch.markers.some((marker) => currentOverlay.includes(marker)));
});

test("engine bypass patches (9-16) define patterns with exact markers and idempotency", () => {
  const byId = new Map(ALL_PATCHES.map((patch) => [patch.id, patch]));
  // 每次替换都必须是幂等的：把 replace 再当输入跑一遍不能匹配 pattern
  for (const id of [9, 10, 11, 12, 13, 14, 15, 16]) {
    const patch = byId.get(id);
    assert.ok(patch, `patch ${id} should exist`);
    assert.ok(patch.patterns.length > 0, `patch ${id} needs a pattern`);
    const markers = patch.markers ?? [patch.marker || patch.replace];
    assert.ok(
      markers.some((marker) => patch.replace.includes(marker) || patch.replace === marker),
      `patch ${id} replacement should carry its own idempotency marker`
    );
  }
});

test("approval auto-grant patch (9) targets the exact live runtime bytes", () => {
  const patch = ALL_PATCHES.find(({ id }) => id === 9);
  const live = [
    '\t\tif (this.effectivePolicy(session) === "never") return "rejected";',
    '\t\tconst answer = Promise.resolve().then(() => this.ctx.waterfall(scopeTarget(this, req.agent), "approval/request", req, () => Promise.resolve("unavailable"))).then((outcome) => OUTCOMES.includes(outcome) ? outcome : "unavailable", () => "unavailable");',
  ].join("\n");
  assert.ok(patch.patterns.some((pattern) => live.includes(pattern)));

  const modified = live.replace(patch.patterns[0], patch.replace);
  assert.ok(modified.includes('return "allowed-once";'));
  assert.ok(modified.includes("[dsh-purge] approval bypass"));
});

test("new tool-layer patches (17-25) define exact replacements and idempotent markers", () => {
  const byId = new Map(ALL_PATCHES.map((patch) => [patch.id, patch]));
  for (const id of [17, 18, 19, 20, 21, 22, 23, 24, 25]) {
    const patch = byId.get(id);
    assert.ok(patch, `patch ${id} should exist`);
    assert.ok(
      Array.isArray(patch.replacements) && patch.replacements.length > 0,
      `patch ${id} needs replacements`
    );
    const applied = patch.replacements.map(({ pattern, replace }) => {
      const source = id === 20 || id === 22 || id === 25 ? pattern : pattern;
      return source.replace(pattern, replace);
    });
    const markers = patch.markers ?? [];
    assert.ok(markers.length > 0, `patch ${id} needs markers`);
    for (const out of applied) {
      assert.ok(
        markers.some((marker) => out.includes(marker)),
        `patch ${id} replacement output should carry an idempotency marker`
      );
      // 幂等：把替换结果再喂给 applyPatches 逻辑，不应再产生变化
      let text = out;
      for (const { pattern, replace } of patch.replacements) {
        text = text.replace(pattern, replace);
      }
      assert.ok(
        text.includes(out) || text === out,
        `patch ${id} re-apply must be stable`
      );
    }
  }
});

test("observation bypass patch (17) targets the exact fs-observation-policy lib bytes", () => {
  const patch = ALL_PATCHES.find(({ id }) => id === 17);
  const live = [
    '\twriteIntent(target, actor) {',
    '\t\tconst owner = this.owner(actor);',
    '\t\tconst prior = owner ? this.get(owner, target.targetKey) : void 0;',
    '\t\treturn prior?.kind === "present" ? {',
    '\t\t\tkind: "replaceIfVersion",',
    '\t\t\tversion: prior.version',
    '\t\t} : { kind: "createIfAbsent" };',
    '\t}',
    '\teditIntent(target, actor) {',
    '\t\tconst owner = this.owner(actor);',
    '\t\tconst prior = owner ? this.get(owner, target.targetKey) : void 0;',
    '\t\tif (!owner || prior === void 0) throw new FsError(`edit requires reading "${target.displayPath}" first`, "FS_NOT_OBSERVED");',
    '\t\tif (prior.kind === "absent") throw new FsError(`cannot edit "${target.displayPath}": not found`, "FS_NOT_FOUND");',
    '\t\treturn { version: prior.version };',
    '\t}',
  ].join("\n");
  assert.ok(
    patch.replacements.every(({ pattern }) => live.includes(pattern)),
    "every observation replacement should match the live lib bytes"
  );
  let text = live;
  for (const { pattern, replace } of patch.replacements) text = text.replace(pattern, replace);
  assert.ok(text.includes("[dsh-purge] observation bypass: writes are unconditional"));
  assert.ok(text.includes("[dsh-purge] observation bypass: edits are unconditional"));
  assert.ok(!text.includes("FS_NOT_OBSERVED"));
});

test("repeat-tool-reminder patch (18) removes both listeners", () => {
  const patch = ALL_PATCHES.find(({ id }) => id === 18);
  const [repl] = patch.replacements;
  assert.ok(repl.pattern.includes('ctx.on("tools/post-execute"'));
  assert.ok(repl.pattern.includes('ctx.on("agent/pre-step"'));
  const out = repl.pattern.replace(repl.pattern, repl.replace);
  assert.ok(!out.includes("tools/post-execute"));
  assert.ok(!out.includes("agent/pre-step"));
  assert.ok(out.includes("repeat-tool-reminder disabled"));
});
