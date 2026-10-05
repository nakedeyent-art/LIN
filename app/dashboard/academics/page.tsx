import { requireAccess } from "@/lib/session";
import { Badge, Card, Disclaimer, Grid, List, Stat } from "@/components/ui";
import { courses, studyLog } from "@/lib/mock";
import { eligibilityGate, gradeAlerts } from "@/lib/calc";

export default async function Academics() {
  const s = await requireAccess("/dashboard/academics");
  const alerts = gradeAlerts(courses);
  const reds = alerts.filter((a) => a.level === "red").length;
  const cleared = eligibilityGate(studyLog.minutesThisWeek, studyLog.proofVerified, reds);
  const gpa = (courses.reduce((t, c) => t + c.grade, 0) / courses.length).toFixed(1);
  return (
    <>
      <h1>Academic Monitoring</h1>
      <div className="tag">Eligibility protects playing time and NIL value.</div>
      <Grid>
        <Card title="Courses" wide>
          <table><thead><tr><th>Course</th><th>Grade</th><th>Trend</th></tr></thead><tbody>
            {courses.map((c) => <tr key={c.name}><td>{c.name}</td><td>{c.grade}%</td>
              <td>{c.previousGrade === undefined ? "—" : c.grade - c.previousGrade >= 0 ? `+${c.grade - c.previousGrade}` : c.grade - c.previousGrade}</td></tr>)}
          </tbody></table>
        </Card>
        <Card title="Alerts">{alerts.length ? alerts.map((a) => <p key={a.message}><Badge tone={a.level === "red" ? "red" : "yellow"}>{a.level}</Badge> {a.message}</p>) : "None"}</Card>
        <Card title="Weekend Competition Gate"><Badge tone={cleared ? "green" : "red"}>{cleared ? "Cleared" : "Not cleared"}</Badge>
          <p className="muted">Requires 90+ study min, verified proof upload, and no red grade alerts.</p></Card>
        <Card title="Accountability Log"><Stat label="Study minutes this week" value={String(studyLog.minutesThisWeek)} /><Stat label="Average grade" value={`${gpa}%`} /></Card>
        <Card title="Tools"><List items={["Sync grades: Canvas / Google Classroom / PowerSchool (planned)", "Upload report card or transcript (OCR verify, planned)", "Book a certified tutor", "Start focus timer (Pomodoro)"]} /></Card>
      </Grid>
      {(s.role === "recruiter" || s.role === "coach") && <Disclaimer>Academic detail is visible only where the athlete and guardian have granted consent.</Disclaimer>}
    </>
  );
}
