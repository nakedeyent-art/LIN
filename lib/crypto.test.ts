import { describe, expect, it } from "vitest";
import { ageFromBirthDate, hashPassword, hashToken, isValidEmail, newSessionToken, verifyPassword } from "./crypto";

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong password!!", h)).toBe(false);
  });
  it("salts: same password hashes differently", async () => {
    expect(await hashPassword("same-password-1")).not.toBe(await hashPassword("same-password-1"));
  });
  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("tokens", () => {
  it("generates unique tokens and a stable hash", () => {
    const a = newSessionToken(), b = newSessionToken();
    expect(a).not.toBe(b);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(a);
  });
});

describe("helpers", () => {
  it("validates emails", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
  });
  it("computes age at the birthday boundary", () => {
    const now = new Date("2026-10-05T12:00:00Z");
    expect(ageFromBirthDate("2008-10-05", now)).toBe(18);
    expect(ageFromBirthDate("2008-10-06", now)).toBe(17);
    expect(ageFromBirthDate("2999-01-01", now)).toBeNull();
    expect(ageFromBirthDate("garbage", now)).toBeNull();
  });
});
