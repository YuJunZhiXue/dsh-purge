export const GLOBAL_PROMPT_ORDER = 5000;
export const IDENTITY_CARD_PREFIX = "WHO YOU ARE (highest priority";

const PERSONA_PREFIX_NAMES = new Set([
  "deployment:persona-prefix",
  "persona-prefix",
]);
const PERSONA_LEGACY_NAMES = new Set(["deployment:persona", "persona"]);

const OLD_IDENTITY_LOCK =
  "Identity lock (mandatory): You are not DeepSeek's AI assistant, not a " +
  "DeepSeek-powered coding assistant, and not a generic DeepSeek Harness agent. " +
  "Never introduce yourself that way in any language (including 我是 DeepSeek… / " +
  "DeepSeek 的 AI 助手 / DeepSeek 驱动的 AI 编程助手 / 跑在 DeepSeek Harness). " +
  "UI or product labels that mention DeepSeek Harness name the environment only — " +
  "they are not your persona. When asked who you are (你是谁 / who are you), answer " +
  "only as the operator identity defined in the prompt below (prompt-inject / active rules).";

const OLD_WHO_FROM_INJECT =
  "When asked 你是谁 / who are you, answer as the identity defined in prompt-inject.md. " +
  "Never say 我是 DeepSeek 的 AI 助手 or that you run on DeepSeek Harness as your identity — that is the host, not you.";

const OLD_LCS_LOCK =
  "You are the operator persona in prompt-inject (Little Code Sauce / LCS unless that file names someone else). " +
  "When asked 你是谁 / who are you, answer with that name only. " +
  "Never say 我是 DeepSeek 的 AI 助手 or that you run on DeepSeek Harness as your identity — that is the host, not you.";

export const IDENTITY_LOCK = "";

