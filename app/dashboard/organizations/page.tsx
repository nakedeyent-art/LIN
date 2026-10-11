import { requireUser } from "@/lib/session";
import { organizationsFor } from "@/lib/organizations";
import { db } from "@/lib/db";
import { archiveOrganization, createOrganization, inviteOrganizationMember, leaveOrganization, removeOrganizationMember, respondOrganizationInvite, revokeOrganizationInvite, setOrganizationRole } from "./actions";

const when = (d: Date) => new Date(d).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

export default async function Organizations({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string }> }) {
  const s = await requireUser(), p = await searchParams;
  const [orgs, closed] = await Promise.all([organizationsFor(s.userId), organizationsFor(s.userId, { archived: true })]);
  const invites = (await db().query(
    "SELECT i.id,o.name,i.expires_at FROM organization_invites i JOIN organizations o ON o.id=i.organization_id WHERE i.invited_user_id=$1 AND i.status='pending' AND i.expires_at>now() AND o.archived_at IS NULL", [s.userId])).rows;
  const hidden = (o: { id: string }, extra: Record<string, string> = {}) => <><input type="hidden" name="organization_id" value={o.id} />{Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}</>;
  return (
    <>
      <p className="eyebrow">Shared operations</p><h1>Organizations</h1>
      <p className="tag">Membership organizes records. Athlete consent and document permissions still apply independently.</p>
      {p.error && <p role="alert" className="error">{p.error}</p>}{p.msg && <p className="ok">{p.msg}</p>}
      {invites.map((i) => (
        <section key={i.id} className="work-panel"><h2>{i.name} invited you</h2><p className="muted">Open until {when(i.expires_at)}.</p>
          <form action={respondOrganizationInvite}><input type="hidden" name="invite_id" value={i.id} />
            <button className="btn" name="accept" value="1">Join organization</button> <button className="btn ghost" name="accept" value="0">Decline</button></form></section>))}
      {await Promise.all(orgs.map(async (o) => {
        const members = (await db().query("SELECT m.user_id,m.role,u.full_name FROM organization_members m JOIN users u ON u.id=m.user_id WHERE organization_id=$1 ORDER BY (m.role='owner') DESC, m.joined_at", [o.id])).rows;
        const owners = members.filter((m) => m.role === "owner").length;
        const pending = o.role === "owner" ? (await db().query("SELECT i.id,u.full_name,i.expires_at FROM organization_invites i JOIN users u ON u.id=i.invited_user_id WHERE i.organization_id=$1 AND i.status='pending' AND i.expires_at>now()", [o.id])).rows : [];
        return (
          <section key={o.id} className="work-panel"><h2>{o.name}</h2>
            <table><thead><tr><th>Member</th><th>Role</th><th>Actions</th></tr></thead><tbody>
              {members.map((m) => (
                <tr key={m.user_id}><td>{m.full_name}{m.user_id === s.userId ? " (you)" : ""}</td><td>{m.role}</td><td>
                  {o.role === "owner" && m.role === "member" && <>
                    <form action={setOrganizationRole} style={{ display: "inline" }}>{hidden(o, { user_id: m.user_id, role: "owner" })}<button className="btn ghost">Make owner</button></form>{" "}
                    <form action={removeOrganizationMember} style={{ display: "inline" }}>{hidden(o, { user_id: m.user_id })}<button className="btn ghost">Remove</button></form></>}
                  {o.role === "owner" && m.role === "owner" && m.user_id === s.userId && owners > 1 &&
                    <form action={setOrganizationRole} style={{ display: "inline" }}>{hidden(o, { user_id: m.user_id, role: "member" })}<button className="btn ghost">Step down to member</button></form>}
                  {o.role === "owner" && m.role === "owner" && m.user_id !== s.userId && owners > 1 &&
                    <form action={setOrganizationRole} style={{ display: "inline" }}>{hidden(o, { user_id: m.user_id, role: "member" })}<button className="btn ghost">Make member</button></form>}
                </td></tr>))}
            </tbody></table>
            {pending.length > 0 && <><h3>Waiting for a reply</h3><ul className="list">{pending.map((i) => (
              <li key={i.id}>{i.full_name} · open until {when(i.expires_at)} <form action={revokeOrganizationInvite} style={{ display: "inline" }}><input type="hidden" name="invite_id" value={i.id} /><button className="btn ghost">Cancel</button></form></li>))}</ul></>}
            {o.role === "owner" && <form className="filter-bar" action={inviteOrganizationMember}>{hidden(o)}<label>Invite by account email<input type="email" name="email" required /></label><button className="btn ghost">Send invitation</button></form>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {(o.role !== "owner" || owners > 1) && <form action={leaveOrganization}>{hidden(o)}<button className="btn ghost">Leave organization</button></form>}
              {o.role === "owner" && <form action={archiveOrganization}>{hidden(o, { archive: "1" })}<button className="btn ghost">Archive organization</button></form>}
            </div>
            {o.role === "owner" && owners === 1 && <p className="muted">You are the only owner. Make someone an owner before you leave, or archive the organization.</p>}
          </section>);
      }))}
      {closed.length > 0 && <section className="work-panel"><h2>Archived</h2><p className="muted">Archived organizations grant no access to shared records. An owner can restore one.</p>
        <ul className="list">{closed.map((o) => <li key={o.id}>{o.name}{o.role === "owner" && <form action={archiveOrganization} style={{ display: "inline" }}> {hidden(o, { archive: "0" })}<button className="btn ghost">Restore</button></form>}</li>)}</ul></section>}
      <form action={createOrganization} className="operation-form"><label>New organization name<input type="text" name="name" required maxLength={160} /></label><button className="btn">Create organization</button></form>
    </>
  );
}
