import { describe, expect, it } from "vitest";
import {
  ALL_ACTIONS, amountError, applyAction, availableActions, canOffer, displayName, formatCents, parseDollarsToCents,
  type Capacity, type DealContext, type DealStatus,
} from "./deals";

const ctx = (o: Partial<DealContext> = {}): DealContext =>
  ({ status: "offered", expired: false, athleteIsMinor: false, athleteHasGuardian: false, funded: false, fundingRequired: false, cancelRequestSide: null, ...o });

describe("deal state machine", () => {
  it("adult athlete: accept moves to signing (never straight to active)", () => {
    expect(applyAction(ctx(), "athlete", "accept")).toEqual({ ok: true, status: "awaiting_signature" });
  });
  it("minor athlete: accept needs a guardian, then goes to guardian review", () => {
    expect(applyAction(ctx({ athleteIsMinor: true }), "athlete", "accept").ok).toBe(false);
    expect(applyAction(ctx({ athleteIsMinor: true, athleteHasGuardian: true }), "athlete", "accept"))
      .toEqual({ ok: true, status: "guardian_review" });
  });
  it("a minor's deal can't move past guardian review without a guardian approving", () => {
    const m = ctx({ athleteIsMinor: true, athleteHasGuardian: true });
    for (const who of ["athlete", "counterparty"] as Capacity[])
      for (const a of ALL_ACTIONS) {
        const r = applyAction({ ...m, status: "guardian_review" }, who, a);
        expect(r.ok && r.status === "awaiting_signature").toBe(false);
      }
    expect(applyAction({ ...m, status: "guardian_review" }, "guardian", "approve")).toEqual({ ok: true, status: "awaiting_signature" });
  });
  it("INVARIANT: no action, in any state, by anyone, can make a deal active — only a fully signed contract can", () => {
    const statuses: DealStatus[] = ["offered", "guardian_review", "awaiting_signature", "active", "completed", "declined", "withdrawn", "cancelled"];
    for (const status of statuses) for (const who of ["athlete", "guardian", "counterparty"] as Capacity[])
      for (const minor of [true, false]) for (const funded of [true, false]) for (const a of ALL_ACTIONS) {
        const r = applyAction(ctx({ status, athleteIsMinor: minor, athleteHasGuardian: true, funded, fundingRequired: true, cancelRequestSide: "buyer" }), who, a);
        if (status !== "active") expect(r.ok && r.status === "active").toBe(false);
      }
  });
  it("guardian cannot approve before the athlete accepted", () => {
    expect(applyAction(ctx({ athleteIsMinor: true, athleteHasGuardian: true }), "guardian", "approve").ok).toBe(false);
  });
  it("guardian can reject at offered or guardian_review", () => {
    for (const status of ["offered", "guardian_review"] as DealStatus[])
      expect(applyAction(ctx({ status }), "guardian", "reject")).toEqual({ ok: true, status: "declined" });
  });
  it("only the counterparty withdraws/completes; completion only from active", () => {
    expect(applyAction(ctx(), "athlete", "withdraw").ok).toBe(false);
    expect(applyAction(ctx(), "counterparty", "withdraw")).toEqual({ ok: true, status: "withdrawn" });
    expect(applyAction(ctx(), "counterparty", "complete").ok).toBe(false);
    expect(applyAction(ctx({ status: "active" }), "counterparty", "complete")).toEqual({ ok: true, status: "completed" });
    expect(applyAction(ctx({ status: "awaiting_signature" }), "counterparty", "complete").ok).toBe(false);
    expect(applyAction(ctx({ status: "active" }), "athlete", "complete").ok).toBe(false);
  });
  it("terminal and active deals can't be withdrawn, accepted or declined", () => {
    for (const status of ["active", "completed", "declined", "withdrawn", "cancelled"] as DealStatus[]) {
      expect(applyAction(ctx({ status }), "counterparty", "withdraw").ok).toBe(false);
      expect(applyAction(ctx({ status }), "athlete", "accept").ok).toBe(false);
      expect(applyAction(ctx({ status }), "athlete", "decline").ok).toBe(false);
    }
  });
  it("expired open offers allow nothing", () => {
    for (const status of ["offered", "guardian_review", "awaiting_signature"] as DealStatus[])
      for (const who of ["athlete", "guardian", "counterparty"] as Capacity[])
        expect(availableActions(ctx({ status, expired: true, athleteIsMinor: true, athleteHasGuardian: true }), who)).toEqual([]);
  });
  it("lists actions per capacity for the UI", () => {
    expect(availableActions(ctx(), "athlete")).toEqual(["accept", "decline"]);
    expect(availableActions(ctx(), "counterparty")).toEqual(["withdraw"]);
    expect(availableActions(ctx({ status: "guardian_review", athleteIsMinor: true, athleteHasGuardian: true }), "guardian")).toEqual(["approve", "reject"]);
  });
});

describe("signing stage", () => {
  const sign = ctx({ status: "awaiting_signature" });
  it("either side can walk away or the offerer can withdraw before it's signed", () => {
    expect(applyAction(sign, "athlete", "decline")).toEqual({ ok: true, status: "declined" });
    expect(applyAction(sign, "counterparty", "withdraw")).toEqual({ ok: true, status: "withdrawn" });
    expect(applyAction({ ...sign, athleteIsMinor: true, athleteHasGuardian: true }, "guardian", "reject")).toEqual({ ok: true, status: "declined" });
  });
});

