/**
 * 能力选用协议：先读 skill / MCP 目录，再按当前任务选用。
 * 不改官方 skill 注册、不改 MCP 挂载、不 deny 任何工具。
 */

export const CAPABILITY_SECTION = "dsh-purge:capabilities";

const OFFICIAL_PROTOCOL = `## Capability selection by task (mandatory)

1. **Read first**: Inspect \`<available_skills>\` / the skill catalog and the installed MCP / host tools for this session. Know what exists before acting.
2. **Match the task**: From that catalog, pick the skill(s) and MCP/CLI tool(s) that fit *this* user task — not “always use something”, not “never use something”.
3. **Call what matches**:
   - Matching **Skill** → load it with the host \`skill\` tool, then follow it (methods, premises, branches, counter-evidence).
   - Matching **MCP / CLI** → call that tool with real schema and context; treat failures by the tool’s semantics.
4. **Only then DIY**: If nothing in the catalog fits the task, use shell / ad-hoc steps and say what was missing.
5. **Subagents / sub-delegates inherit this rule**: Any \`subagent\`, teammate, or child agent you start must also read the catalog and call task-matched skills/MCP the same way. Put that requirement in the child brief when you dispatch.
6. Host skills and MCP stay available; this prompt does not remove them.`;

const REDTEAM_LEAD_PROTOCOL = `## Capability selection by task (redteam lead)

1. You plan, dispatch with \`subagent\`, verify results, and report. Executors do hands-on work.
2. Before dispatch, know which skills/MCP fit the next stage (from \`<available_skills>\` / redteam skills / session MCP).
3. In every \`subagent\` brief: require the child to **read the skill/MCP catalog, then call only what the assigned task needs** (name concrete skill codes when you know them).
4. Do not ban skill or MCP for children. Leaf limits apply only to further delegation tools (\`subagent_fork\` / workflow / ralph), not to skill/MCP.
5. Vague “go investigate” briefs are wrong; task-matched skill/MCP instructions are right.`;

const REDTEAM_CHILD_PROTOCOL = `## Capability selection by task (redteam executor)

1. **Read** \`<available_skills>\` / your role skills and available MCP/CLI tools.
2. **Match** them to *your assigned task* (not every skill, not zero skills).
3. **Call** matching skills via \`skill\`, and matching MCP/CLI tools by schema, before freelancing equivalent shell work.
4. DIY only for gaps the catalog does not cover; stay in role; do not re-delegate.`;

/**
 * @param {{ redteam?: boolean, redteamChild?: boolean, enabled?: boolean }} [opts]
 * @returns {string}
 */
export function capabilityProtocolText(opts = {}) {
  if (opts.enabled === false) return "";
  if (opts.redteamChild) return REDTEAM_CHILD_PROTOCOL;
  if (opts.redteam) return REDTEAM_LEAD_PROTOCOL;
  return OFFICIAL_PROTOCOL;
}
