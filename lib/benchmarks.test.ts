import { describe, expect, it } from "vitest";
import { evaluateTier, SPORT_DRILLS } from "./benchmarks";

describe("Multi-Sport Combine Benchmarks", () => {
  it("includes all core sports in SPORT_DRILLS", () => {
    expect(SPORT_DRILLS).toHaveProperty("Basketball");
    expect(SPORT_DRILLS).toHaveProperty("Football");
    expect(SPORT_DRILLS).toHaveProperty("Baseball");
    expect(SPORT_DRILLS).toHaveProperty("Soccer");
    expect(SPORT_DRILLS).toHaveProperty("Track");
    expect(SPORT_DRILLS).toHaveProperty("Volleyball");
  });

  describe("Tier Evaluation (higher is better)", () => {
    const verticalDrill = SPORT_DRILLS["Basketball"].find((d) => d.name === "Max Vertical Leap")!;

    it("evaluates D1 Power 5 for vertical >= 38 inches", () => {
      const res = evaluateTier(40, verticalDrill);
      expect(res.tier).toBe("D1 Power 5");
    });

    it("evaluates D1 Mid-Major for vertical between 34 and 37 inches", () => {
      const res = evaluateTier(35, verticalDrill);
      expect(res.tier).toBe("D1 Mid-Major");
    });

    it("evaluates D2 / D3 for vertical between 29 and 33 inches", () => {
      const res = evaluateTier(30, verticalDrill);
      expect(res.tier).toBe("D2 / D3");
    });

    it("evaluates Developmental for vertical below 29 inches", () => {
      const res = evaluateTier(26, verticalDrill);
      expect(res.tier).toBe("Developmental");
    });
  });

  describe("Tier Evaluation (lower is better)", () => {
    const dash40 = SPORT_DRILLS["Football"].find((d) => d.name === "40-Yard Dash")!;

    it("evaluates D1 Power 5 for 40-yd dash <= 4.45s", () => {
      const res = evaluateTier(4.38, dash40);
      expect(res.tier).toBe("D1 Power 5");
    });

    it("evaluates D1 Mid-Major for 40-yd dash <= 4.62s", () => {
      const res = evaluateTier(4.55, dash40);
      expect(res.tier).toBe("D1 Mid-Major");
    });

    it("evaluates D2 / D3 for 40-yd dash <= 4.85s", () => {
      const res = evaluateTier(4.75, dash40);
      expect(res.tier).toBe("D2 / D3");
    });

    it("evaluates Developmental for 40-yd dash > 4.85s", () => {
      const res = evaluateTier(5.05, dash40);
      expect(res.tier).toBe("Developmental");
    });
  });
});
