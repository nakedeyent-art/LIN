import { Badge, Card } from "@/components/ui";
import { guardiansOf, maskEmail, parentLinksOfAdult, pendingGuardianInvites, recentGuardianEvents } from "@/lib/guardians";
import { MAX_GUARDIANS } from "@/lib/guardianship";
import {
  cancelGuardianInvite, deleteMinorAccount, inviteGuardian, removeGuardian, removeParentLink, setMinorListing,
  shareWithParent, stopSharingWithParent,
} from "./guardian-actions";

const stack = { display: "grid", gap: 8, maxWidth: 420 } as const;
const fmt = (d: Date) => new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" });
const EVENT: Record<string, string> = {
  invited: "invited a guardian", accepted: "joined as a guardian", invite_cancelled: "cancelled a guardian invite", removed: "removed a guardian",
  stepped_down: "stepped down as a guardian", listing_changed: "changed sponsor listing", adult_sharing_granted: "started sharing with a parent",
  adult_sharing_stopped: "stopped sharing with a parent", adult_link_removed: "removed a parent link",
};

async function History({ athleteId }: { athleteId: string }) {
  const ev = await recentGuardianEvents(athleteId);
  if (!ev.length) return null;
  return (
    <details style={{ marginTop: 12 }}><summary className="muted">Recent guardian activity</summary>
      <ul className="list">{ev.map((e, i) => <li key={i}>{fmt(e.created_at)} — {e.actor} {EVENT[e.action] ?? e.action}{e.detail ? ` (${e.detail})` : ""}</li>)}</ul></details>
  );
}

/** What a guardian of a minor sees: guardians, invites, listing control, and the danger zone. */
export async function GuardianPanel({ athleteId, name, viewerId, listed }: { athleteId: string; name: string; viewerId: string; listed: boolean }) {
  const [guardians, invites] = await Promise.all([guardiansOf(athleteId), pendingGuardianInvites(athleteId)]);
  const slots = guardians.length + invites.length;
  return (
    <Card title={`Guardians — ${name}`} wide>
      <table><tbody>
        {guardians.map((g) => (
          <tr key={g.relationshipId}><td>{g.name}{g.userId === viewerId && <> <Badge tone="gray">you</Badge></>}<div className="muted">{maskEmail(g.email)} · since {fmt(g.since)}</div></td>
            <td><form action={removeGuardian}><input type="hidden" name="relationship_id" value={g.relationshipId} />
              <button className="btn ghost" type="submit">{g.userId === viewerId ? "Step down" : "Remove"}</button></form></td></tr>))}
        {invites.map((i) => (
          <tr key={i.id}><td>{maskEmail(i.email)}<div className="muted">invite pending</div></td>
            <td><form action={cancelGuardianInvite}><input type="hidden" name="invite_id" value={i.id} /><button className="btn ghost" type="submit">Cancel</button></form></td></tr>))}
      </tbody></table>
      {slots < MAX_GUARDIANS && (
        <form action={inviteGuardian} style={{ ...stack, marginTop: 12 }}>
          <input type="hidden" name="athlete_id" value={athleteId} />
          <input type="email" name="email" placeholder="Another parent/guardian's email" required />
          <button className="btn" type="submit">Invite guardian</button>
          <p className="muted">They need a verified Parent account with this email. Any guardian can remove another, and each change is logged and emailed.</p>
        </form>)}
      <div style={{ marginTop: 12 }}>Sponsor listing: <Badge tone={listed ? "green" : "gray"}>{listed ? "listed" : "unlisted"}</Badge>{" "}
        <form action={setMinorListing} style={{ display: "inline" }}><input type="hidden" name="athlete_id" value={athleteId} /><input type="hidden" name="on" value={listed ? "0" : "1"} />
          <button className="btn ghost" type="submit">{listed ? "Unlist" : "List to sponsors"}</button></form></div>
      <History athleteId={athleteId} />
      <details style={{ marginTop: 12 }}><summary className="muted">Delete {name}&apos;s account</summary>
        <form action={deleteMinorAccount} style={{ ...stack, marginTop: 8 }}>
          <input type="hidden" name="athlete_id" value={athleteId} />
          <p className="muted">Permanently removes their profile, grades, logs, workouts and team links. Deal records are kept without their name. Not possible while they have open deals.</p>
          <input type="password" name="password" placeholder="Your password" autoComplete="current-password" required />
          <input type="text" name="confirm" placeholder="Type DELETE to confirm" autoComplete="off" required />
          <button className="btn" type="submit" style={{ background: "#ef4444" }}>Delete this account</button>
        </form></details>
    </Card>
  );
}

/** What the athlete sees about their own guardians. Minors: read-only. Adults: they decide what to keep sharing. */
export async function MyGuardiansPanel({ athleteId, minor }: { athleteId: string; minor: boolean }) {
  if (minor) {
    const [guardians, invites] = await Promise.all([guardiansOf(athleteId), pendingGuardianInvites(athleteId)]);
    return (
      <Card title="My parents / guardians" wide>
        {guardians.length === 0 && invites.length === 0 && <p className="muted">No guardian is linked yet. Deals stay locked until one joins.</p>}
        <ul className="list">
          {guardians.map((g) => <li key={g.relationshipId}>{g.name} <span className="muted">since {fmt(g.since)}</span></li>)}
          {invites.map((i) => <li key={i.id}>{maskEmail(i.email)} <Badge tone="yellow">invited</Badge></li>)}
        </ul>
        <p className="muted">While you&apos;re under 18, your parents/guardians approve your deals and manage who can see your information.</p>
        <History athleteId={athleteId} />
      </Card>
    );
  }
  const links = await parentLinksOfAdult(athleteId);
  if (links.length === 0) return null;
  return (
    <Card title="Parent / guardian access" wide>
      <p>You&apos;re 18+, so you control your information. Your parent/guardian only sees what you choose to share, and only to view it.</p>
      <table><tbody>{links.map((l) => (
        <tr key={l.id}><td>{l.name}</td>
          <td>{l.sharing ? <Badge tone="green">sharing: {[l.academics && "academics", l.health && "nutrition & training"].filter(Boolean).join(" + ")}</Badge> : <Badge tone="gray">not sharing</Badge>}</td>
          <td>
            <form action={shareWithParent} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input type="hidden" name="relationship_id" value={l.id} />
              <label><input type="checkbox" name="academics" defaultChecked={l.sharing && l.academics} /> Academics</label>
              <label><input type="checkbox" name="health" defaultChecked={l.sharing && l.health} /> Nutrition &amp; training</label>
              <button className="btn" type="submit">{l.sharing ? "Update" : "Share"}</button></form>
            {l.sharing && <form action={stopSharingWithParent} style={{ display: "inline" }}><input type="hidden" name="relationship_id" value={l.id} /><button className="btn ghost" type="submit">Stop sharing</button></form>}
            <form action={removeParentLink} style={{ display: "inline" }}><input type="hidden" name="relationship_id" value={l.id} /><button className="btn ghost" type="submit">Remove link</button></form>
          </td></tr>))}</tbody></table>
      <History athleteId={athleteId} />
    </Card>
  );
}
