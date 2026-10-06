import { requireUser } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { RoleDashboard } from "@/components/dashboards";
import { guardianState, parentLinksOfAdult } from "@/lib/guardians";
import { Card, Grid } from "@/components/ui";
import { inviteMyGuardian, resendGuardianInvite } from "../guardian/actions";
import Link from "next/link";
import { db } from "@/lib/db";
import { listDeals } from "@/lib/dealsdb";
import { DealTable } from "@/components/deal-ui";

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ linked?: string; invite?: string; connected?: string }> }) {
  const s = await requireUser();
  const q = await searchParams;
  const cfg = ROLES[s.role];
  const g = s.role === "athlete" ? await guardianState(s.userId) : null;
  const justTurned18 = s.role === "athlete" && (await db().query(
    `SELECT 1 FROM athlete_profiles WHERE user_id=$1 AND birth_date <= CURRENT_DATE - INTERVAL '18 years'
        AND birth_date > CURRENT_DATE - INTERVAL '18 years' - INTERVAL '30 days'`, [s.userId])).rowCount
    ? (await parentLinksOfAdult(s.userId)).length > 0 : false;
  const dealRoles = ["athlete", "parent", "sponsor", "booster", "gym_owner"];
  const deals = dealRoles.includes(s.role) ? await listDeals(s.userId) : null;
  const inviteMsg = q.invite?.startsWith("err:") ? q.invite.slice(4)
    : { sent: "Invite sent.", wait: "Please wait a minute before re-sending.", error: "Couldn't send the invite. Try again shortly." }[q.invite ?? ""];
  return (
    <>
      <h1>Welcome, {s.name}</h1>
      <div className="tag">{cfg.tagline}</div>
      {justTurned18 && <p className="ok" role="status">You&apos;re 18 now, so you control your own information. Your parent/guardian no longer has access unless you choose to share — <Link href="/dashboard/team" style={{ textDecoration: "underline" }}>review on the Team page</Link>.</p>}
      {q.connected && <p className="ok">You're now on this athlete's team.</p>}
      {q.linked && <p className="ok">You&apos;re now linked as a parent/guardian.</p>}
      {g?.minor && g.linked.length === 0 && (
        <div className="error" role="status">
          <strong>Guardian approval needed.</strong> {g.pendingEmail
            ? <>We invited {g.pendingEmail}. Deals stay locked until a guardian accepts.</>
            : <>No guardian is linked, so deals stay locked.</>}
          {inviteMsg && <> {inviteMsg}</>}
          {g.pendingInviteId && <form action={resendGuardianInvite} style={{ marginTop: 8 }}><button className="btn ghost" type="submit">Re-send invite</button></form>}
          <form action={inviteMyGuardian} style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="email" name="email" placeholder={g.pendingEmail ? "Wrong address? Enter the right one" : "Parent/guardian's email"} required style={{ maxWidth: 280 }} />
            <button className="btn ghost" type="submit">{g.pendingEmail ? "Replace invite" : "Send invite"}</button></form>
        </div>
      )}
      {g && g.linked.length > 0 && <p className="ok">Guardian linked: {g.linked.map((l) => l.name).join(", ")}</p>}
      {deals && (
        <Grid><Card title="Deals" wide>
          <DealTable deals={deals.slice(0, 5)} viewerId={s.userId} role={s.role} />
          <p><Link href="/dashboard/deals" style={{ textDecoration: "underline" }}>All deals →</Link></p>
        </Card></Grid>
      )}
      <div style={{ height: 16 }} />
      <RoleDashboard session={s} />
    </>
  );
}
