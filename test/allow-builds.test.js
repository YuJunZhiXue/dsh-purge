import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatAllowBuildLine,
  parseAllowBuildLine,
  rewritePnpmAllowBuilds,
} from "../lib/profile-insert.js";

test("formatAllowBuildLine: 给包含冒号的键加双引号，普通键保持原样", () => {
  assert.equal(formatAllowBuildLine("dsh-purge"), "  dsh-purge: true");
  assert.equal(
    formatAllowBuildLine("dsh-purge@https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master"),
    '  "dsh-purge@https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master": true'
  );
});

test("parseAllowBuildLine: 无论是否带引号，均完整提取 URL 键而不从冒号截断", () => {
  const unquoted = parseAllowBuildLine("  dsh-purge@https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/master: true");
  assert.equal(unquoted.key, "dsh-purge@https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/master");
  assert.equal(unquoted.value, "true");

  const quoted = parseAllowBuildLine('  "dsh-purge@https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/master": true');
  assert.equal(quoted.key, "dsh-purge@https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/master");
  assert.equal(quoted.value, "true");
});

test("rewritePnpmAllowBuilds: 自动清除截断累积的畸形键并去重自愈（#180）", () => {
  const corrupted = `packages:
  - .

allowBuilds:
  cpu-features: true
  dsh-purge: true
  dsh-purge@https: true
  dsh-purge@https: true
  dsh-purge@git+https: true
  dsh-purge@https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master: true
`;
  const result = rewritePnpmAllowBuilds(corrupted);
  assert.equal(result.includes("dsh-purge@https: true"), false, "畸形键必须全部被清除");
  assert.equal(result.includes("dsh-purge@git+https: true"), false, "畸形键必须全部被清除");
  assert.equal(result.includes('  "dsh-purge@https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master": true'), true);
  assert.equal(result.includes("  cpu-features: true"), true);
});
