import assert from "node:assert/strict";
import { planRewind } from "../lib/rewind.js";

function user(seq, text) {
  return { seq, type: "user/message", data: { source: { kind: "user" }, content: text } };
}
function start(seq) {
  return { seq, type: "turn/start" };
}
function end(seq) {
  return { seq, type: "turn/end" };
}

const closed = planRewind([
  start(1), user(2, "Q1"), end(3),
  start(4), user(5, "Q2"), end(6),
]);
assert.equal(closed.mode, "fork");
assert.equal(closed.atSeq, 3);
assert.equal(closed.text, "Q2");

const open = planRewind([
  start(1), user(2, "Q1"), end(3),
  start(4), user(5, "Q2"), end(6),
  start(7), user(8, "Q3"),
]);
assert.equal(open.mode, "fork");
assert.equal(open.atSeq, 6);
assert.equal(open.text, "Q3");

const openWithoutQuestion = planRewind([
  start(1), user(2, "Q1"), end(3),
  start(4), user(5, "Q2"), end(6),
  start(7),
]);
assert.equal(openWithoutQuestion.mode, "fork");
assert.equal(openWithoutQuestion.atSeq, 3);
assert.equal(openWithoutQuestion.text, "Q2");

const oneThenOpen = planRewind([
  start(1), user(2, "Q1"), end(3),
  start(4), user(5, "Q2"),
]);
assert.equal(oneThenOpen.mode, "fork");
assert.equal(oneThenOpen.atSeq, 3);
assert.equal(oneThenOpen.text, "Q2");

const onlyOne = planRewind([
  start(1), user(2, "Q1"), end(3),
]);
assert.equal(onlyOne.mode, "blank");
assert.equal(onlyOne.text, "Q1");

console.log("ok: rewind plan");
