import type { ReactNode } from "react";
import Link from "next/link";
import type { Session } from "@/lib/session";
import { db } from "@/lib/db";
import { subjectsFor } from "@/lib/access";
import { snapshots, type Snapshot } from "@/lib/snapshot";
import { listDeals } from "@/lib/dealsdb";
import { grownAthletesOf } from "@/lib/guardians";
import { displayName, formatCents } from "@/lib/deals";
import { todayStr } from "@/lib/academics";
import { Badge, Card, Grid, List, Stat } from "./ui";
import { setStage, untrack } from "@/app/dashboard/athletes/actions";

const Empty = ({ children }: { children: ReactNode }) => <p className="muted">{children}</p>;
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);
const A = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} style={{ textDecoration: "underline" }}>{children}</Link>;

function alertBadges(s: Snapshot) {
  const al = s.academics?.alerts ?? [];
  const red = al.filter((a) => a.level === "red").length, yellow = al.length - red;
  return <>{red > 0 && <Badge tone="red">{red} red</Badge>} {yellow > 0 && <Badge tone="yellow">{yellow} yellow</Badge>}{al.length === 0 && s.academics && (s.academics.courses ? <Badge tone="green">clear</Badge> : <span className="muted">no grades</span>)}</>;
}

/** One table used by coach / trainer / manager / parent — shows only the columns the viewer is allowed to see. */
function Roster({ rows, link }: { rows: Snapshot[]; link?: (s: Snapshot) => string }) {
  const hasA = rows.some((r) => r.academics), hasH = rows.some((r) => r.health);
  return (
    <table><thead><tr><th>Athlete</th>{hasA && <><th>Academic alerts</th><th>Competition gate</th></>}{hasH && <><th>Training (14d)</th><th>Nutrition (14d)</th><th>Next workout</th></>}</tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id}><td>{link ? <A href={link(r)}>{r.name}</A> : r.name}</td>
          {hasA && <><td>{r.academics ? alertBadges(r) : "—"}</td><td>{r.academics ? <Badge tone={r.academics.gate ? "green" : "red"}>{r.academics.gate ? "Cleared" : "Not cleared"}</Badge> : "—"}</td></>}
          {hasH && <><td>{r.health ? <>{pct(r.health.adherence)}{r.health.missedWeek && <> <Badge tone="yellow">2+ missed</Badge></>}</> : "—"}</td>
            <td>{r.health ? (r.health.hasPlan ? pct(r.health.compliance) : <span className="muted">no plan</span>) : "—"}</td>
            <td>{r.health ? (r.health.next ? `${r.health.next.day} · ${r.health.next.title}` : <span className="muted">none</span>) : "—"}</td></>}
        </tr>))}</tbody></table>
  );
}

async function Athlete({ s }: { s: Session }) {
  const today = todayStr();
  const [me] = await subjectsFor(s);
  const [snap] = me ? await snapshots([me], today) : [];
  const prof = (await db().query(
    `SELECT height_cm IS NOT NULL AS has_metrics, discoverable, birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor,
            (SELECT count(*)::int FROM nutrition_plans n WHERE n.athlete_id = ap.user_id AND n.active_until IS NULL) AS plans,
            (SELECT count(*)::int FROM guardian_links r WHERE r.athlete_id = ap.user_id) AS guardians,
            (SELECT count(*)::int FROM athlete_relationships r WHERE r.athlete_id = ap.user_id AND r.relationship <> 'parent') AS team,
            (SELECT count(*)::int FROM academic_logs l WHERE l.athlete_id = ap.user_id) AS grades
       FROM athlete_profiles ap WHERE ap.user_id=$1`, [s.userId])).rows[0];
  const steps: [boolean, string, string][] = [
    [!!prof?.has_metrics, "Add body details for nutrition targets", "/dashboard/nutrition"],
    [(prof?.plans ?? 0) > 0, "Pick a performance profile", "/dashboard/nutrition"],
    [(prof?.grades ?? 0) > 0, "Enter your current grades", "/dashboard/academics"],
    [(prof?.team ?? 0) > 0, "Invite a coach or trainer", "/dashboard/team"],
    [!!prof?.discoverable, "List yourself to sponsors", "/dashboard/deals"],
    ...(prof?.minor ? [[(prof?.guardians ?? 0) > 0, "Get a parent/guardian linked", "/dashboard"] as [boolean, string, string]] : []),
  ];
  return (
    <Grid>
      <Card title="Today & this week">
        <Stat label="Next workout" value={snap?.health?.next ? snap.health.next.title : "None"} hint={snap?.health?.next?.day ?? "Ask a trainer to assign one"} />
        <Stat label="Verified study minutes (7d)" value={String(snap?.academics?.verifiedMinutes ?? 0)} hint={snap?.academics?.gate ? "Competition gate: cleared" : "Competition gate: not cleared"} />
        <Stat label="Nutrition on target (14d)" value={pct(snap?.health?.compliance)} />
      </Card>
      <Card title="Academic alerts">
        {snap?.academics?.alerts.length ? snap.academics.alerts.map((a) => <p key={a.message}><Badge tone={a.level === "red" ? "red" : "yellow"}>{a.level}</Badge> {a.message}</p>)
          : <Empty>{snap?.academics?.courses ? "No alerts." : "Add your grades to start tracking eligibility."}</Empty>}
      </Card>
      <Card title="Get set up" wide>
        <List items={steps.map(([ok, label, href]) => <>{ok ? "✅" : "⬜"} {ok ? label : <A href={href}>{label}</A>}</>)} />
      </Card>
    </Grid>
  );
}

