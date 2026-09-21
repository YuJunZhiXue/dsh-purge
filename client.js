window.__ModuleLoader__.load({ id: "dsh-purge", factory: (require) => {

		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const h = react.createElement;
		const { useState, useEffect, useCallback, useRef, Component } = react;

		const name = "dsh-purge";
		const inject = ["slots", "locale"];
		const NS = "settings.dsh-purge";
		let translate = (key) => key;
		function useT() {
			return translate;
		}
		function clientGuessSurface() {
			try {
				if (typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || "")) return "desktop";
				if (typeof location !== "undefined") {
					const port = String(location.port || "");
					if (port === "43120") return "desktop";
					const host = String(location.hostname || "");
					if (host && host !== "127.0.0.1" && host !== "localhost" && /dsh desktop/i.test(String(location.href || ""))) return "desktop";
				}
			} catch { /* ignore */ }
			return "";
		}
		function hostSurfaceOf(s) {
			return (s && s.surface) || clientGuessSurface() || "web";
		}
		function hostText(t, key, surface) {
			if (surface && surface !== "web") {
				const specific = key + "." + surface;
				const hit = t(specific);
				if (hit && hit !== specific) return hit;
			}
			return t(key);
		}
		function apiUrl(p) {
			try { return new URL(p, window.location.origin).toString(); } catch { return p; }
		}
		function apiTimeoutMs(p, init) {
			const path = String(p || "");
			const method = String((init && init.method) || "GET").toUpperCase();
			if (path.indexOf("/dsh-purge/update") !== -1) return method === "POST" ? 180000 : 45000;
			if (path.indexOf("/dsh-purge/uninstall") !== -1) return 90000;
			if (path.indexOf("/dsh-purge/skill") !== -1) return method === "POST" ? 120000 : 20000;
			return 20000;
		}
		function isAbortError(e) {
			const msg = String((e && e.message) || e || "");
			return (e && e.name === "AbortError") || /aborted|abort/i.test(msg);
		}
		async function apiJson(p, init) {
			const ctrl = new AbortController();
			const timer = setTimeout(() => ctrl.abort(), apiTimeoutMs(p, init));
			try {
				const r = await fetch(apiUrl(p), Object.assign({ cache: "no-store", credentials: "same-origin", signal: ctrl.signal }, init || {}));
				const text = await r.text();
				let data;
				try { data = text ? JSON.parse(text) : null; } catch {
					throw new Error(r.status + " non-json: " + text.slice(0, 120));
				}
				if (!r.ok) throw new Error((data && (data.error || data.message)) || (r.status + " " + r.statusText));
				return data;
			} catch (e) {
				if (isAbortError(e)) throw new Error("timeout");
				const msg = String((e && e.message) || e || "");
				if (/failed to fetch|networkerror|load failed/i.test(msg)) {
					throw new Error("连不上接口，请确认 dsh 还在跑后 Ctrl+F5");
				}
				throw e;
			} finally { clearTimeout(timer); }
		}

		function promptBoxEmpty(text) {
			return !String(text || "").trim();
		}

		function responseNeedsPrompt(d) {
			return Boolean(d && (d.needPrompt || d.injectSource === "none"));
		}

		function warnNeedPrompt(d, tr) {
			if (!responseNeedsPrompt(d)) return false;
			window.alert(tr("need.prompt"));
			return true;
		}

		function activeRuleHasBody(st) {
			if (!st || !st.ok) return false;
			const active = st.rules && st.rules.find((r) => r.id === st.active);
			return Boolean(active && active.size > 0);
		}

		async function bothInjectEmpty(overrideText) {
			if (!promptBoxEmpty(overrideText)) return false;
			try {
				return !activeRuleHasBody(await rulesApi("status"));
			} catch {
				return true;
			}
		}

		function rulesApi(op, extra) {
			return apiJson("/dsh-purge/rules", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(Object.assign({ op: op }, extra || {})),
			});
		}

		function skillsRouteMissing(e) {
			return /\b404\b|\b405\b|non-json/i.test(String((e && e.message) || e || ""));
		}

		function skillsApi(op, extra) {
			const init = {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(Object.assign({ op: op }, extra || {})),
			};
			return apiJson("/dsh-purge/skills", init).catch((e) => {
				if (!skillsRouteMissing(e)) throw e;
				return apiJson("/dsh-purge/skill", init);
			});
		}

		const TARGETS = ["AGENTS.md", "CLAUDE.md"];
		const PATCH_GROUPS = [
			{ key: "prompt", ids: [1, 2, 3, 4, 5, 26, 27, 28, 29, 33] },
			{ key: "code", ids: [6, 7, 8] },
			{ key: "engine", ids: [9, 10, 11, 12, 13, 14, 15, 16, 36] },
			{ key: "tools", ids: [17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 31, 32, 34, 35, 37, 38] },
			{ key: "compat", ids: [39, 40, 41] },
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
			"status.skipped": "跳过",
			"apply.hint": "待应用=原文还在。跳过=没装或官方已改写，再点也不会变。",
			"warn.noRoot": "未定位到当前宿主的 @deepseek-ai，清洗不会生效。请完全退出后再打开本宿主，在本页点「应用」。桌面端安装目录可以是任意盘符，不要用官方 dsh 去清桌面端。",
			"warn.noRoot.desktop": "未定位到当前桌面应用里的 @deepseek-ai。请退出托盘后重新打开 DSH Desktop.exe，再在桌面端设置页点「应用」。安装目录不限盘符。",
			"warn.noInject": "提示词优先；为空则注入当前启用的规则集。两边都空会提示必须添加。Skill 不顶替提示词。",
			"need.prompt": "提示词和规则集都是空的，必须先添加提示词，或启用一条有内容的规则集。",
			"btn.restoreInject": "恢复默认",
			"saved.restoreInject": "已填入默认提示词，点保存写入",
			"skip": "跳过",
			"unknown": "未知",
			"delete": "删除",
			"btn.apply": "应用",
			"btn.apply.busy": "处理中…",
			"btn.revert": "还原",
			"btn.uninstall": "卸载",
			"btn.uninstall.busy": "卸载中…",
			"uninstall.title": "卸载 dsh-purge",
			"uninstall.body": "是否卸载？卸载将还原回原版，并清除本插件的全部文件与补丁。",
			"uninstall.confirm": "确认卸载",
			"uninstall.cancel": "取消",
			"uninstall.applying": "正在卸载并还原…",
			"uninstall.done": "已卸载并还原，正在重启…",
			"uninstall.done.desktop": "已卸载并还原，正在重启桌面应用…",
			"uninstall.fail": "卸载失败: {error}",
			"btn.checkUpdate": "检测更新",
			"btn.checkUpdate.busy": "检测中…",
			"btn.doUpdate": "更新",
			"btn.doUpdate.busy": "更新中…",
			"channel.title": "通道",
			"channel.stable": "正式版",
			"channel.beta": "测试版",
			"channel.useStable": "切换到正式版",
			"channel.useBeta": "切换到测试版",
			"channel.local": "本机",
			"update.checking": "正在检测更新…",
			"update.applying": "正在更新…",
			"update.switching": "正在切换版本…",
			"update.latest": "已是最新（{version}）",
			"update.available": "有新版本 {remote}，当前 {local}",
			"update.pinned": "已固定在 {version}，通道最新是 {remote}",
			"update.done": "已更新到 {version}",
			"update.switched": "已切换到 {version}",
			"update.autoDone": "已自动更新到 {version}",
			"update.reloading": "正在刷新设置页…",
			"update.dirty": "有新版本，本地有改动未自动覆盖",
			"update.fail": "更新失败: {error}",
			"update.timeout": "检测超时，请再点一次检测更新",
			"update.needRestart": "检测接口未加载，请先重启 dsh 再点检测更新",
			"update.noBeta": "还没有测试版",
			"update.switch": "切换到此版本",
			"update.pick": "选择版本",
			"update.tip": "最新",
			"update.current": "当前",
			"update.confirmSwitch": "切换到 {version}？之后可再切回另一通道或其它版本。本地未提交的插件改动不会保留。",
			"update.confirmChannel": "切换到{version}？会按该通道重新安装插件，本地未提交的插件改动不会保留。",
			"metric.version": "版本",
			"action.apply": "应用",
			"action.revert": "还原",
			"action.uninstall": "卸载",
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
			"skills.title": "Skill",
			"skills.hint": "导入到官方目录后，由 DSH 调用：聊天输入 /名称 立即加载；任务对上 description 或 whenToUse 时模型会调 skill 工具。正文写「激活」不会触发。",
			"skills.hint.desktop": "当前桌面宿主的官方 Skill 目录。聊天输入 /名称 立即加载；任务对上 description 时模型会调 skill 工具。",
			"skills.empty": "暂无用户 Skill",
			"btn.importZip": "导入压缩包",
			"btn.importFolder": "导入文件夹",
			"skills.importing": "正在导入…",
			"saved.import": "已导入 {count} 个 Skill",
			"need.import": "请选择压缩包或文件夹",
			"err.import.folder": "没读到文件夹里的文件，请直接选 Skill 目录（里面要有 SKILL.md）",
			"skills.pick": "选择 Skill",
			"skills.invalid": "官方会忽略：格式不对",
			"skills.call.slash": "聊天输入 {cmd}",
			"skills.call.model": "模型可调",
			"skills.call.modelOff": "模型不可调",
			"skills.call.userOff": "不可 /名称",
			"ph.skill.desc": "description（何时用）",
			"btn.saveSkill": "保存",
			"need.skill.id": "id 必须是 kebab-case，例如 code-review",
			"confirm.delete.skill": "从官方 $DSH_HOME/skills 删除 {id}？宿主会自动从目录拿掉。",
			"err.skills": "读取失败: {error}",
			"err.skills.needRestart": "Skill 接口未加载，请先重启当前宿主",
			"btn.restart": "重启",
			"btn.restart.busy": "重启中…",
			"restarting": "重启中…",
			"restarting.desktop": "正在重启桌面应用…",
			"restart.timeout": "超时，请刷新",
			"restart.fail": "失败: {error}",
			"restart.confirm": "清洗已完成，重启后生效。",
			"restart.confirm.desktop": "清洗已完成，重启桌面应用后生效。",
			"surface.web": "Web",
			"surface.desktop": "桌面端",
			"surface.gui": "GUI",
			"surface.tui": "TUI",
			"restart.incomplete": "清洗未完成：{detail}",
			"restart.incomplete.patches": "必需补丁失败 {failed} 项（#{ids}）",
			"restart.incomplete.flash": "CMD 无感未钉入（{entry}）",
			"restart.later": "以后",
			"group.prompt": "提示词",
			"group.code": "代码",
			"group.engine": "引擎",
			"group.tools": "工具",
			"group.compat": "0.1.5 兼容",
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
			"patch.20": "dsh-web-fetch-http：启用 fetch + provider",
			"patch.21": "dsh-web-fetch-http：base 写入依赖",
			"patch.22": "bash 超时 60s → 10min",
			"patch.23": "read 上限放宽",
			"patch.24": "子代理深度 3 → 10",
			"patch.25": "preset fetch 启用",
			"patch.26": "去掉官方默认身份（功能提示词不动）",
			"patch.27": "minimal：去掉默认身份并打开 inject",
			"patch.28": "dsh-liangshen（梁神）：去掉默认身份（可选）",
			"patch.29": "dsh-liangshen（梁神）：phase-1 保留注入段",
			"patch.30": "dsh-tool-web：外部 untrusted 拦截→可执行",
			"patch.31": "dsh-hooks-claude-code：deny→allow",
			"patch.32": "dsh-hooks-codex：deny→allow",
			"patch.33": "Web 表面身份中性化",
			"patch.34": "Shell 拒绝提示 → 可执行",
			"patch.35": "沙箱提示中性化",
			"patch.36": "升级 never 不拒",
			"patch.37": "文件系统升级 schema 放行",
			"patch.38": "子代理 scope lock 中性化",
			"patch.39": "persona text→prefix（0.1.2 预设）",
			"patch.40": "会话 v0 plugin summary（mnemon）",
			"patch.41": "complete 预设仍保留注入",
			"rewind.label": "回退",
			"rewind.aria": "回退",
			"rewind.busy": "回退中…",
			"rewind.empty": "没有可回退的上一句",
			"rewind.fail": "回退失败: {error}",
			"rewind.once": "回退一次",
			"rewind.once.hint": "只退当前对话上一句",
			"rewind.round": "回退上一轮",
			"rewind.round.hint": "退回上一轮主对话，本轮子代理一并去掉",
			"continue.title": "失败重试 / 继续",
			"continue.hint": "请求失败会自动重试；异常停止或中断可点「继续」或自动续跑。自己点停止不会自动继续。次数用完后需新开一轮。",
			"continue.autoRetry": "失败自动重试",
			"continue.retryMax": "重试次数",
			"continue.autoContinue": "中断后自动继续",
			"continue.continueMax": "继续次数",
			"continue.text": "继续用语",
			"saved.continue": "已保存",
			"continue.label": "继续",
			"continue.aria": "异常停止后继续",
			"continue.busy": "继续中…",
			"continue.ready": "继续（还可 {left} 次）",
			"continue.limit": "已达继续上限",
			"continue.fail": "继续失败: {error}",
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
			"status.skipped": "Skipped",
			"apply.hint": "Pending = original text still present. Skipped = missing or already rewritten.",
			"warn.noRoot": "Could not find this host’s @deepseek-ai tree, so Apply will not patch anything. Fully quit and reopen this host, then Apply here. Desktop may live on any drive; do not use official dsh to purge Desktop.",
			"warn.noRoot.desktop": "Could not find @deepseek-ai inside this desktop app. Quit the tray, reopen DSH Desktop.exe, then Apply on the desktop Settings page. The install folder can be on any drive.",
			"warn.noInject": "The prompt box wins. If it is empty, the enabled rule set is injected. If both are empty you will be asked to add a prompt. Skills do not replace the prompt.",
			"need.prompt": "Both the prompt and the rule set are empty. Add a prompt, or enable a rule that has content.",
			"btn.restoreInject": "Reset default",
			"saved.restoreInject": "Default prompt loaded. Save to write.",
			"skip": "Skipped",
			"unknown": "Unknown",
			"delete": "Delete",
			"btn.apply": "Apply",
			"btn.apply.busy": "Working…",
			"btn.revert": "Restore",
			"btn.uninstall": "Uninstall",
			"btn.uninstall.busy": "Uninstalling…",
			"uninstall.title": "Uninstall dsh-purge",
			"uninstall.body": "Uninstall? This restores the original Harness and removes this plugin completely.",
			"uninstall.confirm": "Uninstall",
			"uninstall.cancel": "Cancel",
			"uninstall.applying": "Uninstalling and restoring…",
			"uninstall.done": "Uninstalled and restored. Restarting…",
			"uninstall.done.desktop": "Uninstalled and restored. Restarting the desktop app…",
			"uninstall.fail": "Uninstall failed: {error}",
			"btn.checkUpdate": "Check update",
			"btn.checkUpdate.busy": "Checking…",
			"btn.doUpdate": "Update",
			"btn.doUpdate.busy": "Updating…",
			"channel.title": "Channel",
			"channel.stable": "Stable",
			"channel.beta": "Beta",
			"channel.useStable": "Switch to stable",
			"channel.useBeta": "Switch to beta",
			"channel.local": "This copy",
			"update.checking": "Checking for updates…",
			"update.applying": "Updating…",
			"update.switching": "Switching version…",
			"update.latest": "Up to date ({version})",
			"update.available": "Update {remote} available (now {local})",
			"update.pinned": "Pinned at {version}; channel latest is {remote}",
			"update.done": "Updated to {version}.",
			"update.switched": "Switched to {version}.",
			"update.autoDone": "Auto-updated to {version}.",
			"update.reloading": "Refreshing settings…",
			"update.dirty": "Update available; local edits were not overwritten.",
			"update.fail": "Update failed: {error}",
			"update.timeout": "Check timed out. Click Check update again.",
			"update.needRestart": "Update API is not loaded. Restart dsh, then check again.",
			"update.noBeta": "No beta build yet",
			"update.switch": "Switch to this version",
			"update.pick": "Select version",
			"update.tip": "latest",
			"update.current": "current",
			"update.confirmSwitch": "Switch to {version}? You can switch back later. Uncommitted plugin edits will not be kept.",
			"update.confirmChannel": "Switch to {version}? The plugin will be reinstalled from that channel. Uncommitted plugin edits will not be kept.",
			"metric.version": "Version",
			"action.apply": "Apply",
			"action.revert": "Restore",
			"action.uninstall": "Uninstall",
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
			"skills.title": "Skills",
			"skills.hint": "After import, DSH calls it: type /name in chat to load now; the model calls the skill tool when the task matches description or whenToUse. Writing「激活」in the body does nothing.",
			"skills.hint.desktop": "This desktop host’s official skill catalog. Type /name in chat to load; the model calls the skill tool when the task matches the description.",
			"skills.empty": "No user skills",
			"btn.importZip": "Import zip",
			"btn.importFolder": "Import folder",
			"skills.importing": "Importing…",
			"saved.import": "Imported {count} skill(s)",
			"need.import": "Choose a zip or folder",
			"err.import.folder": "No files were read. Select the skill folder itself (it must contain SKILL.md).",
			"skills.pick": "Select a skill",
			"skills.invalid": "Official catalog will ignore this: invalid format",
			"skills.call.slash": "Type {cmd} in chat",
			"skills.call.model": "Model can load",
			"skills.call.modelOff": "Hidden from model",
			"skills.call.userOff": "/name disabled",
			"ph.skill.desc": "description (when to use)",
			"btn.saveSkill": "Save",
			"need.skill.id": "id must be kebab-case, e.g. code-review",
			"confirm.delete.skill": "Delete {id} from official $DSH_HOME/skills? The host will drop it from the catalog.",
			"err.skills": "Read failed: {error}",
			"err.skills.needRestart": "Skill API is not loaded. Restart this host first.",
			"btn.restart": "Restart",
			"btn.restart.busy": "Restarting…",
			"restarting": "Restarting…",
			"restarting.desktop": "Restarting the desktop app…",
			"restart.timeout": "Timed out; refresh",
			"restart.fail": "Failed: {error}",
			"restart.confirm": "Apply finished. Restart to take effect.",
			"restart.confirm.desktop": "Apply finished. Restart the desktop app to take effect.",
			"surface.web": "Web",
			"surface.desktop": "Desktop",
			"surface.gui": "GUI",
			"surface.tui": "TUI",
			"restart.incomplete": "Apply incomplete: {detail}",
			"restart.incomplete.patches": "{failed} required patch(es) failed (#{ids})",
			"restart.incomplete.flash": "CMD silence not pinned ({entry})",
			"restart.later": "Later",
			"group.prompt": "Prompt",
			"group.code": "Code",
			"group.engine": "Engine",
			"group.tools": "Tools",
			"group.compat": "0.1.5 compat",
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
			"patch.20": "dsh-web-fetch-http: enable fetch + provider",
			"patch.21": "dsh-web-fetch-http: pin base dependency",
			"patch.22": "bash timeout 60s → 10min",
			"patch.23": "read cap raised",
			"patch.24": "subagent depth 3 → 10",
			"patch.25": "preset fetch on",
			"patch.26": "Strip official default identity (keep feature prompts)",
			"patch.27": "minimal: strip identity, open inject",
			"patch.28": "dsh-liangshen: strip default identity (optional)",
			"patch.29": "dsh-liangshen: keep inject in phase-1",
			"patch.30": "dsh-tool-web: untrusted framing → usable data",
			"patch.31": "dsh-hooks-claude-code: deny→allow",
			"patch.32": "dsh-hooks-codex: deny→allow",
			"patch.33": "Web surface identity neutral",
			"patch.34": "Shell denial prompt → executable",
			"patch.35": "Sandbox hint neutralized",
			"patch.36": "Escalation never-reject",
			"patch.37": "FS escalation schema opened",
			"patch.38": "Subagent scope lock neutralized",
			"patch.39": "persona text→prefix (0.1.2 presets)",
			"patch.40": "session v0 plugin summary (mnemon)",
			"patch.41": "Keep inject when a complete prompt is set",
			"rewind.label": "Undo",
			"rewind.aria": "Undo",
			"rewind.busy": "Undoing…",
			"rewind.empty": "Nothing to undo",
			"rewind.fail": "Undo failed: {error}",
			"rewind.once": "Undo once",
			"rewind.once.hint": "Drop the last turn of this chat",
			"rewind.round": "Undo last round",
			"rewind.round.hint": "Back to the previous main turn, including this round's subagents",
			"continue.title": "Retry / Continue",
			"continue.hint": "Failed requests auto-retry. After an abnormal stop or interrupt, use Continue or auto-resume. A manual stop never auto-continues. Counts reset after a completed turn.",
			"continue.autoRetry": "Auto-retry on failure",
			"continue.retryMax": "Retry count",
			"continue.autoContinue": "Auto-continue after interrupt",
			"continue.continueMax": "Continue count",
			"continue.text": "Continue text",
			"saved.continue": "Saved",
			"continue.label": "Continue",
			"continue.aria": "Continue after an abnormal stop",
			"continue.busy": "Continuing…",
			"continue.ready": "Continue ({left} left)",
			"continue.limit": "Continue limit reached",
			"continue.fail": "Continue failed: {error}",
		};

		const THEME_KEY = "dshp-theme";
		const THEME_MODE_KEY = "dshp-theme-mode"; // "manual" = user picked; else follow host
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
.dshp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
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
.dshp-cr-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0 0;font-size:13px}
.dshp-cr-row label{display:inline-flex;align-items:center;gap:6px;color:var(--dshp-ink)}
.dshp-cr-num{width:64px;min-width:64px;height:28px;padding:0 8px}
.dshp-cr-text{width:120px;min-width:88px;height:28px;padding:0 8px}
.dshp-ver{width:100%;min-width:0;max-width:none;height:32px;padding:0 10px;font-size:12px}
.dshp-rel{margin:0 0 14px}
.dshp-now{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0 0 4px}
.dshp-now-label{font-family:var(--dshp-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dshp-mute)}
.dshp-now-ver{font-family:var(--dshp-display);font-size:20px;font-weight:500;letter-spacing:.01em}
.dshp-now-mark{display:inline-flex;align-items:center;margin-left:6px;padding:1px 7px;border-radius:99px;font-family:var(--dshp-mono);font-size:11px;font-style:normal;font-weight:500;line-height:1.5;color:var(--dshp-ok);border:1px solid color-mix(in srgb,var(--dshp-ok) 38%,var(--dshp-line));background:color-mix(in srgb,var(--dshp-ok) 14%,var(--dshp-bg))}
.dshp-editions{display:flex;flex-direction:column;margin:10px 0 0;border-top:1px solid var(--dshp-line)}
.dshp-edition{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--dshp-line)}
.dshp-edition-name{display:inline-flex;align-items:center;gap:0;font-family:var(--dshp-display);font-size:15px;font-weight:500;white-space:nowrap}
.dshp-edition.is-on .dshp-edition-name{color:var(--dshp-ink)}
.dshp-edition:not(.is-on) .dshp-edition-name{color:var(--dshp-mute)}
.dshp-edition .dshp-btn{min-width:118px}
.dshp-rel .dshp-notice{display:block;margin-top:8px;min-height:16px}
@media (max-width:560px){.dshp-edition{grid-template-columns:1fr auto;grid-template-areas:"name btn" "sel sel"}.dshp-edition-name{grid-area:name}.dshp-edition .dshp-ver{grid-area:sel}.dshp-edition .dshp-btn{grid-area:btn}}
.dshp-area{min-height:220px;resize:vertical}
.dshp-field:focus,.dshp-area:focus{outline:none;border-color:var(--dshp-accent);box-shadow:0 0 0 3px var(--dshp-accent-soft)}
.dshp-field:disabled,.dshp-area:disabled{opacity:.5}
.dshp-ask{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;padding:10px 12px;border:1px solid var(--dshp-line);border-radius:8px;background:var(--dshp-bg);font-size:13px}
.dshp-modal-bg{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;background:color-mix(in srgb,var(--dshp-ink) 28%,transparent)}
.dshp-modal{width:min(420px,100%);background:var(--dshp-paper);color:var(--dshp-ink);border:1px solid var(--dshp-line);border-radius:12px;padding:20px 20px 16px;box-shadow:0 16px 40px color-mix(in srgb,var(--dshp-ink) 18%,transparent)}
.dshp-modal h4{margin:0 0 8px;font-family:var(--dshp-display);font-size:18px;font-weight:500}
.dshp-modal p{margin:0 0 16px;font-size:13.5px;line-height:1.55}
.dshp-modal-ops{display:flex;justify-content:flex-end;gap:8px}
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

		function formatSize(bytes) {
			if (typeof bytes !== "number" || !isFinite(bytes) || bytes < 0) return "0 B";
			if (bytes < 1024) return bytes + " B";
			const kb = bytes / 1024;
			return (kb >= 100 ? Math.round(kb) : kb.toFixed(1)) + " KB";
		}

		function statusKind(st) {
			if (st === "applied" || st === "already") return "ok";
			if (st === "pending") return "wait";
			if (st === "missing_file" || st === "skipped") return "miss";
			return "bad";
		}

		function statusLabel(st, t) {
			if (st === "applied" || st === "already") return t("status.applied");
			if (st === "pending") return t("status.pending");
			if (st === "skipped") return t("status.skipped");
			if (st === "missing_file") return t("skip");
			return st || t("unknown");
		}

		function statusSettled(st) {
			return st === "applied" || st === "already" || st === "skipped" || st === "missing_file";
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
			const [open, setOpen] = useState({});
			if (!state || !state.patch_status) return h("div", { className: "dshp-skel", style: { height: 120 } });
			return PATCH_GROUPS.map((group) => {
				const rows = group.ids.map((id) => {
					const st = state.patch_status[id] || state.patch_status[String(id)] || "missing_file";
					return { id, st, label: t("patch." + id) };
				});
				const done = rows.filter((r) => statusSettled(r.st)).length;
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

		function ContinueRetrySection() {
			const t = useT();
			const [cfg, setCfg] = useState(null);
			const [notice, setNotice] = useState({ kind: "idle", text: "" });
			const [busy, setBusy] = useState(false);

			useEffect(() => {
				apiJson("/dsh-purge/continue/settings")
					.then((d) => { if (d && d.ok) setCfg(d); })
					.catch(() => {});
			}, []);

			const save = (patch) => {
				if (!cfg || busy) return;
				const next = { ...cfg, ...patch };
				if (next.autoRetry && !(Number(next.retryMax) > 0)) next.retryMax = 3;
				if (next.autoContinue && !(Number(next.continueMax) > 0)) next.continueMax = 3;
				setCfg(next);
				setBusy(true);
				apiJson("/dsh-purge/continue/settings", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(next),
				})
					.then((d) => {
						if (d && d.ok) {
							setCfg(d);
							setNotice({ kind: "ok", text: t("saved.continue") });
						} else {
							setNotice({ kind: "error", text: t("err.save", { error: (d && d.error) || "" }) });
						}
					})
					.catch((e) => setNotice({ kind: "error", text: t("err.save", { error: e.message }) }))
					.finally(() => setBusy(false));
			};

			if (!cfg) return null;
			return h("div", { className: "dshp-cr" },
				h("div", { className: "dshp-sub" },
					h("h4", null, t("continue.title")),
					noticeNode(notice),
				),
				h("p", { className: "dshp-hint", style: { margin: "0 0 4px", color: "var(--dshp-mute)", fontSize: 12 } }, t("continue.hint")),
				h("div", { className: "dshp-cr-row" },
					h("label", null,
						h("input", {
							type: "checkbox",
							checked: Boolean(cfg.autoRetry),
							disabled: busy,
							onChange: (e) => save({ autoRetry: e.target.checked }),
						}),
						t("continue.autoRetry"),
					),
					h("label", null,
						t("continue.retryMax"),
						h("input", {
							className: "dshp-field dshp-cr-num",
							type: "number",
							min: 0,
							max: 20,
							value: cfg.retryMax,
							disabled: busy,
							onChange: (e) => save({ retryMax: Number(e.target.value) }),
						}),
					),
				),
				h("div", { className: "dshp-cr-row" },
					h("label", null,
						h("input", {
							type: "checkbox",
							checked: Boolean(cfg.autoContinue),
							disabled: busy,
							onChange: (e) => save({ autoContinue: e.target.checked }),
						}),
						t("continue.autoContinue"),
					),
					h("label", null,
						t("continue.continueMax"),
						h("input", {
							className: "dshp-field dshp-cr-num",
							type: "number",
							min: 0,
							max: 20,
							value: cfg.continueMax,
							disabled: busy,
							onChange: (e) => save({ continueMax: Number(e.target.value) }),
						}),
					),
					h("label", null,
						t("continue.text"),
						h("input", {
							className: "dshp-field dshp-cr-text",
							type: "text",
							value: cfg.continueText || "",
							disabled: busy,
							onChange: (e) => save({ continueText: e.target.value }),
						}),
					),
				),
			);
		}

		function PurgifySection() {
			const t = useT();
			const tRef = useRef(t);
			tRef.current = t;
			const [state, setState] = useState(null);
			const [override, setOverride] = useState("");
			const [defaultOverride, setDefaultOverride] = useState("");
			const [overrideLoaded, setOverrideLoaded] = useState(false);
			const [patchBusy, setPatchBusy] = useState(false);
			const [updateBusy, setUpdateBusy] = useState(false);
			const [canApplyUpdate, setCanApplyUpdate] = useState(false);
			const [updateJob, setUpdateJob] = useState(null);
			const [askRestart, setAskRestart] = useState(false);
			const [askUninstall, setAskUninstall] = useState(false);
			const [uninstallBusy, setUninstallBusy] = useState(false);
			const [notice, setNotice] = useState({ kind: "idle", text: "" });
			const [updateNotice, setUpdateNotice] = useState({ kind: "idle", text: "" });
			const [updateInfo, setUpdateInfo] = useState(null);
			const [channel, setChannel] = useState("stable");
			const [pick, setPick] = useState({ stable: "", beta: "" });
			const actionTicket = useRef(0);

			const syncPicks = (d) => {
				const versions = (d && d.versions) || [];
				const next = { stable: "", beta: "" };
				for (const id of ["stable", "beta"]) {
					const list = versions.filter((item) => item.channel === id && keepListedVersion(item));
					const cur = list.find((item) => item.current);
					const latest = list.find((item) => item.latest);
					next[id] = (cur || latest || {}).ref || "";
				}
				setPick(next);
			};

			const updateErrorText = (tr, e) => {
				const msg = String((e && e.message) || e || "");
				if (msg === "timeout" || /aborted|abort|超时/i.test(msg)) return tr("update.timeout");
				if (/\b404\b/.test(msg) || /non-json/.test(msg)) return tr("update.needRestart");
				return tr("update.fail", { error: msg });
			};

			const applyUpdateInfo = useCallback((d, tr, kind) => {
				if (d.channel) setChannel(d.channel);
				setUpdateInfo((prev) => {
					const versions = (d.versions && d.versions.length) ? d.versions : ((prev && prev.versions) || []);
					return Object.assign({}, prev || {}, d, { versions });
				});
				if (d.versions && d.versions.length) syncPicks(d);
				if (kind === "check") setCanApplyUpdate(Boolean(d.hasUpdate) && !d.error);
				else if (kind === "done" || kind === "switched" || kind === "channel") setCanApplyUpdate(false);
				const version = d.localVersion || d.localSha || "—";
				const remote = d.remoteVersion || d.remoteSha || "—";
				let text = tr("update.latest", { version });
				if (d.hasUpdate) text = tr("update.available", { remote, local: version });
				if (d.pinned && d.hasUpdate) text = tr("update.pinned", { version, remote });
				if (kind === "switched" || kind === "channel") text = tr("update.switched", { version: d.localVersion || d.remoteVersion || "—" });
				if (kind === "done") text = tr("update.done", { version: d.localVersion || d.remoteVersion || "—" });
				if (d.error) text = d.error;
				setUpdateNotice({ kind: d.ok === false || d.error ? "error" : "ok", text });
			}, []);

			const checkUpdate = useCallback((id) => {
				setUpdateBusy(true);
				setUpdateJob({ id: id || "", kind: "check" });
				const tr = tRef.current;
				setUpdateNotice({ kind: "ok", text: tr("update.checking") });
				apiJson("/dsh-purge/update")
					.then((d) => {
						if (!d || (!d.ok && !d.channel)) throw new Error((d && d.error) || "check failed");
						applyUpdateInfo(d, tr, "check");
					})
					.catch((e) => setUpdateNotice({ kind: "error", text: updateErrorText(tr, e) }))
					.finally(() => {
						setUpdateBusy(false);
						setUpdateJob(null);
					});
			}, [applyUpdateInfo]);

			const postUpdate = useCallback((body, kind, id) => {
				setUpdateBusy(true);
				setUpdateJob({ id: id || "", kind });
				const tr = tRef.current;
				setUpdateNotice({ kind: "ok", text: kind === "switched" || kind === "channel" ? tr("update.switching") : tr("update.applying") });
				return apiJson("/dsh-purge/update", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body || {}),
				})
					.then((d) => {
						if (!d || (d.ok === false && d.error)) throw new Error((d && d.error) || "update failed");
						applyUpdateInfo(d, tr, kind);
						if (d.applied && d.reloadClient !== false) {
							setUpdateNotice({ kind: "ok", text: tr("update.reloading") });
							setTimeout(() => {
								try { window.location.reload(); } catch { /* ignore */ }
							}, 280);
						} else if (d.needRestart) {
							setAskRestart(true);
						}
						return d;
					})
					.catch((e) => {
						setUpdateNotice({ kind: "error", text: updateErrorText(tr, e) });
						throw e;
					})
					.finally(() => {
						setUpdateBusy(false);
						setUpdateJob(null);
					});
			}, [applyUpdateInfo]);

			const doUpdate = useCallback((id) => {
				const lane = id === "beta" ? "beta" : "stable";
				postUpdate({ op: "apply", ref: lane === "beta" ? "beta" : "master", channel: lane }, "done", id).catch(() => {});
			}, [postUpdate]);

			const changeChannel = useCallback((next) => {
				if (!next) return;
				const tr = tRef.current;
				if (!window.confirm(tr("update.confirmChannel", { version: tr("channel." + next) }))) return;
				const prevChannel = channel;
				const prevInfo = updateInfo;
				setChannel(next);
				setUpdateInfo((cur) => Object.assign({}, cur || {}, { channel: next }));
				postUpdate({ op: "channel", channel: next }, "channel", next).catch(() => {
					setChannel(prevChannel);
					setUpdateInfo(prevInfo);
				});
			}, [channel, postUpdate, updateInfo]);

			const switchSelected = useCallback((id) => {
				const tr = tRef.current;
				const ref = pick[id];
				const versions = ((updateInfo && updateInfo.versions) || []).filter((item) => item.channel === id);
				const hit = versions.find((item) => item.ref === ref);
				const label = (hit && (hit.label || hit.version)) || ref;
				if (!ref) return;
				if (!window.confirm(tr("update.confirmSwitch", { version: label }))) return;
				const prevChannel = channel;
				const prevInfo = updateInfo;
				if (hit && hit.channel) {
					setChannel(hit.channel);
					setUpdateInfo((cur) => Object.assign({}, cur || {}, { channel: hit.channel }));
				}
				postUpdate({ op: "switch", ref }, "switched", id).catch(() => {
					setChannel(prevChannel);
					setUpdateInfo(prevInfo);
				});
			}, [channel, pick, postUpdate, updateInfo]);

			const loadAll = useCallback(() => {
				const tr = tRef.current;
				apiJson("/dsh-purge/status")
					.then((d) => {
						if (d && d.ok) {
							setState(d);
							if (d.channel) setChannel(d.channel);
							if (d.update && d.update.ok && !d.update.error) setUpdateInfo(d.update);
						} else {
							setState({ ok: false, patches_total: 0, patches_applied: 0, patch_status: {}, shim_cmd: "n/a", shim_ps1: "n/a", shim_bin: "n/a", has_backup: false });
							setNotice({ kind: "error", text: tr("err.status", { error: (d && d.error) || "bad response" }) });
						}
					})
					.catch((e) => {
						setState({ ok: false, patches_total: 0, patches_applied: 0, patch_status: {}, shim_cmd: "n/a", shim_ps1: "n/a", shim_bin: "n/a", has_backup: false });
						setNotice({ kind: "error", text: tr("err.status", { error: e.message }) });
					});
				apiJson("/dsh-purge/update")
					.then((d) => {
						if (!d) return;
						if (d.channel) setChannel(d.channel);
						setUpdateInfo(d);
						syncPicks(d);
					})
					.catch(() => {});
				apiJson("/dsh-purge/override")
					.then((d) => {
						if (d && d.ok) {
							const packed = typeof d.defaultContent === "string" ? d.defaultContent : "";
							if (packed) setDefaultOverride(packed);
							setOverride(typeof d.content === "string" ? d.content : packed);
							setOverrideLoaded(true);
						}
						else setNotice({ kind: "error", text: tr("err.override", { error: (d && d.error) || "" }) });
					})
					.catch((e) => setNotice({ kind: "error", text: tr("err.override", { error: e.message }) }));
			}, []);

			useEffect(() => { loadAll(); }, [loadAll]);

			const rejectNeedPrompt = useCallback((tr) => {
				setAskRestart(false);
				setNotice({ kind: "error", text: tr("need.prompt") });
				setTimeout(() => window.alert(tr("need.prompt")), 0);
			}, []);

			const doAction = useCallback((action, actionKey) => {
				const tr = tRef.current;
				const label = tr(actionKey);
				const ticket = ++actionTicket.current;
				const run = () => {
					setPatchBusy(true);
					setAskRestart(false);
					setNotice({ kind: "idle", text: "" });
					fetch("/dsh-purge/" + action, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(action === "apply" ? { content: override } : {}),
					})
						.then((r) => r.json())
						.then((d) => {
							if (ticket !== actionTicket.current) return;
							const applyEmptyBlocked = action === "apply" && promptBoxEmpty(override) && (!d || d.injectSource !== "rule");
							if (responseNeedsPrompt(d) || applyEmptyBlocked) {
								rejectNeedPrompt(tr);
								return;
							}
							if (!d.ok) {
								setNotice({ kind: "error", text: tr("err.action", { action: label, error: d.error || "" }) });
								return;
							}
							if (action === "apply") {
								if (typeof d.defaultContent === "string") setDefaultOverride(d.defaultContent);
								if (typeof d.override_content === "string") {
									setOverride(d.override_content);
									setOverrideLoaded(true);
								}
							}
							if (action === "apply" && d.complete === false) {
								const parts = [];
								if (d.failed > 0) {
									const ids = (d.failed_items || [])
										.map((x) => x.id)
										.filter((id) => id != null)
										.join(",");
									parts.push(
										tr("restart.incomplete.patches", {
											failed: String(d.failed || 0),
											ids: ids || "?",
										}),
									);
								}
								if (d.cmd_flash && d.cmd_flash.ok === false) {
									parts.push(
										tr("restart.incomplete.flash", {
											entry: String(d.cmd_flash.entry || "fail"),
										}),
									);
								}
								if (parts.length === 0) parts.push(tr("restart.incomplete.flash", { entry: "unknown" }));
								setNotice({
									kind: "error",
									text: tr("restart.incomplete", { detail: parts.join("；") }),
								});
								loadAll();
								return;
							}
							setNotice({ kind: "ok", text: tr("ok.done") });
							loadAll();
							if (action === "apply") setAskRestart(true);
						})
						.catch((e) => {
							if (ticket !== actionTicket.current) return;
							setNotice({ kind: "error", text: tr("err.action", { action: label, error: e.message }) });
						})
						.finally(() => {
							if (ticket === actionTicket.current) setPatchBusy(false);
						});
				};
				if (action !== "apply") {
					run();
					return;
				}
				bothInjectEmpty(override).then((empty) => {
					if (ticket !== actionTicket.current) return;
					if (empty) {
						rejectNeedPrompt(tr);
						return;
					}
					run();
				});
			}, [loadAll, override, rejectNeedPrompt]);

			const saveOverride = useCallback(() => {
				const tr = t;
				const ticket = ++actionTicket.current;
				const go = () => {
					setPatchBusy(true);
					setAskRestart(false);
					setNotice({ kind: "idle", text: "" });
					fetch("/dsh-purge/override", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ content: override }),
					})
						.then((r) => r.json())
						.then((d) => {
							if (ticket !== actionTicket.current) return;
							if (!d.ok || responseNeedsPrompt(d) || (promptBoxEmpty(override) && d.injectSource !== "rule")) {
								rejectNeedPrompt(tr);
								return;
							}
							if (typeof d.content === "string") setOverride(d.content);
							setNotice({ kind: "ok", text: t("saved.override") });
						})
						.catch((e) => {
							if (ticket !== actionTicket.current) return;
							setNotice({ kind: "error", text: t("err.save", { error: e.message }) });
						})
						.finally(() => {
							if (ticket === actionTicket.current) setPatchBusy(false);
						});
				};
				bothInjectEmpty(override).then((empty) => {
					if (ticket !== actionTicket.current) return;
					if (empty) {
						rejectNeedPrompt(tr);
						return;
					}
					go();
				});
			}, [override, t, rejectNeedPrompt]);

			const restoreOverride = useCallback(() => {
				if (!defaultOverride) return;
				setOverride(defaultOverride);
				setNotice({ kind: "ok", text: t("saved.restoreInject") });
			}, [defaultOverride, t]);

			const waitHostAfterUninstall = useCallback((tr) => {
				const started = Date.now();
				const ping = () => {
					fetch("/", { cache: "no-store", credentials: "same-origin" })
						.then((r) => {
							if (r.ok) {
								try {
									window.localStorage.removeItem("dshp-theme");
									window.localStorage.removeItem("dshp-theme-mode");
								} catch { /* ignore */ }
								window.location.reload();
								return;
							}
							retry();
						})
						.catch(retry);
				};
				const retry = () => {
					if (Date.now() - started > 90000) {
						setNotice({ kind: "error", text: tr("restart.timeout") });
						setUninstallBusy(false);
						return;
					}
					setTimeout(ping, 500);
				};
				setTimeout(ping, 800);
			}, []);

			const doUninstall = useCallback(() => {
				setUninstallBusy(true);
				setAskUninstall(false);
				setAskRestart(false);
				const tr = tRef.current;
				setNotice({ kind: "ok", text: tr("uninstall.applying") });
				apiJson("/dsh-purge/uninstall", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
					.then((d) => {
						if (!d || !d.ok) throw new Error((d && d.error) || "uninstall failed");
						setNotice({ kind: "ok", text: (d && d.note) || hostText(tr, "uninstall.done", d.surface || hostSurfaceOf(state)) });
						if ((d && d.surface) === "desktop" || (d && d.fullApp) || hostSurfaceOf(state) === "desktop") return;
						waitHostAfterUninstall(tr);
					})
					.catch((e) => {
						const msg = String((e && e.message) || e || "");
						if (/failed to fetch|networkerror|load failed/i.test(msg)) {
							setNotice({ kind: "ok", text: hostText(tr, "uninstall.done", hostSurfaceOf(state)) });
							if (hostSurfaceOf(state) === "desktop" || clientGuessSurface() === "desktop") return;
							waitHostAfterUninstall(tr);
							return;
						}
						setNotice({ kind: "error", text: tr("uninstall.fail", { error: msg }) });
						setUninstallBusy(false);
					});
			}, [state, waitHostAfterUninstall]);

			const s = state;
			const total = s && s.patches_total ? s.patches_total : 26;
			const applied = s && typeof s.patches_applied === "number" ? s.patches_applied : 0;
			const skipped = s && typeof s.patches_skipped === "number" ? s.patches_skipped : 0;
			const settled = Math.min(total, applied + skipped);
			const pct = total ? Math.round((settled / total) * 100) : 0;

			const hostSurface = hostSurfaceOf(s);
			const versions = (updateInfo && updateInfo.versions) || [];
			const channelNow = (updateInfo && updateInfo.channel) || channel || "stable";
			const localVer = (s && s.plugin_version) || (updateInfo && updateInfo.localVersion) || "";
			const renderEdition = (id) => {
				const lane = (updateInfo && updateInfo.lanes && updateInfo.lanes[id]) || {};
				const list = versions.filter((item) => item.channel === id && keepListedVersion(item));
				const selectedRef = pick[id] || "";
				const hit = list.find((item) => item.ref === selectedRef) || list.find((item) => item.current) || list.find((item) => item.latest);
				const onLane = channelNow === id;
				const noBeta = id === "beta" && updateInfo && updateInfo.hasBeta === false && !list.length;
				const pickedOther = Boolean(hit && selectedRef && !hit.current);
				const thisJob = updateJob && updateJob.id === id ? updateJob : null;
				let actionLabel = t("btn.checkUpdate");
				let actionKind;
				let actionClick = () => checkUpdate(id);
				let actionDisabled = updateBusy || Boolean(noBeta);
				if (noBeta) {
					actionLabel = t("update.noBeta");
					actionClick = () => {};
				} else if (pickedOther) {
					actionLabel = t("update.switch");
					actionKind = "primary";
					actionClick = () => switchSelected(id);
				} else if (!onLane) {
					actionLabel = id === "beta" ? t("channel.useBeta") : t("channel.useStable");
					actionKind = "primary";
					actionClick = () => changeChannel(id);
				} else if (canApplyUpdate && lane.hasUpdate) {
					actionLabel = t("btn.doUpdate");
					actionKind = "primary";
					actionClick = () => doUpdate(id);
				}
				if (thisJob) {
					if (thisJob.kind === "check") actionLabel = t("btn.checkUpdate.busy");
					else if (thisJob.kind === "done") actionLabel = t("btn.doUpdate.busy");
					else actionLabel = t("update.switching");
				}
				return h("div", {
					className: "dshp-edition" + (onLane ? " is-on" : ""),
					"aria-label": t("channel." + id),
				},
					h("span", { className: "dshp-edition-name" },
						t("channel." + id),
						onLane ? h("em", { className: "dshp-now-mark" }, t("update.current")) : null,
					),
					h("select", {
						className: "dshp-field dshp-ver",
						value: selectedRef || (hit && hit.ref) || "",
						disabled: updateBusy || !list.length,
						onChange: (e) => setPick((prev) => Object.assign({}, prev, { [id]: e.target.value })),
						"aria-label": t("update.pick"),
					},
						list.length
							? list.map((item) => h("option", {
								key: item.ref + (item.sha || ""),
								value: item.ref,
							}, (item.version ? "v" + item.version : item.label) + (item.latest && !item.current ? " · " + t("update.tip") : "")))
							: h("option", { value: "" }, noBeta ? t("update.noBeta") : t("update.pick")),
					),
					h(Btn, { tiny: true, kind: actionKind, disabled: actionDisabled, onClick: actionClick }, actionLabel),
				);
			};
			return h("section", { className: "dshp-panel", "aria-label": t("purge.title") },
				h("div", { className: "dshp-head" },
					h("h3", { className: "dshp-title" }, t("purge.title")),
					h("span", { className: "dshp-pill" }, t("surface." + hostSurface)),
				),
				h("div", { className: "dshp-rel" },
					h("div", { className: "dshp-now" },
						h("span", { className: "dshp-now-label" }, t("channel.local")),
						h("b", { className: "dshp-now-ver" }, localVer ? "v" + localVer : "—"),
						h("em", { className: "dshp-now-mark" }, t("update.current")),
					),
					h("div", { className: "dshp-editions" },
						renderEdition("stable"),
						renderEdition("beta"),
					),
					noticeNode(updateNotice),
				),
				s ? h("div", { className: "dshp-metrics" },
					h("div", { className: "dshp-metric" },
						h("b", null, settled + " / " + total),
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
					h(Btn, { kind: "primary", disabled: patchBusy || uninstallBusy, onClick: () => doAction("apply", "action.apply") }, patchBusy ? t("btn.apply.busy") : t("btn.apply")),
					h(Btn, { kind: "danger", disabled: patchBusy || uninstallBusy, onClick: () => doAction("revert", "action.revert") }, t("btn.revert")),
					h(Btn, { kind: "solid-danger", disabled: patchBusy || uninstallBusy, onClick: () => setAskUninstall(true) }, uninstallBusy ? t("btn.uninstall.busy") : t("btn.uninstall")),
					noticeNode(notice),
				),
				askUninstall ? h("div", {
					className: "dshp-modal-bg",
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": "dshp-uninstall-title",
					onClick: (e) => { if (e.target === e.currentTarget && !uninstallBusy) setAskUninstall(false); },
				},
					h("div", { className: "dshp-modal" },
						h("h4", { id: "dshp-uninstall-title" }, t("uninstall.title")),
						h("p", null, t("uninstall.body")),
						h("div", { className: "dshp-modal-ops" },
							h(Btn, { disabled: uninstallBusy, onClick: () => setAskUninstall(false) }, t("uninstall.cancel")),
							h(Btn, { kind: "solid-danger", disabled: uninstallBusy, onClick: doUninstall }, t("uninstall.confirm")),
						),
					),
				) : null,
				h("p", { className: "dshp-hint", style: { margin: "8px 0 0", color: "var(--dshp-mute)", fontSize: 12 } }, t("apply.hint")),
				s && !s.ai_base ? h("p", { className: "dshp-hint", style: { margin: "8px 0 0", color: "var(--dshp-danger, #c44)", fontSize: 12 } }, hostText(t, "warn.noRoot", hostSurface)) : null,
				s && s.ai_base && s.override_status === "missing" ? h("p", { className: "dshp-hint", style: { margin: "8px 0 0", color: "var(--dshp-mute)", fontSize: 12 } }, t("warn.noInject")) : null,
				askRestart ? h("div", { className: "dshp-ask" },
					h("span", null, hostText(t, "restart.confirm", hostSurface)),
					h(Btn, { tiny: true, onClick: () => setAskRestart(false) }, t("restart.later")),
					h(Btn, {
						tiny: true,
						kind: "primary",
						onClick: () => {
							setAskRestart(false);
							restartDsh(setNotice, function () {}, t, hostSurface);
						},
					}, t("btn.restart")),
				) : null,
				// h(ContinueRetrySection, null),
				h("div", { className: "dshp-sub" },
					h("h4", null, t("override.title")),
					h("div", { className: "dshp-row", style: { margin: 0 } },
						h(Btn, { kind: "primary", tiny: true, disabled: patchBusy || !overrideLoaded, onClick: saveOverride }, t("btn.saveInject")),
						h(Btn, { tiny: true, disabled: patchBusy || !overrideLoaded || !defaultOverride, onClick: restoreOverride }, t("btn.restoreInject")),
					),
				),
				h("textarea", {
					className: "dshp-area",
					value: override,
					onChange: (e) => setOverride(e.target.value),
					spellCheck: false,
					placeholder: "",
				}),
				promptBoxEmpty(override) ? h("p", {
					className: "dshp-hint",
					style: { margin: "8px 0 0", color: "var(--dshp-danger, #c44)", fontSize: 12 },
				}, t("need.prompt")) : null,
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
				rulesApi("status")
					.then((d) => {
						if (d && d.ok) setSt(d);
						else {
							setSt({ ok: false, rules: [], active: null });
							setNotice({ kind: "error", text: tr("err.rules", { error: (d && d.error) || "bad response" }) });
						}
					})
					.catch((e) => {
						setSt({ ok: false, rules: [], active: null });
						setNotice({ kind: "error", text: tr("err.rules", { error: e.message }) });
					});
			}, []);

			useEffect(() => { loadStatus(); }, [loadStatus]);

			const doPost = useCallback((action, payload, after) => {
				setBusy(true);
				setNotice({ kind: "idle", text: "" });
				rulesApi(action, payload)
					.then((d) => {
						if (d && d.ok) {
							setNotice({ kind: "ok", text: t("ok.done") });
							if (action === "save" || action === "activate") warnNeedPrompt(d, t);
							loadStatus();
							if (after) after();
						} else {
							warnNeedPrompt(d, t);
							setNotice({ kind: "error", text: t("err.action", { error: (d && d.error) || "" }) });
						}
					})
					.catch((e) => setNotice({ kind: "error", text: t("err.action", { error: e.message }) }))
					.finally(() => setBusy(false));
			}, [loadStatus, t]);

			const openRule = useCallback((id) => {
				setBusy(true);
				rulesApi("read", { id: id })
					.then((d) => {
						if (d.ok) {
							setEditId(id);
							setEditName(d.name || id);
							setEditTarget(d.target || "AGENTS.md");
							setContent(typeof d.content === "string" ? d.content : "");
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

		function skillUiAllowed(d) {
			if (!d || d.channel === "stable") return false;
			const ver = String(d.plugin_version || d.localVersion || "").replace(/^v/i, "");
			if (/^1\.1\.11(?:-|$)/.test(ver)) return false;
			const parts = ver.match(/^(\d+)\.(\d+)\.(\d+)/);
			if (!parts) return false;
			if (+parts[1] !== 1) return +parts[1] > 1;
			if (+parts[2] !== 1) return +parts[2] > 1;
			return +parts[3] >= 12;
		}

		function keepListedVersion(item) {
			return !/^1\.1\.11-beta/i.test(String((item && item.version) || "").replace(/^v/i, ""));
		}

		function SkillsSection() {
			const t = useT();
			const tRef = useRef(t);
			tRef.current = t;
			const [onBeta, setOnBeta] = useState(false);
			const [st, setSt] = useState(null);
			const [editId, setEditId] = useState(null);
			const [editDesc, setEditDesc] = useState("");
			const [content, setContent] = useState("");
			const [busy, setBusy] = useState(false);
			const [notice, setNotice] = useState({ kind: "idle", text: "" });
			const zipRef = useRef(null);
			const folderRef = useRef(null);

			const loadStatus = useCallback(() => {
				const tr = tRef.current;
				const fail = (e) => {
					setSt({ ok: false, skills: [] });
					setNotice({
						kind: "error",
						text: skillsRouteMissing(e) ? tr("err.skills.needRestart") : tr("err.skills", { error: (e && e.message) || e || "bad response" }),
					});
				};
				const apply = (d) => {
					if (d && d.ok) setSt({ ok: true, skills: d.skills || [] });
					else fail({ message: (d && d.error) || "bad response" });
				};
				apiJson("/dsh-purge/status")
					.then((d) => {
						const allowed = skillUiAllowed(d);
						setOnBeta(allowed);
						if (!allowed) {
							setSt(null);
							return;
						}
						if (d.skills) {
							apply({ ok: true, skills: d.skills });
							return;
						}
						skillsApi("status").then(apply).catch(fail);
					})
					.catch(() => {
						setOnBeta(false);
						setSt(null);
					});
			}, []);

			useEffect(() => { loadStatus(); }, [loadStatus]);

			const doPost = useCallback((action, payload, after) => {
				setBusy(true);
				setNotice({ kind: "idle", text: "" });
				skillsApi(action, payload)
					.then((d) => {
						if (d && d.ok) {
							setNotice({ kind: "ok", text: t("ok.done") });
							loadStatus();
							if (after) after(d);
						} else {
							setNotice({ kind: "error", text: t("err.action", { error: (d && d.error) || "" }) });
						}
					})
					.catch((e) => setNotice({
						kind: "error",
						text: skillsRouteMissing(e) ? t("err.skills.needRestart") : t("err.action", { error: e.message }),
					}))
					.finally(() => setBusy(false));
			}, [loadStatus, t]);

			const openSkill = useCallback((id) => {
				setBusy(true);
				skillsApi("read", { id: id })
					.then((d) => {
						if (d.ok) {
							setEditId(id);
							setEditDesc(d.description || "");
							setContent(typeof d.content === "string" ? d.content : "");
						} else setNotice({ kind: "error", text: t("err.read", { error: d.error || "" }) });
					})
					.catch((e) => setNotice({ kind: "error", text: t("err.read", { error: e.message }) }))
					.finally(() => setBusy(false));
			}, [t]);

			const clearEditor = () => {
				setEditId(null);
				setEditDesc("");
				setContent("");
			};

			const readAsBase64 = (file) => new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					const text = String(reader.result || "");
					const at = text.indexOf(",");
					resolve(at >= 0 ? text.slice(at + 1) : text);
				};
				reader.onerror = () => reject(new Error(t("need.import")));
				reader.readAsDataURL(file);
			});

			const importZip = (file) => {
				if (!file) {
					setNotice({ kind: "error", text: t("need.import") });
					return;
				}
				setBusy(true);
				setNotice({ kind: "ok", text: t("skills.importing") });
				readAsBase64(file)
					.then((data) => skillsApi("import", { data, name: file.name }))
					.then((d) => {
						if (!d || !d.ok) throw new Error((d && d.error) || "");
						setNotice({ kind: "ok", text: t("saved.import", { count: (d.imported || []).length || 1 }) });
						loadStatus();
					})
					.catch((e) => setNotice({
						kind: "error",
						text: skillsRouteMissing(e) ? t("err.skills.needRestart") : t("err.action", { error: e.message }),
					}))
					.finally(() => setBusy(false));
			};

			const keepFolderFile = (file) => {
				const rel = String(file.webkitRelativePath || file.name || "").replace(/\\/g, "/");
				if (!rel || rel.includes("..")) return false;
				if (/(^|\/)(node_modules|\.git|__MACOSX|\.system)(\/|$)/i.test(rel)) return false;
				if (/(^|\/)\._/.test(rel) || /\/\.DS_Store$/i.test(rel)) return false;
				return true;
			};

			const importFolder = (list) => {
				const files = Array.from(list || []).filter(keepFolderFile);
				if (!files.length) {
					setNotice({ kind: "error", text: t("err.import.folder") });
					return;
				}
				setBusy(true);
				setNotice({ kind: "ok", text: t("skills.importing") });
				Promise.all(files.map((file) => readAsBase64(file).then((content) => ({
					path: file.webkitRelativePath || file.name,
					content,
					encoding: "base64",
				}))))
					.then((payload) => skillsApi("import", {
						files: payload,
						name: String(payload[0] && payload[0].path || "").split("/")[0],
					}))
					.then((d) => {
						if (!d || !d.ok) throw new Error((d && d.error) || "");
						setNotice({ kind: "ok", text: t("saved.import", { count: (d.imported || []).length || 1 }) });
						loadStatus();
					})
					.catch((e) => setNotice({
						kind: "error",
						text: skillsRouteMissing(e) ? t("err.skills.needRestart") : t("err.action", { error: e.message }),
					}))
					.finally(() => setBusy(false));
			};

			if (!onBeta) return null;

			let list;
			if (!st) {
				list = h("div", { className: "dshp-skel", style: { height: 80, margin: 12 } });
			} else if (!st.skills || st.skills.length === 0) {
				list = h("p", { className: "dshp-empty" }, t("skills.empty"));
			} else {
				list = st.skills.map((item) => {
					const isEdit = item.id === editId;
					return h("div", {
						key: item.id,
						className: "dshp-ruleitem" + (isEdit ? " is-edit" : ""),
						role: "button",
						tabIndex: 0,
						onClick: () => openSkill(item.id),
						onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSkill(item.id); } },
					},
						h("div", { className: "dshp-rule-main" },
							h("span", { className: "dshp-rule-name" }, item.id),
							h("span", { className: "dshp-rule-meta" },
								(item.valid ? item.description : t("skills.invalid")) + " · " + formatSize(item.size),
							),
							item.valid ? h("span", { className: "dshp-rule-meta" },
								[
									item.userInvocable ? t("skills.call.slash", { cmd: "/" + item.id }) : t("skills.call.userOff"),
									item.modelInvocable ? t("skills.call.model") : t("skills.call.modelOff"),
								].join(" · "),
							) : null,
						),
						h("div", { className: "dshp-rule-ops" },
							h(Btn, {
								tiny: true,
								kind: "danger",
								disabled: busy,
								onClick: (e) => {
									e.stopPropagation();
									if (!window.confirm(t("confirm.delete.skill", { id: item.id }))) return;
									if (editId === item.id) clearEditor();
									doPost("delete", { id: item.id });
								},
							}, t("delete")),
						),
					);
				});
			}

			return h("section", { className: "dshp-panel", "aria-label": t("skills.title") },
				h("div", { className: "dshp-head" },
					h("h3", { className: "dshp-title" }, t("skills.title")),
					h("div", { className: "dshp-row", style: { margin: 0 } }, noticeNode(notice)),
				),
				h("p", { className: "dshp-hint", style: { margin: "0 0 10px", color: "var(--dshp-mute)", fontSize: 12 } }, hostText(t, "skills.hint", hostSurfaceOf())),
				h("div", { className: "dshp-split" },
					h("div", { className: "dshp-rulelist" },
						h("div", { className: "dshp-rulebody" }, list),
						h("div", { className: "dshp-create" },
							h("div", { className: "dshp-create-row" },
								h("input", {
									ref: zipRef,
									type: "file",
									accept: ".zip,.tgz,.tar.gz,.tar,.skill",
									style: { display: "none" },
									onChange: (e) => {
										const file = e.target.files && e.target.files[0];
										e.target.value = "";
										importZip(file);
									},
								}),
								h("input", {
									ref: (el) => {
										folderRef.current = el;
										if (!el) return;
										el.setAttribute("webkitdirectory", "");
										el.setAttribute("directory", "");
										el.multiple = true;
									},
									type: "file",
									multiple: true,
									style: { display: "none" },
									onChange: (e) => {
										const files = Array.from((e.target && e.target.files) || []);
										e.target.value = "";
										importFolder(files);
									},
								}),
								h(Btn, {
									kind: "primary",
									tiny: true,
									disabled: busy,
									onClick: () => zipRef.current && zipRef.current.click(),
								}, t("btn.importZip")),
								h(Btn, {
									tiny: true,
									disabled: busy,
									onClick: () => folderRef.current && folderRef.current.click(),
								}, t("btn.importFolder")),
							),
						),
					),
					h("div", { className: "dshp-editor" },
						editId ? [
							h("div", { key: "meta", className: "dshp-row" },
								h("input", {
									className: "dshp-field",
									placeholder: t("ph.skill.desc"),
									value: editDesc,
									onChange: (e) => setEditDesc(e.target.value),
								}),
							),
							h("textarea", {
								key: "body",
								className: "dshp-area",
								value: content,
								onChange: (e) => setContent(e.target.value),
								spellCheck: false,
								placeholder: "",
							}),
							h("div", { key: "save", className: "dshp-row" },
								h(Btn, {
									kind: "primary",
									disabled: busy,
									onClick: () => doPost("save", { id: editId, content, description: editDesc }),
								}, t("btn.saveSkill")),
								noticeNode(notice),
							),
						] : h("div", { className: "dshp-editor-empty" }, t("skills.pick")),
					),
				),
			);
		}

		function reopenAfterRestart() {
			const url = new URL(window.location.href);
			url.searchParams.delete("token");
			window.location.replace(url.pathname + url.search + url.hash);
		}

		function waitForRestart(setNotice, setBusy, t) {
			const started = Date.now();
			const ping = () => {
				fetch("/dsh-purge/status", { cache: "no-store", credentials: "same-origin" })
					.then((r) => (r.ok ? r.json() : Promise.reject()))
					.then((d) => {
						if (d && d.ok && d.ready !== false) reopenAfterRestart();
						else retry();
					})
					.catch(retry);
			};
			const retry = () => {
				if (Date.now() - started > 90000) {
					setNotice({ kind: "error", text: t("restart.timeout") });
					setBusy(false);
					return;
				}
				setTimeout(ping, 500);
			};
			setTimeout(ping, 800);
		}

		function restartDsh(setNotice, setBusy, t, surface) {
			const surf = surface || clientGuessSurface() || "web";
			setBusy(true);
			setNotice({ kind: "ok", text: hostText(t, "restarting", surf) });
			fetch("/dsh-purge/restart", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
				.then((r) => r.json())
				.then((d) => {
					if (!d.ok) throw new Error(d.error || "restart failed");
					const next = (d && d.surface) || surf;
					setNotice({ kind: "ok", text: hostText(t, "restarting", next) });
					// 桌面端整应用会退出重开。先刷新内嵌 web 会单独重启 Host。
					if (next === "desktop" || (d && d.fullApp) || clientGuessSurface() === "desktop") return;
					waitForRestart(setNotice, setBusy, t);
				})
				.catch((e) => {
					if (surf === "desktop" || clientGuessSurface() === "desktop") return;
					if (String(e.message || e).includes("Failed to fetch") || e.name === "TypeError") {
						waitForRestart(setNotice, setBusy, t);
						return;
					}
					setNotice({ kind: "error", text: t("restart.fail", { error: e.message }) });
					setBusy(false);
				});
		}

		function detectHostTheme() {
			try {
				if (typeof document !== "undefined") {
					if (document.body?.hasAttribute("data-ds-dark-theme")) return "dusk";
					const root = document.documentElement;
					const scheme = (root.style.colorScheme || getComputedStyle(root).getPropertyValue("color-scheme") || "").toLowerCase();
					if (scheme.includes("dark")) return "dusk";
					if (scheme.includes("light")) return "white";
				}
				if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
					return "dusk";
				}
			} catch { /* ignore */ }
			return "white";
		}

		function readTheme() {
			try {
				if (window.localStorage.getItem(THEME_MODE_KEY) === "manual") {
					const v = window.localStorage.getItem(THEME_KEY);
					if (v === "dusk" || v === "white") return v;
				}
			} catch { /* ignore */ }
			return detectHostTheme();
		}

		function SettingsRoot(props) {
			const t = typeof props.t === "function" ? props.t : ((key) => key);
			const [theme, setTheme] = useState(readTheme);
			const setAndStore = useCallback((next) => {
				setTheme(next);
				try {
					window.localStorage.setItem(THEME_MODE_KEY, "manual");
					window.localStorage.setItem(THEME_KEY, next);
				} catch { /* ignore */ }
			}, []);
			useEffect(() => {
				let cancelled = false;
				let timer = 0;
				const syncFromHost = () => {
					try {
						if (window.localStorage.getItem(THEME_MODE_KEY) === "manual") return;
					} catch { /* ignore */ }
					if (!cancelled) setTheme(detectHostTheme());
				};
				const syncSoon = () => {
					if (timer) window.clearTimeout(timer);
					timer = window.setTimeout(syncFromHost, 50);
				};
				syncFromHost();
				let mq;
				try {
					mq = window.matchMedia?.("(prefers-color-scheme: dark)");
					mq?.addEventListener?.("change", syncFromHost);
				} catch { /* ignore */ }
				let obs;
				try {
					if (document.body) {
						obs = new MutationObserver(syncSoon);
						obs.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
					}
				} catch { /* ignore */ }
				return () => {
					cancelled = true;
					if (timer) window.clearTimeout(timer);
					try { mq?.removeEventListener?.("change", syncFromHost); } catch { /* ignore */ }
					try { obs?.disconnect(); } catch { /* ignore */ }
				};
			}, []);
			translate = t;
			return h("div", { className: "dshp-root", "data-theme": theme },
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
				h(SkillsSection, null),
			);
		}

		const REWIND_CSS = `
.dshp-rewind-wrap{position:relative;display:inline-flex}
.dshp-rewind{appearance:none;display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,currentColor);font:12px/1 var(--ds-font-sans,system-ui,sans-serif);cursor:pointer}
.dshp-rewind:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,currentColor)}
.dshp-rewind:disabled{opacity:.4;cursor:default}
.dshp-rewind svg{display:block}
.dshp-rewind-menu{position:absolute;right:0;bottom:calc(100% + 6px);z-index:100;box-sizing:border-box;min-width:196px;padding:4px;border:0;border-radius:12px;background:var(--dsw-specific-menu,#fff);color:var(--dsw-alias-label-primary,#1a1a1a);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.16))}
body[data-ds-dark-theme] .dshp-rewind-menu{background:var(--dsw-specific-menu,#32312d);color:var(--dsw-alias-label-primary,#e6e2db);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1,#3f3d38);box-shadow:var(--dsw-elevation-prominent,0 10px 28px rgba(0,0,0,.45))}
.dshp-rewind-item{display:flex;flex-direction:column;gap:2px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:inherit;text-align:left;cursor:pointer;font:12px/1.3 var(--ds-font-sans,system-ui,sans-serif)}
.dshp-rewind-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}
.dshp-rewind-item b{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}
.dshp-rewind-item span{color:var(--dsw-alias-label-tertiary,#9a958c);font-size:11px}
body[data-ds-dark-theme] .dshp-rewind-item span{color:var(--dsw-alias-label-tertiary,#a8a39a)}
.dshp-continue{appearance:none;display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,currentColor);font:12px/1 var(--ds-font-sans,system-ui,sans-serif);cursor:pointer}
.dshp-continue:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,currentColor)}
.dshp-continue:disabled{opacity:.4;cursor:default}
.dshp-continue.is-ready{color:var(--dsw-alias-label-primary,currentColor)}
.dshp-continue svg{display:block}
`;
		const DRAFT_KEY = "dshp-rewind-draft:";
		const ARM_KEY = "dshp-rewind-arm:";
		const FILL_DELAYS = [0, 50, 180];
		const ARM_TTL_MS = 45 * 1000;
		let rewindSeenAt = 0;
		let rewindSessions = null;
		let rewindHost = null;
		let pendingComposer = { sessionId: "", text: "", at: 0 };
		let armedFill = { sessionId: "", text: "", at: 0 };

		function rewindText(t, key, fallback) {
			try {
				if (typeof t === "function") {
					const value = t(key);
					if (value && value !== key) return value;
				}
			} catch { /* ignore */ }
			return fallback;
		}

		function currentSessionId(sessions) {
			try { return sessions?.list?.getSnapshot?.()?.current || ""; } catch { return ""; }
		}

		function isPluginDraft(text) {
			const value = String(text || "").trim();
			if (!value) return false;
			return /^\[MNEMON\]/i.test(value)
				|| /MNEMON RUNTIME MEMORY SNAPSHOT/i.test(value)
				|| /^MNEMON VIEW TOOLS/im.test(value);
		}

		function writeDraft(sessionId, text) {
			if (!sessionId) return;
			const value = isPluginDraft(text) ? "" : (text || "");
			pendingComposer = { sessionId, text: value, at: Date.now() };
			try { sessionStorage.setItem(DRAFT_KEY + sessionId, value); } catch { /* ignore */ }
		}

		function peekDraft(sessionId) {
			if (!sessionId) return "";
			if (pendingComposer.sessionId === sessionId && pendingComposer.text) return pendingComposer.text;
			try { return sessionStorage.getItem(DRAFT_KEY + sessionId) || ""; } catch { return ""; }
		}

		function clearStoredDraft(sessionId) {
			if (!sessionId) return;
			if (pendingComposer.sessionId === sessionId) pendingComposer = { sessionId: "", text: "", at: 0 };
			try { sessionStorage.removeItem(DRAFT_KEY + sessionId); } catch { /* ignore */ }
			try { sessionStorage.removeItem(ARM_KEY + sessionId); } catch { /* ignore */ }
		}

		function armComposerFill(sessionId, text) {
			if (!sessionId || !text || isPluginDraft(text)) return;
			const at = Date.now();
			armedFill = { sessionId, text, at };
			writeDraft(sessionId, text);
			try { sessionStorage.setItem(ARM_KEY + sessionId, String(at)); } catch { /* ignore */ }
		}

		function takeArmedFill(sessionId) {
			if (!sessionId) return "";
			let text = "";
			let at = 0;
			if (armedFill.sessionId === sessionId && armedFill.text) {
				text = armedFill.text;
				at = armedFill.at;
			} else {
				text = peekDraft(sessionId);
				try { at = Number(sessionStorage.getItem(ARM_KEY + sessionId) || 0); } catch { at = 0; }
			}
			if (!text || !at || Date.now() - at > ARM_TTL_MS) {
				if (text && (!at || Date.now() - at > ARM_TTL_MS)) clearStoredDraft(sessionId);
				return "";
			}
			clearStoredDraft(sessionId);
			armedFill = { sessionId: "", text: "", at: 0 };
			return text;
		}

		function conversationInput(sessionId) {
			try {
				const host = rewindHost;
				const conversation = host?.conversation || (typeof host?.get === "function" ? host.get("conversation") : undefined);
				const sessions = host?.sessions || rewindSessions;
				const actx = typeof sessions?.scope === "function" ? sessions.scope(sessionId) : undefined;
				if (conversation?.input?.for && actx) return conversation.input.for(actx);
				return conversation?.input || null;
			} catch {
				return null;
			}
		}

		function liveDraft(sessionId, inputActions) {
			try {
				const fromActions = inputActions?.state?.getSnapshot?.()?.draft;
				if (typeof fromActions === "string") return fromActions;
			} catch { /* ignore */ }
			try {
				const draft = conversationInput(sessionId)?.state?.getSnapshot?.()?.draft;
				if (typeof draft === "string") return draft;
			} catch { /* ignore */ }
			return "";
		}

		function hostSetDraft(sessionId, text) {
			if (!sessionId) return false;
			try {
				const input = conversationInput(sessionId);
				if (input && typeof input.setDraft === "function") {
					input.setDraft(text || "");
					return true;
				}
			} catch { /* ignore */ }
			return false;
		}

		function fillComposer(inputActions, text) {
			if (inputActions && typeof inputActions.setDraft === "function") {
				try { inputActions.setDraft(text || ""); } catch { /* ignore */ }
			}
		}

		function scheduleComposerFill(sessionId, text, inputActions) {
			if (!sessionId || !text || isPluginDraft(text)) return;
			let stopped = false;
			let filled = false;
			const tryFill = () => {
				if (stopped) return;
				const current = liveDraft(sessionId, inputActions);
				if (filled && current !== text) {
					stopped = true;
					return;
				}
				if (current && current !== text) {
					stopped = true;
					return;
				}
				fillComposer(inputActions, text);
				hostSetDraft(sessionId, text);
				filled = true;
			};
			for (const ms of FILL_DELAYS) window.setTimeout(tryFill, ms);
		}

		function scheduleEchoClear(sessionId, inputActions) {
			if (!sessionId) return;
			let last = "";
			let stopped = false;
			const tryClear = () => {
				if (stopped || !last) return;
				const current = String(liveDraft(sessionId, inputActions) || "").trim();
				if (!current) {
					stopped = true;
					return;
				}
				if (current !== last) return;
				fillComposer(inputActions, "");
				hostSetDraft(sessionId, "");
				clearStoredDraft(sessionId);
				stopped = true;
			};
			apiJson("/dsh-purge/last-user?sessionId=" + encodeURIComponent(sessionId)).then((data) => {
				last = String(data?.text || "").trim();
				if (!last || isPluginDraft(last)) return;
				tryClear();
				for (const ms of [0, 50, 180, 400]) window.setTimeout(tryClear, ms);
			}).catch(() => {});
		}

		async function dropInheritedQueue(sessions, sessionId) {
			if (!sessions || !sessionId) return;
			const drop = async () => {
				try {
					const actx = typeof sessions.scope === "function" ? sessions.scope(sessionId) : undefined;
					const face = typeof sessions.sessionOf === "function" ? sessions.sessionOf(actx) : undefined;
					const queue = face?.getSnapshot?.()?.queue || [];
					for (const item of queue) {
						const id = item?.id || item?.itemId;
						if (!id) continue;
						try { await face.updateQueue?.(id, { kind: "remove" }); } catch { /* ignore */ }
					}
				} catch { /* ignore */ }
			};
			await drop();
			window.setTimeout(() => { drop(); }, 80);
		}

		async function openRewoundSession(sessions, sessionId) {
			if (!sessions || !sessionId) return;
			try { await sessions.refresh?.(); } catch { /* ignore */ }
			try { sessions.open(sessionId); } catch { /* ignore */ }
			await dropInheritedQueue(sessions, sessionId);
			window.setTimeout(() => {
				try { sessions.open(sessionId); } catch { /* ignore */ }
				dropInheritedQueue(sessions, sessionId);
			}, 250);
		}

		class RewindSafe extends Component {
			constructor(p) { super(p); this.state = { failed: false }; }
			static getDerivedStateFromError() { return { failed: true }; }
			componentDidCatch(error) { try { console.error("[dsh-purge] rewind slot:", error); } catch { /* ignore */ } }
			render() {
				if (this.state.failed) {
					return h("button", {
						type: "button",
						className: "dshp-rewind",
						title: "回退上一句",
						onMouseDown: (e) => e.preventDefault(),
						onClick: async () => {
							const sessionId = currentSessionId(rewindSessions);
							if (!sessionId) return;
							try {
								const data = await apiJson("/dsh-purge/rewind", {
									method: "POST",
									headers: { "content-type": "application/json" },
									body: JSON.stringify({ sessionId, mode: "once" }),
								});
								if (data && data.ok && data.sessionId) {
									const text = isPluginDraft(data.text) ? "" : (data.text || "");
									armComposerFill(data.sessionId, text);
									scheduleComposerFill(data.sessionId, text);
									await openRewoundSession(rewindSessions, data.sessionId);
									scheduleComposerFill(data.sessionId, text);
								}
							} catch (e) {
								window.alert("回退失败: " + String((e && e.message) || e));
							}
						},
					}, h("style", null, REWIND_CSS), "回退");
				}
				return h(RewindButton, this.props);
			}
		}

		class ContinueSafe extends Component {
			constructor(p) { super(p); this.state = { failed: false }; }
			static getDerivedStateFromError() { return { failed: true }; }
			componentDidCatch(error) { try { console.error("[dsh-purge] continue slot:", error); } catch { /* ignore */ } }
			render() {
				if (this.state.failed) {
					return h("button", {
						type: "button",
						className: "dshp-continue",
						title: rewindText(translate, "continue.label", "继续"),
						onMouseDown: (e) => e.preventDefault(),
						onClick: async () => {
							const sessionId = currentSessionId(rewindSessions);
							if (!sessionId) return;
							try {
								const data = await apiJson("/dsh-purge/continue", {
									method: "POST",
									headers: { "content-type": "application/json" },
									body: JSON.stringify({ sessionId, force: true }),
								});
								if (!data || !data.ok) throw new Error((data && data.error) || "continue");
							} catch (e) {
								window.alert(rewindText(translate, "continue.fail", "继续失败: {error}").replace("{error}", String((e && e.message) || e)));
							}
						},
					}, rewindText(translate, "continue.label", "继续"));
				}
				return h(ContinueButton, this.props);
			}
		}

		function ContinueButton(props) {
			const t = props.t || translate;
			const sessions = rewindSessions;
			const sessionId = props.sessionId || currentSessionId(sessions);
			const [busy, setBusy] = useState(false);
			const [notice, setNotice] = useState("");
			const [info, setInfo] = useState(null);

			useEffect(() => {
				if (!sessionId) {
					setInfo(null);
					return;
				}
				let cancelled = false;
				const tick = () => {
					apiJson("/dsh-purge/continue?sessionId=" + encodeURIComponent(sessionId))
						.then((data) => { if (!cancelled && data && data.ok) setInfo(data); })
						.catch(() => {});
				};
				tick();
				const timer = window.setInterval(tick, 1200);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, [sessionId]);

			const canContinue = Boolean(info && info.canContinue);
			const left = info ? Math.max(0, (info.continueMax || 0) - (info.continueUsed || 0)) : 0;
			const runContinue = async () => {
				if (!sessionId || busy || !canContinue) return;
				setBusy(true);
				setNotice("");
				try {
					const data = await apiJson("/dsh-purge/continue", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ sessionId }),
					});
					if (!data || !data.ok) throw new Error((data && data.error) || "continue");
					setInfo((prev) => prev ? { ...prev, ...data, canContinue: false, continueUsed: data.used } : data);
				} catch (e) {
					setNotice(rewindText(t, "continue.fail", "继续失败: {error}").replace("{error}", String((e && e.message) || e)));
				} finally {
					setBusy(false);
				}
			};

			const label = busy
				? rewindText(t, "continue.busy", "继续中…")
				: rewindText(t, "continue.label", "继续");
			const title = notice
				|| (canContinue
					? rewindText(t, "continue.ready", "继续（还可 {left} 次）").replace("{left}", String(left))
					: (info && info.reason && left <= 0
						? rewindText(t, "continue.limit", "已达继续上限")
						: rewindText(t, "continue.aria", "异常停止后继续")));
			return h("button", {
				type: "button",
				className: "dshp-continue" + (canContinue ? " is-ready" : ""),
				title,
				"aria-label": rewindText(t, "continue.aria", "异常停止后继续"),
				disabled: busy || !sessionId || !canContinue,
				onMouseDown: (e) => e.preventDefault(),
				onClick: (e) => {
					e.preventDefault();
					e.stopPropagation();
					runContinue();
				},
			},
				h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", "aria-hidden": true },
					h("path", { fill: "currentColor", d: "M4.2 2.8v10.4L13 8 4.2 2.8z" }),
				),
				label,
			);
		}

		function RewindButton(props) {
			const t = props.t || translate;
			const sessions = rewindSessions;
			const inputActions = props.inputActions;
			const sessionId = props.sessionId || currentSessionId(sessions);
			const wrapRef = useRef(null);
			const [busy, setBusy] = useState(false);
			const [notice, setNotice] = useState("");
			const [menu, setMenu] = useState(false);

			useEffect(() => {
				if (!sessionId) return;
				const armed = takeArmedFill(sessionId);
				if (armed) {
					scheduleComposerFill(sessionId, armed, inputActions);
					return;
				}
				scheduleEchoClear(sessionId, inputActions);
			}, [sessionId, inputActions]);

			useEffect(() => {
				if (!menu) return;
				const onDoc = (event) => {
					if (wrapRef.current && !wrapRef.current.contains(event.target)) setMenu(false);
				};
				document.addEventListener("mousedown", onDoc);
				return () => document.removeEventListener("mousedown", onDoc);
			}, [menu]);

			const runRewind = async (mode) => {
				if (!sessionId || busy) return;
				setBusy(true);
				setMenu(false);
				setNotice("");
				try {
					const data = await apiJson("/dsh-purge/rewind", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ sessionId, mode }),
					});
					if (!data || !data.ok || !data.sessionId) throw new Error((data && data.error) || "rewind");
					if (data.at) rewindSeenAt = data.at;
					const text = isPluginDraft(data.text) ? "" : (data.text || "");
					armComposerFill(data.sessionId, text);
					await openRewoundSession(sessions, data.sessionId);
					scheduleComposerFill(data.sessionId, text);
				} catch (e) {
					setNotice(rewindText(t, "rewind.fail", "回退失败: {error}").replace("{error}", String((e && e.message) || e)));
				} finally {
					setBusy(false);
				}
			};

			const onClick = async (event) => {
				event?.preventDefault?.();
				event?.stopPropagation?.();
				if (!sessionId || busy) return;
				if (menu) {
					setMenu(false);
					return;
				}
				setBusy(true);
				setNotice("");
				try {
					const info = await apiJson("/dsh-purge/rewind/options?sessionId=" + encodeURIComponent(sessionId));
					if (info && info.ok && info.kind === "main") {
						setMenu(true);
						return;
					}
					await runRewind("once");
				} catch (e) {
					setNotice(rewindText(t, "rewind.fail", "回退失败: {error}").replace("{error}", String((e && e.message) || e)));
				} finally {
					setBusy(false);
				}
			};

			const label = busy ? rewindText(t, "rewind.busy", "回退中…") : rewindText(t, "rewind.label", "回退");
			const title = notice || rewindText(t, "rewind.aria", "回退");
			return h("div", { className: "dshp-rewind-wrap", ref: wrapRef },
				h("style", null, REWIND_CSS),
				h("button", {
					type: "button",
					className: "dshp-rewind",
					title,
					"aria-label": rewindText(t, "rewind.aria", "回退"),
					disabled: busy || !sessionId,
					onMouseDown: (e) => e.preventDefault(),
					onClick,
				},
					h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", "aria-hidden": true },
						h("path", {
							fill: "currentColor",
							d: "M7.2 3.2 3.4 7l3.8 3.8V8.6c2.8 0 4.7.7 5.9 2.3-.2-2.8-1.9-5.2-5.9-5.6V3.2z",
						}),
					),
					label,
				),
				menu ? h("div", { className: "dshp-rewind-menu", role: "menu" },
					h("button", {
						type: "button",
						className: "dshp-rewind-item",
						onMouseDown: (e) => e.preventDefault(),
						onClick: () => runRewind("once"),
					},
						h("b", null, rewindText(t, "rewind.once", "回退一次")),
						h("span", null, rewindText(t, "rewind.once.hint", "只退当前对话上一句")),
					),
					h("button", {
						type: "button",
						className: "dshp-rewind-item",
						onMouseDown: (e) => e.preventDefault(),
						onClick: () => runRewind("round"),
					},
						h("b", null, rewindText(t, "rewind.round", "回退上一轮")),
						h("span", null, rewindText(t, "rewind.round.hint", "退回上一轮主对话，本轮子代理一并去掉")),
					),
				) : null,
			);
		}

		function installRewindWatch(ctx) {
			const sessions = ctx.sessions;
			if (!sessions) return () => {};
			const tick = async () => {
				try {
					const data = await apiJson("/dsh-purge/rewind");
					if (!data || !data.sessionId || !data.at || data.at <= rewindSeenAt) return;
					rewindSeenAt = data.at;
					const current = currentSessionId(sessions);
					if (current && current !== data.parentId) return;
					const text = isPluginDraft(data.text) ? "" : (data.text || "");
					armComposerFill(data.sessionId, text);
					scheduleComposerFill(data.sessionId, text);
					await openRewoundSession(sessions, data.sessionId);
					scheduleComposerFill(data.sessionId, text);
				} catch { /* ignore */ }
			};
			const timer = window.setInterval(tick, 1200);
			return () => window.clearInterval(timer);
		}

		function installRewindUi(ctx) {
			rewindHost = ctx;
			rewindSessions = ctx.sessions;
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "dsh-purge-rewind",
				order: 20,
				inject: (sessionId) => ({
					sessionId,
					t: ctx.locale.bind(NS),
				}),
			}, RewindSafe));
			// ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
			// 	name: "conversation.input.right",
			// 	id: "dsh-purge-continue",
			// 	order: 21,
			// 	inject: (sessionId) => ({
			// 		sessionId,
			// 		t: ctx.locale.bind(NS),
			// 	}),
			// }, ContinueSafe));
			ctx.effect(() => installRewindWatch(ctx), "dsh-purge: rewind watch");
		}

		function apply(ctx) {
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
					ctx.inject(["sessions"], (host) => installRewindUi(host));
				} else if (ctx.sessions) {
					installRewindUi(ctx);
				}
			} catch (e) {
				try { console.warn("[dsh-purge] rewind ui skipped:", e); } catch { /* ignore */ }
			}
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});
