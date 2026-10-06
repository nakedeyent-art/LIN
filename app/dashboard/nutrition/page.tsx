import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { canEditFamily, pickSubject, prescriberInfo } from "@/lib/access";
import { Badge, Card, Disclaimer, Grid, Stat } from "@/components/ui";
import { addDays, todayStr } from "@/lib/academics";
import { ACTIVITY_LEVELS, complianceRate, PROFILE_LABEL, PROFILES } from "@/lib/nutrition";
import { canPrescribe } from "@/lib/training";
import { deleteMeal, logMeal, saveMetrics, setPlan } from "./actions";

const sel = { padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)" } as const;

export default async function Nutrition({ searchParams }: { searchParams: Promise<{ athlete?: string; msg?: string; error?: string }> }) {
  const s = await requireAccess("/dashboard/nutrition");
  const q = await searchParams;
  const { subjects, selected } = await pickSubject(s, "health", q.athlete);
  const today = todayStr();
  if (!selected) return (<><h1>Competition Nutrition</h1><p className="muted">No athletes have shared nutrition with you yet. Athletes (or their parents) can invite you from the Team page.</p></>);

  const prof = (await db().query(
    "SELECT height_cm::float8 AS h, weight_kg::float8 AS w, sex, activity_factor::float8 AS a FROM athlete_profiles WHERE user_id=$1", [selected.id])).rows[0];
  const plan = (await db().query(
    `SELECT p.target_calories, p.protein_grams, p.carbs_grams, p.fats_grams, p.target_body_profile AS profile, p.bmr_kcal, p.created_at, p.created_at::date::text AS started, u.full_name AS by
       FROM nutrition_plans p LEFT JOIN users u ON u.id = p.prescribed_by WHERE p.athlete_id=$1 AND p.active_until IS NULL ORDER BY p.created_at DESC LIMIT 1`, [selected.id])).rows[0];
  const meals = (await db().query(
    "SELECT id, meal_name, calories, protein_grams, carbs_grams, fats_grams, logged_on::text AS day FROM food_logs WHERE athlete_id=$1 AND logged_on >= $2 ORDER BY logged_on DESC, logged_at DESC", [selected.id, addDays(today, -14)])).rows;

  const byDay = new Map<string, { kcal: number; protein: number }>();
  for (const m of meals) { const d = byDay.get(m.day) ?? { kcal: 0, protein: 0 }; d.kcal += m.calories; d.protein += m.protein_grams; byDay.set(m.day, d); }
  const comp = plan ? complianceRate({ calories: plan.target_calories, protein: plan.protein_grams }, byDay, today, plan.started) : null;
  const todayTotals = byDay.get(today);

  const me = selected.relationship;
  const own = me === "self", family = canEditFamily(selected);
  const p = !family && ["trainer", "manager"].includes(me) ? await prescriberInfo(s.userId) : null;
  const canSetPlan = family || (p && canPrescribe(s.role, p.declaredRole, p.credential));
  const qs = (id: string) => `?athlete=${id}`;

  return (
    <>
      <h1>Competition Nutrition</h1>
      <div className="tag">{plan ? `Target profile: ${PROFILE_LABEL[plan.profile as keyof typeof PROFILE_LABEL]}` : "Set your details and a performance profile to get daily targets."}{!own && <> · Viewing <strong>{selected.name}</strong></>}</div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      {subjects.length > 1 && <p>{subjects.map((x) => <Link key={x.id} href={qs(x.id)} className={`btn${x.id === selected.id ? "" : " ghost"}`} style={{ marginRight: 8 }}>{x.name}</Link>)}</p>}
      <Grid>
        <Card title="Daily Targets">
          {plan ? <>
            <Stat label="Calories" value={String(plan.target_calories)} hint={`BMR ${plan.bmr_kcal} kcal × activity`} />
            <Stat label="Protein / Carbs / Fats" value={`${plan.protein_grams}g / ${plan.carbs_grams}g / ${plan.fats_grams}g`} />
            <p className="muted">Set {plan.started} by {plan.by ?? "—"}{!own && ""}.</p></> : <p className="muted">No plan yet.</p>}
        </Card>
        <Card title="Compliance (last 14 days)">
          {comp?.rate != null ? <Stat label="Days on target" value={`${comp.rate}%`} hint={`${comp.compliant} of ${comp.counted} completed days (calories ±10%, protein ≥ 90%)`} />
            : <p className="muted">{plan ? "Starts after your first completed day." : "Needs a plan first."}</p>}
          {plan && <Stat label="Today so far" value={todayTotals ? `${todayTotals.kcal} kcal` : "—"} hint={todayTotals ? `${todayTotals.protein}g protein` : "nothing logged yet"} />}
        </Card>
        <Card title="Body details">
          {prof?.h ? <p>{prof.h} cm · {prof.w} kg · {prof.sex} · activity ×{prof.a}</p> : <p className="muted">Not entered yet.</p>}
          {family && (
            <form action={saveMetrics} style={{ display: "grid", gap: 8, marginTop: 8 }}>
              <input type="hidden" name="athlete_id" value={selected.id} />
              <input type="text" name="height_cm" placeholder="Height (cm)" defaultValue={prof?.h ?? ""} inputMode="decimal" required />
              <input type="text" name="weight_kg" placeholder="Weight (kg)" defaultValue={prof?.w ?? ""} inputMode="decimal" required />
              <select name="sex" style={sel} defaultValue={prof?.sex ?? ""} required><option value="" disabled>Sex (for BMR formula)</option><option value="male">Male</option><option value="female">Female</option></select>
              <select name="activity_factor" style={sel} defaultValue={String(prof?.a ?? 1.55)}>{ACTIVITY_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
              <button className="btn" type="submit">Save details</button></form>)}
        </Card>
        {canSetPlan && (
          <Card title="Performance profile">
            <form action={setPlan} style={{ display: "grid", gap: 8 }}>
              <input type="hidden" name="athlete_id" value={selected.id} />
              <select name="profile" style={sel} defaultValue={plan?.profile ?? "maintenance"}>{PROFILES.map((x) => <option key={x} value={x}>{PROFILE_LABEL[x]}</option>)}</select>
              <button className="btn" type="submit">{plan ? "Update targets" : "Create targets"}</button></form>
            <p className="muted">Targets are calculated from the saved details. For athletes under 18, calories never go below their BMR.</p>
          </Card>)}
        <Card title="Food log" wide>
          {meals.length === 0 ? <p className="muted">No meals logged in the last 14 days.</p> : (
            <table><thead><tr><th>Date</th><th>Meal</th><th>kcal</th><th>P / C / F (g)</th><th></th></tr></thead><tbody>
              {meals.slice(0, 40).map((m) => <tr key={m.id}><td>{m.day}</td><td>{m.meal_name}</td><td>{m.calories}</td><td>{m.protein_grams} / {m.carbs_grams} / {m.fats_grams}</td>
                <td>{own && <form action={deleteMeal}><input type="hidden" name="id" value={m.id} /><button className="btn ghost" type="submit">Remove</button></form>}</td></tr>)}
            </tbody></table>)}
        </Card>
        {own && (
          <Card title="Log a meal" wide>
            <form action={logMeal} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
              <input type="text" name="meal_name" placeholder="Meal (e.g. Chicken, rice, vegetables)" required />
              <input type="text" name="calories" placeholder="Calories" inputMode="numeric" required />
              <input type="text" name="protein" placeholder="Protein (g)" inputMode="numeric" required />
              <input type="text" name="carbs" placeholder="Carbs (g)" inputMode="numeric" required />
              <input type="text" name="fats" placeholder="Fats (g)" inputMode="numeric" required />
              <input type="date" name="logged_on" defaultValue={today} min={addDays(today, -7)} max={today} />
              <button className="btn" type="submit">Log meal</button></form>
            <p className="muted">Photo logging with AI macro estimates is planned; for now enter the numbers from the package or an app.</p>
          </Card>)}
      </Grid>
      <Disclaimer>Educational guidance only, not medical advice. Targets are formula-based estimates; talk to a Registered Dietitian or physician before major changes, especially for athletes under 18.</Disclaimer>
    </>
  );
}
