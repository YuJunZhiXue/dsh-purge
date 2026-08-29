import assert from "node:assert/strict";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { findAiBase } from "../lib/core.js";

test("findAiBase detects Electron app.asar.unpacked dependencies", async (t) => {
  const resourcesPath = await fsp.mkdtemp(path.join(os.tmpdir(), "dsh-purge-desktop-"));
  const aiBase = path.join(resourcesPath, "app.asar.unpacked", "node_modules", "@deepseek-ai");
  await fsp.mkdir(path.join(aiBase, "dsh-agent-instructions", "lib"), { recursive: true });

  const originalDescriptor = Object.getOwnPropertyDescriptor(process, "resourcesPath");
  const originalDshBase = process.env.DSH_BASE;

  // 模拟 Electron 主进程暴露的 resourcesPath。
  Object.defineProperty(process, "resourcesPath", { configurable: true, value: resourcesPath });
  delete process.env.DSH_BASE;

  t.after(async () => {
    if (originalDescriptor) Object.defineProperty(process, "resourcesPath", originalDescriptor);
    else delete process.resourcesPath;
    if (originalDshBase === undefined) delete process.env.DSH_BASE;
    else process.env.DSH_BASE = originalDshBase;
    await fsp.rm(resourcesPath, { recursive: true, force: true });
  });

  assert.equal(findAiBase(), aiBase);
});
