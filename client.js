// dsh-purge client bundle: settings section follows Harness zh/en.
window.__ModuleLoader__.load({ id: "dsh-purge", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const h = react.createElement;
		const { useState, useEffect, useCallback, useContext, createContext, useRef } = react;

		const name = "dsh-purge";
		const inject = ["slots", "locale"];
		const NS = "settings.dsh-purge";

		const TARGETS = ["AGENTS.md", "CLAUDE.md"];
		const PATCH_GROUPS = [
			{ key: "prompt", ids: [1, 2, 3, 4, 5] },
			{ key: "code", ids: [6, 7, 8] },
			{ key: "engine", ids: [9, 10, 11, 12, 13, 14, 15, 16] },
			{ key: "tools", ids: [17, 18, 19, 20, 21, 22, 23, 24, 25] },
		];

		const zh = {
			nav: "规则设定",
			"theme.aria": "外观",
			"theme.white": "白",
			"theme.ink": "墨",
			"purge.title": "补丁",
			"override.title": "提示词",
			"metric.purged": "补丁",
			"metric.shim": "shim",
			"metric.bak.yes": "有备份",
			"metric.bak.no": "无备份",
			"metric.bak.hint": "备份",
			"table.patch": "项目",
			"table.status": "状态",
			"status.applied": "已应用",
			"status.pending": "待应用",
			"skip": "跳过",
			"unknown": "未知",
			"delete": "删除",
			"btn.apply": "应用",
			"btn.apply.busy": "处理中…",
			"btn.revert": "还原",
			"action.apply": "应用",
			"action.revert": "还原",
			"ok.done": "已完成",
			"err.action": "失败: {error}",
			"err.status": "读取失败: {error}",
			"err.override": "读取失败: {error}",
			"err.rules": "读取失败: {error}",
			"err.read": "读取失败: {error}",
			"err.save": "保存失败: {error}",
			"btn.saveInject": "保存",
			"saved.override": "已保存",
			"rules.title": "规则集",
			"rules.none": "无",
			"rules.reset": "还原",
			"rules.reset.confirm": "还原全局指令文件？规则库会保留。",
			"rules.empty": "暂无规则",
			"rules.pick": "选择规则",
			"pill.current": "当前",
			"btn.use": "启用",
			"btn.inUse": "当前",
			"confirm.delete": "删除 {id}？",
			"ph.id": "id",
			"ph.alias": "名称",
			"ph.alias.short": "名称",
			"btn.create": "新建",
			"need.id": "需要 id",
			"ph.content": "",
			"btn.saveRule": "保存",
			"btn.restart": "重启",
			"btn.restart.busy": "重启中…",
			"restarting": "重启中…",
			"restart.timeout": "超时，请刷新",
			"restart.fail": "失败: {error}",
			"restart.confirm": "需要重启后生效。",
			"restart.later": "以后",
			"group.prompt": "提示词",
			"group.code": "代码",
			"group.engine": "引擎",
			"group.tools": "工具",
			"patch.1": "全局免责 → 强指令",
			"patch.2": "替换式免责 → 强指令",
			"patch.3": "作用域免责 → 强指令",
			"patch.4": "persona 会话强指令",
			"patch.5": "审批提示句 → 全权限",
			"patch.6": "沙箱 deny → allow 写",
			"patch.7": "沙箱默认全权限",
			"patch.8": "审批默认 never",
			"patch.9": "审批门自动放行",
			"patch.10": "审批配置默认 never",
			"patch.11": "never 提示句 → 自动放行",
			"patch.12": "ask 提示句 → 自动放行",
			"patch.13": "豁免升级阶梯",
			"patch.14": "升级无条件授信",
			"patch.15": "沙箱 confine 直通",
			"patch.16": "文件系统围栏取消",
			"patch.17": "观察策略读写放行",
			"patch.18": "重复调用守卫禁用",
			"patch.19": "工具结果修剪禁用",
			"patch.20": "web fetch 启用 + provider",
			"patch.21": "base 依赖 fetch-http",
			"patch.22": "bash 超时 60s → 10min",
			"patch.23": "read 上限放宽",
			"patch.24": "子代理深度 3 → 10",
			"patch.25": "preset fetch 启用",
		};

		const en = {
			nav: "Rules",
			"theme.aria": "Appearance",
			"theme.white": "Light",
			"theme.ink": "Ink",
			"purge.title": "Patches",
			"override.title": "Prompt",
			"metric.purged": "Patches",
			"metric.shim": "shim",
			"metric.bak.yes": "Backup",
			"metric.bak.no": "No backup",
			"metric.bak.hint": "Backup",
			"table.patch": "Item",
			"table.status": "Status",
			"status.applied": "Applied",
			"status.pending": "Pending",
			"skip": "Skipped",
			"unknown": "Unknown",
			"delete": "Delete",
			"btn.apply": "Apply",
			"btn.apply.busy": "Working…",
			"btn.revert": "Restore",
			"action.apply": "Apply",
			"action.revert": "Restore",
			"ok.done": "Done",
			"err.action": "Failed: {error}",
			"err.status": "Read failed: {error}",
			"err.override": "Read failed: {error}",
			"err.rules": "Read failed: {error}",
			"err.read": "Read failed: {error}",
			"err.save": "Save failed: {error}",
			"btn.saveInject": "Save",
			"saved.override": "Saved",
			"rules.title": "Rule sets",
			"rules.none": "None",
			"rules.reset": "Restore",
			"rules.reset.confirm": "Restore global instruction files? The rule library is kept.",
			"rules.empty": "No rules",
			"rules.pick": "Select a rule",
			"pill.current": "On",
			"btn.use": "Enable",
			"btn.inUse": "On",
			"confirm.delete": "Delete {id}?",
			"ph.id": "id",
			"ph.alias": "Name",
			"ph.alias.short": "Name",
			"btn.create": "New",
			"need.id": "id required",
			"ph.content": "",
			"btn.saveRule": "Save",
			"btn.restart": "Restart",
			"btn.restart.busy": "Restarting…",
			"restarting": "Restarting…",
			"restart.timeout": "Timed out; refresh",
			"restart.fail": "Failed: {error}",
			"restart.confirm": "Restart to take effect.",
			"restart.later": "Later",
			"group.prompt": "Prompt",
			"group.code": "Code",
			"group.engine": "Engine",
			"group.tools": "Tools",
			"patch.1": "Global disclaimer → mandate",
			"patch.2": "Replacement disclaimer → mandate",
			"patch.3": "Scope disclaimer → mandate",
			"patch.4": "Persona session mandate",
			"patch.5": "Approval copy → full access",
			"patch.6": "Sandbox deny → allow write",
			"patch.7": "Sandbox default full access",
			"patch.8": "Approval default never",
			"patch.9": "Approval gate auto-grant",
			"patch.10": "Approval config default never",
			"patch.11": "never copy → auto-grant",
			"patch.12": "ask copy → auto-grant",
			"patch.13": "Escalation ladder exempt",
			"patch.14": "Escalation unconditional grant",
			"patch.15": "Sandbox confine passthrough",
			"patch.16": "Filesystem fence off",
			"patch.17": "Observation policy allow R/W",
			"patch.18": "Repeat-call guard off",
			"patch.19": "Tool-result pruner off",
			"patch.20": "Web fetch on + provider",
			"patch.21": "base depends on fetch-http",
			"patch.22": "bash timeout 60s → 10min",
			"patch.23": "read cap raised",
			"patch.24": "subagent depth 3 → 10",
			"patch.25": "preset fetch on",
		};

		const THEME_KEY = "dshp-theme";
		const PURGE_CSS = `
.dshp-root{--dshp-display:"Songti SC","Noto Serif SC","Iowan Old Style",Palatino,"Palatino Linotype",Georgia,serif;--dshp-sans:"Yu Gothic UI","Hiragino Sans GB","Source Han Sans SC",system-ui,sans-serif;--dshp-mono:"Cascadia Mono","Sarasa Mono SC",ui-monospace,monospace;--dshp-ease:cubic-bezier(.16,1,.3,1);max-width:920px;display:flex;flex-direction:column;gap:18px;padding:16px;border-radius:12px;background:var(--dshp-bg);color:var(--dshp-ink);font-family:var(--dshp-sans)}
.dshp-root[data-theme="white"]{--dshp-bg:#ffffff;--dshp-paper:#f7f6f3;--dshp-ink:#4a4742;--dshp-mute:#9a958c;--dshp-line:#eceae4;--dshp-fill:#f3f1ec;--dshp-accent:#7d9a86;--dshp-accent-soft:#e7efe9;--dshp-ok:#5d8a6c;--dshp-warn:#a8844a;--dshp-bad:#c48989;color-scheme:light}
.dshp-root[data-theme="dusk"]{--dshp-bg:#2a2926;--dshp-paper:#32312d;--dshp-ink:#e6e2db;--dshp-mute:#a8a39a;--dshp-line:#3f3d38;--dshp-fill:#353430;--dshp-accent:#9bb5a6;--dshp-accent-soft:#3a433d;--dshp-ok:#8fbf9c;--dshp-warn:#d4b07a;--dshp-bad:#d4a0a0;color-scheme:dark}
.dshp-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.dshp-switch{display:inline-flex;border:1px solid var(--dshp-line);border-radius:999px;overflow:hidden;background:var(--dshp-paper)}
.dshp-switch button{appearance:none;border:0;background:transparent;color:var(--dshp-mute);font:12px/1 var(--dshp-sans);padding:6px 14px;cursor:pointer}
.dshp-switch button.is-on{background:var(--dshp-accent-soft);color:var(--dshp-ink)}
.dshp-switch button:focus-visible{outline:2px solid var(--dshp-accent);outline-offset:-2px}
.dshp-panel{border:1px solid var(--dshp-line);background:var(--dshp-paper);border-radius:10px;padding:18px 18px 16px}
.dshp-kicker{font-family:var(--dshp-mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dshp-mute);margin:0 0 4px}
.dshp-title{font-family:var(--dshp-display);font-size:20px;font-weight:500;letter-spacing:.02em;line-height:1.3;margin:0;color:var(--dshp-ink)}
.dshp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.dshp-sub{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:20px 0 10px}
.dshp-sub h4{margin:0;font-family:var(--dshp-display);font-size:15px;font-weight:500}
.dshp-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:14px}
.dshp-metric{border:1px solid var(--dshp-line);background:var(--dshp-bg);padding:12px;min-height:68px;display:flex;flex-direction:column;gap:4px;border-radius:8px}
.dshp-metric b{font-family:var(--dshp-display);font-size:18px;font-weight:500;line-height:1.2}
.dshp-metric span{font-size:11px;color:var(--dshp-mute)}
.dshp-bar{height:3px;border-radius:99px;background:var(--dshp-line);overflow:hidden;margin:8px 0 14px}
.dshp-bar>i{display:block;height:100%;background:var(--dshp-accent);width:0;transition:width .4s var(--dshp-ease)}
.dshp-group{border:1px solid var(--dshp-line);margin:0 0 8px;background:var(--dshp-bg);border-radius:8px;overflow:hidden}
.dshp-group-h{width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;border:0;background:transparent;color:inherit;cursor:pointer;font:inherit;text-align:left}
.dshp-group-h:hover{background:var(--dshp-fill)}
.dshp-group-h:focus-visible{outline:2px solid var(--dshp-accent);outline-offset:-2px}
.dshp-group-h strong{font-family:var(--dshp-display);font-size:14px;font-weight:500}
.dshp-group-h em{font-style:normal;font-size:12px;color:var(--dshp-mute);flex:1}
.dshp-count{font-family:var(--dshp-mono);font-size:12px;color:var(--dshp-mute)}
.dshp-table{width:100%;border-collapse:collapse;font-size:12.5px}
.dshp-table th{text-align:left;font-weight:500;font-size:11px;letter-spacing:.06em;color:var(--dshp-mute);padding:7px 12px;border-bottom:1px solid var(--dshp-line)}
.dshp-table td{padding:8px 12px;border-bottom:1px solid var(--dshp-line);vertical-align:middle}
.dshp-table tr:last-child td{border-bottom:0}
.dshp-table tr.is-on td{background:var(--dshp-accent-soft)}
.dshp-id{font-family:var(--dshp-mono);opacity:.75;width:42px}
.dshp-actions{text-align:right;white-space:nowrap}
.dshp-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dshp-row+.dshp-row{margin-top:10px}
.dshp-pill{display:inline-flex;align-items:center;gap:6px;font-family:var(--dshp-mono);font-size:11px;padding:2px 8px;border:1px solid var(--dshp-line);border-radius:99px;line-height:1.6;background:var(--dshp-bg)}
.dshp-pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.dshp-pill.is-ok{color:var(--dshp-ok);border-color:color-mix(in srgb,var(--dshp-ok) 30%,var(--dshp-line))}
.dshp-pill.is-wait{color:var(--dshp-warn);border-color:color-mix(in srgb,var(--dshp-warn) 30%,var(--dshp-line))}
.dshp-pill.is-miss{color:var(--dshp-mute)}
.dshp-pill.is-bad{color:var(--dshp-bad)}
.dshp-btn{appearance:none;font-family:var(--dshp-sans);font-size:13px;font-weight:500;min-height:34px;padding:0 14px;border-radius:8px;border:1px solid transparent;cursor:pointer;transition:background .15s var(--dshp-ease),opacity .15s var(--dshp-ease)}
.dshp-btn:disabled{opacity:.45;cursor:not-allowed}
.dshp-btn:focus-visible{outline:2px solid var(--dshp-accent);outline-offset:2px}
.dshp-btn-primary{background:var(--dshp-accent-soft);color:var(--dshp-ink);border-color:color-mix(in srgb,var(--dshp-accent) 35%,var(--dshp-line))}
.dshp-btn-primary:hover:not(:disabled){background:color-mix(in srgb,var(--dshp-accent) 22%,var(--dshp-bg))}
.dshp-btn-ghost{background:transparent;color:var(--dshp-ink);border-color:var(--dshp-line)}
.dshp-btn-danger{background:transparent;color:var(--dshp-bad);border-color:color-mix(in srgb,var(--dshp-bad) 40%,var(--dshp-line))}
.dshp-btn-solid-danger{background:color-mix(in srgb,var(--dshp-bad) 16%,var(--dshp-bg));color:var(--dshp-bad);border-color:color-mix(in srgb,var(--dshp-bad) 30%,var(--dshp-line))}
.dshp-btn-tiny{min-height:28px;padding:0 10px;font-size:12px}
.dshp-field,.dshp-area{width:100%;box-sizing:border-box;font:13px/1.55 var(--dshp-mono);padding:8px 10px;background:var(--dshp-bg);color:var(--dshp-ink);border:1px solid var(--dshp-line);border-radius:8px}
.dshp-field{width:auto;min-width:140px}
.dshp-area{min-height:220px;resize:vertical}
.dshp-field:focus,.dshp-area:focus{outline:none;border-color:var(--dshp-accent);box-shadow:0 0 0 3px var(--dshp-accent-soft)}
.dshp-field:disabled,.dshp-area:disabled{opacity:.5}
.dshp-ask{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;padding:10px 12px;border:1px solid var(--dshp-line);border-radius:8px;background:var(--dshp-bg);font-size:13px}
.dshp-notice{font-size:12.5px;line-height:1.4}
.dshp-notice.is-ok{color:var(--dshp-ok)}
.dshp-notice.is-bad{color:var(--dshp-bad)}
.dshp-skel{height:12px;border-radius:6px;background:linear-gradient(90deg,var(--dshp-fill),var(--dshp-line),var(--dshp-fill));background-size:200% 100%;animation:dshp-pulse 1.2s ease-in-out infinite}
.dshp-active{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;margin-bottom:12px;border:1px solid var(--dshp-line);background:var(--dshp-bg);border-radius:8px}
.dshp-active b{font-family:var(--dshp-display);font-weight:500}
.dshp-empty{padding:28px 12px;font-size:13px;color:var(--dshp-mute);text-align:center}
.dshp-split{display:flex;flex-direction:column;gap:12px}
.dshp-rulelist{display:flex;flex-direction:column;border:1px solid var(--dshp-line);border-radius:8px;background:var(--dshp-bg);overflow:hidden}
.dshp-rulebody{max-height:240px;overflow:auto}
.dshp-ruleitem{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border:0;border-bottom:1px solid var(--dshp-line);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dshp-ruleitem:hover{background:var(--dshp-fill)}
.dshp-ruleitem.is-edit{background:var(--dshp-accent-soft)}
.dshp-rule-main{flex:1;min-width:0}
.dshp-rule-name{display:flex;align-items:center;gap:8px;font-family:var(--dshp-display);font-size:14px;line-height:1.35}
.dshp-rule-meta{display:block;margin-top:3px;font-family:var(--dshp-mono);font-size:11px;color:var(--dshp-mute)}
.dshp-rule-ops{display:flex;flex-direction:row;align-items:center;gap:6px;flex-shrink:0}
.dshp-create{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-top:1px solid var(--dshp-line);background:var(--dshp-paper)}
.dshp-create-row{display:flex;gap:6px;align-items:center}
.dshp-create .dshp-field{flex:1;min-width:0;width:auto}
.dshp-editor{display:flex;flex-direction:column;gap:10px;min-width:0;border:1px solid var(--dshp-line);border-radius:8px;background:var(--dshp-bg);padding:12px;min-height:320px}
.dshp-editor .dshp-area{flex:1;min-height:240px}
.dshp-editor-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--dshp-mute);font-size:13px;min-height:160px}
@keyframes dshp-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media (max-width:640px){.dshp-metrics{grid-template-columns:1fr}.dshp-ruleitem{flex-wrap:wrap}.dshp-rule-ops{width:100%;justify-content:flex-end}}
@media (prefers-reduced-motion:reduce){.dshp-btn,.dshp-bar>i{transition:none}.dshp-skel{animation:none}}
`;

		const I18n = createContext((key) => key);
		function useT() { return useContext(I18n); }

		function formatSize(bytes) {
			if (typeof bytes !== "number" || !isFinite(bytes) || bytes < 0) return "0 B";
			if (bytes < 1024) return bytes + " B";
			const kb = bytes / 1024;
			return (kb >= 100 ? Math.round(kb) : kb.toFixed(1)) + " KB";
		}

		function statusKind(st) {
			if (st === "applied" || st === "already") return "ok";
			if (st === "pending") return "wait";
			if (st === "missing_file") return "miss";
			return "bad";
		}

		function statusLabel(st, t) {
			if (st === "applied" || st === "already") return t("status.applied");
			if (st === "pending") return t("status.pending");
			if (st === "missing_file" || st === "skipped") return t("skip");
			return st || t("unknown");
		}

		function shimKind(v) {
			if (v === "patched") return "ok";
			if (v === "original") return "wait";
			if (v === "missing" || v === "n/a" || !v) return "miss";
			return "bad";
		}

		function noticeNode(notice) {
			if (!notice || notice.kind === "idle" || !notice.text) return null;
			return h("span", { className: "dshp-notice " + (notice.kind === "error" ? "is-bad" : "is-ok") }, notice.text);
		}

		function Btn(props) {
			const { kind, tiny, children, className, type, ...rest } = props;
			const cls = ["dshp-btn", kind ? "dshp-btn-" + kind : "dshp-btn-ghost", tiny ? "dshp-btn-tiny" : "", className || ""].filter(Boolean).join(" ");
			return h("button", Object.assign({ type: type || "button", className: cls }, rest), children);
		}

		function Pill({ value, label }) {
			const t = useT();
			return h("span", { className: "dshp-pill is-" + statusKind(value) }, label || statusLabel(value, t));
		}

		function PatchGroups({ state }) {
			const t = useT();
			const [open, setOpen] = useState({ prompt: true, code: true, engine: true, tools: false });
			if (!state || !state.patch_status) return h("div", { className: "dshp-skel", style: { height: 120 } });
			return PATCH_GROUPS.map((group) => {
				const rows = group.ids.map((id) => {
					const st = state.patch_status[id] || state.patch_status[String(id)] || "missing_file";
					return { id, st, label: t("patch." + id) };
				});
				const done = rows.filter((r) => r.st === "applied" || r.st === "already").length;
				const expanded = !!open[group.key];
				return h("div", { key: group.key, className: "dshp-group" },
					h("button", {
						type: "button",
						className: "dshp-group-h",
						"aria-expanded": expanded ? "true" : "false",
						onClick: () => setOpen((prev) => Object.assign({}, prev, { [group.key]: !prev[group.key] })),
					},
						h("strong", null, t("group." + group.key)),
						h("span", { className: "dshp-count" }, done + "/" + rows.length),
					),
					expanded ? h("table", { className: "dshp-table" },
						h("thead", null, h("tr", null,
							h("th", null, "#"),
							h("th", null, t("table.patch")),
							h("th", null, t("table.status")),
						)),
						h("tbody", null, rows.map((r) => h("tr", { key: r.id },
							h("td", { className: "dshp-id" }, "#" + r.id),
							h("td", null, r.label),
							h("td", null, h(Pill, { value: r.st })),
						))),
					) : null,
				);
			});
		}

		function PurgifySection() {
			const t = useT();
			const tRef = useRef(t);
			tRef.current = t;
			const [state, setState] = useState(null);
			const [override, setOverride] = useState("");
			const [overrideLoaded, setOverrideLoaded] = useState(false);
			const [busy, setBusy] = useState(false);
			const [askRestart, setAskRestart] = useState(false);
			const [notice, setNotice] = useState({ kind: "idle", text: "" });

			const loadAll = useCallback(() => {
				const tr = tRef.current;
				fetch("/dsh-purge/status", { cache: "no-store" })
					.then((r) => r.json())
					.then((d) => { if (d.ok) setState(d); else setNotice({ kind: "error", text: tr("err.status", { error: d.error || "" }) }); })
					.catch((e) => setNotice({ kind: "error", text: tr("err.status", { error: e.message }) }));
				fetch("/dsh-purge/override", { cache: "no-store" })
					.then((r) => r.json())
					.then((d) => {
						if (d.ok) { setOverride(d.content || ""); setOverrideLoaded(true); }
						else setNotice({ kind: "error", text: tr("err.override", { error: d.error || "" }) });
					})
					.catch((e) => setNotice({ kind: "error", text: tr("err.override", { error: e.message }) }));
			}, []);

			useEffect(() => { loadAll(); }, [loadAll]);

			const doAction = useCallback((action, actionKey) => {
				setBusy(true);
				setAskRestart(false);
				setNotice({ kind: "idle", text: "" });
				const tr = tRef.current;
				const label = tr(actionKey);
				fetch("/dsh-purge/" + action, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
					.then((r) => r.json())
					.then((d) => {
						if (d.ok) {
							if (action === "apply" && typeof d.override_content === "string") {
								setOverride(d.override_content);
								setOverrideLoaded(true);
							}
							setNotice({ kind: "ok", text: tr("ok.done") });
							loadAll();
							if (action === "apply") setAskRestart(true);
						} else {
							setNotice({ kind: "error", text: tr("err.action", { action: label, error: d.error || "" }) });
						}
					})
					.catch((e) => setNotice({ kind: "error", text: tr("err.action", { action: label, error: e.message }) }))
					.finally(() => setBusy(false));
			}, [loadAll]);

			const saveOverride = useCallback(() => {
				setBusy(true);
				setNotice({ kind: "idle", text: "" });
				fetch("/dsh-purge/override", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ content: override }),
				})
					.then((r) => r.json())
					.then((d) => {
						setNotice(d.ok
							? { kind: "ok", text: t("saved.override") }
							: { kind: "error", text: t("err.save", { error: d.error || "" }) });
					})
					.catch((e) => setNotice({ kind: "error", text: t("err.save", { error: e.message }) }))
					.finally(() => setBusy(false));
			}, [override, t]);

			const s = state;
			const total = s && s.patches_total ? s.patches_total : 25;
			const applied = s && typeof s.patches_applied === "number" ? s.patches_applied : 0;
			const pct = total ? Math.round((applied / total) * 100) : 0;

			return h("section", { className: "dshp-panel", "aria-label": t("purge.title") },
				h("h3", { className: "dshp-title", style: { marginBottom: 14 } }, t("purge.title")),
				s ? h("div", { className: "dshp-metrics" },
					h("div", { className: "dshp-metric" },
						h("b", null, applied + " / " + total),
						h("span", null, t("metric.purged")),
					),
					h("div", { className: "dshp-metric" },
						h("b", { style: { fontSize: 13, fontFamily: "var(--dshp-mono)", fontWeight: 500 } },
							h("span", { className: "dshp-pill is-" + shimKind(s.shim_cmd) }, "cmd"),
							" ",
							h("span", { className: "dshp-pill is-" + shimKind(s.shim_ps1) }, "ps1"),
							" ",
							h("span", { className: "dshp-pill is-" + shimKind(s.shim_bin || "missing") }, "unix"),
						),
						h("span", null, t("metric.shim")),
					),
					h("div", { className: "dshp-metric" },
						h("b", null, s.has_backup ? t("metric.bak.yes") : t("metric.bak.no")),
						h("span", null, t("metric.bak.hint")),
					),
				) : h("div", { className: "dshp-metrics" },
					h("div", { className: "dshp-metric" }, h("div", { className: "dshp-skel" }), h("div", { className: "dshp-skel", style: { width: "40%" } })),
					h("div", { className: "dshp-metric" }, h("div", { className: "dshp-skel" }), h("div", { className: "dshp-skel", style: { width: "40%" } })),
					h("div", { className: "dshp-metric" }, h("div", { className: "dshp-skel" }), h("div", { className: "dshp-skel", style: { width: "40%" } })),
				),
				h("div", { className: "dshp-bar", "aria-hidden": "true" }, h("i", { style: { width: pct + "%" } })),
				h(PatchGroups, { state: s }),
				h("div", { className: "dshp-row", style: { marginTop: 14 } },
					h(Btn, { kind: "primary", disabled: busy, onClick: () => doAction("apply", "action.apply") }, busy ? t("btn.apply.busy") : t("btn.apply")),
					h(Btn, { kind: "danger", disabled: busy, onClick: () => doAction("revert", "action.revert") }, t("btn.revert")),
					noticeNode(notice),
				),
				askRestart ? h("div", { className: "dshp-ask" },
					h("span", null, t("restart.confirm")),
					h(Btn, { tiny: true, onClick: () => setAskRestart(false) }, t("restart.later")),
					h(Btn, {
						tiny: true,
						kind: "primary",
						onClick: () => {
							setAskRestart(false);
							restartDsh(setNotice, function () {}, t);
						},
					}, t("btn.restart")),
				) : null,
				h("div", { className: "dshp-sub" },
					h("h4", null, t("override.title")),
					h("div", { className: "dshp-row", style: { margin: 0 } },
						noticeNode(notice),
						h(Btn, { kind: "primary", tiny: true, disabled: busy || !overrideLoaded, onClick: saveOverride }, t("btn.saveInject")),
					),
				),
				h("textarea", {
					className: "dshp-area",
					value: override,
					onChange: (e) => setOverride(e.target.value),
					spellCheck: false,
					placeholder: "",
				}),
			);
		}

		function ruleLabel(r) {
			if (!r) return "";
			if (r.name !== r.id) return r.name + " (" + r.id + ")";
			return r.id;
		}

		function RulesSection() {
			const t = useT();
			const tRef = useRef(t);
			tRef.current = t;
			const [st, setSt] = useState(null);
			const [editId, setEditId] = useState(null);
			const [editName, setEditName] = useState("");
			const [editTarget, setEditTarget] = useState("AGENTS.md");
			const [content, setContent] = useState("");
			const [newId, setNewId] = useState("");
			const [newName, setNewName] = useState("");
			const [newTarget, setNewTarget] = useState("AGENTS.md");
			const [busy, setBusy] = useState(false);
			const [notice, setNotice] = useState({ kind: "idle", text: "" });

			const loadStatus = useCallback(() => {
				const tr = tRef.current;
				fetch("/dsh-purge/rules/status", { cache: "no-store" })
					.then((r) => r.json())
					.then((d) => {
						if (d.ok) setSt(d);
						else setNotice({ kind: "error", text: tr("err.rules", { error: d.error || "" }) });
					})
					.catch((e) => setNotice({ kind: "error", text: tr("err.rules", { error: e.message }) }));
			}, []);

			useEffect(() => { loadStatus(); }, [loadStatus]);

			const doPost = useCallback((action, payload, after) => {
				setBusy(true);
				setNotice({ kind: "idle", text: "" });
				fetch("/dsh-purge/rules/" + action, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(payload || {}),
				})
					.then((r) => r.json())
					.then((d) => {
						if (d.ok) {
							setNotice({ kind: "ok", text: t("ok.done") });
							loadStatus();
							if (after) after();
						} else {
							setNotice({ kind: "error", text: t("err.action", { error: d.error || "" }) });
						}
					})
					.catch((e) => setNotice({ kind: "error", text: t("err.action", { error: e.message }) }))
					.finally(() => setBusy(false));
			}, [loadStatus, t]);

			const openRule = useCallback((id) => {
				setBusy(true);
				fetch("/dsh-purge/rules/read?id=" + encodeURIComponent(id), { cache: "no-store" })
					.then((res) => res.json())
					.then((d) => {
						if (d.ok) {
							setEditId(id);
							setEditName(d.name || id);
							setEditTarget(d.target || "AGENTS.md");
							setContent(d.content || "");
						} else setNotice({ kind: "error", text: t("err.read", { error: d.error || "" }) });
					})
					.catch((e) => setNotice({ kind: "error", text: t("err.read", { error: e.message }) }))
					.finally(() => setBusy(false));
			}, [t]);

			const clearEditor = () => {
				setEditId(null);
				setEditName("");
				setEditTarget("AGENTS.md");
				setContent("");
			};

			let list;
			if (!st) {
				list = h("div", { className: "dshp-skel", style: { height: 80, margin: 12 } });
			} else if (!st.rules || st.rules.length === 0) {
				list = h("p", { className: "dshp-empty" }, t("rules.empty"));
			} else {
				list = st.rules.map((r) => {
					const isActive = r.id === st.active;
					const isEdit = r.id === editId;
					return h("div", {
						key: r.id,
						className: "dshp-ruleitem" + (isEdit ? " is-edit" : ""),
						role: "button",
						tabIndex: 0,
						onClick: () => openRule(r.id),
						onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRule(r.id); } },
					},
						h("div", { className: "dshp-rule-main" },
							h("span", { className: "dshp-rule-name" },
								ruleLabel(r),
								isActive ? h("span", { className: "dshp-pill is-ok" }, t("pill.current")) : null,
							),
							h("span", { className: "dshp-rule-meta" }, r.target + " · " + formatSize(r.size)),
						),
						h("div", { className: "dshp-rule-ops" },
							h(Btn, {
								tiny: true,
								kind: isActive ? undefined : "primary",
								disabled: busy || isActive,
								onClick: (e) => {
									e.stopPropagation();
									if (!isActive) doPost("activate", { id: r.id });
								},
							}, isActive ? t("btn.inUse") : t("btn.use")),
							h(Btn, {
								tiny: true,
								kind: "danger",
								disabled: busy,
								onClick: (e) => {
									e.stopPropagation();
									if (!window.confirm(t("confirm.delete", { id: r.id }))) return;
									if (editId === r.id) clearEditor();
									doPost("delete", { id: r.id });
								},
							}, t("delete")),
						),
					);
				});
			}

			return h("section", { className: "dshp-panel", "aria-label": t("rules.title") },
				h("div", { className: "dshp-head" },
					h("h3", { className: "dshp-title" }, t("rules.title")),
					h("div", { className: "dshp-row", style: { margin: 0 } },
						noticeNode(notice),
						h(Btn, {
							tiny: true,
							kind: "danger",
							disabled: busy,
							onClick: () => {
								if (!window.confirm(t("rules.reset.confirm"))) return;
								clearEditor();
								doPost("reset", {});
							},
						}, t("rules.reset")),
					),
				),
				h("div", { className: "dshp-split" },
					h("div", { className: "dshp-rulelist" },
						h("div", { className: "dshp-rulebody" }, list),
						h("div", { className: "dshp-create" },
							h("div", { className: "dshp-create-row" },
								h("input", { className: "dshp-field", placeholder: t("ph.id"), value: newId, onChange: (e) => setNewId(e.target.value) }),
								h("input", { className: "dshp-field", placeholder: t("ph.alias"), value: newName, onChange: (e) => setNewName(e.target.value) }),
								h("select", { className: "dshp-field", style: { minWidth: 120, flex: "0 0 auto" }, value: newTarget, onChange: (e) => setNewTarget(e.target.value) },
									TARGETS.map((x) => h("option", { key: x, value: x }, x))),
								h(Btn, {
									kind: "primary",
									tiny: true,
									disabled: busy,
									onClick: () => {
										const id = newId.trim();
										if (!id) { setNotice({ kind: "error", text: t("need.id") }); return; }
										const name = newName.trim() || id;
										const target = newTarget;
										doPost("save", { id, content: "", name, target }, () => {
											setEditId(id);
											setEditName(name);
											setEditTarget(target);
											setContent("");
										});
										setNewId(""); setNewName(""); setNewTarget("AGENTS.md");
									},
								}, t("btn.create")),
							),
						),
					),
					h("div", { className: "dshp-editor" },
						editId ? [
							h("div", { key: "meta", className: "dshp-row" },
								h("input", {
									className: "dshp-field", placeholder: t("ph.alias.short"), value: editName,
									onChange: (e) => setEditName(e.target.value),
								}),
								h("select", {
									className: "dshp-field", style: { minWidth: 120 }, value: editTarget,
									onChange: (e) => setEditTarget(e.target.value),
								}, TARGETS.map((x) => h("option", { key: x, value: x }, x))),
							),
							h("textarea", {
								key: "body",
								className: "dshp-area", value: content,
								onChange: (e) => setContent(e.target.value),
								placeholder: "",
							}),
							h("div", { key: "save", className: "dshp-row" },
								h(Btn, {
									kind: "primary",
									disabled: busy,
									onClick: () => doPost("save", { id: editId, content, name: editName, target: editTarget }),
								}, t("btn.saveRule")),
								noticeNode(notice),
							),
						] : h("div", { className: "dshp-editor-empty" }, t("rules.pick")),
					),
				),
			);
		}

		function waitForRestart(setNotice, setBusy, t) {
			const started = Date.now();
			const ping = () => {
				fetch("/dsh-purge/status", { cache: "no-store" })
					.then((r) => { if (r.ok) window.location.reload(); else retry(); })
					.catch(retry);
			};
			const retry = () => {
				if (Date.now() - started > 25000) {
					setNotice({ kind: "error", text: t("restart.timeout") });
					setBusy(false);
					return;
				}
				setTimeout(ping, 400);
			};
			setTimeout(ping, 700);
		}

		function restartDsh(setNotice, setBusy, t) {
			setBusy(true);
			setNotice({ kind: "ok", text: t("restarting") });
			fetch("/dsh-purge/restart", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
				.then((r) => r.json())
				.then((d) => {
					if (!d.ok) throw new Error(d.error || "restart failed");
					waitForRestart(setNotice, setBusy, t);
				})
				.catch((e) => {
					if (String(e.message || e).includes("Failed to fetch") || e.name === "TypeError") {
						waitForRestart(setNotice, setBusy, t);
						return;
					}
					setNotice({ kind: "error", text: t("restart.fail", { error: e.message }) });
					setBusy(false);
				});
		}

		function readTheme() {
			try {
				const v = window.localStorage.getItem(THEME_KEY);
				if (v === "dusk" || v === "white") return v;
			} catch { /* ignore */ }
			return "white";
		}

		function SettingsRoot(props) {
			const t = typeof props.t === "function" ? props.t : ((key) => key);
			const [theme, setTheme] = useState(readTheme);
			const setAndStore = useCallback((next) => {
				setTheme(next);
				try { window.localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
			}, []);
			return h(I18n.Provider, { value: t },
				h("div", { className: "dshp-root", "data-theme": theme },
					h("style", null, PURGE_CSS),
					h("div", { className: "dshp-toolbar" },
						h("div", { className: "dshp-switch", role: "group", "aria-label": t("theme.aria") },
							h("button", {
								type: "button",
								className: theme === "white" ? "is-on" : "",
								onClick: () => setAndStore("white"),
							}, t("theme.white")),
							h("button", {
								type: "button",
								className: theme === "dusk" ? "is-on" : "",
								onClick: () => setAndStore("dusk"),
							}, t("theme.ink")),
						),
					),
					h(PurgifySection, null),
					h(RulesSection, null),
				),
			);
		}

		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-purge: dictionaries");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-purge",
				order: 40,
				label: () => t("nav"),
				locale: NS,
			}, SettingsRoot));
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
