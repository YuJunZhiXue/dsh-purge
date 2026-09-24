import assert from "node:assert/strict";
import { ALL_PATCHES, applyReplacementsToText, yamlJsCommentsToHash } from "../lib/core.js";

const bash = ALL_PATCHES.find((patch) => patch.id === 21);
assert.equal(bash.name, "BASH_TIMEOUT_RAISED");
assert.equal(bash.replacements[0].replace.includes("//"), false);
assert.match(bash.markers[0], /timeoutMs: 600000 # \[dsh-purge\]/);

const head =
  "- id: bash-sandbox\n" +
  "  name: '@deepseek-ai/dsh-bash-sandbox'\n" +
  "  config:\n";
const indent = " ".repeat(8);

const fresh = applyReplacementsToText(
  `${head}${indent}timeoutMs: 60000\n`,
  bash,
  "cordis.patch.yml",
);
assert.equal(fresh.changed, true);
assert.match(fresh.text, /timeoutMs: 600000 # \[dsh-purge\] bash timeout raised/);
assert.equal(fresh.text.includes("//"), false);

const broken = applyReplacementsToText(
  `${head}${indent}timeoutMs: 600000 // [dsh-purge] bash timeout raised\n`,
  bash,
  "cordis.patch.yml",
);
assert.equal(broken.changed, true);
assert.equal(broken.text, fresh.text);

const healed = applyReplacementsToText(fresh.text, bash, "cordis.patch.yml");
assert.equal(healed.changed, false);
assert.equal(healed.text, fresh.text);

const jsKept = applyReplacementsToText(
  'text: "You are an AI agent powered by DeepSeek Harness."\n',
  {
    replacements: [{
      pattern: 'text: "You are an AI agent powered by DeepSeek Harness."',
      replace: 'text: "" // [dsh-purge] identity stripped',
    }],
  },
  "lib/index.js",
);
assert.match(jsKept.text, /text: "" \/\/ \[dsh-purge\] identity stripped/);

const yamlFixed = applyReplacementsToText(
  'text: "You are an AI agent powered by DeepSeek Harness."\n',
  {
    replacements: [{
      pattern: 'text: "You are an AI agent powered by DeepSeek Harness."',
      replace: 'text: "" // [dsh-purge] identity stripped',
    }],
  },
  "agent.cordis.yml",
);
assert.match(yamlFixed.text, /text: "" # \[dsh-purge\] identity stripped/);
assert.equal(yamlFixed.text.includes("//"), false);

assert.equal(
  yamlJsCommentsToHash("mode: !!js process.env.X ?? 'https://example.com' // keep"),
  "mode: !!js process.env.X ?? 'https://example.com' // keep",
);
assert.equal(yamlJsCommentsToHash("url: https://example.com"), "url: https://example.com");
assert.equal(
  yamlJsCommentsToHash('note: "keep // inside"'),
  'note: "keep // inside"',
);

const yamlPatches = ALL_PATCHES.filter((patch) => {
  const keys = Array.isArray(patch.file) ? patch.file : [patch.file];
  return keys.some((key) => /preset|web-app|headless|base$|agent-preset/.test(key));
});
for (const patch of yamlPatches) {
  const reps = patch.replacements || (patch.patterns || []).map((pattern) => ({ pattern, replace: patch.replace }));
  for (const rep of reps) {
    if (typeof rep.replace !== "string" || !rep.replace.includes("//")) continue;
    const safe = yamlJsCommentsToHash(rep.replace);
    assert.equal(safe.includes(" //"), false, `${patch.name} still writes a JS comment into YAML`);
  }
}

console.log("ok: yaml comments");
