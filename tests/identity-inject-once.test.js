import assert from "node:assert/strict";
import {
  existingSystemPrompt,
  isFirstConversationTurn,
  isMnemonPluginMessage,
  promptAlreadyInjected,
  rewritePromptAssembly,
  shouldInjectPrompt,
} from "../lib/identity.js";

const inject = "You are Little Code Sauce. This is the operator prompt.";

assert.equal(isFirstConversationTurn({ messages: [{ role: "user", text: "hi" }] }), true);
assert.equal(
  isFirstConversationTurn({
    messages: [
      { role: "user", text: "hi" },
      { role: "assistant", text: "ok" },
      { role: "user", text: "again" },
    ],
  }),
  false,
);
assert.equal(isFirstConversationTurn({ agent: { session: { events: [] } } }), true);
assert.equal(
  isFirstConversationTurn({
    agent: { session: { events: [{ type: "turn/end", data: { turn: 1 } }] } },
  }),
  false,
);
assert.equal(shouldInjectPrompt({ turn: 1 }, true, inject), true);
assert.equal(
  shouldInjectPrompt(
    {
      agent: {
        session: {
          events: [
            { type: "system/message", data: { message: { content: [{ type: "text", text: inject }] } } },
            { type: "turn/end", data: { turn: 1 } },
          ],
        },
      },
    },
    true,
    inject,
  ),
  false,
);
assert.equal(shouldInjectPrompt({ turn: 2 }, false, inject), true);
assert.equal(promptAlreadyInjected(inject + "\nWorking directory: x", inject), true);

const session = {
  events: [
    { type: "system/message", data: { message: { content: [{ type: "text", text: "old" }] } } },
    { type: "system/message", data: { message: { content: [{ type: "text", text: inject }] } } },
  ],
};
assert.equal(existingSystemPrompt({ agent: { session } }), inject);
assert.equal(
  isMnemonPluginMessage({ source: { kind: "plugin", plugin: "dsh-mnemon" } }),
  true,
);
assert.equal(
  isMnemonPluginMessage({ source: { kind: "plugin", plugin: "@deepseek-ai/dsh-system-prompt" } }),
  false,
);

const first = rewritePromptAssembly(
  {
    sections: [
      { name: "deployment:persona-prefix", text: "Working directory: {{cwd}}." },
      { name: "dsh-purge", text: inject },
      { name: "dsh-purge:rules", text: "extra rule" },
      { name: "dsh-mnemon", text: "old memory dump" },
      { name: "mnemon:routing", text: "use memory tools" },
    ],
  },
  { fallbackInject: inject, dropMnemon: true, dropPurgeAfterFold: true },
);
const names = first.sections.map((s) => s.name);
assert.equal(names.includes("dsh-purge"), false);
assert.equal(names.some((n) => String(n).includes("mnemon")), false);
assert.equal(first.sections.filter((s) => String(s.text || "").includes("Little Code Sauce")).length, 1);
assert.equal(first.sections.some((s) => s.name === "dsh-purge:rules"), true);

const later = rewritePromptAssembly(
  {
    sections: [
      { name: "deployment:persona-prefix", text: "Working directory: {{cwd}}." },
      { name: "dsh-purge", text: inject },
      { name: "dsh-mnemon", text: "old memory dump" },
    ],
  },
  { fallbackInject: "", dropMnemon: true, dropPurgeAfterFold: true, pinPersonaText: inject },
);
assert.deepEqual(later.sections, [{ name: "deployment:persona-prefix", text: inject }]);

console.log("identity-inject-once ok");
