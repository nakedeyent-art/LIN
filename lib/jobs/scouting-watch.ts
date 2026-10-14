import { createHash } from 'node:crypto';
import { db } from '../db';
import { visibleProspect } from '../scouting';
import type { Session } from '../session';
import type { JobResult } from './adult-transition';

export const WATCH_BATCH = 500;
const HIDDEN = 'not-visible';

/** Round-robin: least recently checked first (never-checked entries lead), so a board larger than one batch is fully covered over several runs. */
export async function nextWatchBatch(limit = WATCH_BATCH) {
  return (await db().query(
    `SELECT b.athlete_id,u.id,u.full_name,u.email FROM recruiting_board b JOIN users u ON u.id=b.recruiter_id
       LEFT JOIN scouting_watch_state w ON w.recruiter_id=b.recruiter_id AND w.athlete_id=b.athlete_id
      WHERE u.deleted_at IS NULL AND u.suspended_at IS NULL AND u.role='recruiter'
      ORDER BY w.checked_at ASC NULLS FIRST, b.updated_at, b.athlete_id LIMIT $1`, [limit])).rows as { athlete_id: string; id: string; full_name: string; email: string }[];
}

export async function runScoutingWatch({ dry, batch = WATCH_BATCH }: { dry: boolean; batch?: number }): Promise<JobResult> {
  if (dry) return { processed: 0, failed: 0, skipped: 0 };
  let processed = 0, skipped = 0, failed = 0;
  for (const r of await nextWatchBatch(batch)) {
    try {
      const s: Session = { userId: r.id, name: r.full_name, email: r.email, role: 'recruiter', emailVerified: true, isAdmin: false };
      const a = await visibleProspect(s, r.athlete_id);
      // Every examined row is stamped, visible or not, so unviewable prospects cannot hold the front of the queue.
      let digest = HIDDEN;
      if (a) {
        const events = (await db().query("SELECT e.id,e.name,d.starts_at FROM sports_attendees a JOIN events e ON e.id=a.event_id JOIN sports_event_details d ON d.event_id=e.id WHERE a.athlete_id=$1 AND d.recruiting_visible AND e.status='published' AND d.starts_at>now() ORDER BY e.id", [a.id])).rows;
        digest = createHash('sha256').update(JSON.stringify({ sport: a.sport, position: a.position, level: a.level, gradYear: a.grad_year, events })).digest('hex');
      }
      const c = await db().connect();
      try {
        await c.query('BEGIN');
        await c.query('INSERT INTO scouting_watch_state(recruiter_id,athlete_id,profile_digest) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [s.userId, r.athlete_id, digest]);
        const previous = (await c.query('SELECT profile_digest FROM scouting_watch_state WHERE recruiter_id=$1 AND athlete_id=$2 FOR UPDATE', [s.userId, r.athlete_id])).rows[0];
        if (a && previous.profile_digest !== digest) {
          await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account','A watched prospect updated their profile or shared an event',$2)", [s.userId, `/dashboard/scouting/${a.id}`]);
          processed++;
        } else if (!a) skipped++;
        await c.query('UPDATE scouting_watch_state SET profile_digest=$3,checked_at=now(),updated_at=CASE WHEN profile_digest<>$3 THEN now() ELSE updated_at END WHERE recruiter_id=$1 AND athlete_id=$2', [s.userId, r.athlete_id, digest]);
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    } catch (e) { failed++; console.error('scouting-watch: entry failed', (e as Error).message); }
  }
  return { processed, skipped, failed };
}
