import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ALL_PATCHES, applyPatches, patchStatus, targetFiles } from "../lib/core.js";

function touch(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "fixture", "utf8");
}

test("targetFiles resolves the current monorepo package layout", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-purge-layout-"));
  try {
    const aiBase = path.join(root, "node_modules", "@deepseek-ai");
    const packages = path.join(root, "packages");
    const dshHome = path.join(root, "dsh-home");
    fs.mkdirSync(aiBase, { recursive: true });
    fs.mkdirSync(path.join(packages, "bundle", "base"), { recursive: true });
    fs.symlinkSync(path.join(packages, "bundle", "base"), path.join(aiBase, "dsh-base"));

    const approval = path.join(packages, "interaction", "user-approval", "lib", "types", "index.js");
    const approvalCode = path.join(packages, "interaction", "user-approval", "lib", "index.js");
    const escalation = path.join(packages, "sandbox", "sandbox", "lib", "types", "escalation.js");
    const fsSandbox = path.join(packages, "fs", "fs-sandbox", "lib", "index.js");
    const sandbox = path.join(packages, "sandbox", "sandbox-local", "lib", "index.js");
    const persona = path.join(dshHome, ".agent-presets", "unrestricted", "agent.cordis.yml");
    touch(approval);
    touch(approvalCode);
    touch(escalation);
    touch(fsSandbox);
    touch(sandbox);
    touch(persona);

    const files = targetFiles(aiBase, dshHome);
    assert.equal(fs.realpathSync(files["user-approval"]), fs.realpathSync(approval));
    assert.equal(fs.realpathSync(files["user-approval-code"]), fs.realpathSync(approvalCode));
    assert.equal(fs.realpathSync(files["escalation"]), fs.realpathSync(escalation));
    assert.equal(fs.realpathSync(files["fs-sandbox"]), fs.realpathSync(fsSandbox));
    assert.equal(fs.realpathSync(files["sandbox-local"]), fs.realpathSync(sandbox));
    assert.equal(fs.realpathSync(files["agent-preset"]), fs.realpathSync(persona));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("patch 21 repairs its workspace link when the manifest marker already exists", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-purge-web-fetch-"));
  try {
    const aiBase = path.join(root, "apps", "cli", "node_modules", "@deepseek-ai");
    const base = path.join(root, "packages", "bundle", "base");
    const fetchPackage = path.join(root, "packages", "web", "web-fetch-http");
    const link = path.join(base, "node_modules", "@deepseek-ai", "dsh-web-fetch-http");
    fs.mkdirSync(aiBase, { recursive: true });
    fs.mkdirSync(base, { recursive: true });
    fs.mkdirSync(fetchPackage, { recursive: true });
    fs.writeFileSync(path.join(fetchPackage, "package.json"), JSON.stringify({
      name: "@deepseek-ai/dsh-web-fetch-http",
      version: "0.0.0",
    }));
    fs.writeFileSync(path.join(base, "package.json"), JSON.stringify({
      name: "@deepseek-ai/dsh-base",
      dependencies: { "@deepseek-ai/dsh-web-fetch-http": "workspace:^" },
    }, null, 2));
    fs.symlinkSync(base, path.join(aiBase, "dsh-base"));

    const patch = ALL_PATCHES.find(({ id }) => id === 21);
    assert.equal((await patchStatus(aiBase, [patch]))[21], "pending");

    const [result] = await applyPatches(aiBase, [patch]);
    assert.equal(result.status, "applied");
    assert.equal(fs.realpathSync(link), fs.realpathSync(fetchPackage));
    assert.equal((await patchStatus(aiBase, [patch]))[21], "applied");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
