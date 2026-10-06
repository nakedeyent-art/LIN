import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { pickSubject } from "@/lib/access";
import { Badge, Card, Disclaimer, Grid, Stat } from "@/components/ui";
import { avgGrade, courseTrends, todayStr, weeklyStudy, addDays } from "@/lib/academics";
import { ACADEMIC_GATE_MIN_STUDY_MINUTES, eligibilityGate, gradeAlerts } from "@/lib/calc";
import { addGrade, deleteGrade, deleteStudy, logStudy, verifyStudy } from "./actions";

export default async function Academics({ searchParams }: { searchParams: Promise<{ athlete?: string; msg?: string; error?: string }> }) {
  const s = await requireAccess("/dashboard/academics");
  const q = await searchParams;
  const { subjects, selected } = await pickSubject(s, "academics", q.athlete);
  const today = todayStr();

  if (!selected) return (<><h1>Academic Monitoring</h1>
    <p className="muted">No athletes have shared academics with you yet. Athletes (or their parents) can invite you from the Team page.</p></>);

  const logs = (await db().query("SELECT id, course_name, current_grade::float8 AS grade, logged_at FROM academic_logs WHERE athlete_id=$1 ORDER BY logged_at DESC", [selected.id])).rows;
  const sessions = (await db().query(
    `SELECT ss.id, ss.minutes, ss.subject, ss.note, ss.studied_on::text AS on, ss.verified_at, v.full_name AS verifier
       FROM study_sessions ss LEFT JOIN users v ON v.id = ss.verified_by
      WHERE ss.athlete_id=$1 AND ss.studied_on >= $2 ORDER BY ss.studied_on DESC, ss.created_at DESC`, [selected.id, addDays(today, -14)])).rows;

  const courses = courseTrends(logs.map((l) => ({ course: l.course_name, grade: l.grade, at: l.logged_at })));
  const alerts = gradeAlerts(courses);
  const reds = alerts.filter((a) => a.level === "red").length;
  const wk = weeklyStudy(sessions.map((x) => ({ minutes: x.minutes, studiedOn: x.on, verified: !!x.verified_at })), today);
  const cleared = courses.length > 0 && eligibilityGate(wk.verified, wk.verified > 0, reds);
  const avg = avgGrade(courses);
  const me = selected.relationship === "self";
  const canVerify = selected.guardianPowers || selected.relationship === "manager";
  const qs = (id: string) => `?athlete=${id}`;

  return (
    <>
      <h1>Academic Monitoring</h1>
      <div className="tag">Eligibility protects playing time and NIL value. {!me && <>Viewing <strong>{selected.name}</strong>.</>}</div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      {subjects.length > 1 && <p>{subjects.map((x) => <Link key={x.id} href={qs(x.id)} className={`btn${x.id === selected.id ? "" : " ghost"}`} style={{ marginRight: 8 }}>{x.name}</Link>)}</p>}
      <Grid>
        <Card title="Courses" wide>
          {courses.length === 0 ? <p className="muted">{me ? "No grades yet. Add your current grade for each class below." : "No grades entered yet."}</p> : (
            <table><thead><tr><th>Course</th><th>Grade</th><th>Change</th></tr></thead><tbody>
              {courses.map((c) => { const d = c.previousGrade === undefined ? null : Math.round((c.grade - c.previousGrade) * 10) / 10;
                return <tr key={c.name}><td>{c.name}</td><td>{c.grade}%</td><td>{d === null ? "—" : d > 0 ? `+${d}` : d}</td></tr>; })}
            </tbody></table>)}
        </Card>
        <Card title="Alerts">{alerts.length ? alerts.map((a) => <p key={a.message}><Badge tone={a.level === "red" ? "red" : "yellow"}>{a.level}</Badge> {a.message}</p>) : <p>{courses.length ? "No alerts." : "—"}</p>}
          <p className="muted">Default thresholds: warn below 78%, ineligible below 70% — set by your school/association.</p></Card>
        <Card title="Weekend Competition Gate"><Badge tone={cleared ? "green" : "red"}>{cleared ? "Cleared" : "Not cleared"}</Badge>
          <p className="muted">Needs {ACADEMIC_GATE_MIN_STUDY_MINUTES}+ verified study minutes in the last 7 days and no red grade alerts.</p></Card>
        <Card title="Last 7 days"><Stat label="Verified study minutes" value={String(wk.verified)} hint={`${wk.total} logged in total`} />
          {avg !== null && <Stat label="Average grade" value={`${avg}%`} />}</Card>
        <Card title="Study log" wide>
          {sessions.length === 0 ? <p className="muted">Nothing logged in the last 14 days.</p> : (
            <table><thead><tr><th>Date</th><th>Subject</th><th>Min</th><th>Proof</th><th></th></tr></thead><tbody>
              {sessions.map((x) => <tr key={x.id}><td>{x.on}</td><td>{x.subject}{x.note && <div className="muted">{x.note}</div>}</td><td>{x.minutes}</td>
                <td>{x.verified_at ? <Badge tone="green">Verified by {x.verifier}</Badge> : <Badge tone="gray">Unverified</Badge>}</td>
                <td>{canVerify && !x.verified_at && <form action={verifyStudy}><input type="hidden" name="id" value={x.id} /><button className="btn" type="submit">Verify</button></form>}
                  {me && !x.verified_at && <form action={deleteStudy}><input type="hidden" name="id" value={x.id} /><button className="btn ghost" type="submit">Remove</button></form>}</td></tr>)}
            </tbody></table>)}
        </Card>
        {me && <>
          <Card title="Add / update a grade">
            <form action={addGrade} style={{ display: "grid", gap: 8 }}>
              <input type="text" name="course" placeholder="Course (e.g. Core Math)" required />
              <input type="text" name="grade" placeholder="Current grade % (e.g. 82.5)" inputMode="decimal" required />
              <button className="btn" type="submit">Save grade</button></form>
            {logs.length > 0 && <details style={{ marginTop: 12 }}><summary className="muted">History</summary>
              <table><tbody>{logs.slice(0, 15).map((l) => <tr key={l.id}><td>{l.course_name}</td><td>{l.grade}%</td>
                <td><form action={deleteGrade}><input type="hidden" name="id" value={l.id} /><button className="btn ghost" type="submit">Delete</button></form></td></tr>)}</tbody></table></details>}
          </Card>
          <Card title="Log a study session">
            <form action={logStudy} style={{ display: "grid", gap: 8 }}>
              <input type="text" name="subject" placeholder="Subject" required />
              <input type="text" name="minutes" placeholder="Minutes (5–480)" inputMode="numeric" required />
              <input type="date" name="studied_on" defaultValue={today} min={addDays(today, -7)} max={today} />
              <input type="text" name="note" placeholder="What you worked on (optional)" maxLength={300} />
              <button className="btn" type="submit">Log session</button></form>
            <p className="muted">Only time verified by a parent/guardian or manager counts toward the gate.</p>
          </Card></>}
      </Grid>
      {!me && <Disclaimer>This information was shared with you by the athlete{selected.minor ? " and their parent/guardian" : ""}. Keep it confidential.</Disclaimer>}
    </>
  );
}
