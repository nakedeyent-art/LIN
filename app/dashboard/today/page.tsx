import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { subjectsFor,canEditFamily } from '@/lib/access';
import { getEnvelope } from '@/lib/signing';
import { db } from '@/lib/db';
export default async function Today() {
 const s=await requireUser(),athletes=(await subjectsFor(s)).filter(canEditFamily),ids=athletes.map(a=>a.id);
 const [events,tasks,signatures,messages]=await Promise.all([
  db().query("SELECT e.id,e.name,d.starts_at,a.athlete_id FROM sports_attendees a JOIN events e ON e.id=a.event_id JOIN sports_event_details d ON d.event_id=e.id WHERE a.athlete_id=ANY($1::uuid[]) AND d.starts_at>=CURRENT_DATE AND d.starts_at<CURRENT_DATE+1 AND e.status<>'cancelled' ORDER BY d.starts_at",[ids]),
  db().query("SELECT id,title,athlete_id,due_at FROM operational_tasks WHERE athlete_id=ANY($1::uuid[]) AND status='open' AND due_at<now()+INTERVAL '1 day' ORDER BY due_at LIMIT 30",[ids]),
  db().query("SELECT DISTINCT e.id,e.title FROM signing_envelopes e JOIN signing_recipients r ON r.envelope_id=e.id WHERE r.user_id=$1 AND r.status<>'signed' AND e.status IN ('sent','viewed','partially_signed') AND e.expires_at>now() ORDER BY e.title LIMIT 30",[s.userId]),
  db().query("SELECT id,title,href FROM notifications WHERE user_id=$1 AND kind='message' AND read_at IS NULL ORDER BY created_at DESC LIMIT 20",[s.userId]),
 ]);
 const authorizedSignatures=(await Promise.all(signatures.rows.map(async e=>await getEnvelope(s,e.id)?e:null))).filter(Boolean);
 return <><p className="eyebrow">Your day · UTC</p><h1>Today</h1><p className="tag">Games, documents requiring action and conversations.</p><div className="today-list"><section className="work-panel"><h2>Games and events</h2>{events.rows.map(e=><p key={`${e.id}-${e.athlete_id}`}><Link className="record-link" href={`/dashboard/schedule?athlete=${e.athlete_id}`}>{e.name}</Link> · {new Date(e.starts_at).toISOString().slice(11,16)}</p>)}{!events.rows.length&&<p className="muted">No games or events scheduled today.</p>}</section><section className="work-panel"><h2>Signatures requiring action</h2>{authorizedSignatures.map(e=><p key={e.id}><Link className="record-link" href={`/dashboard/signing/${e.id}`}>{e.title}</Link></p>)}{!authorizedSignatures.length&&<p className="muted">No signatures awaiting your action.</p>}</section><section className="work-panel"><h2>Due and overdue tasks</h2>{tasks.rows.map(t=><p key={t.id}><Link className="record-link" href={`/dashboard/tasks?athlete=${t.athlete_id}`}>{t.title}</Link> · {new Date(t.due_at).toISOString().slice(0,16)}</p>)}{!tasks.rows.length&&<p className="muted">No tasks due.</p>}</section><section className="work-panel"><h2>Messages</h2>{messages.rows.map(m=><p key={m.id}><Link className="record-link" href={m.href??'/dashboard/deals'}>{m.title}</Link></p>)}{!messages.rows.length&&<p className="muted">No unread message notifications.</p>}<Link className="record-link" href="/dashboard/deals">Open deal conversations →</Link></section></div></>;
}
