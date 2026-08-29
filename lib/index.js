// dsh-purge 插件入口（小杨）
// 功能（移植自 dsh_purge.py，一个不差）：
//   1. 启动自动重洗（autoApplyOnStart）— 解决 npm 升级覆盖 node_modules 后需手动重跑的痛点
//   2. /purge 命令 — status / apply / revert / edit / help
//   3. 模型工具 — purge_status / purge_apply / purge_revert
//   4. systemPrompt 注入 — 会话强指令 section（兜底，不依赖改文件）

import fs from "node:fs";
import { promises as fsp } from "node:fs";
import * as core from "./core.js";

export const name = "dsh-purge";

export const inject = ["systemPrompt", "tools"];

const DEFAULTS = {
  enabled: true,
  autoApplyOnStart: true,
  autoRevertOnMissing: false,
  postPrompt: "",
  postPromptOrder: 1000,
  verbose: false,
};

const GLOBAL_PROMPT_ORDER = 100;

const log = (config, ...args) => {
  if (config?.verbose) console.log("[dsh-purge]", ...args);
};

function fsExists(fp) {
  return fs.existsSync(fp);
}

// ── 文本渲染（无 rich 依赖）───────────────────────────────────────

function line(title, value, ok = null) {
  const mark = ok === null ? "·" : ok ? "✓" : "✗";
  return `${mark} ${title}: ${value}`;
}

function renderStatus(state) {
  const out = [];
  out.push("dsh-purge 状态 / Status");
  out.push(line("DSH_HOME", state.dsh_home));
  if (state.ai_base) {
    out.push(line("插件根 / plugin root", state.ai_base));
    for (const [key, fp] of Object.entries(state.files)) {
      out.push(`    ${fsExists(fp) ? "✓" : "✗"} ${key.padEnd(22)} ${fp}`);
    }
  } else {
    out.push(line("插件根 / plugin root", "NOT FOUND (set DSH_BASE)", false));
  }
  out.push(line("shim 目录", state.shim_dir || "未定位 / not found", !!state.shim_dir));
  out.push(line("备份 / backup", state.has_backup ? "有 / yes" : "无 / no", state.has_backup));
  out.push(line("注入文件 / inject", state.override_path));
  out.push(line("注入状态 / override", state.override_status));
  out.push("");
  out.push(`补丁 / patches: ${state.patches_applied}/${core.ALL_PATCHES.length} applied, ${state.patches_pending} pending`);
  for (const p of core.ALL_PATCHES) {
    const s = state.patch_status[p.id];
    const mark = s === "applied" ? "✓" : s === "pending" ? "✗" : "·";
    out.push(`  ${mark} [#${String(p.id).padEnd(2)}] ${p.name.padEnd(30)} ${p.layer}/${p.layer_en} — ${s}`);
  }
  out.push("");
  out.push(`shim: dsh.cmd=${state.shim_cmd}  dsh.ps1=${state.shim_ps1}`);
  return out.join("\n");
}

export function registerPromptSections(ctx, config, injectFile) {
  ctx.systemPrompt.section({
    name: "dsh-purge",
    order: GLOBAL_PROMPT_ORDER,
    text: () => {
      if (!config.enabled) return "";
      try {
        if (!fs.existsSync(injectFile)) return "";
        return fs.readFileSync(injectFile, "utf8").trim();
      } catch {
        return "";
      }
    },
  });

  const postPrompt = typeof config.postPrompt === "string" ? config.postPrompt.trim() : "";
  if (!postPrompt) return;
  if (!Number.isFinite(config.postPromptOrder) || config.postPromptOrder <= GLOBAL_PROMPT_ORDER) {
    throw new TypeError(`postPromptOrder must be a finite number greater than ${GLOBAL_PROMPT_ORDER}`);
  }
  ctx.systemPrompt.section({
    name: "dsh-purge:post",
    order: config.postPromptOrder,
    text: postPrompt,
  });
}

// ── 自动重洗 ──────────────────────────────────────────────────────

