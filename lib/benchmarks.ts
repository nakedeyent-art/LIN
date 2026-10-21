/**
 * Multi-sport athletic combine drills and collegiate recruiting tier evaluation.
 * Benchmarks based on NCAA D1 Power 5, D1 Mid-Major, and D2/D3 combine testing data.
 */

export type BenchmarkTierName = "D1 Power 5" | "D1 Mid-Major" | "D2 / D3" | "Developmental";

export type BenchmarkTier = {
  tier: BenchmarkTierName;
  color: string;
};

export type Drill = {
  name: string;
  unit: string;
  lowerIsBetter?: boolean;
  d1Elite: number;
  d1Avg: number;
  d2Avg: number;
  hint: string;
};

export const SPORT_DRILLS: Record<string, Drill[]> = {
  Basketball: [
    { name: "Max Vertical Leap", unit: "inches", d1Elite: 38, d1Avg: 34, d2Avg: 29, hint: "Measured from stationary 2-step approach" },
    { name: "Standing Vertical", unit: "inches", d1Elite: 32, d1Avg: 28, d2Avg: 24, hint: "No-step vertical jump reach" },
    { name: "Lane Agility", unit: "seconds", lowerIsBetter: true, d1Elite: 10.8, d1Avg: 11.4, d2Avg: 12.2, hint: "Full key figure-8 sprint and slide" },
    { name: "3/4 Court Sprint", unit: "seconds", lowerIsBetter: true, d1Elite: 3.15, d1Avg: 3.32, d2Avg: 3.55, hint: "Baseline to opposite free throw line" },
    { name: "Standing Reach", unit: "inches", d1Elite: 106, d1Avg: 100, d2Avg: 94, hint: "One-arm overhead fingertip reach" },
  ],
  Football: [
    { name: "40-Yard Dash", unit: "seconds", lowerIsBetter: true, d1Elite: 4.45, d1Avg: 4.62, d2Avg: 4.85, hint: "Laser-timed electronic sprint" },
    { name: "20-Yard Shuttle (5-10-5)", unit: "seconds", lowerIsBetter: true, d1Elite: 4.1, d1Avg: 4.28, d2Avg: 4.5, hint: "Lateral agility and change of direction" },
    { name: "Broad Jump", unit: "inches", d1Elite: 122, d1Avg: 114, d2Avg: 104, hint: "Standing horizontal explosive power" },
    { name: "3-Cone L-Drill", unit: "seconds", lowerIsBetter: true, d1Elite: 6.85, d1Avg: 7.12, d2Avg: 7.42, hint: "Curved running and hip mobility" },
    { name: "Bench Press (225 lbs)", unit: "reps", d1Elite: 22, d1Avg: 16, d2Avg: 10, hint: "NCAA standard combine resistance" },
  ],
  Baseball: [
    { name: "60-Yard Dash", unit: "seconds", lowerIsBetter: true, d1Elite: 6.6, d1Avg: 6.85, d2Avg: 7.15, hint: "Standard scout baseline speed" },
    { name: "Exit Velocity (Tee)", unit: "mph", d1Elite: 95, d1Avg: 88, d2Avg: 82, hint: "Radar-tracked ball exit speed" },
    { name: "Throwing Velocity", unit: "mph", d1Elite: 90, d1Avg: 84, d2Avg: 78, hint: "Infield/Outfield/Fastball radar gun" },
    { name: "Pop Time (Catchers)", unit: "seconds", lowerIsBetter: true, d1Elite: 1.95, d1Avg: 2.05, d2Avg: 2.18, hint: "Glove hit to 2nd base tag" },
  ],
  Soccer: [
    { name: "30-Meter Sprint", unit: "seconds", lowerIsBetter: true, d1Elite: 3.9, d1Avg: 4.12, d2Avg: 4.35, hint: "Acceleration and linear speed" },
    { name: "Agility T-Test", unit: "seconds", lowerIsBetter: true, d1Elite: 9.5, d1Avg: 10.1, d2Avg: 10.8, hint: "Multi-directional soccer movement" },
    { name: "Yo-Yo Intermittent Recovery", unit: "level", d1Elite: 20.2, d1Avg: 18.5, d2Avg: 16.0, hint: "Aerobic match endurance capacity" },
  ],
  Track: [
    { name: "100m Dash", unit: "seconds", lowerIsBetter: true, d1Elite: 10.5, d1Avg: 10.85, d2Avg: 11.35, hint: "FAT electronic sprint" },
    { name: "400m Dash", unit: "seconds", lowerIsBetter: true, d1Elite: 47.5, d1Avg: 49.5, d2Avg: 52.0, hint: "Full lap sprint endurance" },
    { name: "Long Jump", unit: "inches", d1Elite: 288, d1Avg: 264, d2Avg: 240, hint: "Runway takeoff distance" },
  ],
  Volleyball: [
    { name: "Approach Spike Touch", unit: "inches", d1Elite: 124, d1Avg: 118, d2Avg: 111, hint: "Peak fingertip height on spike attack" },
    { name: "Block Touch Reach", unit: "inches", d1Elite: 118, d1Avg: 112, d2Avg: 105, hint: "Stationary two-handed net block jump" },
  ],
};

export function evaluateTier(val: number, drill: Drill): BenchmarkTier {
  if (drill.lowerIsBetter) {
    if (val <= drill.d1Elite) return { tier: "D1 Power 5", color: "var(--primary)" };
    if (val <= drill.d1Avg) return { tier: "D1 Mid-Major", color: "#2563eb" };
    if (val <= drill.d2Avg) return { tier: "D2 / D3", color: "var(--muted)" };
    return { tier: "Developmental", color: "var(--needs)" };
  } else {
    if (val >= drill.d1Elite) return { tier: "D1 Power 5", color: "var(--primary)" };
    if (val >= drill.d1Avg) return { tier: "D1 Mid-Major", color: "#2563eb" };
    if (val >= drill.d2Avg) return { tier: "D2 / D3", color: "var(--muted)" };
    return { tier: "Developmental", color: "var(--needs)" };
  }
}
