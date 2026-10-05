import { bmr, dailyCalories, macroSplit, type Macros, type Profile, type Sex } from "./calc";
import { addDays, daysBetween } from "./academics";

export const PROFILE_LABEL: Record<Profile, string> = {
  hypertrophy_power: "Hypertrophy & Power",
  lean_fast_twitch: "Lean Fast-Twitch & Aerobic Capacity",
  maintenance: "Maintenance",
};
export const PROFILES = Object.keys(PROFILE_LABEL) as Profile[];
export const ACTIVITY_LEVELS = [
  { value: 1.375, label: "Light (1–3 sessions/week)" },
  { value: 1.55, label: "Moderate (3–5 sessions/week)" },
  { value: 1.725, label: "High (6–7 sessions/week)" },
  { value: 1.9, label: "Very high (2-a-days / heavy season)" },
];

export type Metrics = { heightCm: number; weightKg: number; sex: Sex; age: number; activityFactor: number };
export type Targets = Macros & { bmr: number };

/** Targets come only from the formulas — never free-form numbers — so the minor floor (>= BMR) always applies. */
export function buildTargets(m: Metrics, profile: Profile, isMinor: boolean): Targets {
  const b = bmr(m.weightKg, m.heightCm, m.age, m.sex);
  return { bmr: b, ...macroSplit(dailyCalories(b, m.activityFactor, profile, isMinor), profile) };
}

export type DayTotals = { kcal: number; protein: number };

/** A day is compliant if calories are within ±10% of target and protein reaches at least 90% of target. */
export function dayCompliant(t: Pick<Macros, "calories" | "protein">, d: DayTotals | undefined): boolean {
  if (!d) return false;
  return Math.abs(d.kcal - t.calories) <= t.calories * 0.1 && d.protein >= t.protein * 0.9;
}

/**
 * Compliance over the last `windowDays` completed days (today excluded, since it's still in progress),
 * starting no earlier than the plan's start. Unlogged days count against you. null = no completed days yet.
 */
export function complianceRate(
  t: Pick<Macros, "calories" | "protein">, byDay: Map<string, DayTotals>, today: string, planStart: string, windowDays = 14,
): { rate: number | null; compliant: number; counted: number } {
  const start = daysBetween(addDays(today, -windowDays), planStart) > 0 ? planStart : addDays(today, -windowDays);
  let counted = 0, compliant = 0;
  for (let d = start; daysBetween(d, today) > 0; d = addDays(d, 1)) {
    counted++;
    if (dayCompliant(t, byDay.get(d))) compliant++;
  }
  return { rate: counted ? Math.round((compliant / counted) * 100) : null, compliant, counted };
}
