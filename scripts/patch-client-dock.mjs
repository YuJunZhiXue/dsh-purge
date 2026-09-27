/**
 * 把 client.js 改成右侧 dsh-purge 双页签（清洗 + 演练台），并嵌入 vendor 演练台 UI。
 * node scripts/patch-client-dock.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clientPath = join(root, "client.js");
const legalPath = join(root, "docs", "drill-auth-legal.html");

const BEGIN = "/* __DSH_PURGE_DRILL_BEGIN__ */";
const END = "/* __DSH_PURGE_DRILL_END__ */";

const LEGAL = readFileSync(legalPath, "utf8").trim();

let client = readFileSync(clientPath, "utf8").replace(/\r\n/g, "\n");

// 1) locale keys
if (!client.includes('"dock.clean"')) {
	client = client.replace(
		'\t\t\tnav: "规则设定",',
		`\t\t\tnav: "dsh-purge",
			"dock.clean": "清洗",
			"dock.drill": "演练台",
			"dock.toggle": "dsh-purge",
			"dock.full": "全面浏览",
			"dock.close": "收起",
			"dock.unauthorized": "未授权",
			"auth.title": "演练台授权确认",
			"auth.lead": "清洗不需要这一步。第一次进入演练台，或打开全面浏览，都要先完成本窗。",
			"auth.warn": "安全警告：演练台只用于你有权管理的本机、离线靶标，或已书面授权的演练环境。未经授权的渗透、攻击、窃取和破坏一律禁止。",
			"auth.hint.wait": "请阅读声明。{n} 秒后才能勾选。",
			"auth.hint.scroll": "倒计时已结束。请把声明滚到文末，再勾选。",
			"auth.hint.check": "倒计时已结束。请勾选全部三项。",
			"auth.check.read": "我已读完《安全与禁止违法声明》，并认可其中的全部条款。",
			"auth.check.scope": "我确认只用在本机已授权环境、离线靶标或合规演练中。",
			"auth.check.ban": "我确认禁止任何违法用途。未完成本授权，不得使用演练台。",
			"auth.no": "暂不进入",
			"auth.ok": "确认授权",
			"auth.ok.tab": "确认授权并进入演练台",
			"auth.ok.full": "确认授权并全面浏览",`,
	);
	client = client.replace(
		'\t\t\tnav: "Rules",',
		`\t\t\tnav: "dsh-purge",
			"dock.clean": "Clean",
			"dock.drill": "Drill",
			"dock.toggle": "dsh-purge",
			"dock.full": "Full view",
			"dock.close": "Collapse",
			"dock.unauthorized": "Unauthorized",
			"auth.title": "Drill console authorization",
			"auth.lead": "Cleaning does not need this step. Opening Drill or Full view the first time requires this dialog.",
			"auth.warn": "Warning: the drill console is only for hosts you manage, offline targets, or written authorized exercises. Unauthorized intrusion, attack, theft, or sabotage is forbidden.",
			"auth.hint.wait": "Read the notice. You can check the boxes in {n}s.",
			"auth.hint.scroll": "Countdown finished. Scroll to the end, then check the boxes.",
			"auth.hint.check": "Countdown finished. Check all three boxes.",
			"auth.check.read": "I have read the Safety and Anti-Abuse Notice and accept every clause.",
			"auth.check.scope": "I will only use authorized local hosts, offline targets, or compliant exercises.",
			"auth.check.ban": "I will not use this for any illegal purpose. Without this authorization the drill console stays closed.",
			"auth.no": "Not now",
			"auth.ok": "Authorize",
			"auth.ok.tab": "Authorize and open Drill",
			"auth.ok.full": "Authorize and open Full view",`,
	);
}

