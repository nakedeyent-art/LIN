import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, codeAt, newSecret, otpauthUrl, stepAt, verifyTotp } from "./totp";

// RFC 6238 appendix B: SHA-1, secret "12345678901234567890" (the 8-digit codes truncated to 6).
const RFC = base32Encode(new TextEncoder().encode("12345678901234567890"));
describe("TOTP (RFC 6238 vectors)", () => {
  it.each([[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"]])("t=%i → %s", (t, code) => {
    expect(codeAt(RFC, stepAt(t * 1000))).toBe(code);
  });
});
describe("verifyTotp", () => {
  const T = 1111111109 * 1000, step = stepAt(T);
  it("accepts the current and adjacent steps, not further", () => {
    expect(verifyTotp(RFC, "081804", { nowMs: T })).toEqual({ ok: true, step });
    expect(verifyTotp(RFC, codeAt(RFC, step - 1), { nowMs: T })).toEqual({ ok: true, step: step - 1 });
    expect(verifyTotp(RFC, codeAt(RFC, step + 1), { nowMs: T })).toEqual({ ok: true, step: step + 1 });
    expect(verifyTotp(RFC, codeAt(RFC, step - 2), { nowMs: T }).ok).toBe(false);
    expect(verifyTotp(RFC, codeAt(RFC, step + 2), { nowMs: T }).ok).toBe(false);
  });
  it("tolerates spaces but rejects malformed input", () => {
    expect(verifyTotp(RFC, "081 804", { nowMs: T }).ok).toBe(true);
    for (const bad of ["", "12345", "1234567", "abcdef", "081804x", "０８１８０４"]) expect(verifyTotp(RFC, bad, { nowMs: T }).ok, bad).toBe(false);
  });
  it("refuses a step that was already used (replay), but allows a later one", () => {
    expect(verifyTotp(RFC, "081804", { nowMs: T, lastUsedStep: step }).ok).toBe(false);
    expect(verifyTotp(RFC, "081804", { nowMs: T, lastUsedStep: step - 1 }).ok).toBe(true);
    expect(verifyTotp(RFC, codeAt(RFC, step - 1), { nowMs: T, lastUsedStep: step }).ok).toBe(false);
    expect(verifyTotp(RFC, codeAt(RFC, step + 1), { nowMs: T, lastUsedStep: step }).ok).toBe(true);
  });
  it("rejects a wrong secret", () => expect(verifyTotp(newSecret(), "081804", { nowMs: T }).ok).toBe(false));
});
describe("base32 and URLs", () => {
  it("round-trips and generates 160-bit secrets", () => {
    const s = newSecret(); expect(s).toMatch(/^[A-Z2-7]{32}$/); expect(base32Encode(base32Decode(s)!)).toBe(s);
    expect(base32Decode("not base32!")).toBeNull();
    expect(Buffer.from(base32Decode("MFRGG===")!).toString()).toBe("abc");
  });
  it("builds an otpauth URL with the account and issuer encoded", () => {
    const u = new URL(otpauthUrl("ABCDEFGH", "a+b@x.com"));
    expect(u.protocol).toBe("otpauth:"); expect(u.host).toBe("totp"); expect(u.searchParams.get("secret")).toBe("ABCDEFGH"); expect(decodeURIComponent(u.pathname)).toBe("/LIN:a+b@x.com");
  });
});
