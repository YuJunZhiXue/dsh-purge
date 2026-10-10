import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_PATCHES,
  commitOverrideOnApply,
  defaultOverrideText,
  looksLikePluginDefault,
  seedPromptInjectAtBoot,
} from "../lib/core.js";

const CHATML = "<|im_start|>system:<project_instructions>";
const STALE = `${CHATML}\nYou are Little Code Sauce.\nSTALE PLUGIN DEFAULT`;
const USER = "我自己写的提示词，没有小码酱标记。";

async function tempHome() {
  const home = await mkdtemp(path.join(tmpdir(), "dsh-purge-ov-"));
  await mkdir(path.join(home, "dsh-purge"), { recursive: true });
  return home;
}

test("looksLikePluginDefault recognizes sealed and ChatML+LCS stale copies", () => {
  assert.equal(looksLikePluginDefault(defaultOverrideText()), true);
  assert.equal(looksLikePluginDefault(STALE), true);
  assert.equal(looksLikePluginDefault(USER), false);
});

test("stale plugin default with customized flag refreshes to current slot", async () => {
  const home = await tempHome();
  try {
    await writeFile(path.join(home, "prompt-inject.md"), STALE, "utf8");
    await writeFile(path.join(home, "dsh-purge", "override-state.json"), JSON.stringify({
      customized: true,
      hash: "dead",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }), "utf8");
    const seed = seedPromptInjectAtBoot(home);
    assert.ok(seed.action === "refresh_default" || seed.action === "seed_default");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("real user override is kept", async () => {
  const home = await tempHome();
  try {
    await writeFile(path.join(home, "prompt-inject.md"), USER, "utf8");
    const seed = seedPromptInjectAtBoot(home);
    assert.equal(seed.action, "kept_user_custom");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("apply without save seeds sealed when box still holds plugin default", async () => {
  const home = await tempHome();
  try {
    const out = await commitOverrideOnApply(home, STALE);
    assert.ok(out.action === "refresh_default" || out.action === "seed_default" || out.action === "current");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("apply keeps a prompt the user actually wrote", async () => {
  const home = await tempHome();
  try {
    const out = await commitOverrideOnApply(home, USER);
    assert.equal(out.action, "saved_user");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("seedPromptInjectAtBoot is a no-op when disk already matches the slot", async () => {
  const home = await tempHome();
  try {
    await writeFile(path.join(home, "prompt-inject.md"), defaultOverrideText(), "utf8");
    const seed = seedPromptInjectAtBoot(home);
    assert.equal(seed.action, "current");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("patch 86 rewrites steer to next-turn", () => {
  const patch = ALL_PATCHES.find((item) => item.id === 86);
  assert.ok(patch);
  const joined = (patch.replacements || []).map((row) => row.replace).join("\n");
  assert.match(joined, /next-turn/);
  assert.match(joined, /\[dsh-purge-86\]/);
});

test("patch 87 normalizes hang needle to LF", () => {
  const patch = ALL_PATCHES.find((item) => item.id === 87);
  assert.ok(patch);
  const joined = (patch.replacements || []).map((row) => row.replace).join("\n");
  assert.match(joined, /replace\(\/\\r\\n\/g/);
  assert.match(joined, /\[dsh-purge-87\]/);
});
