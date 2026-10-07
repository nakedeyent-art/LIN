/** RFC 6238 time-based one-time passwords (HMAC-SHA1, 30 s steps, 6 digits) — what every authenticator app speaks. */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const STEP_SECONDS = 30, DIGITS = 6, WINDOW = 1;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const newSecret = () => base32Encode(randomBytes(20));

export function base32Encode(b: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const byte of b) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Uint8Array | null {
  const clean = s.replace(/[\s=-]/g, "").toUpperCase();
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of clean) { value = (value << 5) | ALPHABET.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Uint8Array.from(out);
}

export const stepAt = (ms: number) => Math.floor(ms / 1000 / STEP_SECONDS);

export function codeAt(secretB32: string, step: number): string {
  const key = base32Decode(secretB32); if (!key) throw new Error("bad secret");
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Checks a typed code against the current step and one step either side (clock drift). Returns the matched step so the caller can refuse
 * to accept the same step twice (replay): a code that was just used is worthless to someone who saw it over your shoulder.
 */
export function verifyTotp(secretB32: string, input: string, o: { nowMs?: number; lastUsedStep?: number | null } = {}): { ok: true; step: number } | { ok: false } {
  const code = input.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false };
  const now = stepAt(o.nowMs ?? Date.now());
  let found: number | null = null;
  for (let d = -WINDOW; d <= WINDOW; d++) {            // no early exit: constant work whichever step matches
    const step = now + d;
    const a = Buffer.from(codeAt(secretB32, step)), b = Buffer.from(code);
    if (timingSafeEqual(a, b) && found === null && (o.lastUsedStep == null || step > o.lastUsedStep)) found = step;
  }
  return found === null ? { ok: false } : { ok: true, step: found };
}

export const otpauthUrl = (secretB32: string, account: string, issuer = "LIN") =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;

export const groupSecret = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();
