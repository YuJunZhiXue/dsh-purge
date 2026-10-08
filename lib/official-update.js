// 官方客户端升级后的补丁回写标记。wscript 字面量给重启脚本用。
import path from "node:path";
import { hostFs as fs } from "./extract-asar.js";

const MARKER_NAME = "dsh-purge-reapply-asar";

function harnessExeName(exe) {
  const base = path.basename(String(exe || "")).toLowerCase();
  return base === "deepseek harness.exe" || base === "deepseek-harness.exe";
}

export function upgradeMarkerPath(exe) {
  if (!harnessExeName(exe)) return "";
  return path.join(path.dirname(exe), "resources", MARKER_NAME);
}

export function upgradeMarkerExists(exe) {
  const marker = upgradeMarkerPath(exe);
  return Boolean(marker && fs.existsSync(marker));
}

export function clearUpgradeMarker(exe) {
  const marker = upgradeMarkerPath(exe);
  if (!marker) return;
  try { fs.rmSync(marker, { force: true }); } catch { /* 下次启动再试 */ }
}

export function clearStaleExtractedApps(exe) {
  if (!harnessExeName(exe)) return;
  const resources = path.join(path.dirname(exe), "resources");
  let names = [];
  try { names = fs.readdirSync(resources); } catch { return; }
  for (const name of names) {
    if (!name.startsWith("app.dshpurge-prev")) continue;
    try { fs.rmSync(path.join(resources, name), { recursive: true, force: true }); } catch { /* 旧目录删不掉不影响新版本 */ }
  }
}

/** Windows Script Host 无 BOM 时按系统 ANSI 读文件。中文路径写成 \uXXXX，整份脚本保持 ASCII。 */
export function wshLiteral(value) {
  return JSON.stringify(String(value ?? "")).replace(/[\u007f-\uffff]/g, (ch) => {
    return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
  });
}

export function isWshAscii(source) {
  const text = String(source || "");
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) > 0x7f) return false;
  }
  return true;
}
