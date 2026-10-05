import { describe, expect, it } from "vitest";
import { avgGrade, courseTrends, weeklyStudy } from "./academics";
import { buildTargets, complianceRate, dayCompliant } from "./nutrition";
import { adherenceStats, canPrescribe, effectiveStatus, lastWeekStatuses, validateWorkout } from "./training";
import { allowedPhases, missedSessionAlert } from "./calc";

const d = (s: string) => new Date(s + "T12:00:00Z");

describe("courseTrends", () => {
  it("keeps latest + previous per course, case-insensitively", () => {
    const t = courseTrends([
      { course: "core math", grade: 83, at: d("2026-09-01") },
      { course: "Core  Math", grade: 74, at: d("2026-10-01") },
      { course: "English", grade: 91, at: d("2026-09-15") },
    ]);
    expect(t).toEqual([{ name: "Core Math", grade: 74, previousGrade: 83 }, { name: "English", grade: 91, previousGrade: undefined }]);
    expect(avgGrade(t)).toBe(82.5);
    expect(avgGrade([])).toBeNull();
  });
});

describe("weeklyStudy", () => {
  it("counts only the 7 days ending today and separates verified time", () => {
    const rows = [
      { minutes: 60, studiedOn: "2026-10-05", verified: true },
      { minutes: 45, studiedOn: "2026-09-29", verified: false },  // 6 days ago: in
      { minutes: 90, studiedOn: "2026-09-28", verified: true },   // 7 days ago: out
      { minutes: 30, studiedOn: "2026-10-06", verified: true },   // future: out
    ];
    expect(weeklyStudy(rows, "2026-10-05")).toEqual({ total: 105, verified: 60 });
  });
});

describe("nutrition", () => {
  const m = { heightCm: 185, weightKg: 80, sex: "male" as const, age: 17, activityFactor: 1.7 };
  it("builds targets from formulas and floors minors at BMR", () => {
    const t = buildTargets(m, "lean_fast_twitch", true);
    expect(t.bmr).toBe(1876);
    expect(t.calories).toBe(Math.round(1876 * 1.7));
    expect(buildTargets({ ...m, activityFactor: 0.5 }, "maintenance", true).calories).toBe(1876);
  });
  const t = { calories: 3000, protein: 200 };
  it("day compliance needs calories ±10% and protein ≥90%", () => {
    expect(dayCompliant(t, { kcal: 3100, protein: 190 })).toBe(true);
    expect(dayCompliant(t, { kcal: 3400, protein: 200 })).toBe(false);
    expect(dayCompliant(t, { kcal: 3000, protein: 150 })).toBe(false);
    expect(dayCompliant(t, undefined)).toBe(false);
  });
  it("compliance excludes today, respects plan start, and counts unlogged days against", () => {
    const by = new Map([["2026-10-03", { kcal: 3000, protein: 200 }], ["2026-10-04", { kcal: 3000, protein: 200 }]]);
    // plan began 10-02: counted days = 10-02, 10-03, 10-04 (today 10-05 excluded)
    expect(complianceRate(t, by, "2026-10-05", "2026-10-02")).toEqual({ rate: 67, compliant: 2, counted: 3 });
    expect(complianceRate(t, by, "2026-10-05", "2026-10-05").rate).toBeNull();
    // old plan: window caps at 14 completed days
    expect(complianceRate(t, by, "2026-10-05", "2026-01-01").counted).toBe(14);
  });
});

describe("workout validation", () => {
  const ok = { phase: "strength", name: "Hex Bar Deadlift", sets: "4", reps: "5", intensity: "80% 1RM", tempo: "2-0-X-1", restSec: "90", cue: "Brace" };
  it("accepts valid rows, ignores blanks, sorts by phase", () => {
    const r = validateWorkout([{ ...ok }, { phase: "warmup", name: "World's greatest stretch", sets: "2", reps: "8" }, { name: "  " }], allowedPhases("off_season", true));
    expect(r.ok && r.exercises.map((e) => e.phase)).toEqual(["warmup", "strength"]);
  });
  it("rejects strength/plyo for in-season high-schoolers", () => {
    const r = validateWorkout([{ ...ok }], allowedPhases("in_season", true));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/in-season high-school/);
    expect(validateWorkout([{ ...ok }], allowedPhases("in_season", false)).ok).toBe(true);
  });
  it("rejects bad numbers and empty workouts", () => {
    const all = allowedPhases("off_season", false);
    for (const bad of [{ sets: "0" }, { sets: "11" }, { reps: "abc" }, { reps: "101" }, { restSec: "999" }, { phase: "nope" }])
      expect(validateWorkout([{ ...ok, ...bad }], all).ok).toBe(false);
    expect(validateWorkout([], all).ok).toBe(false);
  });
});

describe("training adherence", () => {
  it("derives missed from past unfinished workouts", () => {
    expect(effectiveStatus("assigned", "2026-10-03", "2026-10-05")).toBe("missed");
    expect(effectiveStatus("assigned", "2026-10-05", "2026-10-05")).toBe("assigned");
    expect(effectiveStatus("completed", "2026-10-01", "2026-10-05")).toBe("completed");
  });
  const rows = [
    { status: "completed" as const, scheduledDate: "2026-10-04", adherence: 100 },
    { status: "completed" as const, scheduledDate: "2026-10-03", adherence: 50 },
    { status: "assigned" as const, scheduledDate: "2026-10-02", adherence: null },   // missed
    { status: "assigned" as const, scheduledDate: "2026-10-06", adherence: null },   // future: ignored
    { status: "assigned" as const, scheduledDate: "2026-09-01", adherence: null },   // outside window
  ];
  it("computes rate over due workouts in the window", () => {
    expect(adherenceStats(rows, "2026-10-05")).toEqual({ due: 3, completed: 2, missed: 1, rate: 50 });
    expect(adherenceStats([], "2026-10-05").rate).toBeNull();
  });
  it("feeds the 2-missed-this-week alert", () => {
    const week = [...rows, { status: "assigned" as const, scheduledDate: "2026-10-01", adherence: null }];
    expect(missedSessionAlert(lastWeekStatuses(rows, "2026-10-05"))).toBe(false);
    expect(missedSessionAlert(lastWeekStatuses(week, "2026-10-05"))).toBe(true);
  });
});

describe("canPrescribe", () => {
  it("needs a declared credential; managers must be certified coaches", () => {
    expect(canPrescribe("trainer", null, "CSCS")).toBe(true);
    expect(canPrescribe("trainer", null, "")).toBe(false);
    expect(canPrescribe("manager", "marketing_agent", "CSCS")).toBe(false);
    expect(canPrescribe("manager", "certified_strength_coach", "CSCS")).toBe(true);
    expect(canPrescribe("coach", null, "CSCS")).toBe(false);
  });
});