// 2) dock CSS into PURGE_CSS (append before closing backtick of PURGE_CSS)
if (!client.includes(".dshp-dock{")) {
	const cssExtra = `
.dshp-dock{position:fixed;z-index:10050;display:flex;flex-direction:column;width:var(--dshp-dock-w,620px);height:var(--dshp-dock-h,72vh);min-width:380px;min-height:320px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);box-sizing:border-box;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,var(--dshp-paper,#1c1c1c)) 52%,transparent);backdrop-filter:blur(22px) saturate(1.35);-webkit-backdrop-filter:blur(22px) saturate(1.35);border:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,var(--dshp-line,#555)) 65%,transparent);border-radius:12px;box-shadow:0 18px 48px color-mix(in srgb,#000 30%,transparent),0 0 0 1px color-mix(in srgb,#fff 6%,transparent);pointer-events:auto;color:var(--dsw-alias-label-primary,var(--dshp-ink,#f2f2f2));overflow:hidden}
.dshp-dock[data-open="0"]{display:none}
.dshp-dock-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,var(--dshp-line,#555)) 55%,transparent);background:transparent;cursor:grab;user-select:none;touch-action:none;color:var(--dsw-alias-label-primary,var(--dshp-ink,#f2f2f2))}
.dshp-dock-head:active{cursor:grabbing}
.dshp-dock-head b{font-size:14px;font-weight:600;color:inherit;text-shadow:0 1px 0 color-mix(in srgb,#000 18%,transparent)}
.dshp-dock-head button{cursor:pointer;color:inherit;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.18)) 55%,transparent)}
.dshp-dock-tabs{display:flex;gap:4px;padding:0 12px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,var(--dshp-line,#555)) 55%,transparent);background:transparent}
.dshp-dock-tab{appearance:none;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,var(--dshp-mute,#b8b4ac));border-radius:0;padding:10px 14px 8px;margin-bottom:-1px;cursor:pointer;font:13px/1.2 inherit;text-shadow:0 1px 0 color-mix(in srgb,#000 12%,transparent)}
.dshp-dock-tab:hover{color:var(--dsw-alias-label-primary,var(--dshp-ink,#f2f2f2))}
.dshp-dock-tab.on{color:var(--dsw-alias-label-primary,var(--dshp-ink,#f2f2f2));font-weight:600;border-bottom-color:var(--dsw-alias-brand-primary,#6dbf8c);background:transparent}
.dshp-dock-body{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;background:transparent}
.dshp-dock-body .dshp-root{max-width:none;height:100%;flex:1;min-height:0;overflow:auto;background:transparent!important;--dshp-bg:transparent;--dshp-paper:color-mix(in srgb,var(--dshp-ink) 7%,transparent);--dshp-fill:color-mix(in srgb,var(--dshp-ink) 6%,transparent);--dshp-line:color-mix(in srgb,var(--dshp-ink) 20%,transparent);--dshp-accent-soft:color-mix(in srgb,var(--dshp-accent) 22%,transparent)}
.dshp-dock-body .dshp-root[data-theme="white"]{--dshp-ink:#1c1b18;--dshp-mute:#5a554c;--dshp-ok:#2f6b45;--dshp-warn:#8a5f18;--dshp-bad:#a14545}
.dshp-dock-body .dshp-root[data-theme="dusk"]{--dshp-ink:#f4f1ea;--dshp-mute:#c9c3b8;--dshp-ok:#9fd0ad;--dshp-warn:#e0c08a;--dshp-bad:#e0b0b0}
.dshp-dock-body .dshp-panel,.dshp-dock-body .dshp-metric,.dshp-dock-body .dshp-group,.dshp-dock-body .dshp-editor,.dshp-dock-body .dshp-active,.dshp-dock-body .dshp-ask,.dshp-dock-body .dshp-create,.dshp-dock-body .dshp-switch{background:color-mix(in srgb,var(--dshp-ink) 6%,transparent)!important}
.dshp-dock-body .dshp-field,.dshp-dock-body .dshp-area{background:color-mix(in srgb,var(--dshp-ink) 8%,transparent);color:var(--dshp-ink)}
.dshp-dock-body .dshp-title,.dshp-dock-body .dshp-kicker,.dshp-dock-body .dshp-sub h4,.dshp-dock-body .dshp-group-h strong,.dshp-dock-body .dshp-metric b{color:var(--dshp-ink)}
.dshp-dock-body .dshp-mute,.dshp-dock-body .dshp-metric span,.dshp-dock-body .dshp-group-h em,.dshp-dock-body .dshp-count,.dshp-dock-body .dshp-rule-meta{color:var(--dshp-mute)}
.dshp-dock-body .rt-dock{position:relative;inset:auto;width:100%!important;height:100%;flex:1;min-height:0;display:flex!important;box-shadow:none;border:0;transform:none!important;opacity:1!important;pointer-events:auto!important;background:transparent!important;color:var(--dsw-alias-label-primary,#f2f2f2)}
.dshp-dock-body .rt-grip{display:none!important}
.dshp-dock-body .rt-embedded>.rt-head,.dshp-dock-body .rt-tabs,.dshp-dock-body .rt-body,.dshp-dock-body .rt-foot,.dshp-dock-body .rt-card,.dshp-dock-body .rt-pane,.dshp-dock-body .rt-side,.dshp-dock-body .rt-main{background:transparent!important;color:inherit}
.dshp-dock-body .rt-title,.dshp-dock-body .rt-tab.on,.dshp-dock-body .rt-btn{color:var(--dsw-alias-label-primary,#f2f2f2)}
.dshp-dock-body .rt-tab{color:var(--dsw-alias-label-secondary,#c2bdb4)}
.dshp-dock-body .rt-embedded>.rt-head{padding:8px 12px}
.dshp-dock-body .rt-embedded>.rt-head .rt-title{font-size:13px}
.dshp-dock-body .rt-tabs{gap:2px;padding:6px 12px 0}
.dshp-dock-body .rt-tab{border-radius:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:8px 10px 7px;background:transparent}
.dshp-dock-body .rt-tab.on{border-bottom-color:var(--dsw-alias-brand-primary,#6dbf8c);background:transparent;font-weight:600}
.dshp-dock-body .rt-btn,.dshp-dock-body .rt-input{background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.2)) 60%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-border-l1,#666) 70%,transparent);color:inherit}
.dshp-dock-resize{position:absolute;right:2px;bottom:2px;width:18px;height:18px;cursor:nwse-resize;z-index:3;background:linear-gradient(135deg,transparent 46%,color-mix(in srgb,var(--dsw-alias-label-secondary,#999) 70%,transparent) 46%);border-radius:2px;opacity:.85}
.dshp-dock-resize-l{position:absolute;left:0;top:28px;bottom:18px;width:6px;cursor:ew-resize;z-index:3;background:transparent}
.dshp-dock-resize-l:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#6dbf8c) 35%,transparent)}
.dshp-auth-mask{position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:20px;pointer-events:auto}
.dshp-auth-modal{width:min(680px,100%);max-height:min(88vh,820px);display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#1a1a1a);color:var(--dsw-alias-label-primary,#eee)}
.dshp-auth-modal h2{margin:0;font-size:16px;font-weight:600}
.dshp-auth-warn{padding:8px 10px;border-radius:8px;background:#3a2e18;color:#f0d48a;font-size:13px}
.dshp-auth-legal{overflow:auto;height:300px;margin:0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:8px;background:#121212;font-size:13px;line-height:1.55}
.dshp-auth-legal h3{margin:14px 0 4px;font-size:13px}
.dshp-auth-legal h3:first-child{margin-top:0}
.dshp-auth-legal p{margin:0 0 8px}
.dshp-auth-checks{display:flex;flex-direction:column;gap:8px;font-size:13px}
.dshp-auth-checks label{display:flex;gap:8px;align-items:flex-start}
.dshp-auth-checks label.locked{opacity:.45}
.dshp-auth-ops{display:flex;justify-content:flex-end;gap:8px}
.dshp-auth-ops button,.dshp-dock-head button{appearance:none;border:1px solid var(--dsw-alias-border-l1,#444);background:transparent;color:inherit;border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit}
.dshp-auth-ops button.primary{background:#2a4033;border-color:#8fbf9a}
.dshp-auth-ops button:disabled{opacity:.45;cursor:default}
.dshp-icon-btn{appearance:none;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,currentColor);cursor:pointer;font:13px/1 inherit}
.dshp-icon-btn.on,.dshp-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,currentColor)}
.dshp-hbtn{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary,currentColor);cursor:pointer;font:12px/1 inherit;padding:4px 8px;border-radius:8px}
.dshp-hbtn.on,.dshp-hbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,currentColor)}
`;
	// Find end of PURGE_CSS - the backtick after Rewind starts at REWIND_CSS
	const purgeCssEnd = client.indexOf("\t\tconst REWIND_CSS");
	if (purgeCssEnd < 0) throw new Error("REWIND_CSS not found");
	// PURGE_CSS ends just before that - look backward for closing `
	const before = client.lastIndexOf("`;", purgeCssEnd);
	if (before < 0) throw new Error("PURGE_CSS end not found");
	client = client.slice(0, before) + cssExtra + client.slice(before);
}

