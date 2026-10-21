import { describe, expect, it } from "vitest";
import { calculateReadinessScore, getReadinessStatus } from "./readiness";

describe("Athletic Daily Readiness & Recovery Algorithm", () => {
  it("scores 100% for pristine sleep, low soreness, low stress, high motivation", () => {
    const score = calculateReadinessScore({
      sleepHours: 8.5,
      sleepQuality: 5,
      muscleSoreness: 1, // 1 = completely fresh
      mentalStress: 1, // 1 = calm
      motivation: 5, // 5 = high
    });
    expect(score).toBe(100);

    const status = getReadinessStatus(score);
    expect(status.label).toBe("Optimal / Game Ready");
    expect(status.tone).toBe("green");
  });

  it("scores low and flags 'Fatigued / High Stress' when sleep is low and soreness/stress are high", () => {
    const score = calculateReadinessScore({
      sleepHours: 4,
      sleepQuality: 1,
      muscleSoreness: 5, // very sore
      mentalStress: 5, // very stressed
      motivation: 1, // low motivation
    });
    // 4/8 * 25 = 12.5; quality: 1/5 * 20 = 4; soreness: (6-5)/5 * 20 = 4; stress: (6-5)/5 * 20 = 4; mot: 1/5 * 15 = 3 => 27.5 ~ 28
    expect(score).toBeLessThan(40);

    const status = getReadinessStatus(score);
    expect(status.label).toBe("Fatigued / High Stress");
    expect(status.tone).toBe("yellow");
    expect(status.advice).toContain("Intervention recommended");
  });

  it("handles middle-tier scores (60-79%) as 'Moderate / Normal'", () => {
    const score = calculateReadinessScore({
      sleepHours: 7,
      sleepQuality: 4,
      muscleSoreness: 3,
      mentalStress: 3,
      motivation: 3,
    });
    expect(score).toBeGreaterThanOrEqual(60);
    expect(score).toBeLessThan(80);

    const status = getReadinessStatus(score);
    expect(status.label).toBe("Moderate / Normal");
    expect(status.tone).toBe("blue");
  });

  it("clamps out-of-range values gracefully", () => {
    const scoreOver = calculateReadinessScore({
      sleepHours: 15,
      sleepQuality: 10,
      muscleSoreness: -5,
      mentalStress: -5,
      motivation: 10,
    });
    expect(scoreOver).toBeLessThanOrEqual(100);

    const scoreUnder = calculateReadinessScore({
      sleepHours: -5,
      sleepQuality: 0,
      muscleSoreness: 10,
      mentalStress: 10,
      motivation: 0,
    });
    expect(scoreUnder).toBeGreaterThanOrEqual(0);
  });
});
