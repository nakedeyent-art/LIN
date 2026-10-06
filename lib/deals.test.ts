import { describe, expect, it } from "vitest";
import {
  ALL_ACTIONS, applyAction, availableActions, canOffer, displayName, formatCents, parseDollarsToCents,
  type Capacity, type DealContext, type DealStatus,
} from "./deals";

const ctx = (o: Partial<DealContext> = {}): DealContext =>
  ({ status: "offered", expired: false, athleteIsMinor: false, athleteHasGuardian: false, ...o });

describe("deal state machine", () => {
  it("adult athlete: accept goes straight to active", () => {
    expect(applyAction(ctx(), "athlete", "accept")).toEqual({ ok: true, status: "active" });
  });
  it("minor athlete: accept needs a guardian, then goes to guardian review", () => {
    expect(applyAction(ctx({ athleteIsMinor: true }), "athlete", "accept").ok).toBe(false);
    expect(applyAction(ctx({ athleteIsMinor: true, athleteHasGuardian: true }), "athlete", "accept"))
      .toEqual({ ok: true, status: "guardian_review" });
  });
  it("a minor's deal can never become active without a guardian approving", () => {
    const m = ctx({ athleteIsMinor: true, athleteHasGuardian: true });
    for (const who of ["athlete", "counterparty"] as Capacity[])
      for (const a of ALL_ACTIONS) {
        const r = applyAction({ ...m, status: "guardian_review" }, who, a);
        expect(r.ok && r.status === "active").toBe(false);
      }
    expect(applyAction({ ...m, status: "guardian_review" }, "guardian", "approve")).toEqual({ ok: true, status: "active" });
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
    expect(applyAction(ctx({ status: "active" }), "athlete", "complete").ok).toBe(false);
  });
  it("terminal and active deals can't be withdrawn, accepted or declined", () => {
    for (const status of ["active", "completed", "declined", "withdrawn"] as DealStatus[]) {
      expect(applyAction(ctx({ status }), "counterparty", "withdraw").ok).toBe(false);
      expect(applyAction(ctx({ status }), "athlete", "accept").ok).toBe(false);
      expect(applyAction(ctx({ status }), "athlete", "decline").ok).toBe(false);
    }
  });
  it("expired open offers allow nothing", () => {
    for (const status of ["offered", "guardian_review"] as DealStatus[])
      for (const who of ["athlete", "guardian", "counterparty"] as Capacity[])
        expect(availableActions(ctx({ status, expired: true, athleteIsMinor: true, athleteHasGuardian: true }), who)).toEqual([]);
  });
  it("lists actions per capacity for the UI", () => {
    expect(availableActions(ctx(), "athlete")).toEqual(["accept", "decline"]);
    expect(availableActions(ctx(), "counterparty")).toEqual(["withdraw"]);
    expect(availableActions(ctx({ status: "guardian_review", athleteIsMinor: true, athleteHasGuardian: true }), "guardian")).toEqual(["approve", "reject"]);
  });
});

describe("deals that cross the 18th birthday", () => {
  const adult = ctx({ status: "guardian_review", athleteIsMinor: false });
  it("the now-adult athlete decides a deal that was awaiting a guardian", () => {
    expect(applyAction(adult, "athlete", "approve")).toEqual({ ok: true, status: "active" });
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
