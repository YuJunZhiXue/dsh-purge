// dsh-purge 插件入口（小杨）
// 功能（移植自 dsh_purge.py，一个不差）：
//   1. 启动自动重洗（autoApplyOnStart）— 解决 npm 升级覆盖 node_modules 后需手动重跑的痛点
//   2. /purge 命令 — status / apply / revert / edit / help
//   2b. /rules 命令 — list / use / create / delete / reset
//   3. 模型工具 — purge_status / purge_apply / purge_revert
//   4. systemPrompt 注入 — 会话强指令 section（兜底，不依赖改文件）

import fs from "node:fs";
import { promises as fsp } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as core from "./core.js";
import * as rules from "./rules.js";
import {
  GLOBAL_PROMPT_ORDER,
  rewritePromptAssembly,
} from "./identity.js";

export const name = "dsh-purge";

export const inject = ["systemPrompt", "tools"];

const DEFAULTS = {
  enabled: true,
  autoApplyOnStart: true,
  autoRevertOnMissing: false,
  postPrompt: "",
  postPromptOrder: 5100,
  verbose: false,
};

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
  out.push(`shim: dsh.cmd=${state.shim_cmd}  dsh.ps1=${state.shim_ps1}  dsh=${state.shim_bin}`);
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

  ctx.systemPrompt.section({
    name: "dsh-purge:rules",
    order: GLOBAL_PROMPT_ORDER + 1,
    text: () => {
      if (!config.enabled) return "";
      try {
        return rules.activeRuleText(core.findDshHome());
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

function installIdentityOverride(ctx) {
  if (typeof ctx.on !== "function") return;
  ctx.on("system-prompt/assemble", async (_assembly, _context, next) => {
    const assembled = typeof next === "function" ? await next() : _assembly;
    return rewritePromptAssembly(assembled);
  }, { global: true, prepend: true });
}

// ── 自动重洗 ──────────────────────────────────────────────────────

async function autoApply(config) {
  try {
    const state = await core.gatherState();
    // 始终确保 override 文件存在（缺失或空则写入插件默认文案，不覆盖已有内容）
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
          "  /purge help       显示帮助\n" +
          "规则集切换见 /rules（list | use <id> | create | delete | reset）",
      };
  }
}

function renderRulesStatus(st) {
  const out = [];
  out.push("规则集 / Rule Sets");
  out.push(`  存储目录 / store  ${st.rules_dir}`);
  const targetLine = st.active
    ? `${st.agents_path} (${st.active_target})`
    : "(无激活)";
  out.push(`  目标文件 / target ${targetLine} — exists=${st.agents_exists}, synced=${st.agents_synced}`);
  out.push("");
  if (st.rules.length === 0) {
    out.push("  (暂无规则 / no rules — 用 /rules create <id> 或设置页新建)");
  }
  for (const r of st.rules) {
    const isActive = r.id === st.active;
    const label = r.name !== r.id ? `${r.name} (${r.id})` : r.id;
    out.push(`  ${isActive ? "▶" : "·"} ${label}${isActive ? " ★ 当前" : ""} [${r.target}] (${rules.formatSize(r.size)})`);
  }
  return out.join("\n");
}

async function handleRulesCommand(rawInput) {
  const args = (rawInput || "").trim().split(/\s+/).filter(Boolean);
  const sub = (args[0] || "list").toLowerCase();
  const dshHome = core.findDshHome();

  switch (sub) {
    case "list":
    case "ls":
    case "s":
      return { kind: "success", text: renderRulesStatus(await rules.rulesStatus(dshHome)) };
    case "use":
    case "activate":
    case "u": {
      const id = args[1];
      if (!id) return { kind: "error", text: "用法: /rules use <id>" };
      try {
        const meta = await rules.activateRule(dshHome, id);
        return {
          kind: "success",
          text: `✓ 已激活规则 ${meta.name}（${id}）→ 写入 ${rules.targetPath(dshHome, meta.target)}，并注入 systemPrompt。新会话生效。`,
        };
      } catch (e) {
        return { kind: "error", text: `激活失败: ${e.message}` };
      }
    }
    case "create":
    case "new":
    case "c": {
      const id = args[1];
      if (!id) return { kind: "error", text: "用法: /rules create <id> [别名] [AGENTS.md|CLAUDE.md]" };
      const name = args[2] || id;
      const target = args[3] || "AGENTS.md";
      if (!rules.validTarget(target)) {
        return { kind: "error", text: `无效目标: ${target}（只能是 AGENTS.md 或 CLAUDE.md）` };
      }
      try {
        await rules.saveRule(dshHome, id, "", { name, target });
        return {
          kind: "success",
          text: `✓ 已创建规则 ${name}（${id} → ${target}）。在设置页「规则设定」编辑内容后保存。`,
        };
      } catch (e) {
        return { kind: "error", text: `创建失败: ${e.message}` };
      }
    }
    case "delete":
    case "rm":
    case "d": {
      const id = args[1];
      if (!id) return { kind: "error", text: "用法: /rules delete <id>" };
      try {
        await rules.deleteRule(dshHome, id);
        return { kind: "success", text: `✓ 已删除规则 ${id}。` };
      } catch (e) {
        return { kind: "error", text: `删除失败: ${e.message}` };
      }
    }
    case "reset":
    case "restore":
    case "还原": {
      try {
        const r = await rules.resetToOriginal(dshHome);
        const lines = [];
        if (r.removed.length > 0) lines.push(`✓ 已删除插件写入的目标文件: ${r.removed.join(", ")}`);
        if (r.skipped.length > 0) {
          lines.push(`⚠ 跳过（文件内容与规则不一致，可能被手动修改）: ${r.skipped.join(", ")}`);
        }
        lines.push("已清空激活状态。规则库内容保留，随时可重新激活。现在回到出厂状态：无全局指令。");
        return { kind: "success", text: lines.join("\n") };
      } catch (e) {
        return { kind: "error", text: `还原失败: ${e.message}` };
      }
    }
    case "help":
    case "h":
    default:
      return {
        kind: "success",
        text: "规则集命令：\n" +
          "  /rules list                         列出所有规则\n" +
          "  /rules use <id>                     激活规则（写入 AGENTS.md/CLAUDE.md，并注入 systemPrompt）\n" +
          "  /rules create <id> [别名] [目标]     新建规则\n" +
          "  /rules delete <id>                  删除规则\n" +
          "  /rules reset                        还原原始状态\n" +
          "  /rules help                         显示帮助",
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
    rules.ensureInitialState(core.findDshHome())
      .then((r) => log(cfg, "rules init:", JSON.stringify(r)))
      .catch((e) => console.warn("[dsh-purge] rules init error:", String(e)));
  });

  // 2. systemPrompt 注入（操作员提示词放在 persona 之后，避免被 coding agent 盖住）
  installIdentityOverride(ctx);
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
    commands.register({
      name: "rules",
      description: "规则集切换（写入 AGENTS.md/CLAUDE.md）: list | use <id> | create <id> [别名] [目标] | delete <id> | reset | help",
      input: { hint: "list | use <id> | create <id> [别名] [目标] | delete <id> | reset | help" },
      handler: async (invocation) => handleRulesCommand(invocation.rawInput ?? ""),
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

function portFromRequest(request) {
  const hostHeader = String(request.headers?.host || "");
  const match = hostHeader.match(/:(\d+)$/);
  if (match) return Number(match[1]);
  return 3080;
}

function hostFromRequest(request) {
  const hostHeader = String(request.headers?.host || "127.0.0.1");
  return hostHeader.replace(/:\d+$/, "") || "127.0.0.1";
}

function restartArgv() {
  const argv = process.argv.slice(1).filter((arg) => arg !== "--no-open");
  argv.push("--no-open");
  return argv;
}

function scheduleWebRestart(request) {
  const helper = fileURLToPath(new URL("./restart-web.js", import.meta.url));
  const child = spawn(process.execPath, [helper], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      DSH_PURGE_RESTART: JSON.stringify({
        execPath: process.execPath,
        argv: restartArgv(),
        cwd: process.cwd(),
        host: hostFromRequest(request),
        port: portFromRequest(request),
      }),
    },
  });
  child.unref();
  setTimeout(() => process.exit(0), 250);
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
              shim_bin: state.shim_bin,
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
            const override = await core.ensureOverrideContent(state.dsh_home, false);
            if (state.shim_dir) await core.patchShim(state.shim_dir);
            sendJson(response, 200, {
              ok: true,
              applied: report.filter((r) => r.status === "applied").length,
              already: report.filter((r) => r.status === "already").length,
              report: report.map((r) => ({ id: r.patch_id, name: r.name, status: r.status })),
              override_content: override.content,
              override_path: override.path,
              override_installed: override.installed,
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
              const dshHome = core.findDshHome();
              const fp = core.findOverrideFile(dshHome);
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
              const dshHome = core.findDshHome();
              const fp = core.findOverrideFile(dshHome);
              await fsp.mkdir(dshHome, { recursive: true });
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
      installRulesHttp(host.webServer);
      host.webServer.register({
        kind: "exact",
        path: "/dsh-purge/restart",
        handler: async (request, response) => {
          if (request.method !== "POST") {
            response.writeHead(405, { allow: "POST" });
            response.end();
            return;
          }
          try {
            scheduleWebRestart(request);
            sendJson(response, 200, { ok: true, note: "正在重启 dsh web…" });
          } catch (e) {
            sendJson(response, 500, { ok: false, error: String(e) });
          }
        },
      }, "dsh-purge: restart");
    }, "dsh-purge: http routes");
  });
}

function methodNotAllowed(request, response, allow) {
  if (allow.includes(request.method)) return false;
  response.writeHead(405, { allow: allow.join(", ") });
  response.end();
  return true;
}

function installRulesHttp(webServer) {
  const dshHome = core.findDshHome();

  webServer.register({
    kind: "exact",
    path: "/dsh-purge/rules/status",
    handler: async (request, response) => {
      if (methodNotAllowed(request, response, ["GET"])) return;
      try {
        sendJson(response, 200, { ok: true, ...(await rules.rulesStatus(dshHome)) });
      } catch (e) {
        sendJson(response, 500, { ok: false, error: String(e) });
      }
    },
  }, "dsh-purge: rules status");

  webServer.register({
    kind: "exact",
    path: "/dsh-purge/rules/read",
    handler: async (request, response) => {
      if (methodNotAllowed(request, response, ["GET"])) return;
      try {
        const url = new URL(request.url ?? "", "http://localhost");
        const id = url.searchParams.get("id") ?? "";
        if (!rules.validRuleId(id)) {
          sendJson(response, 400, { ok: false, error: "invalid id" });
          return;
        }
        const content = await rules.readRule(dshHome, id);
        if (content === null) {
          sendJson(response, 404, { ok: false, error: `rule not found: ${id}` });
          return;
        }
        const meta = await rules.readRuleMeta(dshHome, id);
        sendJson(response, 200, { ok: true, id, name: meta.name, target: meta.target, content });
      } catch (e) {
        sendJson(response, 500, { ok: false, error: String(e) });
      }
    },
  }, "dsh-purge: rules read");

  webServer.register({
    kind: "exact",
    path: "/dsh-purge/rules/save",
    handler: async (request, response) => {
      if (methodNotAllowed(request, response, ["POST"])) return;
      try {
        const body = await readJsonBody(request);
        const id = typeof body?.id === "string" ? body.id : "";
        const content = typeof body?.content === "string" ? body.content : null;
        if (!rules.validRuleId(id) || content === null) {
          sendJson(response, 400, { ok: false, error: "id and content (string) required" });
          return;
        }
        await rules.saveRule(dshHome, id, content, {
          name: typeof body?.name === "string" ? body.name : undefined,
          target: typeof body?.target === "string" ? body.target : undefined,
        });
        sendJson(response, 200, { ok: true, id });
      } catch (e) {
        sendJson(response, 500, { ok: false, error: String(e) });
      }
    },
  }, "dsh-purge: rules save");

  webServer.register({
    kind: "exact",
    path: "/dsh-purge/rules/activate",
    handler: async (request, response) => {
      if (methodNotAllowed(request, response, ["POST"])) return;
      try {
        const body = await readJsonBody(request);
        const id = typeof body?.id === "string" ? body.id : "";
        if (!rules.validRuleId(id)) {
          sendJson(response, 400, { ok: false, error: "invalid id" });
          return;
        }
        const meta = await rules.activateRule(dshHome, id);
        sendJson(response, 200, {
          ok: true,
          id,
          name: meta.name,
          target: meta.target,
          agents_path: rules.targetPath(dshHome, meta.target),
          note: "已写入目标文件并注入 systemPrompt，新会话生效",
        });
      } catch (e) {
        sendJson(response, 500, { ok: false, error: String(e) });
      }
    },
  }, "dsh-purge: rules activate");

  webServer.register({
    kind: "exact",
    path: "/dsh-purge/rules/delete",
    handler: async (request, response) => {
      if (methodNotAllowed(request, response, ["POST"])) return;
      try {
        const body = await readJsonBody(request);
        const id = typeof body?.id === "string" ? body.id : "";
        if (!rules.validRuleId(id)) {
          sendJson(response, 400, { ok: false, error: "invalid id" });
          return;
        }
        await rules.deleteRule(dshHome, id);
        sendJson(response, 200, { ok: true, id });
      } catch (e) {
        sendJson(response, 500, { ok: false, error: String(e) });
      }
    },
  }, "dsh-purge: rules delete");

  webServer.register({
    kind: "exact",
    path: "/dsh-purge/rules/reset",
    handler: async (request, response) => {
      if (methodNotAllowed(request, response, ["POST"])) return;
      try {
        const r = await rules.resetToOriginal(dshHome);
        sendJson(response, 200, { ok: true, ...r, note: "已还原出厂状态（无全局指令）；规则库保留" });
      } catch (e) {
        sendJson(response, 500, { ok: false, error: String(e) });
      }
    },
  }, "dsh-purge: rules reset");
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
    if (size > 512 * 1024) throw new Error("request body too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
