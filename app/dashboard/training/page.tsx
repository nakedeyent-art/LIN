import { requireAccess } from "@/lib/session";
import { Badge, Card, Disclaimer, Grid, List, Stat } from "@/components/ui";
import { weekStatuses, workout } from "@/lib/mock";
import { allowedPhases, missedSessionAlert } from "@/lib/calc";

export default async function Training({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  await requireAccess("/dashboard/training");
  const season = (await searchParams).season === "off_season" ? "off_season" : "in_season";
  const allowed = allowedPhases(season, true);
  const c = workout.current;
  const done = weekStatuses.filter((x) => x === "completed").length;
  return (
    <>
      <h1>Training &amp; Consistency</h1>
      <div className="tag">Focus: {workout.focus}</div>
      <p>
        Season mode: <Badge tone="gray">{season === "in_season" ? "In-season (HS)" : "Off-season"}</Badge>{" "}
        <a href={`?season=${season === "in_season" ? "off_season" : "in_season"}`} className="muted">switch</a>
      </p>
      <Grid>
        <Card title="Workout Plan" wide>
          {workout.phases.map((p) => {
            const ok = allowed.includes(p.phase as never);
            return <div key={p.phase} className={`phase${ok ? "" : " locked"}`}><span>{p.title}</span>
              <span>{ok ? p.detail : "Deferred to school coach (in-season)"}</span></div>;
          })}
        </Card>
        <Card title="Guided View">
          <strong>{c.exercise}</strong>
          <p>{c.sets} sets x {c.reps} reps @ {c.intensity} · Tempo {c.tempo} · Rest {c.restSec}s</p>
          <p className="muted">&ldquo;{c.cue}&rdquo;</p>
          <List items={c.checklist} />
        </Card>
        <Card title="Consistency"><Stat label="Sessions done this week" value={`${done} / ${weekStatuses.length}`} />
          {missedSessionAlert(weekStatuses) && <Badge tone="yellow">2 missed — manager alerted</Badge>}</Card>
      </Grid>
      <Disclaimer>Templates must come from CSCS/NSCA-certified professionals. In-season high-school mode limits plans to supplemental recovery, injury prevention and skill work.</Disclaimer>
    </>
  );
}
