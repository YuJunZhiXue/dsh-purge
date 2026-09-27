/**
 * Agent-preset composition reader (adapted from dsh-liangshen).
 * Parses presets/redteam/{agent.cordis.yml,preset.yml} for registry.register().
 */
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
* The redteam preset composition reader: just enough YAML to turn the
* bundled `presets/redteam/agent.cordis.yml` — and the flat `preset.yml`
* display map beside it — into the declaration the agent-preset registry takes.
*
* Under 0.1.7 a preset is an ordinary registry declaration instead of a
* directory the harness discovers, so this plugin hands `ctx.agentPresets` the
* rows of its OWN composition. No YAML package is resolvable from this package
* and the harness's reader is not importable from here, so the subset is owned
* here; the shipped composition is the only file it must read, and tests fence
* it against that whole file. Supported: block maps and sequences, quoted and
* plain scalars, single-line flow sequences, literal and folded block scalars,
* comments, and `!!js` expressions preserved as data (`{ __jsExpr }`, the shape
* the Loader itself hands a plugin).
*
* Fail-closed: a construct outside the subset — anchors, aliases, tags other
* than `!!js`, nested flow collections, multiple documents, tabs — raises
* {@link CompositionError} rather than being guessed at, so an unreadable
* composition is refused instead of half-declared.
*
* Relative module names (`name: ./minimal-prompt.mjs`) are resolved against
* the preset directory handed to {@link readCompositionRows} and emitted as
* file URLs: the registry mounts a declaration under the DECLARING LOADER's
* base, so a relative name would otherwise be resolved outside this package.
* @module dsh-purge/redteam/preset-composition
*/
/** A construct outside the supported subset, or malformed YAML. */
var CompositionError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "CompositionError";
	}
};
const BLANK_OR_COMMENT_RE = /^[ \t]*(?:#.*)?$/;
const INTEGER_RE = /^[+-]?\d+$/;
const FLOAT_RE = /^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?$/;
/** The indentation width of one line (its leading spaces). */
function indentOf(line) {
	const match = /^ */.exec(line);
	return match === null ? 0 : match[0].length;
}
/**
* The indentation of one structurally significant line. A tab there is
* forbidden by YAML; block-scalar content is verbatim and never measured here.
*/
function significantIndent(line, lineNumber) {
	const leading = /^[ \t]*/.exec(line)?.[0] ?? "";
	if (leading.includes("	")) throw new CompositionError(`line ${String(lineNumber)}: tabs must not be used for indentation`);
	return leading.length;
}
/** Advance past blank and comment-only lines. */
function skipInsignificant(cursor) {
	while (cursor.index < cursor.lines.length && BLANK_OR_COMMENT_RE.test(cursor.lines[cursor.index] ?? "")) cursor.index += 1;
}
/** Whether a line at `indent` opens a block sequence entry. */
function isSequenceEntry(line, indent) {
	if (line[indent] !== "-") return false;
	return line.length === indent + 1 || line[indent + 1] === " ";
}
/** The index of the quote that closes a quoted scalar starting at index 0. */
function closingQuote(text) {
	const quote = text[0];
	for (let index = 1; index < text.length; index += 1) {
		const char = text[index];
		if (quote === "\"" && char === "\\") {
			index += 1;
			continue;
		}
		if (quote === "'" && char === "'" && text[index + 1] === "'") {
			index += 1;
			continue;
		}
		if (char === quote) return index;
	}
	return -1;
}
/** Resolve one quoted scalar, or return the text unchanged when unquoted. */
function unquote(text) {
	const trimmed = text.trim();
	if (trimmed.startsWith("\"")) {
		const end = closingQuote(trimmed);
		if (end !== trimmed.length - 1) throw new CompositionError(`unterminated double-quoted scalar: ${trimmed}`);
		return trimmed.slice(1, end).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, escape) => {
			switch (escape[0]) {
				case "n": return "\n";
				case "t": return "	";
				case "r": return "\r";
				case "0": return "\0";
				case "u":
				case "x": return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
				default: return escape;
			}
		});
	}
	if (trimmed.startsWith("'")) {
		const end = closingQuote(trimmed);
		if (end !== trimmed.length - 1) throw new CompositionError(`unterminated single-quoted scalar: ${trimmed}`);
		return trimmed.slice(1, end).replaceAll("''", "'");
	}
	return trimmed;
}
/** Split one block-map line into its key and the raw text after the colon. */
function matchKeyEntry(text) {
	if (text.startsWith("'") || text.startsWith("\"")) {
		const end = closingQuote(text);
		if (end === -1) return void 0;
		const after = text.slice(end + 1).trimStart();
		if (!after.startsWith(":")) return void 0;
		return {
			key: unquote(text.slice(0, end + 1)),
			rest: after.slice(1).trim()
		};
	}
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (char === "#" && index > 0 && text[index - 1] === " ") break;
		if (char === ":" && (index + 1 === text.length || text[index + 1] === " ")) return {
			key: text.slice(0, index),
			rest: text.slice(index + 1).trim()
		};
	}
}
/** Resolve a plain scalar to the value YAML's JSON schema would produce. */
function plainScalar(text) {
	const comment = text.indexOf(" #");
	const value = (comment === -1 ? text : text.slice(0, comment)).trim();
	if (value === "" || value === "~" || value === "null" || value === "Null" || value === "NULL") return null;
	if (value === "true" || value === "True" || value === "TRUE") return true;
	if (value === "false" || value === "False" || value === "FALSE") return false;
	if (INTEGER_RE.test(value)) return Number(value);
	if (FLOAT_RE.test(value)) return Number(value);
	return value;
}
/**
* Read one single-line flow sequence (`['mcp__*']`) into its scalar items.
* Nested flow collections are outside the subset and refused.
*/
function flowSequence(text) {
	const end = text.lastIndexOf("]");
	if (end === -1) throw new CompositionError(`unterminated flow sequence: ${text}`);
	const tail = text.slice(end + 1).trim();
	if (tail !== "" && !tail.startsWith("#")) throw new CompositionError(`unexpected content after a flow sequence: ${tail}`);
	const body = text.slice(1, end);
	if (body.trim() === "") return [];
	const items = [];
	for (const raw of body.split(",")) {
		const item = raw.trim();
		if (item === "") throw new CompositionError(`empty item in a flow sequence: ${text}`);
		if (item.startsWith("[") || item.startsWith("{")) throw new CompositionError(`nested flow collections are not supported: ${item}`);
		items.push(inlineScalar(item));
	}
	return items;
}
/** Resolve the text that follows a colon or a dash on one line. */
function inlineScalar(text) {
	const value = text.trim();
	if (value.startsWith("!!js")) {
		const expression = value.slice(4).trim();
		if (expression === "") throw new CompositionError("!!js requires an expression");
		return { __jsExpr: unquote(expression) };
	}
	if (value.startsWith("'") || value.startsWith("\"")) {
		const end = closingQuote(value);
		if (end === -1) throw new CompositionError(`unterminated quoted scalar: ${value}`);
		const tail = value.slice(end + 1).trim();
		if (tail !== "" && !tail.startsWith("#")) throw new CompositionError(`unexpected content after a quoted scalar: ${tail}`);
		return unquote(value.slice(0, end + 1));
	}
	if (value.startsWith("[")) return flowSequence(value);
	if (value.startsWith("{")) throw new CompositionError(`flow mappings are not supported: ${value}`);
	if (value.startsWith("|") || value.startsWith(">")) throw new CompositionError(`block scalars need their own line: ${value}`);
	if (value.startsWith("!") || value.startsWith("&") || value.startsWith("*")) throw new CompositionError(`unsupported YAML node: ${value}`);
	return plainScalar(value);
}
/**
* Read one literal (`|`) or folded (`>`) block scalar, consuming its lines.
* @param cursor - line cursor positioned on the line that follows the header.
* @param parentIndent - indentation of the node that owns the scalar.
* @param header - the header text (`|-`, `>+2`, ...) possibly with a comment.
* @returns the scalar text after indentation stripping and chomping.
*/
function blockScalar(cursor, parentIndent, header) {
	const style = header[0];
	const indicators = header.slice(1).split("#")[0]?.trim() ?? "";
	let explicitIndent;
	let chomp = "clip";
	for (const char of indicators) if (char === "-") chomp = "strip";
	else if (char === "+") chomp = "keep";
	else if (char >= "1" && char <= "9") explicitIndent = Number(char);
	else throw new CompositionError(`unsupported block scalar header: ${header}`);
	const body = [];
	let blockIndent;
	let trailing = 0;
	while (cursor.index < cursor.lines.length) {
		const line = cursor.lines[cursor.index] ?? "";
		if (line.trim() === "") {
			body.push("");
			trailing += 1;
			cursor.index += 1;
			continue;
		}
		const indent = indentOf(line);
		if (indent <= parentIndent) break;
		if (blockIndent === void 0) blockIndent = explicitIndent === void 0 ? indent : parentIndent + explicitIndent;
		if (indent < blockIndent) break;
		body.push(line.slice(blockIndent));
		trailing = 0;
		cursor.index += 1;
	}
	const lines = body.slice(0, body.length - trailing);
	if (style === ">") {
		let folded = "";
		let blank = 0;
		let started = false;
		for (const line of lines) {
			if (line === "") {
				blank += 1;
				continue;
			}
			if (!started) {
				folded = line;
				started = true;
				blank = 0;
				continue;
			}
			folded += blank === 0 ? " " + line : "\n".repeat(blank) + line;
			blank = 0;
		}
		if (chomp === "strip") return folded;
		if (chomp === "keep") return folded + "\n".repeat(trailing + 1);
		return folded === "" ? "" : folded + "\n";
	}
	const text = lines.join("\n");
	if (chomp === "strip") return text;
	if (chomp === "keep") return text + "\n".repeat(trailing + 1);
	return text === "" ? "" : text + "\n";
}
/** Resolve the value of one entry whose line has already been consumed. */
function parseValue(cursor, parentIndent, rest) {
	if (rest !== "") {
		if (rest.startsWith("|") || rest.startsWith(">")) return blockScalar(cursor, parentIndent, rest);
		return inlineScalar(rest);
	}
	skipInsignificant(cursor);
	const line = cursor.lines[cursor.index];
	if (line === void 0 || indentOf(line) <= parentIndent) return null;
	return parseNode(cursor, parentIndent + 1);
}
/** Parse a block map whose keys sit at exactly `indent`. */
function parseMap(cursor, indent) {
	const map = {};
	while (true) {
		skipInsignificant(cursor);
		const line = cursor.lines[cursor.index];
		if (line === void 0) break;
		const lineIndent = significantIndent(line, cursor.index + 1);
		if (lineIndent < indent) break;
		if (lineIndent > indent) throw new CompositionError(`line ${String(cursor.index + 1)}: unexpected indentation`);
		if (isSequenceEntry(line, indent)) break;
		const entry = matchKeyEntry(line.slice(indent));
		if (entry === void 0) throw new CompositionError(`line ${String(cursor.index + 1)}: expected "key: value", got "${line.trim()}"`);
		if (Object.hasOwn(map, entry.key)) throw new CompositionError(`line ${String(cursor.index + 1)}: duplicate key "${entry.key}"`);
		cursor.index += 1;
		map[entry.key] = parseValue(cursor, indent, entry.rest);
	}
	return map;
}
/** Parse a block sequence whose dashes sit at exactly `indent`. */
function parseSequence(cursor, indent) {
	const items = [];
	while (true) {
		skipInsignificant(cursor);
		const line = cursor.lines[cursor.index];
		if (line === void 0) break;
		if (significantIndent(line, cursor.index + 1) !== indent || !isSequenceEntry(line, indent)) break;
		const rest = line.slice(indent + 1);
		const content = rest.trimStart();
		if (content === "") {
			cursor.index += 1;
			skipInsignificant(cursor);
			const nested = cursor.lines[cursor.index];
			const nestedIndent = nested === void 0 ? -1 : significantIndent(nested, cursor.index + 1);
			items.push(nestedIndent <= indent ? null : parseNode(cursor, indent + 1));
			continue;
		}
		const contentIndent = indent + 1 + (rest.length - content.length);
		if (matchKeyEntry(content) !== void 0) {
			cursor.lines[cursor.index] = " ".repeat(contentIndent) + content;
			items.push(parseMap(cursor, contentIndent));
			continue;
		}
		cursor.index += 1;
		items.push(parseValue(cursor, indent, content));
	}
	return items;
}
/** Parse the block node that starts at the cursor. */
function parseNode(cursor, minIndent) {
	skipInsignificant(cursor);
	const line = cursor.lines[cursor.index];
	if (line === void 0) return null;
	const indent = significantIndent(line, cursor.index + 1);
	if (indent < minIndent) return null;
	return isSequenceEntry(line, indent) ? parseSequence(cursor, indent) : parseMap(cursor, indent);
}
/** Read one cordis YAML document (an entry list, or the flat map of `preset.yml`). */
function readYaml(text) {
	const cursor = {
		lines: (text.startsWith("﻿") ? text.slice(1) : text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n"),
		index: 0
	};
	const value = parseNode(cursor, 0);
	skipInsignificant(cursor);
	const extra = cursor.lines[cursor.index];
	if (extra !== void 0) throw new CompositionError(`line ${String(cursor.index + 1)}: unexpected content "${extra.trim()}"`);
	return value;
}
/** Whether a parsed value is one composition row (a map with a string `name`). */
function asRow(value, at) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new CompositionError(`${at} is not a plugin row (expected a map with a "name")`);
	const row = value;
	if (typeof row.name !== "string" || row.name === "") throw new CompositionError(`${at} names no plugin (a "name" string is required)`);
	return row;
}
/**
* Rewrite the relative module names of one row list, recursively through the
* nested entry lists of group rows, into absolute file URLs.
*/
function absolutizeRows(rows, baseDir, at = "row") {
	return rows.map((row, index) => {
		const label = `${at} ${String(index + 1)}`;
		const checked = asRow(row, label);
		const name = checked.name ?? "";
		const out = { ...checked };
		if (name.startsWith("./") || name.startsWith("../")) out.name = pathToFileURL(resolve(baseDir, name)).href;
		if (checked.group === true) {
			if (!Array.isArray(checked.config)) throw new CompositionError(`group ${label} must hold a list of plugin rows`);
			out.config = absolutizeRows(checked.config, baseDir, `${label} group`);
		}
		return out;
	});
}
/**
* Read the child plugin rows of one `agent.cordis.yml`.
* @param text - the raw composition document.
* @param baseDir - directory a relative row `name` resolves against (the preset's own directory).
* @returns the row list to hand the registry, relative names resolved to file URLs.
* @throws {CompositionError} on malformed YAML or a row the registry would reject.
*/
function readCompositionRows(text, baseDir) {
	const value = readYaml(text);
	if (!Array.isArray(value)) throw new CompositionError("agent.cordis.yml must be a top-level list of plugin rows");
	return absolutizeRows(value, baseDir);
}
/** Read the single-line display scalars of one `preset.yml`. */
function readPresetMetadata(text) {
	const value = readYaml(text);
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new CompositionError("preset.yml must be a mapping");
	const record = value;
	const metadata = {};
	for (const key of ["name", "description"]) {
		const field = record[key];
		if (field === void 0 || field === null) continue;
		if (typeof field !== "string" || field.includes("\n")) throw new CompositionError(`preset.yml: ${key} must be a single-line string`);
		metadata[key] = field;
	}
	const order = record["order"];
	if (order !== void 0 && order !== null) {
		if (typeof order !== "number" || !Number.isFinite(order)) throw new CompositionError("preset.yml: order must be a number");
		metadata.order = order;
	}
	return metadata;
}
/**
* Build the registry declaration of one preset directory.
* @param id - preset identity the roster keys the declaration by.
* @param dir - absolute preset directory holding `agent.cordis.yml` and `preset.yml`.
* @returns the definition to submit to `ctx.agentPresets.register`.
* @throws {CompositionError} when either file is missing, unreadable, or unparsable.
*/
function readPresetDefinition(id, dir) {
	const read = (name) => {
		try {
			return readFileSync(join(dir, name), "utf8");
		} catch (error) {
			throw new CompositionError(`${name} is unreadable: ${error instanceof Error ? error.message : String(error)}`);
		}
	};
	return {
		id,
		...readPresetMetadata(read("preset.yml")),
		plugins: readCompositionRows(read("agent.cordis.yml"), dir)
	};
}
/** The overlay table: settings field to composition row and config key. */
function overrideTargets(overrides) {
	return [["tool-catalog", { ...overrides.presentation === void 0 ? {} : { presentation: overrides.presentation } }], ["guard", {
		...overrides.guardEnabled === void 0 ? {} : { enabled: overrides.guardEnabled },
		...overrides.guardSensitivity === void 0 ? {} : { sensitivity: overrides.guardSensitivity },
		...overrides.guardStallReasoningChars === void 0 ? {} : { stallReasoningChars: overrides.guardStallReasoningChars },
		...overrides.guardGlobalStallCap === void 0 ? {} : { globalStallCap: overrides.guardGlobalStallCap },
		...overrides.guardEchoFailures === void 0 ? {} : { echoFailures: overrides.guardEchoFailures }
	}]];
}
/**
* Apply the settings overlay to one parsed row list.
*
* Rows are addressed by their `id`, and only a row the composition actually
* carries is touched: the overlay narrows the shipped configuration, it never
* invents a mount the preset did not have. The shipped composition declares
* every key the overlay writes, so leaving a key absent only matters for a
* composition that dropped it.
* @param rows - the parsed composition rows.
* @param overrides - the operator's settings-surface choices.
* @returns a new row list with the overlay applied.
*/
function applyPresetOverrides(rows, overrides) {
	const table = overrideTargets(overrides);
	return rows.map((row) => {
		const target = table.find(([id]) => id === row.id);
		if (target === void 0) return row;
		const [, patch] = target;
		if (Object.keys(patch).length === 0) return row;
		const config = row.config;
		if (typeof config !== "object" || config === null || Array.isArray(config)) return row;
		return {
			...row,
			config: {
				...config,
				...patch
			}
		};
	});
}

export { CompositionError, readCompositionRows, readPresetDefinition };