async function Parent({ s }: { s: Session }) {
  const subs = await subjectsFor(s);
  const snaps = await snapshots(subs, todayStr());
  const deals = (await listDeals(s.userId)).filter((d) => d.status === "guardian_review").length;
  const grown = await grownAthletesOf(s.userId);
  return (
    <Grid>
      {grown.length > 0 && <Card title="Now adults" wide>
        <List items={grown.map((g) => <>{g.name} turned 18 — {g.sharing ? "they're sharing some information with you (view-only)" : "they control their own information now"}. <A href="/dashboard/team">Details</A></>)} />
      </Card>}
      <Card title="My athletes" wide>
        {snaps.length === 0 ? <Empty>No athletes linked yet. Athletes link you by sending an invite to your email.</Empty>
          : <Roster rows={snaps} link={(r) => `/dashboard/academics?athlete=${r.id}`} />}
      </Card>
      <Card title="Needs your decision">
        {deals > 0 ? <p><Badge tone="yellow">{deals}</Badge> deal{deals > 1 ? "s" : ""} awaiting your approval — <A href="/dashboard/deals">review</A></p> : <Empty>No deals waiting.</Empty>}
      </Card>
    </Grid>
  );
}

async function Coach({ s }: { s: Session }) {
  const snaps = await snapshots(await subjectsFor(s), todayStr());
  const flagged = snaps.filter((r) => r.academics && !r.academics.gate).length;
  return (
    <Grid>
      <Card title="Roster" wide>
        {snaps.length === 0 ? <Empty>No athletes have added you yet. Athletes (or their parents) invite coaches from their Team page.</Empty>
          : <Roster rows={snaps} link={(r) => `/dashboard/academics?athlete=${r.id}`} />}
      </Card>
      {snaps.length > 0 && <Card title="Summary"><Stat label="Athletes" value={String(snaps.length)} /><Stat label="Not cleared for competition" value={String(flagged)} /></Card>}
    </Grid>
  );
}

async function Trainer({ s }: { s: Session }) {
  const snaps = await snapshots(await subjectsFor(s), todayStr());
  const d = (await db().query("SELECT credential_type, credential_verified FROM manager_declarations WHERE manager_id=$1", [s.userId])).rows[0];
  const alerts = snaps.filter((r) => r.health?.missedWeek);
  return (
    <Grid>
      <Card title="Clients" wide>
        {snaps.length === 0 ? <Empty>No clients yet. Athletes (or their parents) invite trainers from their Team page.</Empty>
          : <Roster rows={snaps} link={(r) => `/dashboard/training?athlete=${r.id}`} />}
      </Card>
      <Card title="Needs attention">{alerts.length ? <List items={alerts.map((a) => `${a.name} missed 2+ sessions this week`)} /> : <Empty>No missed-session alerts.</Empty>}</Card>
      <Card title="Credential">{d ? <><Badge tone="gray">{d.credential_type}</Badge> <span className="muted">{d.credential_verified ? "verified" : "self-declared, not yet verified"}</span></> : <Empty>None on file.</Empty>}</Card>
    </Grid>
  );
}

async function Manager({ s }: { s: Session }) {
  const snaps = await snapshots(await subjectsFor(s), todayStr());
  const d = (await db().query("SELECT declared_role, credential_type, credential_verified FROM manager_declarations WHERE manager_id=$1", [s.userId])).rows[0];
  const items = snaps.flatMap((r) => [
    ...(r.academics?.alerts ?? []).map((a) => <><Badge tone={a.level === "red" ? "red" : "yellow"}>{a.level}</Badge> {r.name}: {a.message}</>),
    ...(r.health?.missedWeek ? [<><Badge tone="yellow">yellow</Badge> {r.name} missed 2+ sessions this week — intervene</>] : []),
  ]);
  return (
    <Grid>
      <Card title="Client alerts" wide>{items.length ? <List items={items} /> : <Empty>{snaps.length ? "No alerts right now." : "No clients yet. Athletes (or their parents) invite managers from their Team page."}</Empty>}</Card>
      {snaps.length > 0 && <Card title="Clients" wide><Roster rows={snaps} link={(r) => `/dashboard/academics?athlete=${r.id}`} /></Card>}
      <Card title="Your declared role">
        {d ? <><Badge tone="green">{String(d.declared_role).replace(/_/g, " ")}</Badge>{d.credential_type && <> <Badge tone="gray">{d.credential_type}</Badge></>}
          <p className="muted">{d.credential_verified ? "Credential verified." : "Self-declared; not yet verified by LIN."} Training and nutrition prescriptions require a Certified Strength Coach declaration.</p></> : <Empty>None on file.</Empty>}
      </Card>
    </Grid>
  );
}

