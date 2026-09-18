import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  stripPluginFromPackage,
  shouldDeletePluginTree,
  wasApplied,
} from "../lib/uninstall.js";
import { revertHideConsoleFromBin } from "../lib/hide-console.js";

assert.equal(wasApplied({ has_backup: true, patches_applied: 0 }), true);
assert.equal(wasApplied({ has_backup: false, patches_applied: 3 }), true);
assert.equal(wasApplied({ has_backup: false, patches_applied: 0, shim_cmd: "patched" }), true);
assert.equal(wasApplied({ has_backup: false, patches_applied: 0, shim_cmd: "original" }), false);

const pkg = {
  dependencies: { "dsh-purge": "github:YuJunZhiXue/dsh-purge", other: "1.0.0" },
  bundles: ["dsh-purge", "dsh-mnemon"],
  plugins: [{ id: "dsh-purge" }, { id: "keep-me" }],
};
assert.equal(stripPluginFromPackage(pkg), true);
assert.equal(pkg.dependencies["dsh-purge"], undefined);
assert.equal(pkg.dependencies.other, "1.0.0");
assert.deepEqual(pkg.bundles, ["dsh-mnemon"]);
assert.deepEqual(pkg.plugins, [{ id: "keep-me" }]);
assert.equal(stripPluginFromPackage(pkg), false);

const home = path.join(os.tmpdir(), "dsh-home-fake");
assert.equal(
  shouldDeletePluginTree(path.join(home, "profiles", "web", "node_modules", "dsh-purge"), home),
  true,
);
assert.equal(shouldDeletePluginTree(path.join(os.tmpdir(), "vendor", "dsh-purge"), home), false);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-hide-"));
const binRoot = path.join(tmp, "dsh");
const libDir = path.join(binRoot, "lib");
fs.mkdirSync(libDir, { recursive: true });
const binJs = path.join(libDir, "bin.js");
fs.writeFileSync(
  binJs,
  'import "./dsh-purge-hide-console.js"; // [dsh-purge] hide-console\nconsole.log("ok");\n',
  "utf8",
);
fs.writeFileSync(path.join(libDir, "dsh-purge-hide-console.js"), "// side\n", "utf8");
fs.writeFileSync(path.join(libDir, "dsh-purge-child-process-hide.mjs"), "// facade\n", "utf8");
assert.equal(revertHideConsoleFromBin(binRoot, { fs, path }), "reverted");
assert.equal(fs.readFileSync(binJs, "utf8"), 'console.log("ok");\n');
assert.equal(fs.existsSync(path.join(libDir, "dsh-purge-hide-console.js")), false);
assert.equal(revertHideConsoleFromBin(binRoot, { fs, path }), "absent");
fs.rmSync(tmp, { recursive: true, force: true });

console.log("uninstall.test.js ok");
