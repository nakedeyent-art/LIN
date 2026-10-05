import { requireUser } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { RoleDashboard } from "@/components/dashboards";
import { guardianState, linkedAthletes } from "@/lib/guardians";
import { Card, Grid, List } from "@/components/ui";
import { resendGuardianInvite } from "../guardian/actions";

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ linked?: string; invite?: string }> }) {
  const s = await requireUser();
  const q = await searchParams;
  const cfg = ROLES[s.role];
  const g = s.role === "athlete" ? await guardianState(s.userId) : null;
  const kids = s.role === "parent" ? await linkedAthletes(s.userId) : [];
  const inviteMsg = { sent: "Invite re-sent.", wait: "Please wait a minute before re-sending.", error: "Couldn't send the invite. Try again shortly." }[q.invite ?? ""];
  return (
    <>
      <h1>Welcome, {s.name}</h1>
      <div className="tag">{cfg.tagline}</div>
      {q.linked && <p className="ok">You&apos;re now linked as a parent/guardian.</p>}
      {g?.minor && g.linked.length === 0 && (
        <div className="error" role="status">
          <strong>Guardian approval needed.</strong> {g.pendingEmail
            ? <>We invited {g.pendingEmail}. Deals stay locked until a guardian accepts.</>
            : <>No guardian is linked, so deals stay locked.</>}
          {inviteMsg && <> {inviteMsg}</>}
          {g.pendingInviteId && <form action={resendGuardianInvite} style={{ marginTop: 8 }}><button className="btn ghost" type="submit">Re-send invite</button></form>}
        </div>
      )}
      {g && g.linked.length > 0 && <p className="ok">Guardian linked: {g.linked.map((l) => l.name).join(", ")}</p>}
      {s.role === "parent" && (
        <Grid><Card title="My Athletes" wide>
          {kids.length ? <List items={kids.map((k) => `${k.name}${k.sport ? ` — ${k.sport}` : ""}`)} /> : <p className="muted">No athletes linked yet. Athletes link you by sending an invite to your email.</p>}
        </Card></Grid>
      )}
      <div style={{ height: 16 }} />
      <RoleDashboard role={s.role} />
    </>
  );
}
