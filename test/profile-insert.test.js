import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseAllowBuildLine,
  formatAllowBuildLine,
  validateAllowBuildRewrite,
  purgePnpmBuildSpecs,
  rewritePnpmAllowBuilds,
  ensurePnpmAllowBuild,
} from "../lib/profile-insert.js";

const MASTER_URL = "https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master";
const COMMIT_URL = "https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/abc1234567890";

function withTempProfile(lockText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-purge-test-"));
  if (lockText !== undefined) {
    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), lockText, "utf8");
  }
  return dir;
}

test("URL 键解析不被冒号截断", () => {
  const parsed = parseAllowBuildLine(`  dsh-purge@${MASTER_URL}: true`);
  assert.equal(parsed.key, `dsh-purge@${MASTER_URL}`);
  assert.equal(parsed.value, "true");
});

test("畸形键也解析成整键（自愈时统一丢弃）", () => {
  assert.deepEqual(parseAllowBuildLine("  dsh-purge@https: true"), {
    key: "dsh-purge@https",
    value: "true",
  });
  assert.deepEqual(parseAllowBuildLine("  dsh-purge@1.1.81: true"), {
    key: "dsh-purge@1.1.81",
    value: "true",
  });
});

test("行尾没有值的 `key:` 解析为空值", () => {
  assert.deepEqual(parseAllowBuildLine("  dsh-purge@https:"), {
    key: "dsh-purge@https",
    value: "",
  });
  assert.deepEqual(parseAllowBuildLine("  dsh-purge:"), {
    key: "dsh-purge",
    value: "",
  });
});

test("引号包裹的键照旧解析", () => {
  const spec = `dsh-purge@${MASTER_URL}`;
  for (const line of [`  "${spec}": true`, `  '${spec}': true`]) {
    assert.deepEqual(parseAllowBuildLine(line), { key: spec, value: "true" });
  }
});

test("URL 键写回带引号且 round-trip 无损", () => {
  const spec = `dsh-purge@${MASTER_URL}`;
  const line = formatAllowBuildLine(spec);
  assert.equal(line, `  "${spec}": true`);
  assert.deepEqual(parseAllowBuildLine(line), { key: spec, value: "true" });
  // 不含 URL 的键保持无引号，round-trip 同样无损
  const plain = formatAllowBuildLine("dsh-purge");
  assert.equal(plain, "  dsh-purge: true");
  assert.deepEqual(parseAllowBuildLine(plain), { key: "dsh-purge", value: "true" });
});

test("污染的 allowBuilds 重写后只剩期望键", () => {
  const polluted = [
    "packages:",
    "  - '.'",
    "",
    "allowBuilds:",
    "  cpu-features: true",
    "  ssh2: true",
    "  dsh-purge: true",
    "  dsh-purge@1.1.81: true",
    "  dsh-purge@https: true",
    "  dsh-purge@https: true",
    `  dsh-purge@${MASTER_URL}: true`,
    "",
  ].join("\n");
  const next = rewritePnpmAllowBuilds(polluted);
  const keys = next.split("\n").filter((line) => parseAllowBuildLine(line)).map((line) => parseAllowBuildLine(line).key);
  // 期望键：裸包名 + package.json 的 tarball（本仓库装的是 master tarball，无 profileDir 时)
  const wanted = ["cpu-features", "ssh2", ...purgePnpmBuildSpecs()];
  assert.deepEqual([...new Set(keys)], wanted);
  // 畸形历史键一个都不留
  for (const bad of [`dsh-purge@1.1.81`, `dsh-purge@https`]) {
    assert.equal(keys.includes(bad), false, `should drop ${bad}`);
  }
  // 重复出现过的 `dsh-purge@https` 只允许来自 wanted 精确键，且不重复
  assert.equal(keys.filter((key) => key.startsWith("dsh-purge")).length, purgePnpmBuildSpecs().length);
  // 保留段的结构仍然合法
  assert.equal(validateAllowBuildRewrite(next), true);
});

test("非 purge 键原样保留，无 allowBuilds 段时追加", () => {
  const base = "packages:\n  - '.'\n";
  const next = rewritePnpmAllowBuilds(base);
  assert.equal(next.startsWith("packages:\n  - '.'\n\nallowBuilds:\n"), true);
  // 追加的是期望键（裸包名 + package.json 的 tarball）
  for (const spec of purgePnpmBuildSpecs()) {
    const escaped = formatAllowBuildLine(spec).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(next, new RegExp(`^${escaped}$`, "m"));
  }
  const withSection = "allowBuilds:\n  cpu-features: true\n  ssh2: true\n";
  const next2 = rewritePnpmAllowBuilds(withSection);
  assert.match(next2, /^ {2}cpu-features: true$/m);
  assert.match(next2, /^ {2}ssh2: true$/m);
});