// 3) Insert dock/auth/marker block before installRewindUi
const dockBlock = `
		const AUTH_KEY = "dsh-purge-drill-auth";
		const AUTH_LEGAL_HTML = ${JSON.stringify(LEGAL)};

		${BEGIN}
		const __dshPurgeDrill = { CSS: "", Panel: null, setUI: () => {}, useUI: () => ({ open: false }), isFullWindow: () => false, setDockWidth: () => {} };
		${END}

		function readDrillAuth() {
			try { return window.localStorage.getItem(AUTH_KEY) === "1"; } catch { return false; }
		}
		function writeDrillAuth(ok) {
			try {
				if (ok) window.localStorage.setItem(AUTH_KEY, "1");
				else window.localStorage.removeItem(AUTH_KEY);
			} catch { /* ignore */ }
		}

		let dockBus = { open: false, tab: "clean", authOpen: false, pending: "tab", listeners: new Set() };
		function getDock() { return dockBus; }
		function setDock(patch) {
			dockBus = Object.assign({}, dockBus, patch);
			dockBus.listeners.forEach((fn) => { try { fn(dockBus); } catch { /* ignore */ } });
		}
		function useDock() {
			const [st, setSt] = useState(dockBus);
			useEffect(() => {
				const fn = (next) => setSt(next);
				dockBus.listeners.add(fn);
				return () => { dockBus.listeners.delete(fn); };
			}, []);
			return st;
		}

		function requestDrill(kind) {
			const pending = kind || "tab";
			if (readDrillAuth()) {
				setDock({ open: true, tab: "drill", authOpen: false, pending: "tab" });
				try { if (__dshPurgeDrill && __dshPurgeDrill.setUI) __dshPurgeDrill.setUI({ open: true }); } catch { /* ignore */ }
				if (pending === "full") {
					try { window.open(window.location.href.split("#")[0] + "#redteam-full", "_blank", "noopener"); } catch { /* ignore */ }
				}
				return;
			}
			setDock({ open: true, tab: "drill", authOpen: true, pending: pending });
		}

		function openDockClean() {
			setDock({ open: true, tab: "clean", authOpen: false, pending: "tab" });
		}
		function toggleDock() {
			if (dockBus.open) setDock({ open: false, authOpen: false, pending: "tab" });
			else openDockClean();
		}

		function AuthGate(props) {
			const t = useT();
			const [left, setLeft] = useState(10);
			const [readEnd, setReadEnd] = useState(false);
			const [checks, setChecks] = useState({ read: false, scope: false, ban: false });
			const legalRef = useRef(null);
			useEffect(() => {
				const id = window.setInterval(() => {
					setLeft((n) => {
						if (n <= 1) { window.clearInterval(id); return 0; }
						return n - 1;
					});
				}, 1000);
				return () => window.clearInterval(id);
			}, []);
			useEffect(() => {
				const el = legalRef.current;
				if (!el) return;
				if (el.scrollHeight <= el.clientHeight + 4) setReadEnd(true);
			}, []);
			const locked = left > 0 || !readEnd;
			const ready = !locked && checks.read && checks.scope && checks.ban;
			const hint = left > 0
				? t("auth.hint.wait").replace("{n}", String(left))
				: (readEnd ? t("auth.hint.check") : t("auth.hint.scroll"));
			const onScroll = () => {
				const el = legalRef.current;
				if (!el) return;
				if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReadEnd(true);
			};
			const toggle = (id) => {
				if (locked) return;
				setChecks((prev) => Object.assign({}, prev, { [id]: !prev[id] }));
			};
			const okLabel = !ready ? t("auth.ok") : (props.pending === "full" ? t("auth.ok.full") : t("auth.ok.tab"));
			return h("div", { className: "dshp-auth-mask", role: "dialog", "aria-modal": "true" },
				h("div", { className: "dshp-auth-modal" },
					h("h2", null, t("auth.title")),
					h("div", { className: "muted", style: { color: "var(--dsw-alias-label-secondary,#999)", fontSize: 12 } }, t("auth.lead")),
					h("div", { className: "dshp-auth-warn" }, t("auth.warn")),
					h("div", {
						className: "dshp-auth-legal",
						ref: legalRef,
						onScroll,
						dangerouslySetInnerHTML: { __html: AUTH_LEGAL_HTML },
					}),
					h("div", { style: { color: "var(--dsw-alias-label-secondary,#999)", fontSize: 12 } }, hint),
					h("div", { className: "dshp-auth-checks" },
						[["read", "auth.check.read"], ["scope", "auth.check.scope"], ["ban", "auth.check.ban"]].map((row) =>
							h("label", { key: row[0], className: locked ? "locked" : "" },
								h("input", {
									type: "checkbox",
									checked: !!checks[row[0]],
									disabled: locked,
									onChange: () => toggle(row[0]),
								}),
								h("span", null, t(row[1])),
							),
						),
					),
					h("div", { className: "dshp-auth-ops" },
						h("button", { type: "button", onClick: () => setDock({ authOpen: false, tab: "clean", pending: "tab" }) }, t("auth.no")),
						h("button", {
							type: "button",
							className: "primary",
							disabled: !ready,
							onClick: () => {
								if (!ready) return;
								writeDrillAuth(true);
								const kind = props.pending || "tab";
								setDock({ authOpen: false, open: true, tab: "drill", pending: "tab" });
								try { if (__dshPurgeDrill && __dshPurgeDrill.setUI) __dshPurgeDrill.setUI({ open: true }); } catch { /* ignore */ }
								if (kind === "full") {
									try { window.open(window.location.href.split("#")[0] + "#redteam-full", "_blank", "noopener"); } catch { /* ignore */ }
								}
							},
						}, okLabel),
					),
				),
			);
		}

		function PurgeDock() {
			const t = useT();
			const st = useDock();
			useEffect(() => {
				if (!__dshPurgeDrill || !__dshPurgeDrill.CSS) return undefined;
				const styleTag = document.createElement("style");
				styleTag.setAttribute("data-dsh-purge-drill", "1");
				styleTag.textContent = __dshPurgeDrill.CSS;
				document.head.append(styleTag);
				const widthTag = document.createElement("style");
				widthTag.setAttribute("data-dsh-purge-dock-w", "1");
				widthTag.textContent = ":root{--dshp-dock-w:620px;--rt-dock-w:620px}";
				document.head.append(widthTag);
				try { if (__dshPurgeDrill.setDockWidth) __dshPurgeDrill.setDockWidth(620); } catch { /* ignore */ }
				return () => { styleTag.remove(); widthTag.remove(); };
			}, []);
			useEffect(() => {
				if (st.tab === "drill" && readDrillAuth() && __dshPurgeDrill && __dshPurgeDrill.setUI) {
					try { __dshPurgeDrill.setUI({ open: true }); } catch { /* ignore */ }
				}
			}, [st.tab, st.open]);
			const onTab = (id) => {
				if (id === "drill") { requestDrill("tab"); return; }
				setDock({ tab: "clean", authOpen: false, pending: "tab" });
			};
			const body = st.tab === "clean"
				? h(SettingsRoot, { t })
				: (readDrillAuth() && __dshPurgeDrill.Panel
					? h(__dshPurgeDrill.Panel, { embedded: true })
					: h("div", { style: { padding: 16, color: "var(--dsw-alias-label-secondary)" } }, t("dock.unauthorized")));
			return h(react.Fragment, null,
				h("div", { className: "dshp-dock", "data-open": st.open ? "1" : "0" },
					h("div", { className: "dshp-dock-head" },
						h("b", null, "dsh-purge"),
						h("span", { style: { flex: 1 } }),
						st.tab === "drill" && readDrillAuth()
							? h("button", { type: "button", onClick: () => requestDrill("full") }, t("dock.full"))
							: null,
						h("button", { type: "button", onClick: () => setDock({ open: false, authOpen: false, tab: "clean", pending: "tab" }) }, t("dock.close")),
					),
					h("div", { className: "dshp-dock-tabs", role: "tablist" },
						h("button", {
							type: "button",
							className: "dshp-dock-tab" + (st.tab === "clean" ? " on" : ""),
							role: "tab",
							"aria-selected": st.tab === "clean" ? "true" : "false",
							onClick: () => onTab("clean"),
						}, t("dock.clean")),
						h("button", {
							type: "button",
							className: "dshp-dock-tab" + (st.tab === "drill" ? " on" : ""),
							role: "tab",
							"aria-selected": st.tab === "drill" ? "true" : "false",
							onClick: () => onTab("drill"),
						}, t("dock.drill") + (readDrillAuth() ? "" : " · " + t("dock.unauthorized"))),
					),
					h("div", { className: "dshp-dock-body" }, body),
				),
				st.authOpen ? h(AuthGate, { pending: st.pending }) : null,
			);
		}

		function HeroNewSessionMount() {
			const t = useT();
			const st = useDock();
			const [host, setHost] = useState(null);
			useEffect(() => {
				let dead = false;
				const ensure = () => {
					if (dead || typeof document === "undefined") return;
					const row = document.querySelector('[class*="heroWorkspaceRow"]');
					if (!row) { setHost((prev) => (prev ? null : prev)); return; }
					let el = row.querySelector(":scope > .dshp-hero-chip");
					if (!el) {
						el = document.createElement("div");
						el.className = "dshp-hero-chip";
						row.appendChild(el);
					}
					setHost((prev) => (prev === el ? prev : el));
				};
				ensure();
				const obs = typeof MutationObserver !== "undefined" ? new MutationObserver(() => ensure()) : null;
				if (obs) obs.observe(document.body, { childList: true, subtree: true });
				const iv = setInterval(ensure, 1000);
				return () => { dead = true; if (obs) obs.disconnect(); clearInterval(iv); };
			}, []);
			if (!host) return null;
			const btn = h("button", {
				type: "button",
				className: "dshp-hero-chip-btn" + (st.open ? " on" : ""),
				title: t("dock.newSession"),
				onClick: () => toggleDock(),
			},
				st.open ? h("span", { className: "dshp-live-dot", "aria-hidden": "true" }) : null,
				t("dock.newSession"),
			);
			try {
				const rd = require("react-dom");
				if (rd && typeof rd.createPortal === "function") return rd.createPortal(btn, host);
			} catch { /* ignore */ }
			return null;
		}

`;

