import assert from "node:assert/strict";
import test from "node:test";
import { ALL_PATCHES, applyReplacementsToText } from "../lib/core.js";

const patch = ALL_PATCHES.find(({ id }) => id === 21);
const filename = "dsh-base/cordis.patch.yml";
const marker = "# [dsh-purge] bash timeout raised";

function fixture(timeout, name = "@deepseek-ai/dsh-bash-sandbox") {
  return `- insert:
    - id: bash-sandbox
      name: '${name}'
      disabled: false
      config:
        timeoutMs: ${timeout}
    - id: other-tool
      config:
        timeoutMs: 600000
`;
}

function apply(text) {
  return applyReplacementsToText(text, patch, filename);
}

test("preserves the official 60-second default", () => {
  const text = fixture("60000");
  assert.deepEqual(apply(text), { text, changed: false });
});

test("restores the plugin's 10-minute wait without changing adjacent config", () => {
  assert.deepEqual(apply(fixture(`600000 ${marker}`)), {
    text: fixture("60000"),
    changed: true,
  });
});

test("migrates marked older extra-zero and invalid-comment variants", () => {
  for (const value of ["600000", "600000000000000"]) {
    for (const comment of [marker, marker.replace("#", "//")]) {
      assert.deepEqual(apply(fixture(`${value} ${comment}`)), {
        text: fixture("60000"),
        changed: true,
      });
    }
  }
});

test("repeated apply is idempotent", () => {
  let text = apply(fixture(`600000 ${marker}`)).text;
  for (let i = 0; i < 3; i += 1) {
    assert.deepEqual(apply(text), { text, changed: false });
  }
});

test("preserves custom values, including an unmarked 10-minute wait", () => {
  for (const value of ["10000", "45000", "600000", "660000", `10000 ${marker}`, `660000 ${marker}`]) {
    const text = fixture(value);
    assert.deepEqual(apply(text), { text, changed: false });
  }
});

test("never migrates another executor or crosses an entry boundary", () => {
  const other = fixture(`600000 ${marker}`, "@deepseek-ai/dsh-pwsh-sandbox");
  assert.deepEqual(apply(other), { text: other, changed: false });
  const missing = fixture("60000")
    .replace("        timeoutMs: 60000\n", "")
    .replace("        timeoutMs: 600000", `        timeoutMs: 600000 ${marker}`);
  assert.deepEqual(apply(missing), { text: missing, changed: false });
});

test("preserves CRLF and accepts a timeout on the last line", () => {
  const source = fixture(`600000 ${marker}`).split("    - id: other-tool")[0].trimEnd();
  const expected = fixture("60000").split("    - id: other-tool")[0].trimEnd();
  assert.equal(apply(source).text, expected);
  assert.equal(apply(source.replaceAll("\n", "\r\n")).text, expected.replaceAll("\n", "\r\n"));
});

test("migrates each marked Bash entry without leaking regex state", () => {
  const source = fixture(`600000 ${marker}`);
  assert.equal(apply(source + source).text, fixture("60000") + fixture("60000"));
  assert.equal(apply(source).changed, true);
});
