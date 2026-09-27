import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isUserProfilePatchFile,
  dropStaleUserProfilePatchBackups,
  targetFiles,
} from "../lib/core.js";

assert.equal(
  isUserProfilePatchFile("D:/DeepSeek Harness/.dsh/profiles/web/cordis.patch.yml"),
  true,
);
assert.equal(
  isUserProfilePatchFile("C:/Users/x/.dsh/profiles/desktop/cordis.patch.yml"),
  true,
);
assert.equal(
  isUserProfilePatchFile("/home/me/.dsh/profiles/web/node_modules/dsh-purge/cordis.patch.yml"),
  false,
  "插件自己的 cordis.patch.yml 不是用户 profile 层",
);
assert.equal(
  isUserProfilePatchFile("/x/node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml"),
  false,
);

// targetFiles 不得再收录 profiles/*/cordis.patch.yml（#43）
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-purge-43-"));
const profilePatch = path.join(tmpHome, "profiles", "web", "cordis.patch.yml");
fs.mkdirSync(path.dirname(profilePatch), { recursive: true });
fs.writeFileSync(profilePatch, "patches:\n  - insert: user-mcp\n", "utf8");
const bak = `${profilePatch}.dshpurge.bak`;
fs.writeFileSync(bak, "patches: []\n", "utf8");

const files = targetFiles(path.join(tmpHome, "missing-ai-base"), tmpHome);
const flat = Object.values(files).flatMap((v) => (Array.isArray(v) ? v : [v])).filter(Boolean);
assert.equal(
  flat.some((fp) => isUserProfilePatchFile(fp)),
  false,
  "targetFiles 不应包含用户 profile cordis.patch.yml",
);

const before = fs.readFileSync(profilePatch, "utf8");
const dropped = await dropStaleUserProfilePatchBackups(tmpHome);
assert.equal(dropped.length, 1, "应丢掉误建 bak");
assert.equal(fs.existsSync(bak), false, "bak 应已删除");
assert.equal(fs.readFileSync(profilePatch, "utf8"), before, "用户当前内容必须保留");

fs.rmSync(tmpHome, { recursive: true, force: true });
console.log("ok: user profile cordis.patch.yml not reverted (#43)");
