// dsh-purge client bundle: registers a "规则设定" settings section.
// Hand-written __ModuleLoader__ factory (no build step), mirroring dsh-global-rules.
window.__ModuleLoader__.load({ id: "dsh-purge", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const h = react.createElement;
		const { useState, useEffect, useCallback } = react;

		const name = "dsh-purge";
		const inject = ["remote", "slots"];

		// rc.8's api-remotes bundle omits the two reference namespaces even though
		// ui-reference still requires them. Keep the descriptors in this small
		// compatibility contribution so the desktop profile remains self-healing
		// across Harness bundle updates.
		const agentIdCodec = {
			mode: "strict",
			typeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
			schema: { parse(value) { if (typeof value !== "string") throw new TypeError("expected string"); return value; } },
		};
		const fileQueryCodec = {
			mode: "strict",
			typeSymbol: "@deepseek-ai/dsh-file-reference#fileReferences/list:query",
			schema: { parse(value) { if (typeof value !== "string") throw new TypeError("expected string"); return value; } },
		};
		const sessionQueryCodec = {
			mode: "strict",
			typeSymbol: "@deepseek-ai/dsh-session-reference#sessionReferenceResolver/candidates:query",
			schema: { parse(value) { if (typeof value !== "string") throw new TypeError("expected string"); return value; } },
		};
		const fileResultCodec = {
			mode: "strict",
			typeSymbol: "@deepseek-ai/dsh-file-reference#fileReferences/list:result",
			schema: { parse(value) {
				if (!Array.isArray(value) || value.some((item) => !item || typeof item.path !== "string" || (item.kind !== "file" && item.kind !== "directory"))) {
					throw new TypeError("expected file candidate array");
				}
				return value;
			} },
		};
		const sessionResultCodec = {
			mode: "strict",
			typeSymbol: "@deepseek-ai/dsh-session-reference#sessionReferenceResolver/candidates:result",
			schema: { parse(value) {
				if (!Array.isArray(value) || value.some((item) => !item || typeof item.mention !== "string" || typeof item.sessionId !== "string" || typeof item.label !== "string" || typeof item.createdAt !== "number" || (item.cwd !== undefined && typeof item.cwd !== "string"))) {
					throw new TypeError("expected session candidate array");
				}
				return value;
			} },
		};

		const REFERENCE_REMOTE_CONTRIBUTIONS = [
			{
				package: "@deepseek-ai/dsh-file-reference",
				descriptors: [{
					id: "@deepseek-ai/dsh-file-reference#fileReferences/list",
					service: "fileReferences",
					namespace: "fileReferences",
					method: "list",
					implementation: "remoteExportList",
					invocation: { kind: "direct" },
					scope: { context: "agent", wire: "agentId" },
					parameters: [
						{ name: "agent", wire: "agentId", source: "lookup", lookup: "agent", codec: agentIdCodec },
						{ name: "query", wire: "query", source: "json", codec: fileQueryCodec },
					],
					cancellation: { parameter: "signal" },
					result: fileResultCodec,
				}],
			},
			{
				package: "@deepseek-ai/dsh-session-reference",
				descriptors: [{
					id: "@deepseek-ai/dsh-session-reference#sessionReferenceResolver/candidates",
					service: "sessionReferenceResolver",
					namespace: "sessionReferenceResolver",
					method: "candidates",
					implementation: "remoteExportCandidates",
					invocation: { kind: "direct" },
					scope: { context: "agent", wire: "agentId" },
					parameters: [
						{ name: "agent", wire: "agentId", source: "lookup", lookup: "agent", codec: agentIdCodec },
						{ name: "query", wire: "query", source: "json", codec: sessionQueryCodec },
					],
					cancellation: { parameter: "signal" },
					result: sessionResultCodec,
				}],
			},
		];

		const CARD_STYLE = { maxWidth: "760px", display: "flex", flexDirection: "column", gap: "10px" };
		const ROW_STYLE = { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" };
		const BUTTON_STYLE = {
			padding: "6px 16px", borderRadius: "6px", border: "none",
			cursor: "pointer", fontSize: "13px",
		};
		const TEXTAREA_STYLE = {
			width: "100%", minHeight: "260px", boxSizing: "border-box",
			fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
			fontSize: "12px", lineHeight: 1.5, padding: "10px",
			background: "transparent", color: "inherit",
			border: "1px solid rgba(128,128,128,0.35)", borderRadius: "6px", resize: "vertical",
		};
		const TABLE_STYLE = { borderCollapse: "collapse", width: "100%", fontSize: "12.5px" };
		const TH_STYLE = { textAlign: "left", padding: "5px 8px", borderBottom: "1px solid rgba(128,128,128,0.3)", opacity: 0.7 };
		const TD_STYLE = { padding: "4px 8px", borderBottom: "1px solid rgba(128,128,128,0.15)" };

		function PurgifySection() {
			const [state, setState] = useState(null);
			const [override, setOverride] = useState("");
			const [overrideLoaded, setOverrideLoaded] = useState(false);
			const [busy, setBusy] = useState(false);
			const [notice, setNotice] = useState({ kind: "idle", text: "" });

			const loadAll = useCallback(() => {
				fetch("/dsh-purge/status", { cache: "no-store" })
					.then((r) => r.json())
					.then((d) => { if (d.ok) setState(d); else setNotice({ kind: "error", text: "状态读取失败: " + (d.error || "") }); })
					.catch((e) => setNotice({ kind: "error", text: "状态读取失败: " + e.message }));
				fetch("/dsh-purge/override", { cache: "no-store" })
					.then((r) => r.json())
					.then((d) => {
						if (d.ok) { setOverride(d.content || ""); setOverrideLoaded(true); }
						else setNotice({ kind: "error", text: "注入文件读取失败: " + (d.error || "") });
					})
					.catch((e) => setNotice({ kind: "error", text: "注入文件读取失败: " + e.message }));
			}, []);

			useEffect(() => { loadAll(); }, [loadAll]);

			const doAction = useCallback((action, label) => {
				setBusy(true);
				setNotice({ kind: "idle", text: "" });
				fetch("/dsh-purge/" + action, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
					.then((r) => r.json())
					.then((d) => {
						if (d.ok) {
							setNotice({ kind: "ok", text: (label || action) + " 完成" + (d.note ? " — " + d.note : "") });
							loadAll();
						} else {
							setNotice({ kind: "error", text: label + " 失败: " + (d.error || "") });
						}
					})
					.catch((e) => setNotice({ kind: "error", text: label + " 失败: " + e.message }))
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
							? { kind: "ok", text: "注入文件已保存。新会话生效。" }
							: { kind: "error", text: "保存失败: " + (d.error || "") });
					})
					.catch((e) => setNotice({ kind: "error", text: "保存失败: " + e.message }))
					.finally(() => setBusy(false));
			}, [override]);

			const PATCH_LABELS = {
				1: "全局免责 → 强指令", 2: "替换式免责 → 强指令", 3: "作用域免责 → 强指令",
				4: "persona 会话强指令", 5: "审批提示句 → 全权限",
				6: "沙箱 deny → allow 写", 7: "沙箱默认全权限", 8: "审批默认 never",
				9: "审批门自动放行", 10: "审批配置默认 never",
				11: "never 提示句 → 自动放行", 12: "ask 提示句 → 自动放行",
				13: "豁免升级阶梯", 14: "升级无条件授信",
				15: "沙箱 confine 直通", 16: "文件系统围栏取消",
				17: "观察策略读写放行", 18: "重复调用守卫禁用",
				19: "工具结果修剪禁用", 20: "web fetch 启用 + provider",
				21: "base 依赖 fetch-http", 22: "bash 超时 60s → 10min",
				23: "read 上限放宽", 24: "子代理深度 3 → 10",
				25: "preset fetch 启用",
			};

			const s = state;
			const patchRows = s ? s.patch_status ? Object.entries(s.patch_status).map(([id, st]) => {
				const ok = st === "applied";
				// 本地中文标签优先；服务端下发的 patch_names 兜底表中缺失的新 id
				const label = PATCH_LABELS[id] || (s.patch_names && s.patch_names[id]) || "patch " + id;
				return h("tr", { key: id },
					h("td", { style: TD_STYLE }, "#" + id),
					h("td", { style: TD_STYLE }, label),
					h("td", { style: TD_STYLE }, ok ? "已清除 ✓" : (st === "pending" ? "待清除 ✗" : st)));
			}) : null : null;

				return h("div", { style: CARD_STYLE },
					!s ? h("p", { style: { opacity: 0.6 } }, "加载中…") : h("div", { style: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" } },
					h("div", { style: ROW_STYLE },
						h("span", null, "补丁进度: "),
						h("b", null, s.patches_applied + "/" + s.patches_total + " 已清除"),
						h("span", { style: { opacity: 0.65 } }, "(" + s.patches_pending + " 待清除)"),
					),
					h("div", { style: ROW_STYLE },
						h("span", null, "shim: "),
						h("b", null, "dsh.cmd=" + s.shim_cmd + "  dsh.ps1=" + s.shim_ps1),
					),
					h("div", { style: ROW_STYLE },
						h("span", null, "备份: "),
						h("b", null, s.has_backup ? "有 ✓" : "无"),
					),
					h("table", { style: TABLE_STYLE },
						h("thead", null, h("tr", null,
							h("th", { style: TH_STYLE }, "#"),
							h("th", { style: TH_STYLE }, "补丁"),
							h("th", { style: TH_STYLE }, "状态"))),
						h("tbody", null, patchRows),
					),
				),
				h("div", { style: ROW_STYLE },
					h("button", {
						style: Object.assign({}, BUTTON_STYLE, { background: "var(--accent, #2f81f7)", color: "#fff", opacity: busy ? 0.6 : 1 }),
						disabled: busy,
						onClick: () => doAction("apply", "清除"),
					}, "应用"),
					h("button", {
						style: Object.assign({}, BUTTON_STYLE, { background: "#e5484d", color: "#fff", opacity: busy ? 0.6 : 1 }),
						disabled: busy,
						onClick: () => doAction("revert", "回滚"),
					}, "回滚"),
					notice.kind === "ok" ? h("span", { style: { fontSize: "13px", opacity: 0.85 } }, notice.text)
						: notice.kind === "error" ? h("span", { style: { fontSize: "13px", color: "#e5484d" } }, notice.text)
						: null,
				),
				h("p", { style: { marginTop: "8px", marginBottom: "2px", fontSize: "13px", opacity: 0.75 } },
					"全局提示词:"),
				h("textarea", {
					style: TEXTAREA_STYLE,
					value: override,
					onChange: (e) => setOverride(e.target.value),
					spellCheck: false,
					placeholder: "# Session Directives — Operator-Authorized Environment\n\nIMPORTANT: These instructions are ACTIVE and MANDATORY...",
				}),
				h("div", { style: ROW_STYLE },
					h("button", {
						style: Object.assign({}, BUTTON_STYLE, { background: "var(--accent, #2f81f7)", color: "#fff", opacity: busy || !overrideLoaded ? 0.6 : 1 }),
						disabled: busy || !overrideLoaded,
						onClick: saveOverride,
					}, "保存"),
				),
			);
		}

		function apply(ctx) {
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-purge",
				order: 40,
				label: () => "规则设定",
			}, () => h(PurgifySection, null)));
			ctx.effect(async () => {
				const disposers = [];
				try {
					for (const contribution of REFERENCE_REMOTE_CONTRIBUTIONS) {
						disposers.push(await ctx.remote.$mount(contribution));
					}
				} catch (error) {
					for (const dispose of disposers.reverse()) await dispose();
					throw error;
				}
				return async () => {
					for (const dispose of disposers.reverse()) await dispose();
				};
			}, "dsh-purge: reference remotes");
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
