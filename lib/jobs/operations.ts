import { db } from '../db';
import { deliverSigningNotices } from '../signing';
import type { JobResult } from './adult-transition';

export const ENVELOPE_BATCH = 200, REMINDER_BATCH = 500;

/**
 * Idempotent reminders use durable unique delivery records; no sensitive details in notifications.
 * Fairness: every query EXCLUDES what has already been handled today, so a backlog larger than a batch is worked through across runs
 * instead of re-reading the same first rows forever (the old LIMIT-without-progress queries starved everything after row 200/500).
 * One bad record is counted as a failure and skipped; it never stops the rest of the batch.
 */
export async function runOperationsReminders({ dry }: { dry: boolean }): Promise<JobResult> {
  if (dry) return { processed: 0, skipped: 0, failed: 0 };
  let processed = 0, failed = 0;

  // 1) Expire what is past its deadline (rows leave the set once expired, so repeated runs always make progress).
  const overdue = (await db().query("SELECT id FROM signing_envelopes WHERE status IN ('sent','viewed','partially_signed') AND expires_at<=now() ORDER BY expires_at, id LIMIT $1", [ENVELOPE_BATCH])).rows;
  for (const e of overdue) {
    try {
      const c = await db().connect();
      try {
        await c.query('BEGIN');
        const changed = await c.query("UPDATE signing_envelopes SET status='expired' WHERE id=$1 AND status IN ('sent','viewed','partially_signed') RETURNING id", [e.id]);
        if (changed.rowCount) await c.query("INSERT INTO signing_events(envelope_id,action) VALUES($1,'envelope.expired')", [e.id]);
        await c.query('COMMIT');
      } catch (err) { await c.query('ROLLBACK'); throw err; } finally { c.release(); }
      await deliverSigningNotices(e.id, 'expired'); processed++;
    } catch (err) { failed++; console.error('operations-reminders: expiry failed', (err as Error).message); }
  }

  // 2) Daily reminder for live envelopes that have not had one today.
  const due = (await db().query(
    `SELECT e.id FROM signing_envelopes e WHERE e.status IN ('sent','viewed','partially_signed') AND e.expires_at>now()
        AND NOT EXISTS (SELECT 1 FROM signing_delivery_events d WHERE d.envelope_id=e.id AND d.kind='reminder' AND d.delivery_day=CURRENT_DATE)
      ORDER BY e.expires_at, e.id LIMIT $1`, [ENVELOPE_BATCH])).rows;
  for (const e of due) {
    try { await deliverSigningNotices(e.id, 'reminder'); processed++; }
    catch (err) { failed++; console.error('operations-reminders: reminder failed', (err as Error).message); }
  }

  // 3) Tasks, expiring documents and scouting follow-ups: only rows without a reminder today, oldest deadline first.
  const reminders = (await db().query(
    `SELECT * FROM (
       SELECT 'task' AS kind,t.id::text AS id,t.assigned_to AS user_id,'An operational task is due' AS title,'/dashboard/tasks?athlete='||t.athlete_id AS href,t.due_at::date AS due
         FROM operational_tasks t WHERE t.status='open' AND t.due_at<=now()+INTERVAL '1 day' AND (t.assigned_to=t.athlete_id OR EXISTS(SELECT 1 FROM guardian_links g WHERE g.athlete_id=t.athlete_id AND g.member_id=t.assigned_to))
       UNION ALL SELECT 'document',d.id::text,d.athlete_id,'An athlete document expires soon','/dashboard/documents/'||d.id,d.expires_on FROM athlete_documents d WHERE d.status='active' AND d.expires_on<=CURRENT_DATE+7
       UNION ALL SELECT 'scouting',f.id::text,f.owner_id,'A scouting follow-up is due','/dashboard/scouting',f.due_on FROM scouting_followups f WHERE NOT f.done AND f.due_on<=CURRENT_DATE+1
     ) x WHERE NOT EXISTS (SELECT 1 FROM operations_reminders r WHERE r.resource_type=x.kind AND r.resource_id=x.id AND r.user_id=x.user_id AND r.sent_on=CURRENT_DATE)
     ORDER BY x.due, x.id LIMIT $1`, [REMINDER_BATCH])).rows;
  for (const n of reminders) {
    try {
      const c = await db().connect();
      try {
        await c.query('BEGIN');
        const r = await c.query('INSERT INTO operations_reminders(resource_type,resource_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING resource_id', [n.kind, n.id, n.user_id]);
        if (r.rowCount) { await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account',$2,$3)", [n.user_id, n.title, n.href]); processed++; }
        await c.query('COMMIT');
      } catch (err) { await c.query('ROLLBACK'); throw err; } finally { c.release(); }
    } catch (err) { failed++; console.error('operations-reminders: reminder failed', (err as Error).message); }
  }
  return { processed, skipped: 0, failed };
}
