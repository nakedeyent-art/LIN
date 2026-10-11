import { db } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { athleteOverview, ATHLETE_TABS, canEditFamily } from "@/lib/operations";
import { athleteSchedule } from "@/lib/sports-operations";
import { listDocuments } from "@/lib/documents";
import { formatCents } from "@/lib/deals";

export default async function AthleteRecord({ params, searchParams }: { params: Promise<{athleteId: string}>; searchParams: Promise<{tab?: string}> }) {
  const s = await requireUser(), { athleteId } = await params, { tab: requested } = await searchParams;
  const data = await athleteOverview(s, athleteId);
  if (!data) notFound();
  const tab = ATHLETE_TABS.find(t => t === requested) ?? "overview";
  const { subject: a, summary, deals, team } = data;
  const family = canEditFamily(a), pending = deals.filter(d => ["guardian_review", "awaiting_signature"].includes(d.status));
  const documents = await listDocuments(s,a.id);
  const schedule = await athleteSchedule(s,a.id);
  const activity=family?(await db().query("SELECT action,created_at FROM operations_activity WHERE athlete_id=$1 ORDER BY created_at DESC LIMIT 40",[a.id])).rows:[];
  const sharedReports=family?(await db().query("SELECT r.title,r.notes,r.created_at,u.full_name AS author FROM scouting_reports r JOIN users u ON u.id=r.author_id WHERE r.athlete_id=$1 AND r.intentionally_shared ORDER BY r.created_at DESC LIMIT 30",[a.id])).rows:[];
  const base = `/dashboard/operations/${a.id}`;
  const link = (path: string) => `${path}?athlete=${a.id}`;
  const dealTable = <><table><thead><tr><th>Deal</th><th>Status</th><th>Value</th><th>Deliverables</th></tr></thead><tbody>{deals.map(d => <tr key={d.id}><td><Link className="record-link" href={`/dashboard/deals/${d.id}`}>{d.title}</Link></td><td>{d.status.replaceAll("_", " ")}</td><td>{formatCents(d.amount_cents)}</td><td>{d.deliverables}</td></tr>)}</tbody></table>{!deals.length && <p className="empty-state">No deals available to your account.</p>}</>;
  return <><Link className="muted" href="/dashboard/operations">← Athlete operations</Link><header className="record-header"><div><p className="eyebrow">Athlete record</p><h1>{a.name}</h1><p className="muted">{a.sport} · {a.level.replaceAll("_", " ")}</p></div><span className="status-dot">{a.inSeason ? "In season" : "Off season"}</span></header>
    <nav className="record-tabs" aria-label="Athlete sections">{ATHLETE_TABS.map(t => <Link key={t} href={`${base}?tab=${t}`} aria-current={tab === t ? "page" : undefined}>{t[0].toUpperCase()+t.slice(1)}</Link>)}</nav>
    <div className="record-columns"><section className="work-panel"><h2>{tab[0].toUpperCase()+tab.slice(1)}</h2>
      {tab === "overview" && <><h3>Upcoming games and events</h3>{schedule.filter(e=>new Date(e.starts_at)>new Date()&&e.status!=='cancelled').sort((x,y)=>new Date(x.starts_at).getTime()-new Date(y.starts_at).getTime()).slice(0,4).map(e=><p key={e.id}><Link href={link("/dashboard/schedule")}>{e.name} · {new Date(e.starts_at).toISOString().slice(0,16)} UTC</Link></p>)}<h3>Expiring documents</h3>{documents.filter(d=>d.expires_on&&d.expires_on<=new Date(Date.now()+7*86400000).toISOString().slice(0,10)).map(d=><p key={d.id}><Link href={`/dashboard/documents/${d.id}`}>{d.title} · {d.expires_on}</Link></p>)}<h3>Needs attention</h3>{pending.length ? <ul>{pending.map(d => <li key={d.id}><Link href={`/dashboard/deals/${d.id}`}>{d.title} · {d.status === "guardian_review" ? "Guardian approval" : "Signatures needed"}</Link></li>)}</ul> : <p className="muted">No deal approvals or signatures awaiting action.</p>}
        {summary.academics?.alerts.map((alert, i) => <p key={i} className="disclaimer">{alert.message}</p>)}
        {summary.health?.next && <p>Next development session: {summary.health.next.title} · {summary.health.next.day}</p>}
        <h3>Deal deliverables</h3>{dealTable}</>}
      {tab === "deals" && dealTable}
      {tab === "development" && <div className="action-list">{a.academics && <Link href={link("/dashboard/academics")}>Academic progress and eligibility →</Link>}{a.health && <><Link href={link("/dashboard/metrics")}>Measurables and verified statistics →</Link><Link href={link("/dashboard/training")}>Training and development →</Link><Link href={link("/dashboard/nutrition")}>Nutrition →</Link></>}{!a.academics && !a.health && <p>Development information has not been shared with your account.</p>}</div>}
      {tab === "team" && <>{family ? <><table><thead><tr><th>Member</th><th>Role</th><th>Shared information</th></tr></thead><tbody>{team.map((r,i) => <tr key={i}><td>{r.full_name}</td><td>{r.relationship}</td><td>{[r.can_view_academics && "Academics", r.can_view_health && "Health"].filter(Boolean).join(", ") || "Basic"}</td></tr>)}</tbody></table><p><Link className="record-link" href="/dashboard/team">Manage consent and invitations</Link></p></> : <p>Team membership is managed by the athlete and their guardian.</p>}</>}
      {tab === "recruiting" && <>{sharedReports.map((r,i)=><article key={i} className="report-entry"><h3>{r.title}</h3><p className="muted">Shared by {r.author} · {new Date(r.created_at).toISOString().slice(0,10)}</p><p style={{whiteSpace:'pre-wrap'}}>{r.notes}</p></article>)}{!sharedReports.length&&<p className="empty-state">No recruiting reports have been shared with you.</p>}<p className="muted">Private recruiter evaluations stay in the scouting workspace. Academic sharing remains controlled by athlete consent.</p></>}
      {tab === "schedule" && <><Link className="record-link" href={link("/dashboard/schedule")}>Open schedule and travel →</Link>{schedule.map(e=><p key={e.id}>{e.name} · {new Date(e.starts_at).toISOString().slice(0,16)} UTC · {e.availability}</p>)}{!schedule.length&&<p className="empty-state">No events available to your account.</p>}</>}
      {tab === "documents" && <><p><Link className="record-link" href={link("/dashboard/documents")}>Open document center →</Link></p>{documents.map(d => <p key={d.id}><Link className="record-link" href={`/dashboard/documents/${d.id}`}>{d.title}</Link> · {d.category.replaceAll("_", " ")}{d.expires_on ? ` · Expires ${d.expires_on}` : ""}</p>)}{!documents.length && <p className="empty-state">No documents available to your account.</p>}</>}
      {tab === "activity" && <>{activity.map((event,i)=><p key={i}>{event.action.replaceAll("."," ").replaceAll("_"," ")} · {new Date(event.created_at).toISOString()}</p>)}{deals.length ? deals.map(d => <p key={d.id}><Link href={`/dashboard/deals/${d.id}`}>{d.title}</Link> · {d.status.replaceAll("_", " ")}</p>) : <p className="empty-state">No visible deal activity.</p>}</>}
    </section><aside className="activity-rail"><h2>Attention</h2><p>{pending.length} deal{pending.length === 1 ? "" : "s"} awaiting approval or signatures</p>{summary.academics && <p>{summary.academics.alerts.length} academic alert{summary.academics.alerts.length === 1 ? "" : "s"}</p>}<p className="muted">This record shows only information shared with your account.</p><Link className="record-link" href="/dashboard/notifications">Notifications →</Link></aside></div>
  </>;
}