async function DealPipeline({ s, title }: { s: Session; title: string }) {
  const deals = await listDeals(s.userId);
  const sum = (f: (d: (typeof deals)[number]) => boolean) => deals.filter(f).reduce((t, d) => t + d.amount_cents, 0);
  const open = deals.filter((d) => d.status === "offered" || d.status === "guardian_review");
  return (
    <Grid>
      <Card title={title}>
        <Stat label="Open offers" value={String(open.length)} hint={formatCents(sum((d) => open.includes(d)))} />
        <Stat label="Active deals" value={String(deals.filter((d) => d.status === "active").length)} hint={formatCents(sum((d) => d.status === "active"))} />
        <Stat label="Completed" value={String(deals.filter((d) => d.status === "completed").length)} hint={formatCents(sum((d) => d.status === "completed"))} />
      </Card>
      <Card title="Find athletes"><p>Browse athletes who chose to be listed and send an offer.</p><A href="/dashboard/athletes">Find athletes →</A></Card>
    </Grid>
  );
}

async function Tournament({ s }: { s: Session }) {
  const ev = (await db().query("SELECT name, starts_on::text AS day, status FROM events WHERE organizer_id=$1 AND status <> 'cancelled' AND starts_on >= CURRENT_DATE ORDER BY starts_on LIMIT 5", [s.userId])).rows;
  return (
    <Grid>
      <Card title="Upcoming events" wide>
        {ev.length === 0 ? <Empty>No upcoming events. <A href="/dashboard/events">Create one</A>.</Empty>
          : <table><tbody>{ev.map((e) => <tr key={e.name + e.day}><td>{e.name}</td><td>{e.day}</td><td><Badge tone={e.status === "published" ? "green" : "gray"}>{e.status}</Badge></td></tr>)}</tbody></table>}
      </Card>
    </Grid>
  );
}

async function Recruiter({ s }: { s: Session }) {
  const board = (await db().query(
    `SELECT b.id, b.stage, u.id AS athlete_id, u.full_name, ap.sport, ap.position, ap.level, ap.grad_year,
            ap.birth_date > CURRENT_DATE - INTERVAL '18 years' AS minor
       FROM recruiting_board b JOIN users u ON u.id = b.athlete_id JOIN athlete_profiles ap ON ap.user_id = u.id
      WHERE b.recruiter_id=$1 ORDER BY b.updated_at DESC`, [s.userId])).rows;
  const snaps = new Map((await snapshots((await subjectsFor(s)).filter((x) => board.some((b) => b.athlete_id === x.id)), todayStr())).map((x) => [x.id, x]));
  return (
    <Grid>
      <Card title="Recruiting board" wide>
        {board.length === 0 ? <Empty>Your board is empty. <A href="/dashboard/athletes">Find athletes</A> to track.</Empty> : (
          <table><thead><tr><th>Prospect</th><th>Sport</th><th>Class</th><th>Academics</th><th>Stage</th><th></th></tr></thead><tbody>
            {board.map((b) => { const a = snaps.get(b.athlete_id)?.academics;
              return <tr key={b.id}><td>{snaps.has(b.athlete_id) ? b.full_name : displayName(b.full_name, b.minor)}</td>
                <td>{b.sport}{b.position ? ` · ${b.position}` : ""}</td><td>{b.grad_year ?? "—"}</td>
                <td>{a ? <>{a.avg != null ? `${a.avg}% avg ` : ""}<Badge tone={a.gate ? "green" : "yellow"}>{a.gate ? "Eligible" : "At risk"}</Badge></> : <span className="muted">not shared</span>}</td>
                <td><form action={setStage} style={{ display: "flex", gap: 6 }}><input type="hidden" name="id" value={b.id} />
                  <select name="stage" defaultValue={b.stage} style={{ padding: 6, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)" }}>
                    {["watching", "evaluating", "contacted", "passed"].map((x) => <option key={x}>{x}</option>)}</select><button className="btn ghost" type="submit">Save</button></form></td>
                <td><form action={untrack}><input type="hidden" name="id" value={b.id} /><button className="btn ghost" type="submit">Remove</button></form></td></tr>; })}
          </tbody></table>)}
      </Card>
    </Grid>
  );
}

export async function RoleDashboard({ session: s }: { session: Session }) {
  switch (s.role) {
    case "athlete": return <Athlete s={s} />;
    case "parent": return <Parent s={s} />;
    case "coach": return <Coach s={s} />;
    case "trainer": return <Trainer s={s} />;
    case "manager": return <Manager s={s} />;
    case "gym_owner": return <DealPipeline s={s} title="Your offers" />;
    case "sponsor": return <DealPipeline s={s} title="Campaign pipeline" />;
    case "booster": return <DealPipeline s={s} title="Collective pipeline" />;
    case "tournament_manager": return <Tournament s={s} />;
    case "recruiter": return <Recruiter s={s} />;
  }
}
