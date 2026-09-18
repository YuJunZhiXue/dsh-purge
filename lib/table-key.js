import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";

const MIX = Object.freeze([
  "cordis.slot.v2",
  [100, 115, 104, 45, 112, 117, 114, 103, 101].map((n) => String.fromCharCode(n)).join(""),
  "surface:web|desktop",
  "ov.table.1",
]);

export function mixKey(extra) {
  return createHash("sha256").update(`${MIX.join("\x1e")}\x1e${String(extra || "")}`).digest();
}

export function sealSlot(text) {
  const mask = randomBytes(16).toString("base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", mixKey(mask), iv);
  const packed = deflateSync(Buffer.from(String(text ?? ""), "utf8"), { level: 9 });
  const body = Buffer.concat([cipher.update(packed), cipher.final()]);
  return {
    SLOT: body.toString("base64"),
    MASK: mask,
    TAG: cipher.getAuthTag().toString("base64"),
    IV: iv.toString("base64"),
  };
}
