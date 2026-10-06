import { describe, expect, it } from "vitest";
import { feeBpsFromEnv, formatBps, payoutCents, platformFee } from "./money";

describe("platformFee", () => {
  it("computes basis points, rounding down", () => {
    expect(platformFee(100000, 500)).toBe(5000);
    expect(platformFee(999, 500)).toBe(49);        // 49.95 → 49: never more than stated
    expect(platformFee(1, 500)).toBe(0);
    expect(platformFee(12345, 0)).toBe(0);
  });
  it("fee + payout always equals the amount", () => {
    for (const a of [1, 7, 99, 1000, 123457, 100000000]) for (const bps of [0, 1, 250, 500, 1999, 2000])
      expect(platformFee(a, bps) + payoutCents(a, bps)).toBe(a);
  });
  it("rejects nonsense", () => {
    for (const a of [0, -1, 1.5, NaN]) expect(() => platformFee(a, 500)).toThrow();
    for (const b of [-1, 2001, 1.5, NaN]) expect(() => platformFee(1000, b)).toThrow();
  });
});

describe("feeBpsFromEnv", () => {
  it("parses valid values, defaults to 0 otherwise", () => {
    expect(feeBpsFromEnv("500")).toBe(500);
    expect(feeBpsFromEnv(" 250 ")).toBe(250);
    for (const bad of [undefined, "", "abc", "-5", "2001", "5.5", "99999"]) expect(feeBpsFromEnv(bad)).toBe(0);
  });
  it("formats", () => { expect(formatBps(500)).toBe("5%"); expect(formatBps(250)).toBe("2.50%"); expect(formatBps(0)).toBe("0%"); });
});
