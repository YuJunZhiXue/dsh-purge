/**
 * Producer-owned message source kinds (session format v4).
 *
 * v4 retired the bare `{ kind: "plugin", plugin: X }` wrapper. Every message
 * must carry a producer-owned kind, and a plugin's kind is `plugin:<name>`.
 * A bare `kind: "plugin"` is rejected on write, and the rejection surfaces as
 * the whole turn dying with
 * `format v4 message requires a producer-owned source kind`.
 *
 * So producers here emit `plugin:dsh-purge`, and recognizers must treat the
 * retired bare shape and the current prefixed shape as the same thing —
 * otherwise a plugin stops recognising its own messages.
 */

/** This plugin's own producer-owned source kind. */
export const PURGE_SOURCE_KIND = "plugin:dsh-purge";

/** The retired v3 wrapper kind. */
const LEGACY_PLUGIN_KIND = "plugin";

/** Whether a message source came from a plugin, in either the v3 or the v4 shape. */
export function isPluginSource(source) {
  const kind = source?.kind;
  return (
    typeof kind === "string" &&
    (kind === LEGACY_PLUGIN_KIND || kind.startsWith(`${LEGACY_PLUGIN_KIND}:`))
  );
}

/** Whether a message source came from this plugin. */
export function isPurgeSource(source) {
  return source?.plugin === "dsh-purge" || source?.kind === PURGE_SOURCE_KIND;
}