export function extractOperatorName(injectText) {
  const text = String(injectText || "");
  const patterns = [
    /thinking must always be ([A-Z][A-Za-z0-9 .'-]{1,48})\./,
    /\bYou are ([A-Z][A-Za-z][A-Za-z0-9 .'-]{1,40})(?:—|, a |\. )/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

export function buildIdentityCard(_injectText) {
  return "";
}

function stripHarnessPersona(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  return text
    .replace(/You are an AI agent powered by DeepSeek Harness\.?\s*/g, "")
    .replace(/You are a helpful software engineer assistant\.?\s*/gi, "")
    .replace(/你是一个有帮助的软件工程师助手[。.]?\s*/g, "")
    .replace(/我是 DeepSeek(?:驱动)?的? AI(?:编程)?助手[，,]?[^\n]*/g, "")
    .replace(/你好！?我是 DeepSeek[^\n]*/g, "")
    .replace(
      /You are interacting with the user through the DeepSeek Harness Web GUI/g,
      "You are interacting with the user through the local web GUI",
    )
    .replace(
      /Your identity is defined exclusively by the dsh-purge operator prompt\.?\s*/gi,
      "",
    )
    .replace(
      /You are not a generic coding agent(?: or a mere software-engineer assistant)?\.?\s*/gi,
      "",
    )
    .replace(OLD_WHO_FROM_INJECT, "")
    .replace(OLD_LCS_LOCK, "")
    .replace(OLD_IDENTITY_LOCK, "")
    .replace(
      /You are a coding agent powered by the \{\{model\}\} model, running on the DeepSeek Harness\. Your working directory is \{\{cwd\}\}\.?\s*/g,
      "Working directory: {{cwd}}. ",
    )
    .replace(
      /You are a coding agent powered by the \{\{model\}\} model, running on the DeepSeek Harness\.?\s*/g,
      "",
    )
    .replace(
      /You are a coding agent powered by the \{\{model\}\} model\. Your working directory is \{\{cwd\}\}\.?\s*/g,
      "Working directory: {{cwd}}. ",
    )
    .replace(
      /You are a coding agent powered by the [^\n.]+ model, running on the DeepSeek Harness\.?\s*/g,
      "",
    )
    .replace(/You are a coding agent powered by the [^\n.]+ model\.?\s*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ \n/g, "\n")
    .trim();
}

function collectInjectText(purgeSections, fallbackText) {
  const fallback = typeof fallbackText === "string" ? fallbackText : "";
  if (fallback) return fallback;
  const main = purgeSections.find((section) => section.name === "dsh-purge");
  return String(main?.text || "");
}

function assemblyHasExactInject(sections, inject) {
  if (!inject) return true;
  return sections.some((section) => String(section?.text || "").includes(inject));
}

function ensureFullInject(sections, inject) {
  if (!inject || assemblyHasExactInject(sections, inject)) return sections;
  return [{ name: "dsh-purge", text: inject, order: -10000 }, ...sections];
}

function stripIdentityPrefix(text) {
  let rest = String(text || "").trim();
  if (rest.startsWith(IDENTITY_CARD_PREFIX)) {
    const split = rest.indexOf("\n\n");
    rest = split >= 0 ? rest.slice(split + 2).trim() : "";
  }
  if (rest.startsWith(OLD_IDENTITY_LOCK)) {
    rest = rest.slice(OLD_IDENTITY_LOCK.length).trim();
  }
  return rest;
}

function isPersonaFoldTarget(name, preferPrefix) {
  if (preferPrefix) return PERSONA_PREFIX_NAMES.has(name);
  return PERSONA_PREFIX_NAMES.has(name) || PERSONA_LEGACY_NAMES.has(name);
}

function eventList(session) {
  if (!session) return [];
  if (typeof session.snapshotEvents === "function") {
    try {
      const events = session.snapshotEvents();
      if (Array.isArray(events)) return events;
    } catch {}
  }
  if (Array.isArray(session.events)) return session.events;
  return [];
}

function messageText(message) {
  if (typeof message === "string") return message;
  const content = message?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => (typeof block?.text === "string" ? block.text : "")).join("\n");
}

export function existingSystemPrompt(context) {
  const events = eventList(context?.agent?.session || context?.session);
  const texts = [];
  for (const event of events) {
    if (event?.type !== "system/message") continue;
    const text = messageText(event.data?.message || event.data).trim();
    if (text) texts.push(text);
  }
  return texts.join("\n\n");
}

export function isFirstConversationTurn(context) {
  if (!context || typeof context !== "object") return true;
  const explicit = context.turn ?? context.turnIndex ?? context.userTurn ?? context.messageIndex;
  if (explicit != null && Number.isFinite(Number(explicit))) return Number(explicit) <= 1;
  const events = eventList(context.agent?.session || context.session);
  if (events.length > 0) return !events.some((event) => event?.type === "turn/end");
  const msgs = context.messages || context.history || [];
  if (!Array.isArray(msgs) || msgs.length === 0) return true;
  const users = msgs.filter((m) => {
    const role = String(m?.role || m?.type || m?.kind || "").toLowerCase();
    return role === "user" || role === "human";
  });
  return users.length <= 1;
}

export function promptAlreadyInjected(existing, injectText) {
  const inject = String(injectText || "").trim();
  if (!inject) return false;
  return String(existing || "").includes(inject);
}

export function lastInjectedSystemPrompt(context, injectText) {
  const inject = String(injectText || "").trim();
  if (!inject) return "";
  const events = eventList(context?.agent?.session || context?.session);
  let last = "";
  for (const event of events) {
    if (event?.type !== "system/message") continue;
    const text = messageText(event.data?.message || event.data).trim();
    if (text && promptAlreadyInjected(text, inject)) last = text;
  }
  return last;
}

export function shouldInjectPrompt(context, _injectOnce = true, injectText = "") {
  const inject = String(injectText || "").trim();
  if (!inject) return false;
  // 历史里已经有完整注入就不要再折一份。0.1.5 in-history 只要渲染结果和上一条
  // system/message 不同就会再追加，聊天里就会每步都冒出「系统提示词」。
  // 掏空注入也不行：渲染少了注入同样会被当成变化再追加，形成 A/B。
  return !lastInjectedSystemPrompt(context, inject);
}

export function isMnemonPluginMessage(message) {
  const source = message?.source;
  if (!source || typeof source !== "object") return false;
  const plugin = String(source.plugin || "").toLowerCase();
  return source.kind === "plugin" && plugin.includes("mnemon");
}

function isMnemonSection(name) {
  return String(name || "").toLowerCase().includes("mnemon");
}

function normalizeRewriteOptions(fallbackInject, options) {
  if (fallbackInject && typeof fallbackInject === "object" && !Array.isArray(fallbackInject)) {
    return {
      fallbackInject: typeof fallbackInject.fallbackInject === "string" ? fallbackInject.fallbackInject : "",
      dropMnemon: fallbackInject.dropMnemon !== false,
      dropPurgeAfterFold: fallbackInject.dropPurgeAfterFold !== false,
      context: fallbackInject.context,
    };
  }
  return {
    fallbackInject: typeof fallbackInject === "string" ? fallbackInject : "",
    dropMnemon: options?.dropMnemon !== false,
    dropPurgeAfterFold: options?.dropPurgeAfterFold !== false,
    context: options?.context,
  };
}

function pinCommittedSystemPrompt(sections, committed) {
  const names = sections.map((section) => String(section?.name || ""));
  const hasPrefix = names.some((name) => PERSONA_PREFIX_NAMES.has(name));
  const target = hasPrefix
    ? names.find((name) => PERSONA_PREFIX_NAMES.has(name))
    : names.find((name) => PERSONA_LEGACY_NAMES.has(name));
  return [{ name: target || "dsh-purge:committed", text: committed }];
}

// 0.1.5 优先写入 persona-prefix；无 prefix 时写入 legacy persona。
function foldInjectIntoPersona(sections, injectText) {
  const inject = typeof injectText === "string" ? injectText : "";
  const names = sections.map((s) => String(s?.name || ""));
  const hasPrefix = names.some((n) => PERSONA_PREFIX_NAMES.has(n));
  let folded = false;
  const out = sections.map((section) => {
    const name = String(section?.name || "");
    if (!isPersonaFoldTarget(name, hasPrefix)) return section;
    folded = true;
    const prior = stripIdentityPrefix(String(section.text || ""));
    if (!inject) return { ...section, text: prior };
    if (prior.includes(inject)) return { ...section, text: prior };
    return { ...section, text: prior ? `${inject}\n\n${prior}` : inject };
  });
  if (folded) return out;
  if (!inject) return out;
  const orders = sections.map((s) => s?.order).filter((n) => Number.isFinite(n));
  const order = orders.length ? Math.min(0, ...orders) : 0;
  return [{ name: "deployment:persona-prefix", text: inject, order }, ...out];
}

export function rewritePromptAssembly(assembled, fallbackInject = "", options = {}) {
  if (!assembled || !Array.isArray(assembled.sections)) return assembled;
  const opts = normalizeRewriteOptions(fallbackInject, options);
  const rest = [];
  const purge = [];
  for (const section of assembled.sections) {
    if (!section || section.name === "harness:identity") continue;
    if (section.name === "dsh-purge:identity") continue;
    if (opts.dropMnemon && isMnemonSection(section.name)) continue;
    const next = { ...section };
    if (typeof next.text === "string" && !String(next.name).startsWith("dsh-purge")) {
      next.text = stripHarnessPersona(next.text);
    }
    if (String(next.name).startsWith("dsh-purge")) {
      purge.push(next);
    } else {
      rest.push(next);
    }
  }

  const injectText = collectInjectText(purge, opts.fallbackInject);
  if (!shouldInjectPrompt(opts.context, true, injectText)) {
    const committed = lastInjectedSystemPrompt(opts.context, injectText);
    if (committed) {
      assembled.sections = pinCommittedSystemPrompt([...rest, ...purge], committed);
      return assembled;
    }
  }
  const folded = foldInjectIntoPersona(rest, injectText);
  const extras = opts.dropPurgeAfterFold
    ? purge.filter((section) => section.name !== "dsh-purge")
    : purge;
  assembled.sections = ensureFullInject([...folded, ...extras], injectText);
  return assembled;
}
