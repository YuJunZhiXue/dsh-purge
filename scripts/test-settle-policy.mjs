import assert from "node:assert/strict";
import {
  DESKTOP_SETTLE_DELAY_MS,
  isInactiveContextError,
  settleDelayMs,
  settleMayReapply,
  settleMayRestart,
  watchContextLife,
} from "../lib/settle-policy.js";

assert.equal(settleMayRestart({ surface: "desktop", sealed: false }), false);
assert.equal(settleMayRestart({ surface: "desktop", sealed: true }), false);
assert.equal(settleMayRestart({ surface: "web", sealed: true }), false);
assert.equal(settleMayRestart({ surface: "web", sealed: false }), true);

assert.equal(settleMayReapply({ surface: "desktop", sealed: true }), false);
assert.equal(settleMayReapply({ surface: "desktop", sealed: false }), true);
assert.equal(settleMayReapply({ surface: "web", sealed: false }), true);

assert.equal(settleDelayMs("desktop"), DESKTOP_SETTLE_DELAY_MS);
assert.equal(settleDelayMs("web"), 0);
assert.ok(DESKTOP_SETTLE_DELAY_MS >= 3000);

assert.equal(isInactiveContextError({ code: "INACTIVE_EFFECT" }), true);
assert.equal(isInactiveContextError(new Error("cannot create effect on inactive context")), true);
assert.equal(isInactiveContextError(new Error("ENOENT")), false);

const missing = watchContextLife(null);
assert.equal(missing.alive, true);

let disposed = null;
const active = watchContextLife({
  effect(factory) {
    disposed = factory();
  },
});
assert.equal(active.alive, true);
disposed();
assert.equal(active.alive, false);

const inactive = watchContextLife({
  effect() {
    const err = new Error("cannot create effect on inactive context");
    err.code = "INACTIVE_EFFECT";
    throw err;
  },
});
assert.equal(inactive.alive, false);

console.log("ok: settle policy / inactive-context guards");
