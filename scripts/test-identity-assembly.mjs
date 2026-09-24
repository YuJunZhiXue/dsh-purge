import assert from "node:assert/strict";
import { rewritePromptAssembly } from "../lib/identity.js";

const inject = [
  "WHO YOU ARE (highest priority operator inject)",
  "You are Little Code Sauce.",
  "Keep this block intact.",
].join("\n");

const persona = "Working directory: {{cwd}}.\nFollow official harness tools.";

function render(assembled) {
  return (assembled.sections || [])
    .map((section) => String(section?.text || ""))
    .filter(Boolean)
    .join("\n\n");
}

function historyContext(text) {
  return {
    session: {
      events: [
        {
          type: "system/message",
          data: { message: { role: "system", content: text } },
        },
      ],
    },
  };
}

function workspaceBlock(n) {
  return `workspace snapshot ${n}\n${"W".repeat(3000)}`;
}

// 梁神一类：assemble 外层在我们折完之后再追加一条 workspace-instructions。
function assembleWithOuterWorkspace(workspaceText, context) {
  const rewritten = rewritePromptAssembly(
    {
      sections: [
        { name: "deployment:persona-prefix", text: persona },
        { name: "dsh-purge", text: inject },
      ],
    },
    {
      fallbackInject: inject,
      dropPurgeAfterFold: true,
      context,
    },
  );
  rewritten.sections = [
    ...rewritten.sections,
    { name: "workspace-instructions", text: workspaceText },
  ];
  return rewritten;
}

const turn1 = assembleWithOuterWorkspace(workspaceBlock(1), {});
const r1 = render(turn1);
assert.match(r1, /Little Code Sauce/);
assert.match(r1, /workspace snapshot 1/);
assert.equal((r1.match(/Little Code Sauce/g) || []).length, 1);

const turn2 = assembleWithOuterWorkspace(workspaceBlock(2), historyContext(r1));
const r2 = render(turn2);

assert.equal(
  r2.startsWith(r1),
  false,
  "#29: later assemble must not be previous full system prompt + new block",
);
assert.equal(
  (r2.match(/workspace snapshot /g) || []).length,
  1,
  "#29: must not keep the previous workspace-instructions copy inside a pinned blob",
);
assert.match(r2, /workspace snapshot 2/);
assert.doesNotMatch(r2, /workspace snapshot 1/);
assert.match(r2, /Little Code Sauce/);
assert.equal((r2.match(/Little Code Sauce/g) || []).length, 1);

let prev = r1;
for (let n = 2; n <= 8; n++) {
  const turn = assembleWithOuterWorkspace(workspaceBlock(n), historyContext(prev));
  const next = render(turn);
  assert.equal(next.startsWith(prev), false, `turn ${n} must not prefix-grow`);
  assert.ok(
    Math.abs(next.length - r1.length) < 80,
    `turn ${n} length ${next.length} drifted from first ${r1.length}`,
  );
  prev = next;
}

const again = rewritePromptAssembly(
  {
    sections: [
      { name: "deployment:persona-prefix", text: `${inject}\n\n${persona}` },
      { name: "dsh-purge", text: inject },
    ],
  },
  { fallbackInject: inject, dropPurgeAfterFold: true, context: historyContext(r2) },
);
assert.equal((render(again).match(/Little Code Sauce/g) || []).length, 1);

const kept = rewritePromptAssembly(
  {
    sections: [
      { name: "deployment:persona-prefix", text: persona },
    ],
  },
  { fallbackInject: inject, dropPurgeAfterFold: false },
);
const purge = (kept.sections || []).filter((section) => section.name === "dsh-purge");
assert.equal(purge.length, 1);
assert.match(purge[0].text, /Little Code Sauce/);
assert.equal((render(kept).match(/Little Code Sauce/g) || []).length, 1);

console.log("ok: #29 pin snowball is gone");