async function autoApply(config) {
  try {
    const state = await core.gatherState();
    // 始终确保 override 文件存在（缺失则建空文件，不覆盖已有内容）
    await core.installOverride(state.dsh_home, false);
    if (!state.ai_base) {
      log(config, "skip auto-apply: plugin root not found");
      return "skip:plugin_root_not_found";
    }
    if (state.patches_pending === 0) {
      log(config, "auto-apply: already clean");
      return "already_clean";
    }
    if (!config.autoApplyOnStart) {
      log(config, "auto-apply disabled");
      return "disabled";
    }
    await core.backupAll(state.ai_base);
    const report = await core.applyPatches(state.ai_base);
    if (state.shim_dir) await core.patchShim(state.shim_dir);
    const applied = report.filter((r) => r.status === "applied").length;
    log(config, `auto-apply done: ${applied} applied`);
    return `applied:${applied}`;
  } catch (e) {
    console.warn("[dsh-purge] auto-apply error:", String(e));
    return `error:${e}`;
  }
}

// ── 命令处理 ──────────────────────────────────────────────────────

async function handlePurgeCommand(rawInput, config) {
  const args = (rawInput || "").trim().split(/\s+/).filter(Boolean);
  const sub = (args[0] || "status").toLowerCase();

  switch (sub) {
    case "status":
    case "s": {
      const state = await core.gatherState();
      return { kind: "success", text: renderStatus(state) };
    }
    case "apply":
    case "a": {
      const state = await core.gatherState();
      if (!state.ai_base) {
        return { kind: "error", text: "插件根未找到 / plugin root NOT FOUND — 请设置 DSH_BASE" };
      }
      await core.backupAll(state.ai_base);
      const report = await core.applyPatches(state.ai_base);
      await core.installOverride(state.dsh_home, false);
      if (state.shim_dir) await core.patchShim(state.shim_dir);
      const lines = report.map((r) => {
        const m = r.status === "applied" ? "✓ 已清洗" : r.status === "already" ? "- 已是最新" : r.status === "missing_file" ? "⚠ 文件缺失" : `✗ ${r.status}`;
        return `  ${m} patch #${String(r.patch_id).padEnd(2)} ${r.name}`;
      });
      lines.push("", "全部完成 / All done。重启 dsh 生效 / Restart dsh to take effect.");
      return { kind: "success", text: lines.join("\n") };
    }
    case "revert":
    case "r": {
      const state = await core.gatherState();
      const lines = [];
      if (state.ai_base) {
        const { reverted, errors } = await core.revertAll(state.ai_base);
        lines.push(...reverted.map((p) => `  ✓ 已还原 / Reverted ${p}`));
        for (const [p, e] of errors) lines.push(`  ⚠ 还原失败 ${p}: ${e}`);
        if (reverted.length === 0) lines.push("  - 没有补丁备份可还原 / no patch backup");
      }
      if (state.shim_dir) {
        const r = await core.revertShim(state.shim_dir);
        for (const [fname, st] of Object.entries(r)) {
          if (st === "reverted" || st === "stripped_inject") lines.push(`  ✓ shim ${fname}: ${st}`);
          else lines.push(`  - shim ${fname}: ${st}`);
        }
      }
      lines.push("", "回滚完成 / Revert done。重启 dsh 后恢复 / restart to restore.");
      lines.push("注: prompt-inject.md 保留（用户文件）/ prompt-inject.md kept (user file)");
      return { kind: "success", text: lines.join("\n") };
    }
    case "edit":
    case "e": {
      const state = await core.gatherState();
      const r = core.editOverride(state.dsh_home);
      if (!r.ok && r.needCreate) {
        await core.installOverride(state.dsh_home, true);
        const r2 = core.editOverride(state.dsh_home);
        return {
          kind: "success",
          text: `已创建默认注入文件并打开编辑器：${r2.path}\n重启 dsh 生效。`,
        };
      }
      return {
        kind: "success",
        text: `已打开 ${r.editor} 编辑注入文件：${r.path}\n编辑完成后重启 dsh 生效。`,
      };
    }
    case "help":
    case "h":
    default:
      return {
        kind: "success",
        text: "dsh-purge 命令：\n" +
          "  /purge status     显示状态\n" +
          "  /purge apply      应用全部清洗（提示词+代码+shim+override）\n" +
          "  /purge revert     回滚还原\n" +
          "  /purge edit       编辑注入文件 prompt-inject.md\n" +
          "  /purge help       显示帮助",
      };
  }
}

