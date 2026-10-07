/** Encrypts small secrets (TOTP seeds) at rest with AES-256-GCM. The key lives in the environment, never in the database. */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const k = process.env.MFA_ENCRYPTION_KEY;
  if (k) {
    const b = Buffer.from(k, "base64");
    if (b.length !== 32) throw new Error("MFA_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
    return b;
  }
  if (process.env.NODE_ENV === "production") throw new Error("MFA_ENCRYPTION_KEY is not set");
  return createHash("sha256").update("lin-dev-only-mfa-key").digest();   // development convenience only
}

export function seal(plain: string, aad = ""): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

/** `aad` binds the ciphertext to its owner, so a stolen row can't be pasted under another account. Returns null on any failure. */
export function open(sealed: string, aad = ""): string | null {
  try {
    const [v, iv, tag, ct] = sealed.split(":");
    if (v !== "v1" || !iv || !tag || !ct) return null;
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAAD(Buffer.from(aad)); d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}
