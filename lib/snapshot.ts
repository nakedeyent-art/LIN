import { db } from "./db";
import type { Subject } from "./access";
import { addDays, avgGrade, courseTrends, weeklyStudy } from "./academics";
import { eligibilityGate, gradeAlerts, missedSessionAlert, type Alert } from "./calc";
import { complianceRate } from "./nutrition";
import { adherenceStats, lastWeekStatuses } from "./training";

export type Snapshot = {
  id: string; name: string; minor: boolean; relationship: Subject["relationship"];
  academics?: { alerts: Alert[]; gate: boolean; avg: number | null; verifiedMinutes: number; courses: number };
  health?: { adherence: number | null; due: number; missedWeek: boolean; compliance: number | null; hasPlan: boolean; next: { day: string; title: string } | null };
};

/**
 * Dashboard rollups for many athletes using a handful of batched queries (not one per athlete).
 * Only the parts the viewer is permitted to see (subject.academics / subject.health) are loaded or returned.
 */
export async function snapshots(subjects: Subject[], today: string): Promise<Snapshot[]> {
  const aIds = subjects.filter((s) => s.academics).map((s) => s.id);
  const hIds = subjects.filter((s) => s.health).map((s) => s.id);
  const q = async (sql: string, ids: string[], ...p: unknown[]) => (ids.length ? (await db().query(sql, [ids, ...p])).rows : []);

  const [grades, study, workouts, plans, meals] = await Promise.all([
    q("SELECT athlete_id, course_name, current_grade::float8 AS grade, logged_at FROM academic_logs WHERE athlete_id = ANY($1::uuid[])", aIds),
    q("SELECT athlete_id, minutes, studied_on::text AS on, verified_at FROM study_sessions WHERE athlete_id = ANY($1::uuid[]) AND studied_on >= $2", aIds, addDays(today, -7)),
    q("SELECT athlete_id, title, scheduled_date::text AS day, status, adherence_score::float8 AS adherence FROM athlete_workouts WHERE athlete_id = ANY($1::uuid[]) AND scheduled_date BETWEEN $2 AND $3 ORDER BY scheduled_date",
      hIds, addDays(today, -14), addDays(today, 30)),
    q(`SELECT DISTINCT ON (athlete_id) athlete_id, target_calories, protein_grams, created_at::date::text AS started FROM nutrition_plans
        WHERE athlete_id = ANY($1::uuid[]) AND active_until IS NULL ORDER BY athlete_id, created_at DESC`, hIds),
    q("SELECT athlete_id, logged_on::text AS day, calories, protein_grams FROM food_logs WHERE athlete_id = ANY($1::uuid[]) AND logged_on >= $2", hIds, addDays(today, -14)),
  ]);
  const by = <T extends { athlete_id: string }>(rows: T[], id: string) => rows.filter((r) => r.athlete_id === id);

  return subjects.map((s): Snapshot => {
    const snap: Snapshot = { id: s.id, name: s.name, minor: s.minor, relationship: s.relationship };
    if (s.academics) {
      const courses = courseTrends(by(grades, s.id).map((g) => ({ course: g.course_name, grade: g.grade, at: g.logged_at })));
      const alerts = gradeAlerts(courses);
      const wk = weeklyStudy(by(study, s.id).map((x) => ({ minutes: x.minutes, studiedOn: x.on, verified: !!x.verified_at })), today);
      snap.academics = {
        alerts, avg: avgGrade(courses), courses: courses.length, verifiedMinutes: wk.verified,
        gate: courses.length > 0 && eligibilityGate(wk.verified, wk.verified > 0, alerts.filter((a) => a.level === "red").length),
      };
    }
    if (s.health) {
      const ws = by(workouts, s.id), wr = ws.map((w) => ({ status: w.status, scheduledDate: w.day, adherence: w.adherence }));
      const st = adherenceStats(wr, today);
      const plan = plans.find((p) => p.athlete_id === s.id);
      const days = new Map<string, { kcal: number; protein: number }>();
      for (const m of by(meals, s.id)) { const d = days.get(m.day) ?? { kcal: 0, protein: 0 }; d.kcal += m.calories; d.protein += m.protein_grams; days.set(m.day, d); }
      const next = ws.find((w) => w.day >= today && w.status === "assigned");
      snap.health = {
        adherence: st.rate, due: st.due, missedWeek: missedSessionAlert(lastWeekStatuses(wr, today)), hasPlan: !!plan,
        compliance: plan ? complianceRate({ calories: plan.target_calories, protein: plan.protein_grams }, days, today, plan.started).rate : null,
        next: next ? { day: next.day, title: next.title } : null,
      };
    }
    return snap;
  });
}
