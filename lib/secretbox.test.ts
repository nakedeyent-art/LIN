import { afterEach, describe, expect, it } from "vitest";
import { open, seal } from "./secretbox";
import { hashRecovery, looksLikeRecovery, newRecoveryCodes, normalizeRecovery } from "./recovery";

const KEY = Buffer.alloc(32, 7).toString("base64");
afterEach(() => { delete process.env.MFA_ENCRYPTION_KEY; });
describe("secretbox", () => {
  it("round-trips and never stores the plaintext", () => {
    process.env.MFA_ENCRYPTION_KEY = KEY;
    const s = seal("JBSWY3DPEHPK3PXP", "user-1");
    expect(s).not.toContain("JBSWY3DPEHPK3PXP"); expect(open(s, "user-1")).toBe("JBSWY3DPEHPK3PXP");
  });
  it("uses a fresh nonce each time", () => { process.env.MFA_ENCRYPTION_KEY = KEY; expect(seal("x")).not.toBe(seal("x")); });
  it("is bound to its owner and to the key, and detects tampering", () => {
    process.env.MFA_ENCRYPTION_KEY = KEY;
    const s = seal("secret", "user-1");
    expect(open(s, "user-2")).toBeNull();
    const parts = s.split(":"); parts[3] = Buffer.from("tampered").toString("base64");
    expect(open(parts.join(":"), "user-1")).toBeNull();
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(open(s, "user-1")).toBeNull();
    expect(open("garbage", "user-1")).toBeNull();
  });
  it("insists on a proper key in production and rejects a malformed one", () => {
    const env = process.env as Record<string, string | undefined>; const was = env.NODE_ENV;
    env.NODE_ENV = "production";
    try { expect(() => seal("x")).toThrow(/not set/); process.env.MFA_ENCRYPTION_KEY = "short"; expect(() => seal("x")).toThrow(/32 bytes/); }
    finally { env.NODE_ENV = was; }
  });
});
describe("recovery codes", () => {
  it("makes distinct, readable codes", () => {
    const c = newRecoveryCodes();
    expect(c).toHaveLength(10); expect(new Set(c).size).toBe(10);
    for (const x of c) { expect(x).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/); expect(looksLikeRecovery(x)).toBe(true); }
  });
  it("accepts any casing and separators, and hashes consistently", () => {
    expect(normalizeRecovery("abcde-fghjk")).toBe("ABCDEFGHJK");
    expect(hashRecovery("abcde fghjk")).toBe(hashRecovery("ABCDE-FGHJK"));
    expect(hashRecovery("ABCDE-FGHJK")).not.toBe(hashRecovery("ABCDE-FGHJM"));
  });
  it("doesn't mistake an authenticator code for a recovery code", () => { expect(looksLikeRecovery("123456")).toBe(false); expect(looksLikeRecovery("")).toBe(false); });
});
