import assert from "node:assert/strict";
import { lastHumanUserText } from "../lib/rewind.js";

const events = [
  { type: "turn/start", seq: 1 },
  {
    type: "user/message",
    seq: 2,
    data: { content: [{ type: "text", text: "first" }], source: { kind: "user" } },
  },
  { type: "turn/end", seq: 3 },
  { type: "turn/start", seq: 4 },
  {
    type: "user/message",
    seq: 5,
    data: { content: [{ type: "text", text: "second" }], source: { kind: "user" } },
  },
  {
    type: "user/message",
    seq: 6,
    data: { content: [{ type: "text", text: "[MNEMON] skip" }], source: { kind: "plugin", plugin: "dsh-mnemon" } },
  },
];

assert.equal(lastHumanUserText(events), "second");
assert.equal(lastHumanUserText([]), "");
assert.equal(lastHumanUserText(null), "");

console.log("rewind-last-user ok");