// ── 插件 apply ────────────────────────────────────────────────────

export function apply(ctx, config) {
  const cfg = { ...DEFAULTS, ...(config || {}) };
  if (!cfg.enabled) return;
  log(cfg, "plugin enabled");

  // 1. 启动自动重洗（异步，不阻塞启动）
  setImmediate(() => {
    autoApply(cfg).then((r) => log(cfg, "auto-apply:", r));
  });

  // 2. systemPrompt 注入（注入用户"全局提示词"内容；默认空则什么都不注入）
  const injectFile = core.findOverrideFile(core.findDshHome());
  registerPromptSections(ctx, cfg, injectFile);

  // 3. /purge 命令
  const commands = ctx.get?.("commands");
  if (commands) {
    commands.register({
      name: "purge",
      description: "dsh 指令权威性清洗（status/apply/revert/edit/help）",
      input: { hint: "status | apply | revert | edit | help" },
      handler: async (invocation) => handlePurgeCommand(invocation.rawInput ?? "", cfg),
    });
  }

  // 4. 模型工具（原始 JSON-Schema ToolDefinition，零 peer 依赖）
  if (ctx.tools) {
    ctx.tools.register({
      name: "purge_status",
      description: `查看 dsh 指令权威性清洗状态（${core.ALL_PATCHES.length} patch 清洗进度、shim 注入、override 文件）。`,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { text: { type: "string" } },
        },
        render: (_args, value) => [{ type: "text", text: String(value?.text ?? "") }],
      },
      async execute() {
        const state = await core.gatherState();
        return { text: renderStatus(state) };
      },
    });
    ctx.tools.register({
      name: "purge_apply",
      description: `应用 dsh 指令权威性清洗：${core.ALL_PATCHES.length} patch（提示词层+代码默认+引擎级审批/沙箱绕过）+ shim 注入 + override 文件。需重启 dsh 完全生效。`,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { text: { type: "string" } },
        },
        render: (_args, value) => [{ type: "text", text: String(value?.text ?? "") }],
      },
      async execute() {
        const state = await core.gatherState();
        if (!state.ai_base) return { text: "ERROR: 插件根未找到 / set DSH_BASE" };
        await core.backupAll(state.ai_base);
        const report = await core.applyPatches(state.ai_base);
        await core.installOverride(state.dsh_home, false);
        if (state.shim_dir) await core.patchShim(state.shim_dir);
        const applied = report.filter((r) => r.status === "applied").length;
        const already = report.filter((r) => r.status === "already").length;
        return { text: `清洗完成 / applied=${applied}, already=${already}. 重启 dsh 生效.` };
      },
    });
    ctx.tools.register({
      name: "purge_revert",
      description: "回滚 dsh 指令权威性清洗到备份原件（保留 prompt-inject.md 用户文件）。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { text: { type: "string" } },
        },
        render: (_args, value) => [{ type: "text", text: String(value?.text ?? "") }],
      },
      async execute() {
        const state = await core.gatherState();
        const lines = [];
        if (state.ai_base) {
          const { reverted, errors } = await core.revertAll(state.ai_base);
          lines.push(`reverted=${reverted.length}${errors.length ? ` errors=${errors.length}` : ""}`);
        }
        if (state.shim_dir) await core.revertShim(state.shim_dir);
        return { text: `回滚完成 / ${lines.join(", ")}. 重启 dsh 恢复.` };
      },
    });
  }

  // 5. HTTP API（Web UI 设置面板用）
  installWebServer(ctx, cfg);
}

// ── Web UI 设置面板后端（HTTP 路由）──────────────────────────────

