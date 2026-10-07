import { describe, expect, it } from "vitest";
import { canActOnUser, validateReason, type Target } from "./admin";

const t = (o: Partial<Target> = {}): Target => ({ id: "u1", isAdmin: false, deleted: false, suspended: false, verified: true, role: "athlete", liveDeals: 0, moneyInFlight: 0, mfaEnrolled: true, ...o });
describe("validateReason", () => {
  it("needs a real reason", () => {
    expect(validateReason("short")).not.toBeNull();
    expect(validateReason("   nope   ")).not.toBeNull();
    expect(validateReason("Parent reported a typo in the birth year")).toBeNull();
    expect(validateReason("x".repeat(301))).not.toBeNull();
  });
});
describe("canActOnUser", () => {
  it("never on yourself or another admin for the powerful actions", () => {
    for (const a of ["suspend", "unsuspend", "set_birth_date"] as const) {
      expect(canActOnUser("me", t({ id: "me" }), a, "2000-01-01").ok, a + " self").toBe(false);
      expect(canActOnUser("me", t({ isAdmin: true }), a, "2000-01-01").ok, a + " admin").toBe(false);
    }
  });
  it("not on deleted accounts", () => expect(canActOnUser("me", t({ deleted: true }), "unlock").ok).toBe(false));
  it("suspend / restore need the right starting state", () => {
    expect(canActOnUser("me", t(), "suspend").ok).toBe(true);
    expect(canActOnUser("me", t({ suspended: true }), "suspend").ok).toBe(false);
    expect(canActOnUser("me", t({ suspended: true }), "unsuspend").ok).toBe(true);
    expect(canActOnUser("me", t(), "unsuspend").ok).toBe(false);
  });
  it("resend verification only when unverified", () => {
    expect(canActOnUser("me", t({ verified: false }), "resend_verification").ok).toBe(true);
    expect(canActOnUser("me", t(), "resend_verification").ok).toBe(false);
  });
  it("resetting two-factor: only for ordinary accounts that have it, never self or admins", () => {
    expect(canActOnUser("me", t(), "reset_mfa").ok).toBe(true);
    expect(canActOnUser("me", t({ mfaEnrolled: false }), "reset_mfa").ok).toBe(false);
    expect(canActOnUser("me", t({ id: "me" }), "reset_mfa").ok).toBe(false);
    expect(canActOnUser("me", t({ isAdmin: true }), "reset_mfa").ok).toBe(false);
    expect(canActOnUser("me", t({ deleted: true }), "reset_mfa").ok).toBe(false);
  });
  it("birth date: athletes only, valid, and not mid-deal", () => {
    expect(canActOnUser("me", t(), "set_birth_date", "2005-05-05").ok).toBe(true);
    expect(canActOnUser("me", t({ role: "sponsor" }), "set_birth_date", "2005-05-05").ok).toBe(false);
    expect(canActOnUser("me", t(), "set_birth_date", "not-a-date").ok).toBe(false);
    expect(canActOnUser("me", t(), "set_birth_date", "2999-01-01").ok).toBe(false);
    expect(canActOnUser("me", t(), "set_birth_date", "1900-01-01").ok).toBe(false);
    expect(canActOnUser("me", t({ liveDeals: 1 }), "set_birth_date", "2005-05-05").ok).toBe(false);
    expect(canActOnUser("me", t({ moneyInFlight: 1 }), "set_birth_date", "2005-05-05").ok).toBe(false);
  });
});
