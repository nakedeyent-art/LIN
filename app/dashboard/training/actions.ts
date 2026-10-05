"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { prescriberInfo, subjectFor } from "@/lib/access";
import { addDays, daysBetween, todayStr } from "@/lib/academics";
import { allowedPhases } from "@/lib/calc";
import { adherenceOf, canPrescribe, type Exercise, type RawExercise, validateWorkout } from "@/lib/training";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const back = (athlete: string | null, key: "msg" | "error", m: string): never =>
  redirect(`/dashboard/training?${athlete ? `athlete=${athlete}&` : ""}${key}=${encodeURIComponent(m)}`);
const EXERCISE_ROWS = 8; // keep in sync with the builder form in page.tsx

export async function createWorkout(formData: FormData) {
  const s = await requireAccess("/dashboard/training");
  const athleteId = str(formData, "athlete_id");
  const sub = UUID.test(athleteId) ? await subjectFor(s, athleteId) : null;
  if (!sub || !sub.health || !["trainer", "manager"].includes(sub.relationship)) back(null, "error", "You can't prescribe workouts for this athlete.");
  const p = await prescriberInfo(s.userId);
  if (!canPrescribe(s.role, p.declaredRole, p.credential))
    back(sub!.id, "error", "Prescribing requires a declared certification (trainers) or a Certified Strength Coach declaration (managers).");

  const title = str(formData, "title"), focus = str(formData, "focus"), date = str(formData, "scheduled_date");
  const today = todayStr();
  if (title.length < 3 || title.length > 80) back(sub!.id, "error", "Title must be 3–80 characters.");
  if (focus.length > 100) back(sub!.id, "error", "Focus is too long.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || daysBetween(today, date) < 0 || daysBetween(today, date) > 60) back(sub!.id, "error", "Pick a date from today to 60 days out.");

  const rows: RawExercise[] = Array.from({ length: EXERCISE_ROWS }, (_, i) => ({
    phase: str(formData, `ex${i}_phase`) as RawExercise["phase"], name: str(formData, `ex${i}_name`), sets: str(formData, `ex${i}_sets`),
    reps: str(formData, `ex${i}_reps`), intensity: str(formData, `ex${i}_intensity`), tempo: str(formData, `ex${i}_tempo`),
    restSec: str(formData, `ex${i}_rest`), cue: str(formData, `ex${i}_cue`),
  }));
  // The in-season rule is enforced here, not just hidden in the UI.
  const v = validateWorkout(rows, allowedPhases(sub!.inSeason ? "in_season" : "off_season", sub!.level === "high_school"));
  if (!v.ok) back(sub!.id, "error", v.error);

  const sport = (await db().query("SELECT sport FROM athlete_profiles WHERE user_id=$1", [sub!.id])).rows[0]?.sport ?? "general";
  await db().query(
    `INSERT INTO athlete_workouts(athlete_id, prescribed_by, sport, focus_area, workout_json, scheduled_date, title)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`, [sub!.id, s.userId, sport, focus || null, JSON.stringify({ exercises: (v as { exercises: Exercise[] }).exercises }), date, title]);
  back(sub!.id, "msg", "Workout assigned.");
}

export async function deleteWorkout(formData: FormData) {
  const s = await requireAccess("/dashboard/training");
  const id = str(formData, "id");
  if (UUID.test(id))
    await db().query("DELETE FROM athlete_workouts WHERE id=$1 AND prescribed_by=$2 AND status='assigned' AND scheduled_date >= $3", [id, s.userId, todayStr()]);
  back(null, "msg", "Workout removed.");
}

/** Athlete checks off what they did on the day it's scheduled; adherence = share of exercises completed. */
export async function completeWorkout(formData: FormData) {
  const s = await requireAccess("/dashboard/training");
  if (s.role !== "athlete") back(null, "error", "Only the athlete completes workouts.");
  const id = str(formData, "id");
  if (!UUID.test(id)) back(null, "error", "Unknown workout.");
  const w = (await db().query("SELECT workout_json, scheduled_date::text AS d, status FROM athlete_workouts WHERE id=$1 AND athlete_id=$2", [id, s.userId])).rows[0];
  if (!w) back(null, "error", "Unknown workout.");
  const total = (w.workout_json.exercises as Exercise[]).length;
  const done = Array.from({ length: total }, (_, i) => formData.get(`done_${i}`) === "on").filter(Boolean).length;
  if (done === 0) back(null, "error", "Check off at least one exercise you completed.");
  const note = str(formData, "notes").slice(0, 500);
  const r = await db().query(
    `UPDATE athlete_workouts SET status='completed', adherence_score=$3, athlete_notes=$4, completed_at=NOW()
      WHERE id=$1 AND athlete_id=$2 AND status IN ('assigned','in_progress') AND scheduled_date = $5`,
    [id, s.userId, adherenceOf(done, total), note || null, todayStr()]);
  if (!r.rowCount) back(null, "error", "This workout can only be completed on its scheduled day.");
  back(null, "msg", `Nice work — ${adherenceOf(done, total)}% of the plan completed.`);
}

/** Season toggle: athlete or a linked guardian. Controls what third-party prescribers may assign. */
export async function setSeason(formData: FormData) {
  const s = await requireAccess("/dashboard/training");
  const athleteId = str(formData, "athlete_id");
  const sub = UUID.test(athleteId) ? await subjectFor(s, athleteId) : null;
  if (!sub || !["self", "parent"].includes(sub.relationship)) back(null, "error", "You can't change this.");
  await db().query("UPDATE athlete_profiles SET in_season=$2 WHERE user_id=$1", [sub!.id, formData.get("in_season") === "1"]);
  back(sub!.id, "msg", "Season mode updated.");
}
