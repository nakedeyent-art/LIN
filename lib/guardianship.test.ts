import { describe, expect, it } from "vitest";
import { canInviteGuardian, checkRemoval, guardianPowers, MAX_GUARDIANS } from "./guardianship";

describe("guardianPowers", () => {
  it("full authority only while the athlete is a minor", () => {
    expect(guardianPowers(true, true, false)).toBe("guardian");
    expect(guardianPowers(true, true, true)).toBe("guardian");
  });
  it("at 18 consent transfers: no access unless the athlete re-consents, and then view-only", () => {
    expect(guardianPowers(false, true, false)).toBe("none");
    expect(guardianPowers(false, true, true)).toBe("viewer");
  });
  it("unlinked parents have nothing", () => {
    for (const minor of [true, false]) for (const c of [true, false]) expect(guardianPowers(minor, false, c)).toBe("none");
  });
});

describe("checkRemoval", () => {
  const base = { actorIsGuardian: true, targetIsSelf: false, guardiansLinked: 2, openDeals: 0 };
  it("a guardian can remove another guardian", () => expect(checkRemoval(base)).toEqual({ ok: true, leavesNone: false }));
  it("non-guardians can't", () => expect(checkRemoval({ ...base, actorIsGuardian: false }).ok).toBe(false));
  it("can step down when another guardian remains", () => expect(checkRemoval({ ...base, targetIsSelf: true })).toEqual({ ok: true, leavesNone: false }));
  it("the last guardian may leave only with no open deals", () => {
    const last = { ...base, targetIsSelf: true, guardiansLinked: 1 };
    expect(checkRemoval(last)).toEqual({ ok: true, leavesNone: true });
    expect(checkRemoval({ ...last, openDeals: 1 }).ok).toBe(false);
  });
  it("can't remove someone else if that would leave no guardian", () => {
    expect(checkRemoval({ ...base, guardiansLinked: 1 }).ok).toBe(false);
  });
});

describe("canInviteGuardian", () => {
  it("caps linked + pending", () => {
    expect(canInviteGuardian(1, 0).ok).toBe(true);
    expect(canInviteGuardian(2, MAX_GUARDIANS - 3).ok).toBe(true);
    expect(canInviteGuardian(2, MAX_GUARDIANS - 2).ok).toBe(false);
  });
});
