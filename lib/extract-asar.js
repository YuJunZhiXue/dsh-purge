import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

/** Electron 会把 app.asar 伪装成目录。读归档必须走 original-fs，否则 isFile 为假、解不开。 */
function archiveFs() {
  process.noDeprecation = true;
  try {
    return createRequire(import.meta.url)("original-fs");
  } catch {
    return fs;
  }
}

function renameBusy(error) {
  const code = error && error.code;
  return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

export function renameAsarAside(asarPath) {
  const afs = archiveFs();
  if (!asarPath || !afs.existsSync(asarPath)) return { renamed: false };
  const bak = `${asarPath}.bak`;
  try {
    if (afs.existsSync(bak)) afs.rmSync(bak, { force: true });
    afs.renameSync(asarPath, bak);
    return { renamed: true, bak };
  } catch (error) {
    if (renameBusy(error)) return { renamed: false, busy: true, bak };
    throw error;
  }
}

export function asarArchiveIsFile(p) {
  try {
    const afs = archiveFs();
    return Boolean(p) && afs.existsSync(p) && afs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function readHeader(fd, afs) {
  const pre = Buffer.alloc(16);
  if (afs.readSync(fd, pre, 0, 16, 0) !== 16) throw new Error("asar header truncated");
  if (pre.readUInt32LE(0) !== 4) throw new Error("not an asar archive");
  const headerSize = pre.readUInt32LE(4);
  const jsonSize = pre.readUInt32LE(12);
  if (!headerSize || !jsonSize || jsonSize > 256 * 1024 * 1024) throw new Error("asar header size invalid");
  const jsonBuf = Buffer.alloc(jsonSize);
  if (afs.readSync(fd, jsonBuf, 0, jsonSize, 16) !== jsonSize) throw new Error("asar header short");
  return {
    header: JSON.parse(jsonBuf.toString("utf8")),
    dataOffset: 8 + headerSize,
  };
}

function walk(node, prefix, out) {
  const files = node && node.files;
  if (!files) return;
  for (const [name, info] of Object.entries(files)) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (info && info.files) walk(info, rel, out);
    else if (info) out.push({ rel, info });
  }
}

export function readAsarFile(asarPath, rel) {
  const afs = archiveFs();
  const fd = afs.openSync(asarPath, "r");
  try {
    const { header, dataOffset } = readHeader(fd, afs);
    let node = header;
    for (const part of String(rel || "").split("/")) {
      if (!part) continue;
      node = node && node.files && node.files[part];
      if (!node) return null;
    }
    if (!node || node.files || node.unpacked) return null;
    const size = Number(node.size || 0);
    const buf = Buffer.alloc(size);
    const offset = dataOffset + Number(node.offset || 0);
    if (size && afs.readSync(fd, buf, 0, size, offset) !== size) return null;
    return buf;
  } finally {
    afs.closeSync(fd);
  }
}

export function listAsarEntries(asarPath) {
  const afs = archiveFs();
  const fd = afs.openSync(asarPath, "r");
  try {
    const { header } = readHeader(fd, afs);
    const out = [];
    walk(header, "", out);
    return out;
  } finally {
    afs.closeSync(fd);
  }
}

function copyRange(afs, fd, offset, size, outPath) {
  const out = fs.openSync(outPath, "w");
  try {
    const buf = Buffer.alloc(Math.min(1024 * 1024, Math.max(size, 1)));
    let left = size;
    let pos = offset;
    while (left > 0) {
      const n = afs.readSync(fd, buf, 0, Math.min(buf.length, left), pos);
      if (n <= 0) throw new Error(`asar short read at ${outPath}`);
      fs.writeSync(out, buf, 0, n);
      pos += n;
      left -= n;
    }
  } finally {
    fs.closeSync(out);
  }
}

/** asar 里标记 unpacked 的原生文件不在归档正文。解开目录启动前必须补到 resources/app。 */
export function overlayAsarUnpacked(asarPath, destDir) {
  const unpacked = `${asarPath}.unpacked`;
  if (!destDir || !fs.existsSync(unpacked)) return { copied: 0, missing: true };
  let copied = 0;
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, ent.name);
      const to = path.join(destDir, path.relative(unpacked, from));
      if (ent.isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        walk(from);
      } else if (ent.isFile()) {
        if (fs.existsSync(to)) continue;
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        copied += 1;
      }
    }
  };
  walk(unpacked);
  return { copied };
}

export function extractAsar(asarPath, destDir) {
  const afs = archiveFs();
  const fd = afs.openSync(asarPath, "r");
  let count = 0;
  try {
    const { header, dataOffset } = readHeader(fd, afs);
    const entries = [];
    walk(header, "", entries);
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of entries) {
      const info = entry.info;
      const outPath = path.join(destDir, ...entry.rel.split("/"));
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      if (info.unpacked) continue;
      if (typeof info.link === "string") {
        try {
          fs.symlinkSync(info.link, outPath);
        } catch {
          // 不能建链接就跳过，主程序文件仍在归档里
        }
        continue;
      }
      const size = Number(info.size || 0);
      const offset = dataOffset + Number(info.offset || 0);
      if (size === 0) {
        fs.writeFileSync(outPath, Buffer.alloc(0));
      } else {
        copyRange(afs, fd, offset, size, outPath);
      }
      count += 1;
    }
  } finally {
    afs.closeSync(fd);
  }
  return count;
}
