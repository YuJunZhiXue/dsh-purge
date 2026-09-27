import assert from "node:assert/strict";
import { pathLooksDesktop, detectSurface } from "../lib/surface.js";
import { looksLikeSourceCliRoot, installHideConsoleIntoBin } from "../lib/hide-console.js";

// #40：源码仓库路径不能仅因目录名 deepseek-harness 被判成桌面端
assert.equal(
  pathLooksDesktop("/home/me/deepseek-harness/apps/cli/lib/bin.js"),
  false,
  "源码 cli 路径不应命中 pathLooksDesktop",
);
assert.equal(
  pathLooksDesktop("/home/me/deepseek-harness/node_modules/@deepseek-ai/dsh/lib/bin.js"),
  false,
  "源码树里的 node_modules 也不应仅凭目录名判桌面",
);
assert.equal(
  detectSurface({
    argv: ["/usr/bin/node", "/home/me/deepseek-harness/apps/cli/lib/bin.js"],
    execPath: "/usr/bin/node",
    env: {},
  }),
  "web",
  "源码版 argv 应判为 web",
);

// 官方桌面安装形态仍应命中
assert.equal(
  pathLooksDesktop("C:/DeepSeek Harness/resources/app.asar/node_modules/@deepseek-ai/dsh"),
  true,
  "官方 Win resources 路径应判桌面",
);
assert.equal(
  pathLooksDesktop("/Applications/DeepSeek Harness.app/Contents/Resources/app"),
  true,
  "官方 macOS .app Resources 应判桌面",
);
assert.equal(
  pathLooksDesktop("C:/deepseek-harness/deepseek-harness.exe"),
  true,
  "官方 exe 路径应判桌面",
);
assert.equal(
  pathLooksDesktop("C:/dsh-desktop/DSH Desktop.exe"),
  true,
  "第三方 DSH Desktop 应判桌面",
);

// #41：源码 apps/cli 识别 + 禁止注入
assert.equal(looksLikeSourceCliRoot("E:/DSH/apps/cli"), true);
assert.equal(looksLikeSourceCliRoot("/home/me/deepseek-harness/apps/cli"), true);
assert.equal(
  looksLikeSourceCliRoot("/home/me/deepseek-harness/node_modules/@deepseek-ai/dsh"),
  false,
);

const prev = process.platform;
Object.defineProperty(process, "platform", { value: "win32" });
try {
  const status = installHideConsoleIntoBin("E:/DSH/apps/cli", {
    fs: {
      existsSync: () => true,
      readFileSync: () => 'import "./x.js";\n',
      writeFileSync: () => {
        throw new Error("source cli must not be written");
      },
      unlinkSync: () => {
        throw new Error("source cli must not be unlinked");
      },
    },
    path: await import("node:path").then((m) => m.default),
  });
  assert.equal(status, "skipped_source_cli", "源码 cli 应跳过 hide-console 注入");
} finally {
  Object.defineProperty(process, "platform", { value: prev });
}

console.log("ok: surface desktop + source cli guards (#40/#41)");
