import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const HIDDEN = {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
  windowsHide: true,
  timeout: 60000,
};

/** 各平台解压顺序。node 不调用外部命令，macOS / Linux / Windows 都能用。 */
export function unzipTools(platform = process.platform) {
  if (platform === "win32") return ["tar", "powershell", "node"];
  return ["tar", "unzip", "python3", "bsdtar", "node"];
}

function safeZipName(name) {
  const rel = String(name || "").replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/+$/, "");
  if (!rel) return "";
  if (rel.startsWith("/") || /^[A-Za-z]:/.test(rel)) throw new Error("Invalid zip path");
  const parts = rel.split("/");
  if (parts.some((part) => part === ".." || part === "")) throw new Error("Invalid zip path");
  return parts.join("/");
}

function findEocd(buf) {
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Not a zip file");
}

function readZipEntries(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error("Not a zip file");
  const eocd = findEocd(buf);
  const total = buf.readUInt16LE(eocd + 10);
  let cursor = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < total; n += 1) {
    if (cursor + 46 > buf.length || buf.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Corrupt zip central directory");
    }
    const method = buf.readUInt16LE(cursor + 10);
    const compSize = buf.readUInt32LE(cursor + 20);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.toString("utf8", cursor + 46, cursor + 46 + nameLen);
    entries.push({ name, method, compSize, localOffset });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function listZipEntries(buf) {
  return readZipEntries(buf).map((entry) => entry.name.replace(/\\/g, "/"));
}

export function listZipFile(zipPath) {
  return listZipEntries(fs.readFileSync(zipPath));
}

function localDataOffset(buf, localOffset) {
  if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error("Corrupt zip local header");
  }
  const nameLen = buf.readUInt16LE(localOffset + 26);
  const extraLen = buf.readUInt16LE(localOffset + 28);
  return localOffset + 30 + nameLen + extraLen;
}

export function extractZipBuffer(buf, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const root = path.resolve(dest);
  for (const entry of readZipEntries(buf)) {
    const rel = safeZipName(entry.name);
    if (!rel) continue;
    if (entry.compSize === 0xffffffff || entry.localOffset === 0xffffffff) {
      throw new Error("zip64 is not supported");
    }
    if (entry.method !== 0 && entry.method !== 8) {
      throw new Error(`Unsupported zip compression method ${entry.method}`);
    }
    // 显式目录条目（名字以 / 结尾）：建目录，不写成空文件。safeZipName 会去掉结尾的 /，
    // 不先认出来的话目录条目会被写成同名空文件，后面的子文件 mkdir 到它上面直接 EEXIST。
    if (/(?:^|\/)$/.test(entry.name) || entry.name.endsWith("\\")) {
      fs.mkdirSync(path.resolve(root, rel), { recursive: true });
      continue;
    }
    const start = localDataOffset(buf, entry.localOffset);
    const end = start + entry.compSize;
    if (end > buf.length) throw new Error("Truncated zip data");
    const compressed = buf.subarray(start, end);
    const body = entry.method === 0 ? compressed : zlib.inflateRawSync(compressed);
    const out = path.resolve(root, rel);
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (out !== root && !out.startsWith(prefix)) throw new Error("Invalid zip path");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, body);
  }
}

function attempt(file, args, extra = {}) {
  try {
    execFileSync(file, args, {
      ...HIDDEN,
      stdio: ["ignore", "pipe", "pipe"],
      ...extra,
    });
    return "";
  } catch (error) {
    const detail = String((error && (error.stderr || error.stdout || error.message)) || "")
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)[0];
    return detail ? `${file}: ${detail}` : file;
  }
}

/** 按平台试外部工具，最后用 Node 解 zip。成功返回用到的方式。 */
export function extractZipArchive(zipPath, dest, tools = unzipTools()) {
  fs.mkdirSync(dest, { recursive: true });
  const notes = [];
  for (const tool of tools) {
    if (tool === "node") {
      try {
        extractZipBuffer(fs.readFileSync(zipPath), dest);
        return "node";
      } catch (error) {
        notes.push(`node: ${error && error.message ? error.message : error}`);
        break;
      }
    }
    if (tool === "tar" || tool === "bsdtar") {
      const note = attempt(tool, ["-xf", zipPath, "-C", dest]);
      if (!note) return tool;
      notes.push(note);
      continue;
    }
    if (tool === "unzip") {
      const note = attempt("unzip", ["-o", "-q", zipPath, "-d", dest]);
      if (!note) return "unzip";
      notes.push(note);
      continue;
    }
    if (tool === "python3") {
      const note = attempt("python3", ["-m", "zipfile", "-e", zipPath, dest]);
      if (!note) return "python3";
      notes.push(note);
      continue;
    }
    if (tool === "powershell") {
      const note = attempt(
        "powershell",
        ["-NoProfile", "-Command", "Expand-Archive -LiteralPath $env:DSH_UPD_ZIP -DestinationPath $env:DSH_UPD_DIR -Force"],
        { env: { ...process.env, DSH_UPD_ZIP: zipPath, DSH_UPD_DIR: dest } },
      );
      if (!note) return "powershell";
      notes.push(note);
    }
  }
  throw new Error(`Extraction failed: ${notes.join(" | ") || "no extractor available"}`);
}
