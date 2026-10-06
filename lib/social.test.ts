import { describe, expect, it } from "vitest";
import { cleanText, followDecision, postVisible, timeAgo } from "./social";

const v = { id: "v", role: "sponsor", isGuardianOfTarget: false };
const adult = { id: "a", isMinor: false, unavailable: false }, minor = { id: "m", isMinor: true, unavailable: false };
const none = { blocked: false, existing: null as null };
describe("followDecision", () => {
  it("follows an adult instantly and requests a minor", () => {
    expect(followDecision(v, adult, none)).toEqual({ ok: true, status: "approved" });
    expect(followDecision(v, minor, none)).toEqual({ ok: true, status: "pending" });
  });
  it("blocks self, blocked pairs and unavailable accounts — without saying why", () => {
    expect(followDecision({ ...v, id: "a" }, adult, none).ok).toBe(false);
    const b = followDecision(v, adult, { ...none, blocked: true }), u = followDecision(v, { ...adult, unavailable: true }, none);
    for (const r of [b, u]) { expect(r.ok).toBe(false); if (!r.ok) expect(r.error).not.toMatch(/block|suspend|delet/i); }
  });
  it("keeps boosters away from minors, like the offer rule", () => {
    expect(followDecision({ ...v, role: "booster" }, minor, none).ok).toBe(false);
    expect(followDecision({ ...v, role: "booster" }, adult, none).ok).toBe(true);
  });
  it("handles existing relationships and guardians", () => {
    expect(followDecision(v, adult, { blocked: false, existing: "approved" }).ok).toBe(false);
    expect(followDecision(v, minor, { blocked: false, existing: "pending" }).ok).toBe(false);
    expect(followDecision({ ...v, isGuardianOfTarget: true }, minor, none).ok).toBe(false);
  });
});
describe("postVisible", () => {
  const base = { viewerId: "v", authorId: "a", authorIsMinor: false, approvedFollower: false, guardianOfAuthor: false, blocked: false, authorUnavailable: false };
  it("adults are visible to every signed-in user", () => expect(postVisible(base)).toBe(true));
  it("a minor's posts reach only themselves, approved followers and guardians", () => {
    const m = { ...base, authorIsMinor: true };
    expect(postVisible(m)).toBe(false);
    expect(postVisible({ ...m, approvedFollower: true })).toBe(true);
    expect(postVisible({ ...m, guardianOfAuthor: true })).toBe(true);
    expect(postVisible({ ...m, viewerId: "a" })).toBe(true);
  });
  it("blocks and unavailable authors hide everything, even from the author's followers", () => {
    expect(postVisible({ ...base, blocked: true })).toBe(false);
    expect(postVisible({ ...base, authorIsMinor: true, approvedFollower: true, blocked: true })).toBe(false);
    expect(postVisible({ ...base, authorUnavailable: true })).toBe(false);
  });
});
describe("cleanText", () => {
  it("trims, bounds and strips control characters", () => {
    expect(cleanText("  hi\r\n\r\n\r\nthere‮ ", 50)).toEqual({ ok: true, text: "hi\n\nthere" });
    expect(cleanText("   ", 50).ok).toBe(false);
    expect(cleanText("x".repeat(51), 50).ok).toBe(false);
  });
});
it("timeAgo", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  expect(timeAgo(new Date("2026-10-06T11:59:40Z"), now)).toBe("just now");
  expect(timeAgo(new Date("2026-10-06T11:30:00Z"), now)).toBe("30m");
  expect(timeAgo(new Date("2026-10-06T07:00:00Z"), now)).toBe("5h");
  expect(timeAgo(new Date("2026-10-04T12:00:00Z"), now)).toBe("2d");
});
