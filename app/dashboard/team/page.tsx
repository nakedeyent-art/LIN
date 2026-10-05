import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { subjectsFor } from "@/lib/access";
import { Badge, Card, Disclaimer, Grid } from "@/components/ui";
import { inviteMember, removeMember, revokeInvite } from "./actions";

const sel = { padding: 10, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)" } as const;

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const s = await requireAccess("/dashboard/team");
  const { msg, error } = await searchParams;
  const athletes = await subjectsFor(s);
  const blocks = await Promise.all(athletes.map(async (a) => {
    const members = (await db().query(
      `SELECT r.id, r.relationship, r.can_view_academics, r.can_view_health, u.full_name, u.email FROM athlete_relationships r
         JOIN users u ON u.id = r.member_id WHERE r.athlete_id=$1 AND r.relationship <> 'parent' ORDER BY r.created_at`, [a.id])).rows;
    const invites = (await db().query(
      `SELECT id, invitee_email, role, can_view_academics, can_view_health, expires_at FROM connection_invites
        WHERE athlete_id=$1 AND status='pending' AND expires_at > NOW() ORDER BY created_at`, [a.id])).rows;
    const manage = s.role === "parent" || (s.role === "athlete" && !a.minor);
    return { a, members, invites, manage };
  }));
  return (
    <>
      <h1>Team &amp; sharing</h1>
      <div className="tag">Choose who can see an athlete&apos;s academics, nutrition and training. Nothing is shared by default.</div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {blocks.length === 0 && <p className="muted">No athletes to manage yet.</p>}
      {blocks.map(({ a, members, invites, manage }) => (
        <Grid key={a.id}>
          <Card title={s.role === "parent" ? `${a.name} — team` : "My team"} wide>
            {!manage && <p className="muted">You&apos;re under 18, so your parent/guardian manages who can see your information.</p>}
            {members.length === 0 && invites.length === 0 && <p className="muted">No one has access yet.</p>}
            <table><tbody>
              {members.map((m) => (
                <tr key={m.id}><td>{m.full_name}<div className="muted">{m.email}</div></td>
                  <td><Badge tone="gray">{String(m.relationship).replace("_", " ")}</Badge></td>
                  <td>{[m.can_view_academics && "Academics", m.can_view_health && "Nutrition & training"].filter(Boolean).join(" · ")}</td>
                  <td>{manage && <form action={removeMember}><input type="hidden" name="relationship_id" value={m.id} /><button className="btn ghost" type="submit">Remove access</button></form>}</td></tr>))}
              {invites.map((i) => (
                <tr key={i.id}><td>{i.invitee_email}<div className="muted">invite pending</div></td>
                  <td><Badge tone="yellow">{String(i.role).replace("_", " ")}</Badge></td>
                  <td>{[i.can_view_academics && "Academics", i.can_view_health && "Nutrition & training"].filter(Boolean).join(" · ")}</td>
                  <td>{manage && <form action={revokeInvite}><input type="hidden" name="invite_id" value={i.id} /><button className="btn ghost" type="submit">Revoke</button></form>}</td></tr>))}
            </tbody></table>
          </Card>
          {manage && (
            <Card title="Invite someone" wide>
              <form action={inviteMember} style={{ display: "grid", gap: 10, maxWidth: 480 }}>
                <input type="hidden" name="athlete_id" value={a.id} />
                <input type="email" name="email" placeholder="Their email (must match their account)" required />
                <select name="role" style={sel} defaultValue="coach">
                  <option value="coach">Coach</option><option value="trainer">Trainer</option>
                  <option value="manager">Manager / Agent</option><option value="recruiter">Recruiter</option>
                </select>
                <label><input type="checkbox" name="academics" /> Can see academics (grades, study log)</label>
                <label><input type="checkbox" name="health" /> Can see nutrition &amp; training (trainers/managers can also prescribe workouts)</label>
                <button className="btn" type="submit">Send invite</button>
              </form>
            </Card>)}
        </Grid>))}
      <Disclaimer>Only people you invite, with the access you choose, can see this information. You can remove access at any time.</Disclaimer>
    </>
  );
}
