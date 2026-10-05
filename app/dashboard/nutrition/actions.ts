"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { prescriberInfo, subjectFor } from "@/lib/access";
import { ageFromBirthDate } from "@/lib/crypto";
import { addDays, daysBetween, todayStr } from "@/lib/academics";
import { ACTIVITY_LEVELS, buildTargets, PROFILES } from "@/lib/nutrition";
import { canPrescribe } from "@/lib/training";
import { parseBounded as num } from "@/lib/validation";
import type { Profile } from "@/lib/calc";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const back = (athlete: string | null, key: "msg" | "error", m: string): never =>
  redirect(`/dashboard/nutrition?${athlete ? `athlete=${athlete}&` : ""}${key}=${encodeURIComponent(m)}`);
/** Metrics are the athlete's own data: editable by the athlete or a linked guardian, no one else. */
export async function saveMetrics(formData: FormData) {
  const s = await requireAccess("/dashboard/nutrition");
  const athleteId = str(formData, "athlete_id");
  const sub = UUID.test(athleteId) ? await subjectFor(s, athleteId) : null;
  if (!sub || !["self", "parent"].includes(sub.relationship)) back(null, "error", "You can't edit these details.");
  const h = num(str(formData, "height_cm"), 100, 250, 1), w = num(str(formData, "weight_kg"), 25, 250, 1);
  const sex = str(formData, "sex"), act = parseFloat(str(formData, "activity_factor"));
  if (h === null) back(sub!.id, "error", "Height must be 100–250 cm.");
  if (w === null) back(sub!.id, "error", "Weight must be 25–250 kg.");
  if (!["male", "female"].includes(sex)) back(sub!.id, "error", "Choose a sex for the BMR formula.");
  if (!ACTIVITY_LEVELS.some((a) => a.value === act)) back(sub!.id, "error", "Choose an activity level.");
  await db().query("UPDATE athlete_profiles SET height_cm=$2, weight_kg=$3, sex=$4, activity_factor=$5 WHERE user_id=$1", [sub!.id, h, w, sex, act]);
  back(sub!.id, "msg", "Details saved.");
}

/** Plans are computed by formula from the saved metrics — nobody types calorie numbers, so the minor floor always applies. */
export async function setPlan(formData: FormData) {
  const s = await requireAccess("/dashboard/nutrition");
  const athleteId = str(formData, "athlete_id");
  const sub = UUID.test(athleteId) ? await subjectFor(s, athleteId) : null;
  const profile = str(formData, "profile") as Profile;
  if (!sub || !sub.health) back(null, "error", "You can't set a plan for this athlete.");
  const me = sub!.relationship;
  if (me !== "self" && me !== "parent") {
    const p = await prescriberInfo(s.userId);
    if (!["trainer", "manager"].includes(me) || !canPrescribe(s.role, p.declaredRole, p.credential)) back(sub!.id, "error", "Only the athlete, a guardian, or a credentialed trainer/certified coach can set a plan.");
  }
  if (!PROFILES.includes(profile)) back(sub!.id, "error", "Choose a performance profile.");
  const m = (await db().query(
    "SELECT height_cm::float8 AS h, weight_kg::float8 AS w, sex, activity_factor::float8 AS a, birth_date::text AS b FROM athlete_profiles WHERE user_id=$1", [sub!.id])).rows[0];
  if (!m?.h || !m?.w || !m?.sex) back(sub!.id, "error", "Add height, weight and sex first (the athlete or a guardian can do this).");
  const age = ageFromBirthDate(m.b)!;
  const t = buildTargets({ heightCm: m.h, weightKg: m.w, sex: m.sex, age, activityFactor: m.a }, profile, sub!.minor);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE nutrition_plans SET active_until = CURRENT_DATE WHERE athlete_id=$1 AND active_until IS NULL", [sub!.id]);
    await client.query(
      `INSERT INTO nutrition_plans(athlete_id, prescribed_by, target_calories, protein_grams, carbs_grams, fats_grams, target_body_profile, bmr_kcal, activity_factor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [sub!.id, s.userId, t.calories, t.protein, t.carbs, t.fats, profile, t.bmr, m.a]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  back(sub!.id, "msg", "Plan updated.");
}

export async function logMeal(formData: FormData) {
  const s = await requireAccess("/dashboard/nutrition");
  if (s.role !== "athlete") back(null, "error", "Only the athlete logs meals.");
  const name = str(formData, "meal_name");
  const day = str(formData, "logged_on") || todayStr(), today = todayStr();
  const kcal = num(str(formData, "calories"), 0, 6000, 0), p = num(str(formData, "protein"), 0, 500, 0),
        c = num(str(formData, "carbs"), 0, 1000, 0), f = num(str(formData, "fats"), 0, 500, 0);
  if (name.length < 2 || name.length > 80) back(null, "error", "Name the meal (2–80 characters).");
  if (kcal === null || p === null || c === null || f === null) back(null, "error", "Enter whole numbers for calories and grams of protein, carbs and fats.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || daysBetween(day, today) < 0 || daysBetween(day, today) > 7) back(null, "error", "Date must be within the last 7 days.");
  await db().query(
    "INSERT INTO food_logs(athlete_id, meal_name, calories, protein_grams, carbs_grams, fats_grams, logged_on) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [s.userId, name, kcal, p, c, f, day]);
  back(null, "msg", "Meal logged.");
}

export async function deleteMeal(formData: FormData) {
  const s = await requireAccess("/dashboard/nutrition");
  const id = str(formData, "id");
  if (s.role === "athlete" && UUID.test(id)) await db().query("DELETE FROM food_logs WHERE id=$1 AND athlete_id=$2", [id, s.userId]);
  back(null, "msg", "Meal removed.");
}
