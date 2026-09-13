// Official Harness / engineer personas are stripped so prompt-inject.md owns identity.
// Liangshen phase-1 keeps persona (+ prefix on 0.1.5). Fold inject into the prefix
// (or legacy persona) so turn 1 still sees it. No plugin-authored identity card.

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

/** @deprecated Identity is prompt-inject.md only. Kept so old callers do not throw. */
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

/** @deprecated No plugin identity card. Inject file is used as-is. */
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
  const fromSections = purgeSections
    .map((s) => String(s.text || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
  if (fromSections) return fromSections;
  return typeof fallbackText === "string" ? fallbackText.trim() : "";
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

function foldInjectIntoPersona(sections, injectText) {
  const inject = typeof injectText === "string" ? injectText.trim() : "";
  const names = sections.map((s) => String(s?.name || ""));
  const hasPrefix = names.some((n) => PERSONA_PREFIX_NAMES.has(n));
  let folded = false;
  const out = sections.map((section) => {
    const name = String(section?.name || "");
    if (!isPersonaFoldTarget(name, hasPrefix)) return section;
    folded = true;
    const prior = stripIdentityPrefix(String(section.text || "").trim());
    if (!inject) return { ...section, text: prior };
    if (prior.includes(inject.slice(0, Math.min(80, inject.length)))) {
      return { ...section, text: prior };
    }
    return { ...section, text: prior ? `${inject}\n\n${prior}` : inject };
  });
  if (folded) return out;
  if (!inject) return out;
  return [{ name: "deployment:persona-prefix", text: inject }, ...out];
}

/**
 * @param {object} assembled
 * @param {string} [fallbackInject] raw prompt-inject.md when purge sections were
 *   already filtered out by an outer Liangshen hook (first-turn race).
 */
export function rewritePromptAssembly(assembled, fallbackInject = "") {
  if (!assembled || !Array.isArray(assembled.sections)) return assembled;
  const rest = [];
  const purge = [];
  for (const section of assembled.sections) {
    if (!section || section.name === "harness:identity") continue;
    if (section.name === "dsh-purge:identity") continue;
    const next = { ...section };
    if (typeof next.text === "string" && !String(next.name).startsWith("dsh-purge")) {
      next.text = stripHarnessPersona(next.text);
    }
    if (String(next.name).startsWith("dsh-purge")) purge.push(next);
    else rest.push(next);
  }

  const injectText = collectInjectText(purge, fallbackInject);
  assembled.sections = [...foldInjectIntoPersona(rest, injectText), ...purge];
  return assembled;
}
