/** Pure domain logic: nutrition targets, adherence, alerts, season rules. */

export type Sex = "male" | "female";
export type Profile = "hypertrophy_power" | "lean_fast_twitch" | "maintenance";

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function bmr(weightKg: number, heightCm: number, ageYears: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(base + (sex === "male" ? 5 : -161));
}

const PROFILE_ADJUST: Record<Profile, number> = {
  hypertrophy_power: 1.1,
  lean_fast_twitch: 1.0,
  maintenance: 1.0,
};

/**
 * Daily calorie target. Activity factor comes from tracked activity
 * (Apple Health / Health Connect / WHOOP) or a default multiplier.
 * Never prescribes a deficit beyond `minFloor` (safety guardrail for minors).
 */
export function dailyCalories(bmrKcal: number, activityFactor: number, profile: Profile, isMinor: boolean): number {
  const target = bmrKcal * activityFactor * PROFILE_ADJUST[profile];
  const floor = isMinor ? bmrKcal : bmrKcal * 0.9;
  return Math.round(Math.max(target, floor));
}

export type Macros = { calories: number; protein: number; carbs: number; fats: number };

const SPLITS: Record<Profile, [number, number, number]> = {
  hypertrophy_power: [0.3, 0.45, 0.25],
  lean_fast_twitch: [0.25, 0.55, 0.2],
  maintenance: [0.25, 0.5, 0.25],
};

export function macroSplit(calories: number, profile: Profile): Macros {
  const [p, c, f] = SPLITS[profile];
  return {
    calories,
    protein: Math.round((calories * p) / 4),
    carbs: Math.round((calories * c) / 4),
    fats: Math.round((calories * f) / 9),
  };
}

/** % of prescribed volume (reps x weight) actually completed, capped at 100. */
export function adherenceScore(prescribed: number, completed: number): number {
  if (prescribed <= 0) return 0;
  return Math.min(100, Math.round((completed / prescribed) * 1000) / 10);
}

export type WorkoutStatus = "assigned" | "in_progress" | "completed" | "missed";

/** Alert the manager when 2+ sessions were missed in the given week. */
export function missedSessionAlert(statuses: WorkoutStatus[]): boolean {
  return statuses.filter((s) => s === "missed").length >= 2;
}

export type Course = { name: string; grade: number; previousGrade?: number };
export type Alert = { level: "yellow" | "red"; message: string };

/** Eligibility thresholds are configurable per association; defaults are illustrative. */
export function gradeAlerts(courses: Course[], opts = { warnBelow: 78, failBelow: 70 }): Alert[] {
  const alerts: Alert[] = [];
  for (const c of courses) {
    if (c.grade < opts.failBelow) {
      alerts.push({ level: "red", message: `${c.name} at ${c.grade}% — below eligibility threshold` });
    } else if (c.grade < opts.warnBelow) {
      alerts.push({ level: "yellow", message: `${c.name} dropped to ${c.grade}% — eligibility threshold at risk` });
    } else if (c.previousGrade !== undefined && c.previousGrade - c.grade >= 8) {
      alerts.push({ level: "yellow", message: `${c.name} fell ${c.previousGrade - c.grade} pts in one period` });
    }
  }
  return alerts;
}

export type Phase = "warmup" | "plyometrics" | "strength" | "skill" | "recovery" | "mobility";
export type SeasonMode = "in_season" | "off_season";

/**
 * Season toggle: in-season, third-party managers must not dictate primary load
 * (school coach owns it) — only supplemental recovery / mobility / skill work.
 */
export function allowedPhases(mode: SeasonMode, isHighSchool: boolean): Phase[] {
  if (mode === "in_season" && isHighSchool) return ["warmup", "mobility", "recovery", "skill"];
  return ["warmup", "mobility", "plyometrics", "strength", "skill", "recovery"];
}

export const ACADEMIC_GATE_MIN_STUDY_MINUTES = 90;

/** Clear an athlete for weekend competition only if study minutes + proof are in. */
export function eligibilityGate(studyMinutes: number, proofVerified: boolean, redAlerts: number): boolean {
  return redAlerts === 0 && proofVerified && studyMinutes >= ACADEMIC_GATE_MIN_STUDY_MINUTES;
}
