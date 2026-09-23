import assert from "node:assert/strict";
import { hideListedVersion, latestStableVersion, markCurrent, pluginAddSpec, safeUpdateRef } from "../lib/update.js";

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

const caughtUp = [
  { ref: "master", version: "1.1.12", channel: "stable", latest: true },
  { ref: "v1.1.12", version: "1.1.12", channel: "stable" },
  { ref: "v1.1.12-beta.1", version: "1.1.12-beta.1", channel: "beta" },
  { ref: "beta", version: "1.1.12-beta.1", channel: "beta", latest: true },
  { ref: "v1.1.13-beta.1", version: "1.1.13-beta.1", channel: "beta" },
];
const ceiling = latestStableVersion(caughtUp);
assert.equal(ceiling, "1.1.12");
assert.equal(hideListedVersion(caughtUp[2], ceiling), true);
assert.equal(hideListedVersion(caughtUp[3], ceiling), true);
assert.equal(hideListedVersion(caughtUp[4], ceiling), false);
assert.equal(hideListedVersion({ ref: "v1.1.11-beta.1", version: "1.1.11-beta.1", channel: "beta" }, ""), true);

const visible = caughtUp.filter((item) => !hideListedVersion(item, ceiling));
assert.deepEqual(visible.map((item) => item.ref), ["master", "v1.1.12", "v1.1.13-beta.1"]);
const staleSha = "423a91614baa747b56749003d054fedb8e725714";
const shown = markCurrent(visible, { channel: "stable", pin: "" }, "1.1.12", staleSha);
assert.equal(shown.find((item) => item.ref === "master").current, true);
assert.equal(shown.find((item) => item.ref === "v1.1.12").current, false);
assert.equal(shown.find((item) => item.ref === "v1.1.13-beta.1").current, false);

console.log("ok: update guards");