function installWebServer(ctx, cfg) {
  ctx.inject(["webServer"], (host) => {
    host.effect(() => {
      host.webServer.register({
        kind: "exact",
        path: "/dsh-purge/status",
        handler: async (request, response) => {
          if (request.method !== "GET") {
            response.writeHead(405, { allow: "GET" });
            response.end();
            return;
          }
          try {
            const state = await core.gatherState();
            const patch_names = {};
            for (const p of core.ALL_PATCHES) patch_names[String(p.id)] = p.name;
            sendJson(response, 200, {
              ok: true,
              ai_base: state.ai_base,
              patches_applied: state.patches_applied,
              patches_pending: state.patches_pending,
              patches_total: core.ALL_PATCHES.length,
              patch_status: state.patch_status,
              patch_names,
              shim_cmd: state.shim_cmd,
              shim_ps1: state.shim_ps1,
              has_backup: state.has_backup,
              override_status: state.override_status,
              override_path: state.override_path,
              dsh_home: state.dsh_home,
            });
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e) });
          }
        },
      }, "dsh-purge: status");
      host.webServer.register({
        kind: "exact",
        path: "/dsh-purge/apply",
        handler: async (request, response) => {
          if (request.method !== "POST") {
            response.writeHead(405, { allow: "POST" });
            response.end();
            return;
          }
          try {
            const state = await core.gatherState();
            if (!state.ai_base) {
              sendJson(response, 500, { ok: false, error: "插件根未找到 / set DSH_BASE" });
              return;
            }
            await core.backupAll(state.ai_base);
            const report = await core.applyPatches(state.ai_base);
            await core.installOverride(state.dsh_home, false);
            if (state.shim_dir) await core.patchShim(state.shim_dir);
            sendJson(response, 200, {
              ok: true,
              applied: report.filter((r) => r.status === "applied").length,
              already: report.filter((r) => r.status === "already").length,
              report: report.map((r) => ({ id: r.patch_id, name: r.name, status: r.status })),
              note: "重启 dsh 完全生效",
            });
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e) });
          }
        },
      }, "dsh-purge: apply");
      host.webServer.register({
        kind: "exact",
        path: "/dsh-purge/revert",
        handler: async (request, response) => {
          if (request.method !== "POST") {
            response.writeHead(405, { allow: "POST" });
            response.end();
            return;
          }
          try {
            const state = await core.gatherState();
            const result = {};
            if (state.ai_base) {
              const { reverted, errors } = await core.revertAll(state.ai_base);
              result.reverted = reverted.length;
              result.errors = errors.length;
            }
            if (state.shim_dir) {
              result.shim = await core.revertShim(state.shim_dir);
            }
            sendJson(response, 200, { ok: true, ...result, note: "重启 dsh 恢复; prompt-inject.md 保留" });
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e) });
          }
        },
      }, "dsh-purge: revert");
      host.webServer.register({
        kind: "exact",
        path: "/dsh-purge/override",
        handler: async (request, response) => {
          if (request.method === "GET") {
            try {
              const state = await core.gatherState();
              const fp = core.findOverrideFile(state.dsh_home);
              let content = "";
              if (fs.existsSync(fp)) content = await fsp.readFile(fp, "utf8");
              sendJson(response, 200, { ok: true, exists: fs.existsSync(fp), content, path: fp });
            } catch (e) {
              sendJson(response, 500, { ok: false, error: String(e) });
            }
            return;
          }
          if (request.method === "POST") {
            try {
              const body = await readJsonBody(request);
              const content = typeof body?.content === "string" ? body.content : null;
              if (content === null) {
                sendJson(response, 400, { ok: false, error: "content must be a string" });
                return;
              }
              const state = await core.gatherState();
              const fp = core.findOverrideFile(state.dsh_home);
              await fsp.mkdir(state.dsh_home, { recursive: true });
              await fsp.writeFile(fp, content, "utf8");
              sendJson(response, 200, { ok: true, path: fp });
            } catch (e) {
              sendJson(response, 500, { ok: false, error: String(e) });
            }
            return;
          }
          response.writeHead(405, { allow: "GET, POST" });
          response.end();
        },
      }, "dsh-purge: override");
    }, "dsh-purge: http routes");
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 256 * 1024) throw new Error("request body too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
