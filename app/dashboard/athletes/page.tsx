import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { canOffer, displayName, type Level } from "@/lib/deals";
import { trackAthlete } from "./actions";
import { Card, Disclaimer, Grid } from "@/components/ui";

export default async function Athletes({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const s = await requireAccess("/dashboard/athletes");
  const sport = ((await searchParams).sport ?? "").trim().slice(0, 50);
  // Only opted-in, verified athletes; minors only once a guardian is linked. No email / birth date is ever selected.
  const { rows } = await db().query(
    `SELECT u.id, u.full_name, ap.sport, ap.position, ap.level, ap.state, ap.grad_year,
            ap.birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor
       FROM athlete_profiles ap JOIN users u ON u.id = ap.user_id
      WHERE ap.discoverable AND u.email_verified_at IS NOT NULL
        AND (ap.birth_date <= CURRENT_DATE - INTERVAL '18 years' OR EXISTS (
              SELECT 1 FROM athlete_relationships r WHERE r.athlete_id = u.id AND r.relationship='parent' AND r.guardian_approved))
        AND ($1 = '' OR ap.sport ILIKE $1)
      ORDER BY u.full_name LIMIT 100`, [sport]);
  return (
    <>
      <h1>Find Athletes</h1>
      <div className="tag">Athletes who chose to be listed.</div>
      <form method="get" style={{ marginBottom: 16 }}>
        <input type="text" name="sport" placeholder="Filter by sport (exact)" defaultValue={sport} style={{ maxWidth: 260 }} />{" "}
        <button className="btn ghost" type="submit">Filter</button>
      </form>
      <Grid><Card title={`${rows.length} athlete${rows.length === 1 ? "" : "s"}`} wide>
        {rows.length === 0 ? <p className="muted">No listed athletes match.</p> : (
          <table><thead><tr><th>Athlete</th><th>Sport</th><th>Level</th><th></th></tr></thead><tbody>
            {rows.map((a) => {
              const ok = canOffer(s.role, a.level as Level);
              return <tr key={a.id}>
                <td>{displayName(a.full_name, a.minor)}</td>
                <td>{a.sport}{a.position ? ` · ${a.position}` : ""}{a.state ? ` · ${a.state}` : ""}</td>
                <td>{String(a.level).replace("_", " ")}{a.grad_year ? ` (${a.grad_year})` : ""}</td>
                <td>{s.role === "recruiter"
                  ? <form action={trackAthlete}><input type="hidden" name="athlete_id" value={a.id} /><button className="btn" type="submit">Track</button></form>
                  : ok.ok ? <Link className="btn" href={`/dashboard/deals/new?athlete=${a.id}`}>Make offer</Link> : <span className="muted">Not available to your role</span>}</td>
              </tr>;
            })}
          </tbody></table>)}
      </Card></Grid>
      <Disclaimer>{s.role === "recruiter" ? "Academic details appear on your board only for athletes who invited you and chose to share them." : "Athletes under 18 need a parent/guardian to approve any deal; offers to them are held until that happens."}</Disclaimer>
    </>
  );
}
