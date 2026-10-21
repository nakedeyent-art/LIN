import { requireUser } from '@/lib/session';
import { subjectsFor, canEditFamily } from '@/lib/access';
import { db } from '@/lib/db';
import { needsYou } from '@/lib/needs-you';
import { FeedCard, FeedEmpty, FeedSection, PageHead } from '@/components/ui';
import { WellnessCheckin } from '@/components/wellness-checkin';

/** Venue wall-clock time: events are scheduled in the venue's zone (see sports_event_details.timezone). */
const venueTime = (at: Date, tz: string | null) => {
  try { return new Intl.DateTimeFormat('en-US', { timeZone: tz ?? 'UTC', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(at)); }
  catch { return new Date(at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
};
const due = (at: Date) => { const d = new Date(at); return d < new Date() ? `Overdue · was due ${d.toISOString().slice(0, 10)}` : `Due ${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`; };

/**
 * Today — the feed. Decisions only you can make come first (orange), then what is happening,
 * then what is due and what people said. One card, one action.
 */
export default async function Today() {
  const s = await requireUser(), athletes = (await subjectsFor(s)).filter(canEditFamily), ids = athletes.map(a => a.id);
  const names = new Map(athletes.map(a => [a.id, a.name]));
  const [pending, events, tasks, messages] = await Promise.all([
    needsYou(s),
    db().query("SELECT e.id,e.name,d.starts_at,d.timezone,d.kind,a.athlete_id,(d.starts_at<CURRENT_DATE+1) AS today FROM sports_attendees a JOIN events e ON e.id=a.event_id JOIN sports_event_details d ON d.event_id=e.id WHERE a.athlete_id=ANY($1::uuid[]) AND d.starts_at>=CURRENT_DATE AND d.starts_at<CURRENT_DATE+8 AND e.status<>'cancelled' ORDER BY d.starts_at LIMIT 30", [ids]),
    db().query("SELECT id,title,athlete_id,due_at FROM operational_tasks WHERE athlete_id=ANY($1::uuid[]) AND status='open' AND due_at<now()+INTERVAL '1 day' ORDER BY due_at LIMIT 30", [ids]),
    db().query("SELECT id,title,href FROM notifications WHERE user_id=$1 AND kind='message' AND read_at IS NULL ORDER BY created_at DESC LIMIT 20", [s.userId]),
  ]);
  const todayEvents = events.rows.filter(e => e.today), soon = events.rows.filter(e => !e.today);
  const who = (id: string) => athletes.length > 1 ? ` · ${names.get(id) ?? ''}` : '';
  return <>
    <PageHead eyebrow={new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date()) + ' · UTC'} title="Today" tag="Decisions waiting on you first, then games, tasks and conversations." />
    {['athlete', 'manager', 'trainer'].includes(s.role) && <WellnessCheckin athleteName={athletes[0]?.name ?? s.name} />}
    <div className="feed">
      <FeedSection needs={pending.length > 0} id="needs-you">Needs you{pending.length ? ` · ${pending.length}` : ''}</FeedSection>
      {pending.length
        ? pending.map(i => <FeedCard key={i.key} needs icon={i.kind === 'signature' ? '✍' : '$'} title={i.title} detail={i.detail} href={i.href} cta={i.cta} />)
        : <p className="feed-all-clear" role="status"><span aria-hidden>✓</span> No signatures or decisions are waiting on you.</p>}

      <FeedSection>Games and events today</FeedSection>
      {todayEvents.length ? todayEvents.map(e => <FeedCard key={`${e.id}-${e.athlete_id}`} icon="●" title={e.name} detail={`${String(e.kind ?? 'event').replaceAll('_', ' ')} · ${venueTime(e.starts_at, e.timezone)}${who(e.athlete_id)}`} href={`/dashboard/schedule?athlete=${e.athlete_id}`} cta="Open schedule" />)
        : <FeedEmpty>No games or events scheduled today.</FeedEmpty>}

      {soon.length > 0 && <><FeedSection>Coming up this week</FeedSection>
        {soon.map(e => <FeedCard key={`${e.id}-${e.athlete_id}`} icon="○" title={e.name} detail={`${String(e.kind ?? 'event').replaceAll('_', ' ')} · ${venueTime(e.starts_at, e.timezone)}${who(e.athlete_id)}`} href={`/dashboard/schedule?athlete=${e.athlete_id}`} />)}</>}

      <FeedSection>Due and overdue tasks</FeedSection>
      {tasks.rows.length ? tasks.rows.map(t => <FeedCard key={t.id} icon="☐" title={t.title} detail={`${due(t.due_at)}${who(t.athlete_id)}`} href={`/dashboard/tasks?athlete=${t.athlete_id}`} cta="Open task" />)
        : <FeedEmpty>No tasks due.</FeedEmpty>}

      <FeedSection>Messages</FeedSection>
      {messages.rows.length ? messages.rows.map(m => <FeedCard key={m.id} icon="✉" title={m.title} href={m.href ?? '/dashboard/deals'} cta="Reply" />)
        : <FeedEmpty>No unread message notifications. <a className="record-link" href="/dashboard/deals">Open deal conversations →</a></FeedEmpty>}
    </div>
  </>;
}
