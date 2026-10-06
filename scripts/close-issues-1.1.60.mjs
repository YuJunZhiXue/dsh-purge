import { execSync } from "node:child_process";

const sha = "af13e8c201b526dc3bbce949351fb46a762eb1eb";
const owner = "YuJunZhiXue";
const repo = "dsh-purge";

function gitToken() {
  const out = execSync("git credential fill", {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
  });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error("no github token from git credential");
  return m[1].trim();
}

const token = gitToken();

async function gh(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

const comments = {
  66: `已在 1.1.60 (${sha}) 继续加固：lib/desktop.js 探测 JScript 不可用时走 PowerShell 换包，且不再用 inflight 标记误杀 PS 兜底。请用 tag v1.1.60 验证。`,
  67: `${sha}（1.1.60）：lib/desktop.js 的 patchOfficialCliCmdText 优先解包路径、修复 dsh.cmd 自引用；再点一次应用即可。`,
  68: `${sha}（1.1.60）：README 写明官方桌面用 dsh plugin --profile desktop add …/master.tar.gz；Hub 市场一键仍走 git（无 prepare），文档已说明。`,
  69: `${sha}（1.1.60）：演练台 .rt-dock 默认 position:fixed，嵌入清洗面板时为 relative，见 lib/redteam/client.js。`,
  70: `${sha}（1.1.60）：lib/redteam/skill-availability.js 按本机 OS/CPU 判定技能路径，不把其它平台文件名当缺失。`,
  71: `${sha}（1.1.60）：lib/identity.js installAssembleGuard 幂等，避免重复 Proxy 栈溢出。`,
};

for (const n of [66, 67, 68, 69, 70, 71]) {
  const issue = await gh(`/repos/${owner}/${repo}/issues/${n}`);
  await gh(`/repos/${owner}/${repo}/issues/${n}/comments`, {
    method: "POST",
    body: { body: comments[n] },
  });
  if (issue.state === "open") {
    await gh(`/repos/${owner}/${repo}/issues/${n}`, {
      method: "PATCH",
      body: { state: "closed", state_reason: "completed" },
    });
    process.stdout.write(`closed #${n}\n`);
  } else {
    process.stdout.write(`#${n} already closed (comment added)\n`);
  }
}

process.stdout.write("done 66-71\n");
