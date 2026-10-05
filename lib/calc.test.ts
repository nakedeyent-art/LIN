import { describe, expect, it } from "vitest";
import {
  adherenceScore, allowedPhases, bmr, dailyCalories, eligibilityGate,
  gradeAlerts, macroSplit, missedSessionAlert,
} from "./calc";

describe("nutrition", () => {
  it("computes Mifflin-St Jeor BMR", () => {
    expect(bmr(80, 185, 17, "male")).toBe(1876); // 800+1156.25-85+5 = 1876.25
  });
  it("never sets a minor below BMR", () => {
    expect(dailyCalories(1800, 0.5, "maintenance", true)).toBe(1800);
  });
  it("macro split calories roughly reconcile", () => {
    const m = macroSplit(3000, "lean_fast_twitch");
    expect(m.protein * 4 + m.carbs * 4 + m.fats * 9).toBeGreaterThan(2980);
    expect(m.protein * 4 + m.carbs * 4 + m.fats * 9).toBeLessThan(3020);
  });
});

describe("training", () => {
  it("caps adherence at 100", () => expect(adherenceScore(100, 120)).toBe(100));
  it("alerts at 2 missed sessions", () => {
    expect(missedSessionAlert(["completed", "missed"])).toBe(false);
    expect(missedSessionAlert(["missed", "completed", "missed"])).toBe(true);
  });
  it("restricts high-school in-season to supplemental work", () => {
    const p = allowedPhases("in_season", true);
    expect(p).not.toContain("strength");
    expect(p).not.toContain("plyometrics");
    expect(allowedPhases("off_season", true)).toContain("strength");
  });
});

describe("academics", () => {
  it("raises yellow and red alerts", () => {
    const a = gradeAlerts([{ name: "Math", grade: 74 }, { name: "Chem", grade: 65 }, { name: "Eng", grade: 90 }]);
    expect(a.map((x) => x.level)).toEqual(["yellow", "red"]);
  });
  it("gates competition on study, proof and no red alerts", () => {
    expect(eligibilityGate(120, true, 0)).toBe(true);
    expect(eligibilityGate(120, false, 0)).toBe(false);
    expect(eligibilityGate(30, true, 0)).toBe(false);
    expect(eligibilityGate(120, true, 1)).toBe(false);
  });
});
