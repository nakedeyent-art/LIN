/** One-time recovery codes for a lost authenticator. 10 codes, 50 bits each; only SHA-256 hashes are stored. */
import { createHash, randomInt } from "node:crypto";

export const RECOVERY_COUNT = 10;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // no 0/O/1/I/L: easy to read out loud and type back

export function newRecoveryCodes(n = RECOVERY_COUNT): string[] {
  return Array.from({ length: n }, () => {
    const c = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}
export const normalizeRecovery = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const looksLikeRecovery = (s: string) => normalizeRecovery(s).length === 10 && /^[A-Z2-9]+$/.test(normalizeRecovery(s));
export const hashRecovery = (s: string) => createHash("sha256").update("lin-recovery:" + normalizeRecovery(s)).digest("hex");