if (!client.includes("function PurgeDock()")) {
	const anchor = "\t\tfunction installRewindUi(ctx) {";
	if (!client.includes(anchor)) throw new Error("installRewindUi not found");
	client = client.replace(anchor, dockBlock + "\t\tfunction installRewindUi(ctx) {");
}

// 4) Replace apply() settings.section with dock slots
const oldApply = `		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-purge: dictionaries");
			const t = ctx.locale.bind(NS);
			translate = t;
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-purge",
				order: 40,
				label: () => t("nav"),
				locale: NS,
				inject: () => ({ t }),
			}, SettingsRoot));
			try {
				if (typeof ctx.inject === "function") {
					ctx.inject(["sessions", "uiWorkspace", "conversation"], (host) => installRewindUi(host));
				} else if (ctx.sessions) {
					installRewindUi(ctx);
				}
			} catch (e) {
				try { console.warn("[dsh-purge] rewind ui skipped:", e); } catch { /* ignore */ }
			}
		}`;

const newApply = `		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-purge: dictionaries");
			const t = ctx.locale.bind(NS);
			translate = t;
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-purge",
				order: 40,
				label: () => t("nav"),
				locale: NS,
				inject: () => ({ t }),
			}, SettingsRoot));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-purge-dock",
				order: 50,
			}, () => h(react.Fragment, null, h(PurgeDock), h(HeroNewSessionMount))));
			try {
				if (typeof ctx.inject === "function") {
					ctx.inject(["sessions", "uiWorkspace", "workspaces", "conversation"], (host) => installRewindUi(host));
				} else if (ctx.sessions) {
					installRewindUi(ctx);
				}
			} catch (e) {
				try {
					if (typeof ctx.inject === "function") {
						ctx.inject(["sessions", "uiWorkspace", "conversation"], (host) => installRewindUi(host));
					}
				} catch (e2) {
					try { console.warn("[dsh-purge] rewind ui skipped:", e2 || e); } catch { /* ignore */ }
				}
			}
		}`;

if (client.includes('id: "dsh-purge-dock"')) {
	// already patched apply
} else if (client.includes(oldApply)) {
	client = client.replace(oldApply, newApply);
} else {
	throw new Error("apply() block not found for replacement");
}

writeFileSync(clientPath, client);
console.log("patched dock/auth into client.js");

const built = spawnSync(process.execPath, [join(root, "scripts", "build-client.mjs")], {
	cwd: root,
	encoding: "utf8",
});
process.stdout.write(built.stdout || "");
process.stderr.write(built.stderr || "");
if (built.status !== 0) process.exit(built.status || 1);
console.log("done");