test("写前校验：重复顶层键 / 重复 allowBuilds 键 / 解析不了的行判无效", () => {
  assert.equal(validateAllowBuildRewrite("packages:\n  - '.'\n\npackages:\n  - \"..\"\n"), false);
  assert.equal(validateAllowBuildRewrite("allowBuilds:\n  cpu-features: true\n  cpu-features: true\n"), false);
  // 没有键值分隔的裸行解析不出来，校验必须挡下
  assert.equal(validateAllowBuildRewrite("allowBuilds:\n  不是键值对\n"), false);
  assert.equal(validateAllowBuildRewrite("allowBuilds:\n# 注释行放行\n  ssh2: true\n"), true);
});

test("purgePnpmBuildSpecs 仅返回安全包名，避免向 allowBuilds 注入非法 URL 导致 ERR_PNPM_INVALID_VERSION_UNION", () => {
  const dir = withTempProfile([
    "lockfileVersion: '9.0'",
    "",
    "importers:",
    "",
    "  .:",
    "    dependencies:",
    "      dsh-purge:",
    `        specifier: ${COMMIT_URL}`,
    `        version: dsh-purge@${COMMIT_URL}`,
    "",
  ].join("\n"));
  const specs = purgePnpmBuildSpecs(dir);
  assert.deepEqual(specs, ["dsh-purge"]);
});

test("lock 读不到或无文件时，purgePnpmBuildSpecs 稳定返回安全裸包名", () => {
  const dir = withTempProfile();
  assert.deepEqual(purgePnpmBuildSpecs(dir), ["dsh-purge"]);
  const dir2 = withTempProfile([
    "importers:",
    "",
    "  .:",
    "    dependencies:",
    "      dsh-purge:",
    "        specifier: https://codeload.github.com/YuJunZhiXue/dsh-purge/tar.gz/refs/heads/master",
    "        version: '1.1.81'",
    "",
  ].join("\n"));
  assert.deepEqual(purgePnpmBuildSpecs(dir2), ["dsh-purge"]);
});

test("重写污染文件：带 URL、畸形及过期历史键全数自愈清除，仅收敛为纯净的 dsh-purge: true", () => {
  const dir = withTempProfile([
    "lockfileVersion: '9.0'",
    "",
    "importers:",
    "",
    "  .:",
    "    dependencies:",
    "      dsh-purge:",
    `        specifier: ${COMMIT_URL}`,
    `        version: dsh-purge@${COMMIT_URL}`,
    "",
  ].join("\n"));
  const polluted = [
    "packages:",
    "  - '.'",
    "",
    "allowBuilds:",
    "  ssh2: true",
    `  dsh-purge@${MASTER_URL}: true`,
    "  dsh-purge@https: true",
    `  "dsh-purge@${COMMIT_URL}": true`,
    "",
  ].join("\n");
  const next = rewritePnpmAllowBuilds(polluted, dir);
  const keys = next.split("\n").filter((line) => parseAllowBuildLine(line)).map((line) => parseAllowBuildLine(line).key);
  assert.equal(keys.includes("dsh-purge"), true);
  assert.equal(keys.includes(`dsh-purge@${COMMIT_URL}`), false);
  assert.equal(keys.includes(`dsh-purge@${MASTER_URL}`), false);
  assert.equal(keys.includes("dsh-purge@https"), false);
  assert.equal(keys.includes("ssh2"), true);
  // 重写输出收敛为规范包名
  assert.equal(next.split("\n").some((line) => line === "  dsh-purge: true"), true);
});

test("幂等：健康文件重写输出等于输入，零写入", () => {
  const dir = withTempProfile();
  const fp = path.join(dir, "pnpm-workspace.yaml");
  const healthy = [
    "packages:",
    "  - '.'",
    "",
    "allowBuilds:",
    "  cpu-features: true",
    "  ssh2: true",
    "  dsh-purge: true",
    "",
  ].join("\n");
  fs.writeFileSync(fp, healthy, "utf8");
  const before = fs.readFileSync(fp, "utf8");
  assert.equal(rewritePnpmAllowBuilds(before, dir), before);
  const statBefore = fs.statSync(fp);
  const result = ensurePnpmAllowBuild(dir);
  assert.equal(result.wrote, false);
  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(fp, "utf8"), before);
  assert.equal(fs.statSync(fp).mtimeMs, statBefore.mtimeMs);
});

test("幂等：第二次 ensure 不再写盘（自愈后收敛）", () => {
  const dir = withTempProfile();
  const fp = path.join(dir, "pnpm-workspace.yaml");
  const polluted = `allowBuilds:\n  ssh2: true\n  dsh-purge@https: true\n  dsh-purge@1.1.81: true\n`;
  fs.writeFileSync(fp, polluted, "utf8");
  const first = ensurePnpmAllowBuild(dir);
  assert.equal(first.wrote, true);
  const healed = fs.readFileSync(fp, "utf8");
  // 畸形历史键被清掉（URL 键带引号重写，不会留下这些裸键）
  assert.equal(healed.includes("dsh-purge@https: true"), false);
  assert.equal(healed.includes("dsh-purge@1.1.81"), false);
  const second = ensurePnpmAllowBuild(dir);
  assert.equal(second.wrote, false);
  assert.equal(fs.readFileSync(fp, "utf8"), healed);
});