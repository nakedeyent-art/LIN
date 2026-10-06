import { describe, expect, it } from "vitest";
import { canHavePayoutAccount, describePayment, fundingBlocker, payeeValid, type FundingInput } from "./payment-rules";

describe("payeeValid", () => {
  it("adult athletes receive for themselves; minors' money goes to a current guardian", () => {
    expect(payeeValid({ athleteIsMinor: false, payeeIsAthlete: true, payeeIsCurrentGuardian: false })).toBe(true);
    expect(payeeValid({ athleteIsMinor: false, payeeIsAthlete: false, payeeIsCurrentGuardian: true })).toBe(false);   // ex-guardian after 18
    expect(payeeValid({ athleteIsMinor: true, payeeIsAthlete: false, payeeIsCurrentGuardian: true })).toBe(true);
    expect(payeeValid({ athleteIsMinor: true, payeeIsAthlete: true, payeeIsCurrentGuardian: false })).toBe(false);    // a minor can't hold the account
    expect(payeeValid({ athleteIsMinor: true, payeeIsAthlete: false, payeeIsCurrentGuardian: false })).toBe(false);   // guardian stepped down
  });
});

describe("canHavePayoutAccount", () => {
  it("adult athletes and guardians of minors only", () => {
    expect(canHavePayoutAccount({ role: "athlete", isAdultAthlete: true, guardsAMinor: false })).toBe(true);
    expect(canHavePayoutAccount({ role: "athlete", isAdultAthlete: false, guardsAMinor: false })).toBe(false);
    expect(canHavePayoutAccount({ role: "parent", isAdultAthlete: false, guardsAMinor: true })).toBe(true);
    expect(canHavePayoutAccount({ role: "parent", isAdultAthlete: false, guardsAMinor: false })).toBe(false);
    expect(canHavePayoutAccount({ role: "sponsor", isAdultAthlete: false, guardsAMinor: true })).toBe(false);
  });
});

describe("fundingBlocker", () => {
  const ok: FundingInput = { paymentsEnabled: true, dealStatus: "active", contractExecuted: true, isBuyer: true, payeeSet: true, payeeIsValid: true, payeeReady: true, livePayment: null, expired: false };
  it("allows funding only when everything lines up", () => expect(fundingBlocker(ok)).toBeNull());
  it("blocks each missing precondition", () => {
    expect(fundingBlocker({ ...ok, paymentsEnabled: false })).toMatch(/aren't switched on/);
    expect(fundingBlocker({ ...ok, isBuyer: false })).toMatch(/Only the sponsor/);
    for (const dealStatus of ["offered", "guardian_review", "awaiting_signature", "completed", "declined", "withdrawn", "cancelled"])
      expect(fundingBlocker({ ...ok, dealStatus })).toMatch(/fully signed/);
    expect(fundingBlocker({ ...ok, contractExecuted: false })).toMatch(/fully signed/);
    expect(fundingBlocker({ ...ok, payeeSet: false })).toMatch(/choose who receives/);
    expect(fundingBlocker({ ...ok, payeeIsValid: false })).toMatch(/choose who receives/);
    expect(fundingBlocker({ ...ok, payeeReady: false })).toMatch(/payout setup/);
  });
  it("can't double-fund, but can retry after an expired or pending checkout", () => {
    for (const livePayment of ["funded", "releasing", "refunding"] as const) expect(fundingBlocker({ ...ok, livePayment })).toMatch(/already funded/);
    expect(fundingBlocker({ ...ok, livePayment: "pending_checkout" })).toBeNull();   // resume the same checkout
    expect(fundingBlocker({ ...ok, livePayment: null })).toBeNull();
  });
});

describe("describePayment", () => {
  it("describes every state", () => {
    expect(describePayment(null, { required: false })).toMatch(/Payments are off/);
    expect(describePayment(null, { required: true })).toBe("Awaiting funding");
    expect(describePayment({ status: "funded", attempts: 0 }, { required: true })).toMatch(/held/);
    expect(describePayment({ status: "releasing", attempts: 3 }, { required: true })).toMatch(/retrying/);
    expect(describePayment({ status: "released", attempts: 1 }, { required: true })).toBe("Paid out");
    expect(describePayment({ status: "refunded", attempts: 1 }, { required: true })).toMatch(/Refunded/);
  });
});
