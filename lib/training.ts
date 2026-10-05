import { type Phase, type WorkoutStatus } from "./calc";
import { addDays, daysBetween } from "./academics";

export const PHASE_LABEL: Record<Phase, string> = {
  warmup: "Dynamic Warmup", mobility: "Mobility", plyometrics: "Plyometrics & Force Absorption",
  strength: "Strength", skill: "Sport-Specific Skill", recovery: "Recovery / Cool-down",
};
export const PHASE_ORDER: Phase[] = ["warmup", "mobility", "plyometrics", "strength", "skill", "recovery"];

export type Exercise = {
  phase: Phase; name: string; sets: number; reps: number;
  intensity?: string; tempo?: string; restSec?: number; cue?: string;
};

export type RawExercise = Partial<Record<keyof Exercise, string>>;
export type Validation = { ok: true; exercises: Exercise[] } | { ok: false; error: string };

const int = (s: string | undefined, min: number, max: number): number | null => {
  if (s === undefined || !/^\d{1,4}$/.test(s.trim())) return null;
  const n = parseInt(s, 10);
  return n >= min && n <= max ? n : null;
};

/**
 * Validates a prescribed workout. Phases outside `allowed` are rejected — that's how the in-season
 * high-school rule (no primary strength/plyometric load from third parties) is enforced server-side.
 */
export function validateWorkout(rows: RawExercise[], allowed: Phase[]): Validation {
  const out: Exercise[] = [];
  for (const [i, r] of rows.entries()) {
    const name = (r.name ?? "").trim();
    if (!name) continue; // blank rows are ignored
    const n = i + 1;
    if (!PHASE_ORDER.includes(r.phase as Phase)) return { ok: false, error: `Exercise ${n}: choose a phase.` };
    const phase = r.phase as Phase;
    if (!allowed.includes(phase))
      return { ok: false, error: `Exercise ${n}: ${PHASE_LABEL[phase]} can't be prescribed right now (in-season high-school athletes are limited to warm-up, mobility, skill and recovery work).` };
    if (name.length > 80) return { ok: false, error: `Exercise ${n}: name is too long.` };
    const sets = int(r.sets, 1, 10), reps = int(r.reps, 1, 100);
    if (sets === null) return { ok: false, error: `Exercise ${n}: sets must be 1–10.` };
    if (reps === null) return { ok: false, error: `Exercise ${n}: reps must be 1–100.` };
    const e: Exercise = { phase, name, sets, reps };
    if (r.intensity?.trim()) e.intensity = r.intensity.trim().slice(0, 40);
    if (r.tempo?.trim()) e.tempo = r.tempo.trim().slice(0, 20);
    if (r.cue?.trim()) e.cue = r.cue.trim().slice(0, 200);
    if (r.restSec?.trim()) {
      const rest = int(r.restSec, 0, 600);
      if (rest === null) return { ok: false, error: `Exercise ${n}: rest must be 0–600 seconds.` };
      e.restSec = rest;
    }
    out.push(e);
  }
  if (!out.length) return { ok: false, error: "Add at least one exercise." };
  if (out.length > 20) return { ok: false, error: "A workout can have at most 20 exercises." };
  out.sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));
  return { ok: true, exercises: out };
}

/** Assigned workouts whose date has passed are missed (no cron needed). */
export function effectiveStatus(status: WorkoutStatus, scheduledDate: string, today: string): WorkoutStatus {
  return (status === "assigned" || status === "in_progress") && daysBetween(scheduledDate, today) > 0 ? "missed" : status;
}

export const adherenceOf = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 1000) / 10 : 0);

export type WorkoutRow = { status: WorkoutStatus; scheduledDate: string; adherence: number | null };

/** Mean adherence over workouts scheduled in the last `days` days that are already due (completed or missed). */
export function adherenceStats(rows: WorkoutRow[], today: string, days = 14) {
  const from = addDays(today, -(days - 1));
  let due = 0, completed = 0, missed = 0, sum = 0;
  for (const r of rows) {
    if (daysBetween(from, r.scheduledDate) < 0 || daysBetween(r.scheduledDate, today) < 0) continue;
    const st = effectiveStatus(r.status, r.scheduledDate, today);
    if (st === "completed") { due++; completed++; sum += r.adherence ?? 0; }
    else if (st === "missed") { due++; missed++; }
  }
  return { due, completed, missed, rate: due ? Math.round(sum / due) : null };
}

/** Statuses of workouts scheduled in the last 7 days, for the "2 missed this week" alert. */
export const lastWeekStatuses = (rows: WorkoutRow[], today: string): WorkoutStatus[] =>
  rows.filter((r) => daysBetween(r.scheduledDate, today) >= 0 && daysBetween(r.scheduledDate, today) <= 6)
      .map((r) => effectiveStatus(r.status, r.scheduledDate, today));

export const canPrescribe = (role: string, declaredRole: string | null, credential: string | null): boolean =>
  !!credential?.trim() && (role === "trainer" || (role === "manager" && declaredRole === "certified_strength_coach"));
