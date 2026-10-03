import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-purge-stamp-"));
process.env.DSH_HOME = tmp;

const {
  stampMatches,
  resolveApplySha,
  markPatchesApplied,
  readAppliedStamp,
  healEmptyAppliedStamp,
  ensureInstalledRevSeed,
  shouldSkipSettleRestart,
  markSettleRestart,
  canHealEmptyStamp,
} = await import("../lib/reapply.js");

assert.equal(stampMatches({ version: "1.1.52", sha: "" }, "1.1.52", "abc"), false);
assert.equal(stampMatches({ version: "1.1.52", sha: "abc" }, "1.1.52", "abc"), true);
assert.equal(stampMatches({ version: "1.1.52", sha: "abc" }, "1.1.52", ""), true);
assert.equal(stampMatches({ version: "1.1.52", sha: "apply:1.1.52" }, "1.1.52", "deadbeef"), true);
assert.equal(stampMatches({ version: "1.1.52", sha: "abc" }, "1.1.52", "def"), false);
assert.equal(stampMatches({ version: "1.1.51", sha: "abc" }, "1.1.52", "abc"), false);

// #56：空 sha 仍不能当对齐；#57：密封/缺标记不能就地补戳。
assert.equal(canHealEmptyStamp({ sealed: true, hasAiBase: true, markersPresent: true }), false);
assert.equal(canHealEmptyStamp({ sealed: false, hasAiBase: true, markersPresent: false }), false);
assert.equal(canHealEmptyStamp({ sealed: false, hasAiBase: true, markersPresent: true }), true);
assert.equal(canHealEmptyStamp({ sealed: false, hasAiBase: false, markersPresent: false }), true);

assert.equal(resolveApplySha("deadbeef"), "deadbeef");
assert.match(resolveApplySha(""), /^(apply:|applied)/);

const sha = markPatchesApplied();
assert.ok(sha);
assert.ok(sha.length > 0);
const stamp = readAppliedStamp();
assert.equal(stamp.sha, sha);
assert.ok(stamp.sha);
const revFile = path.join(tmp, "dsh-purge", "installed-rev");
assert.equal(fs.readFileSync(revFile, "utf8").trim(), sha);
assert.equal(stampMatches(stamp, stamp.version, sha), true);

fs.writeFileSync(path.join(tmp, "dsh-purge", "applied.json"), `${JSON.stringify({
  version: stamp.version,
  sha: "",
  at: new Date().toISOString(),
}, null, 2)}\n`);
assert.equal(healEmptyAppliedStamp(), true);
assert.ok(readAppliedStamp().sha);

// #60：缺 installed-rev 时种子
fs.rmSync(path.join(tmp, "dsh-purge", "installed-rev"), { force: true });
const seeded = ensureInstalledRevSeed();
assert.ok(seeded);
assert.equal(fs.readFileSync(path.join(tmp, "dsh-purge", "installed-rev"), "utf8").trim(), seeded);

assert.equal(shouldSkipSettleRestart(), false);
markSettleRestart();
assert.equal(shouldSkipSettleRestart(), true);

console.log("ok: reapply stamp / infinite-restart guards");
