import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { canEditFamily, pickSubject, prescriberInfo } from "@/lib/access";
import { Badge, Card, Disclaimer, Grid, Stat } from "@/components/ui";
import { addDays, todayStr } from "@/lib/academics";
import { allowedPhases, missedSessionAlert } from "@/lib/calc";
import { adherenceStats, canPrescribe, effectiveStatus, type Exercise, lastWeekStatuses, PHASE_LABEL, PHASE_ORDER } from "@/lib/training";
import { completeWorkout, createWorkout, deleteWorkout, setSeason } from "./actions";

const sel = { padding: 8, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)" } as const;

export default async function Training({ searchParams }: { searchParams: Promise<{ athlete?: string; msg?: string; error?: string }> }) {
  const s = await requireAccess("/dashboard/training");
  const q = await searchParams;
  const { subjects, selected } = await pickSubject(s, "health", q.athlete);
  const today = todayStr();
  if (!selected) return (<><h1>Training &amp; Consistency</h1><p className="muted">No athletes have shared training with you yet. Athletes (or their parents) can invite you from the Team page.</p></>);

  const rows = (await db().query(
    `SELECT w.id, w.title, w.focus_area, w.workout_json, w.scheduled_date::text AS day, w.status, w.adherence_score::float8 AS adherence, w.athlete_notes, w.prescribed_by, u.full_name AS by
       FROM athlete_workouts w LEFT JOIN users u ON u.id = w.prescribed_by
      WHERE w.athlete_id=$1 AND w.scheduled_date BETWEEN $2 AND $3 ORDER BY w.scheduled_date, w.created_at`, [selected.id, addDays(today, -14), addDays(today, 30)])).rows;
  const wr = rows.map((r) => ({ status: r.status, scheduledDate: r.day, adherence: r.adherence }));
  const stats = adherenceStats(wr, today), weekMissed = missedSessionAlert(lastWeekStatuses(wr, today));

  const me = selected.relationship, own = me === "self", family = canEditFamily(selected);
  const pinfo = ["trainer", "manager"].includes(me) ? await prescriberInfo(s.userId) : null;
  const prescriber = !!pinfo && canPrescribe(s.role, pinfo.declaredRole, pinfo.credential);
  const allowed = allowedPhases(selected.inSeason ? "in_season" : "off_season", selected.level === "high_school");
  const upcoming = rows.filter((r) => r.day >= today), past = rows.filter((r) => r.day < today).reverse();
  const qs = (id: string) => `?athlete=${id}`;

  const WorkoutCard = ({ r }: { r: (typeof rows)[number] }) => {
    const ex: Exercise[] = r.workout_json.exercises, st = effectiveStatus(r.status, r.day, today);
    const completable = own && r.day === today && st !== "completed" && st !== "missed";
    return (
      <Card title={`${r.day} · ${r.title}`} wide>
        <p>{r.focus_area && <>Focus: {r.focus_area} · </>}<Badge tone={st === "completed" ? "green" : st === "missed" ? "red" : "gray"}>{st}{st === "completed" && r.adherence != null ? ` ${r.adherence}%` : ""}</Badge> <span className="muted">by {r.by ?? "—"}</span></p>
        <form action={completable ? completeWorkout : undefined}>
          <input type="hidden" name="id" value={r.id} />
          {PHASE_ORDER.filter((p) => ex.some((e) => e.phase === p)).map((p) => (
            <div key={p}><strong>{PHASE_LABEL[p]}</strong>
              <ul className="list">{ex.map((e, i) => e.phase !== p ? null : (
                <li key={i}>{completable && <input type="checkbox" name={`done_${i}`} />} {e.name} — {e.sets} × {e.reps}{e.intensity ? ` @ ${e.intensity}` : ""}{e.tempo ? ` · tempo ${e.tempo}` : ""}{e.restSec != null ? ` · rest ${e.restSec}s` : ""}
                  {e.cue && <div className="muted">&ldquo;{e.cue}&rdquo;</div>}</li>))}</ul></div>))}
          {completable && <><input type="text" name="notes" placeholder="Notes (weights used, how it felt)" maxLength={500} style={{ marginBottom: 8 }} /><button className="btn" type="submit">Complete workout</button></>}
          {r.athlete_notes && <p className="muted">Athlete notes: {r.athlete_notes}</p>}
        </form>
        {r.prescribed_by === s.userId && r.status === "assigned" && r.day >= today &&
          <form action={deleteWorkout} style={{ marginTop: 8 }}><input type="hidden" name="id" value={r.id} /><button className="btn ghost" type="submit">Remove workout</button></form>}
      </Card>);
  };

  return (
    <>
      <h1>Training &amp; Consistency</h1>
      <div className="tag">{!own && <>Viewing <strong>{selected.name}</strong> · </>}Season mode: <Badge tone="gray">{selected.inSeason ? "In-season" : "Off-season"}</Badge></div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      {subjects.length > 1 && <p>{subjects.map((x) => <Link key={x.id} href={qs(x.id)} className={`btn${x.id === selected.id ? "" : " ghost"}`} style={{ marginRight: 8 }}>{x.name}</Link>)}</p>}
      <Grid>
        <Card title="Consistency (14 days)">
          {stats.rate != null ? <><Stat label="Average adherence" value={`${stats.rate}%`} hint={`${stats.completed} completed · ${stats.missed} missed`} />
            {weekMissed && <Badge tone="yellow">2+ sessions missed this week</Badge>}</> : <p className="muted">No completed or missed workouts yet.</p>}
        </Card>
        {family && (
          <Card title="Season mode">
            <form action={setSeason}><input type="hidden" name="athlete_id" value={selected.id} /><input type="hidden" name="in_season" value={selected.inSeason ? "0" : "1"} />
              <button className="btn ghost" type="submit">Switch to {selected.inSeason ? "off-season" : "in-season"}</button></form>
            <p className="muted">{selected.level === "high_school" ? "In-season, third-party coaches can only assign warm-up, mobility, skill and recovery work — the school coach owns primary load." : "No restrictions apply at this level."}</p>
          </Card>)}
        {upcoming.length === 0 && <Card title="Upcoming" wide><p className="muted">{own ? "No workouts assigned. Invite a trainer from the Team page to get a program." : "Nothing scheduled."}</p></Card>}
        {upcoming.map((r) => <WorkoutCard key={r.id} r={r} />)}
        {prescriber && (
          <Card title="Prescribe a workout" wide>
            <form action={createWorkout} style={{ display: "grid", gap: 8 }}>
              <input type="hidden" name="athlete_id" value={selected.id} />
              <input type="text" name="title" placeholder="Title (e.g. Deceleration & first-step power)" required />
              <input type="text" name="focus" placeholder="Target adaptation (optional)" />
              <input type="date" name="scheduled_date" defaultValue={today} min={today} max={addDays(today, 60)} required />
              <p className="muted">Allowed phases right now: {allowed.map((p) => PHASE_LABEL[p]).join(", ")}.</p>
              <table><thead><tr><th>Phase</th><th>Exercise</th><th>Sets</th><th>Reps</th><th>Intensity</th><th>Tempo</th><th>Rest s</th><th>Cue</th></tr></thead><tbody>
                {Array.from({ length: 8 }, (_, i) => <tr key={i}>
                  <td><select name={`ex${i}_phase`} style={sel} defaultValue={allowed.includes("strength") ? "strength" : "skill"}>{PHASE_ORDER.map((p) => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}</select></td>
                  <td><input type="text" name={`ex${i}_name`} style={{ minWidth: 150 }} /></td>
                  <td><input type="text" name={`ex${i}_sets`} size={2} /></td><td><input type="text" name={`ex${i}_reps`} size={2} /></td>
                  <td><input type="text" name={`ex${i}_intensity`} size={8} placeholder="80% 1RM" /></td><td><input type="text" name={`ex${i}_tempo`} size={6} placeholder="2-0-X-1" /></td>
                  <td><input type="text" name={`ex${i}_rest`} size={3} /></td><td><input type="text" name={`ex${i}_cue`} /></td></tr>)}
              </tbody></table>
              <button className="btn" type="submit">Assign workout</button>
            </form>
          </Card>)}
        {past.length > 0 && <Card title="Recent history" wide>
          <table><tbody>{past.map((r) => { const st = effectiveStatus(r.status, r.day, today);
            return <tr key={r.id}><td>{r.day}</td><td>{r.title}</td><td><Badge tone={st === "completed" ? "green" : "red"}>{st}</Badge></td><td>{r.adherence != null ? `${r.adherence}%` : ""}</td></tr>; })}</tbody></table></Card>}
      </Grid>
      <Disclaimer>Programs should come from certified professionals (e.g. CSCS/NSCA). Credentials are self-declared and not yet verified by LIN. Stop and consult a professional if anything hurts.</Disclaimer>
    </>
  );
}