describe("completion, payment and cancellation", () => {
  const active = ctx({ status: "active" });
  it("with payments on, completion needs the deal funded", () => {
    expect(applyAction({ ...active, fundingRequired: true }, "counterparty", "complete").ok).toBe(false);
    expect(applyAction({ ...active, fundingRequired: true, funded: true }, "counterparty", "complete")).toEqual({ ok: true, status: "completed" });
    expect(applyAction({ ...active, fundingRequired: false }, "counterparty", "complete").ok).toBe(true);
  });
  it("unfunded active deals can be cancelled by either side; a minor athlete can't, their guardian can", () => {
    expect(applyAction(active, "counterparty", "cancel")).toEqual({ ok: true, status: "cancelled" });
    expect(applyAction(active, "athlete", "cancel")).toEqual({ ok: true, status: "cancelled" });
    const minor = { ...active, athleteIsMinor: true, athleteHasGuardian: true };
    expect(applyAction(minor, "athlete", "cancel").ok).toBe(false);
    expect(applyAction(minor, "guardian", "cancel")).toEqual({ ok: true, status: "cancelled" });
  });
  it("funded deals can't be cancelled unilaterally", () => {
    const funded = { ...active, fundingRequired: true, funded: true };
    for (const who of ["counterparty", "athlete"] as Capacity[]) expect(applyAction(funded, who, "cancel").ok).toBe(false);
  });
  it("funded cancellation is mutual: request, then the OTHER side agrees", () => {
    const funded = { ...active, fundingRequired: true, funded: true };
    expect(applyAction(funded, "counterparty", "request_cancel").ok).toBe(true);
    expect(applyAction(funded, "counterparty", "agree_cancel").ok).toBe(false);          // nothing to agree to yet
    const asked = { ...funded, cancelRequestSide: "buyer" as const };
    expect(applyAction(asked, "counterparty", "request_cancel").ok).toBe(false);          // already pending
    expect(applyAction(asked, "counterparty", "agree_cancel").ok).toBe(false);            // can't agree to your own request
    expect(applyAction(asked, "athlete", "agree_cancel")).toEqual({ ok: true, status: "cancelled" });
    expect(applyAction(asked, "counterparty", "withdraw_cancel").ok).toBe(true);
    expect(applyAction(asked, "athlete", "withdraw_cancel").ok).toBe(false);              // only the requester can withdraw it
  });
  it("a guardian agrees for a minor; the minor athlete and ex-guardians can't", () => {
    const asked = { ...active, athleteIsMinor: true, athleteHasGuardian: true, fundingRequired: true, funded: true, cancelRequestSide: "buyer" as const };
    expect(applyAction(asked, "guardian", "agree_cancel")).toEqual({ ok: true, status: "cancelled" });
    expect(applyAction(asked, "athlete", "agree_cancel").ok).toBe(false);
    expect(applyAction({ ...asked, athleteIsMinor: false }, "guardian", "agree_cancel").ok).toBe(false);
  });
  it("completed deals can't be cancelled", () => {
    for (const a of ["cancel", "request_cancel", "agree_cancel"] as const)
      expect(applyAction(ctx({ status: "completed", funded: true, fundingRequired: true, cancelRequestSide: "buyer" }), "athlete", a).ok).toBe(false);
  });
});

describe("deals that cross the 18th birthday", () => {
  const adult = ctx({ status: "guardian_review", athleteIsMinor: false });
  it("the now-adult athlete decides a deal that was awaiting a guardian", () => {
    expect(applyAction(adult, "athlete", "approve")).toEqual({ ok: true, status: "awaiting_signature" });
    expect(applyAction(adult, "athlete", "decline")).toEqual({ ok: true, status: "declined" });
  });
  it("the former guardian can no longer approve", () => {
    expect(applyAction(adult, "guardian", "approve").ok).toBe(false);
  });
  it("permission errors come before state errors", () => {
    const r = applyAction(ctx({ status: "offered" }), "counterparty", "approve");
    expect(!r.ok && r.error).toMatch(/Only a linked guardian can approve/);
  });
  it("a minor can never approve their own deal", () => {
    expect(applyAction(ctx({ status: "guardian_review", athleteIsMinor: true, athleteHasGuardian: true }), "athlete", "approve").ok).toBe(false);
  });
});

describe("offer eligibility", () => {
  it("only sponsors, boosters and gym owners offer", () => {
    expect(canOffer("athlete", "college").ok).toBe(false);
    expect(canOffer("sponsor", "high_school").ok).toBe(true);
    expect(canOffer("gym_owner", "high_school").ok).toBe(true);
  });
  it("boosters are blocked from high-school athletes", () => {
    expect(canOffer("booster", "high_school").ok).toBe(false);
    expect(canOffer("booster", "college").ok).toBe(true);
  });
});

describe("money and names", () => {
  it("parses dollars to cents", () => {
    expect(parseDollarsToCents("1500")).toBe(150000);
    expect(parseDollarsToCents("$1,250.5")).toBe(125050);
    expect(parseDollarsToCents("0.99")).toBe(99);
  });
  it("rejects bad amounts", () => {
    for (const bad of ["", "0", "-5", "abc", "1.234", "1e5", "1,000,000.01", "99999999999"]) expect(parseDollarsToCents(bad)).toBeNull();
    expect(parseDollarsToCents("1000000")).toBe(100000000);
  });
  it("formats cents", () => expect(formatCents(150000)).toBe("$1,500.00"));
  it("shortens minors' names for third parties", () => {
    expect(displayName("Jordan Marcus Reyes", true)).toBe("Jordan R.");
    expect(displayName("Jordan Reyes", false)).toBe("Jordan Reyes");
    expect(displayName("Cher", true)).toBe("Cher");
  });
});

describe("minimum amount with payments on", () => {
  it("requires $1.00 only when payments are switched on", () => {
    expect(amountError(99, true)).toMatch(/minimum deal is \$1\.00/);
    expect(amountError(100, true)).toBeNull();
    expect(amountError(1, false)).toBeNull();
  });
});
