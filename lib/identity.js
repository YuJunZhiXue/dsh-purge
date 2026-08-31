// Strip Harness "coding agent" / harness:identity so the operator prompt can speak.
// Inject used to sit at order -40; persona at 0 overwrote it. Operator prompt is last.

export const GLOBAL_PROMPT_ORDER = 5000;

function stripHarnessPersona(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  return text
    .replace(/You are an AI agent powered by DeepSeek Harness\.?\s*/g, "")
    .replace(
      /You are a coding agent powered by the \{\{model\}\} model, running on the DeepSeek Harness\. Your working directory is \{\{cwd\}\}\.?\s*/g,
      "Working directory: {{cwd}}. ",
    )
    .replace(
      /You are a coding agent powered by the \{\{model\}\} model\. Your working directory is \{\{cwd\}\}\.?\s*/g,
      "Working directory: {{cwd}}. ",
    )
    .replace(/You are a coding agent powered by the [^\n.]+ model\.?\s*/g, "");
}

export function rewritePromptAssembly(assembled) {
  if (!assembled || !Array.isArray(assembled.sections)) return assembled;
  const rest = [];
  const purge = [];
  for (const section of assembled.sections) {
    if (!section || section.name === "harness:identity") continue;
    const next = { ...section };
    if (typeof next.text === "string" && !String(next.name).startsWith("dsh-purge")) {
      next.text = stripHarnessPersona(next.text);
    }
    if (String(next.name).startsWith("dsh-purge")) purge.push(next);
    else rest.push(next);
  }
  assembled.sections = [...rest, ...purge];
  return assembled;
}
