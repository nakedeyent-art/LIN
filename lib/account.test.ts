import { describe, expect, it } from "vitest";
import { maskEmail, validateAthleteProfile, validateDisplayName } from "./account";

describe("maskEmail", () => {
  it("keeps first letter and domain", () => {
    expect(maskEmail("jordan@example.com")).toBe("j*****@example.com");
    expect(maskEmail("ab@x.co")).toBe("a*@x.co");
    expect(maskEmail("a@x.co")).toBe("a*@x.co");
    expect(maskEmail("garbage")).toBe("***");
  });
});

describe("validateDisplayName", () => {
  it("accepts normal names and rejects bad ones", () => {
    expect(validateDisplayName("Jordan Reyes")).toBeNull();
    expect(validateDisplayName("J")).toMatch(/2–80/);
    expect(validateDisplayName("x".repeat(81))).toMatch(/2–80/);
    expect(validateDisplayName("<script>")).toMatch(/aren't allowed/);
    expect(validateDisplayName("line\nbreak")).toMatch(/aren't allowed/);
  });
});

describe("validateAthleteProfile", () => {
  const ok = { sport: "Basketball", position: "PG", state: "tx", gradYear: "2027" };
  it("normalises valid input", () => {
    expect(validateAthleteProfile(ok)).toEqual({ ok: true, value: { sport: "Basketball", position: "PG", state: "TX", gradYear: 2027 } });
    expect(validateAthleteProfile({ ...ok, position: "", state: "", gradYear: "" })).toEqual({ ok: true, value: { sport: "Basketball", position: null, state: null, gradYear: null } });
  });
  it("rejects invalid fields", () => {
    for (const bad of [{ sport: "" }, { state: "Texas" }, { state: "T1" }, { gradYear: "27" }, { gradYear: "1999" }, { gradYear: "2101" }, { position: "x".repeat(51) }])
      expect(validateAthleteProfile({ ...ok, ...bad }).ok).toBe(false);
  });
});
