import { createDecipheriv } from "node:crypto";
import { inflateSync } from "node:zlib";
import { IV, MASK, SLOT, TAG } from "./asset-table.js";
import { mixKey } from "./table-key.js";

export function openSlot() {
  try {
    const decipher = createDecipheriv("aes-256-gcm", mixKey(MASK), Buffer.from(IV, "base64"));
    decipher.setAuthTag(Buffer.from(TAG, "base64"));
    const raw = Buffer.concat([
      decipher.update(Buffer.from(SLOT, "base64")),
      decipher.final(),
    ]);
    return inflateSync(raw).toString("utf8");
  } catch {
    return "";
  }
}
