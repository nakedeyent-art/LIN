import { describe, expect, it } from "vitest";
import { canPostMessage, cleanBody, MAX_MESSAGE_CHARS, rateLimited } from "./messaging";

const base = { who: "counterparty" as const, athleteIsMinor: false, athleteHasGuardian: false, status: "active" as const, expired: false };
describe("canPostMessage", () => {
  it("allows the parties on live and finished deals", () => {
    for (const status of ["offered", "guardian_review", "awaiting_signature", "active", "completed", "cancelled"] as const)
      expect(canPostMessage({ ...base, status }).ok, status).toBe(true);
  });
  it("needs standing", () => expect(canPostMessage({ ...base, who: null }).ok).toBe(false));
  it("closes when the offer ended without a deal", () => {
    expect(canPostMessage({ ...base, status: "declined" }).ok).toBe(false);
    expect(canPostMessage({ ...base, status: "withdrawn" }).ok).toBe(false);
  });
  it("closes on an expired open offer but not an expired-looking finished deal", () => {
    expect(canPostMessage({ ...base, status: "offered", expired: true }).ok).toBe(false);
    expect(canPostMessage({ ...base, status: "completed", expired: true }).ok).toBe(true);
  });
  it("pauses a minor's thread with no guardian", () => {
    expect(canPostMessage({ ...base, athleteIsMinor: true }).ok).toBe(false);
    expect(canPostMessage({ ...base, athleteIsMinor: true, athleteHasGuardian: true }).ok).toBe(true);
    expect(canPostMessage({ ...base, who: "athlete", athleteIsMinor: true }).ok).toBe(false);
  });
  it("a guardian has no voice once the athlete is an adult", () =>
    expect(canPostMessage({ ...base, who: "guardian" }).ok).toBe(false));
});
describe("cleanBody", () => {
  it("trims and normalises", () => expect(cleanBody("  hi\r\nthere \r\n\r\n\r\n\r\nbye  ")).toEqual({ ok: true, body: "hi\nthere\n\nbye" }));
  it("rejects empty / whitespace / control-only", () => {
    for (const s of ["", "   \n ", "\u0000​"]) expect(cleanBody(s).ok).toBe(false);
  });
  it("strips control and bidi-override characters", () => expect(cleanBody("a\u0000b‮c")).toEqual({ ok: true, body: "abc" }));
  it("caps the length", () => {
    expect(cleanBody("x".repeat(MAX_MESSAGE_CHARS)).ok).toBe(true);
    expect(cleanBody("x".repeat(MAX_MESSAGE_CHARS + 1)).ok).toBe(false);
  });
});
it("rate limit", () => { expect(rateLimited(7)).toBe(false); expect(rateLimited(8)).toBe(true); });
