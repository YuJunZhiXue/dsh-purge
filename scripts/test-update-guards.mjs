import assert from "node:assert/strict";
import { markCurrent, pluginAddSpec, safeUpdateRef } from "../lib/update.js";

assert.equal(safeUpdateRef("master"), "master");
assert.equal(safeUpdateRef("beta"), "beta");
assert.equal(safeUpdateRef("v1.1.11"), "v1.1.11");
assert.equal(safeUpdateRef("v1.1.12-beta.1"), "v1.1.12-beta.1");
assert.equal(safeUpdateRef("9397203733562d6baeec9e38ac519698c619edcb"), "9397203733562d6baeec9e38ac519698c619edcb");
assert.equal(safeUpdateRef("--hard"), "");
assert.equal(safeUpdateRef("origin/master"), "");
assert.equal(safeUpdateRef("../evil"), "");
assert.equal(safeUpdateRef("master;rm"), "");

const masterTar = "https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.tar.gz";
assert.equal(pluginAddSpec("git+https://github.com/yujunzhixue/dsh-purge.git", "master"), masterTar);
assert.equal(pluginAddSpec("github:yujunzhixue/dsh-purge", "master"), masterTar);
assert.equal(pluginAddSpec("https://github.com/YuJunZhiXue/dsh-purge/archive/refs/heads/master.zip", "master"), masterTar);
assert.equal(pluginAddSpec("dsh-purge", "master"), "");

const head = "9397203733562d6baeec9e38ac519698c619edcb";
const tag = "5e6be24acc3e5aac981c701cc34ef710ce48c4c7";
const versions = [
  { id: "master", ref: "master", sha: head, version: "1.1.11", channel: "stable", latest: true },
  { id: "v1.1.11", ref: "v1.1.11", sha: tag, version: "1.1.11", channel: "stable" },
];
const marked = markCurrent(versions, { channel: "stable", pin: "" }, "1.1.11", head);
assert.equal(marked.find((item) => item.ref === "master").current, true);
assert.equal(marked.find((item) => item.ref === "v1.1.11").current, false);

const onTag = markCurrent(versions, { channel: "stable", pin: "v1.1.11" }, "1.1.11", tag);
assert.equal(onTag.find((item) => item.ref === "v1.1.11").current, true);
assert.equal(onTag.find((item) => item.ref === "master").current, false);

console.log("ok: update guards");
