import { describe, expect, it } from "vitest";
import { parseBounded } from "./validation";

describe("parseBounded", () => {
  it("whole numbers (0 decimals) — the meal-log case that used to crash", () => {
    expect(parseBounded("2500", 0, 6000, 0)).toBe(2500);
    expect(parseBounded("0", 0, 6000, 0)).toBe(0);
    expect(parseBounded("9999", 0, 6000, 0)).toBeNull();
    expect(parseBounded("12.5", 0, 6000, 0)).toBeNull();
  });
  it("decimals up to the allowed places", () => {
    expect(parseBounded("185.5", 100, 250, 1)).toBe(185.5);
    expect(parseBounded("185.55", 100, 250, 1)).toBeNull();
    expect(parseBounded("99", 100, 250, 1)).toBeNull();
  });
  it("rejects junk", () => {
    for (const bad of ["", "abc", "-5", "1e3", " 5", "5 ", "1,000", "."]) expect(parseBounded(bad, 0, 10000, 1)).toBeNull();
  });
});
