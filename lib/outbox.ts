import type { PoolClient } from 'pg';
import { db } from './db';
import { sendMail } from './mailer';

export const MAX_ATTEMPTS = 6;
/** Minutes to wait after the Nth failed attempt: 1, 5, 30, 2 h, 6 h. */
export const BACKOFF_MINUTES = [1, 5, 30, 120, 360];
export const backoffMinutes = (attempt: number) => BACKOFF_MINUTES[Math.min(attempt - 1, BACKOFF_MINUTES.length - 1)];
type Q = Pick<PoolClient, 'query'>;

/**
 * Queue a notice. With a dedupe key the same notice is never queued twice. Pass the caller's transaction client to make the notice
 * commit or roll back together with the event that caused it. Never queue anything containing a live token or a secret.
 */
export async function enqueueMail(to: string, subject: string, text: string, o: { dedupeKey?: string; client?: Q } = {}): Promise<number | null> {
  const r = await (o.client ?? db()).query(
    'INSERT INTO email_outbox(to_email,subject,body,dedupe_key) VALUES($1,$2,$3,$4) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id', [to, subject, text, o.dedupeKey ?? null]);
  return r.rows[0]?.id ?? null;
}

/** Sends one queued message that is due (SKIP LOCKED: parallel workers never double-send). Blank the body once delivered. */
async function deliverOne(): Promise<'sent' | 'failed' | 'dead' | 'none'> {
  const c = await db().connect();
  try {
    await c.query('BEGIN');
    const m = (await c.query("SELECT id,to_email,subject,body,attempts FROM email_outbox WHERE status='pending' AND next_attempt_at<=now() ORDER BY next_attempt_at, id LIMIT 1 FOR UPDATE SKIP LOCKED")).rows[0];
    if (!m) { await c.query('COMMIT'); return 'none'; }
    try {
      await sendMail(m.to_email, m.subject, m.body);
      await c.query("UPDATE email_outbox SET status='sent',sent_at=now(),attempts=attempts+1,body='',last_error=NULL WHERE id=$1", [m.id]);
      await c.query('COMMIT'); return 'sent';
    } catch (e) {
      const n = m.attempts + 1, dead = n >= MAX_ATTEMPTS;
      await c.query("UPDATE email_outbox SET attempts=$2,status=$3,last_error=$4,next_attempt_at=now()+make_interval(mins=>$5) WHERE id=$1",
        [m.id, n, dead ? 'dead' : 'pending', String((e as Error).message).slice(0, 200), backoffMinutes(n)]);
      if (dead) await c.query("UPDATE email_outbox SET body='' WHERE id=$1", [m.id]);
      await c.query('COMMIT'); return dead ? 'dead' : 'failed';
    }
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

export async function drainOutbox(limit = 100): Promise<{ sent: number; retrying: number; dead: number }> {
  const out = { sent: 0, retrying: 0, dead: 0 };
  for (let i = 0; i < limit; i++) {
    const r = await deliverOne();
    if (r === 'none') break;
    if (r === 'sent') out.sent++; else if (r === 'failed') out.retrying++; else out.dead++;
  }
  return out;
}

/** Queue, then try straight away so users see no delay; if the provider is down the job retries with backoff. Never throws. */
export async function sendNotice(to: string, subject: string, text: string, o: { dedupeKey?: string } = {}): Promise<void> {
  try { if (await enqueueMail(to, subject, text, o)) await drainOutbox(5); }
  catch (e) { console.error('notice could not be queued', (e as Error).message); }
}

/** Tidy-up: delivered rows after 7 days, dead ones after 30. */
export async function purgeOutbox(): Promise<number> {
  return (await db().query("DELETE FROM email_outbox WHERE (status='sent' AND sent_at<now()-interval '7 days') OR (status='dead' AND created_at<now()-interval '30 days')")).rowCount ?? 0;
}
export async function outboxStats(): Promise<{ pending: number; dead: number; oldestPendingMinutes: number | null }> {
  const r = (await db().query("SELECT count(*) FILTER (WHERE status='pending')::int AS pending, count(*) FILTER (WHERE status='dead')::int AS dead, EXTRACT(EPOCH FROM now()-min(created_at) FILTER (WHERE status='pending'))/60 AS oldest FROM email_outbox")).rows[0];
  return { pending: r.pending, dead: r.dead, oldestPendingMinutes: r.oldest === null ? null : Math.round(Number(r.oldest)) };
}
