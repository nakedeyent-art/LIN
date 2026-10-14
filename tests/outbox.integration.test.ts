import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';

const mail = vi.hoisted(() => ({ fail: false, sent: [] as string[][] }));
vi.mock('../lib/mailer', () => ({
  appUrl: () => 'http://localhost:3113',
  sendMail: async (to: string, subject: string, text: string) => { if (mail.fail) throw new Error('provider down'); mail.sent.push([to, subject, text]); },
}));

import { db } from '../lib/db';
import { enqueueMail, drainOutbox, sendNotice, purgeOutbox, outboxStats, backoffMinutes, MAX_ATTEMPTS } from '../lib/outbox';

beforeEach(async () => { await db().query('TRUNCATE email_outbox'); mail.fail = false; mail.sent = []; });
afterAll(async () => { await db().end(); });
const row = async () => (await db().query('SELECT * FROM email_outbox ORDER BY id')).rows;

describe('email outbox', () => {
  it('delivers once and clears the body afterwards', async () => {
    await enqueueMail('a@example.test', 'Hello', 'Secret-ish body');
    expect(await drainOutbox()).toEqual({ sent: 1, retrying: 0, dead: 0 });
    expect(await drainOutbox()).toEqual({ sent: 0, retrying: 0, dead: 0 });
    expect(mail.sent).toEqual([['a@example.test', 'Hello', 'Secret-ish body']]);
    const [r] = await row(); expect(r.status).toBe('sent'); expect(r.body).toBe(''); expect(r.sent_at).not.toBeNull();
  });
  it('deduplicates by key', async () => {
    expect(await enqueueMail('a@example.test', 's', 'b', { dedupeKey: 'k1' })).not.toBeNull();
    expect(await enqueueMail('a@example.test', 's', 'b', { dedupeKey: 'k1' })).toBeNull();
    expect(await row()).toHaveLength(1);
  });
  it('retries a failing provider with backoff and stops after the maximum', async () => {
    mail.fail = true; await enqueueMail('a@example.test', 's', 'b');
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
      expect(await drainOutbox()).toEqual({ sent: 0, retrying: 1, dead: 0 });
      let [r] = await row(); expect(r.attempts).toBe(attempt); expect(r.status).toBe('pending'); expect(r.last_error).toContain('provider down');
      expect(await drainOutbox()).toEqual({ sent: 0, retrying: 0, dead: 0 });      // not due yet
      await db().query("UPDATE email_outbox SET next_attempt_at=now()-interval '1 second'");
    }
    expect(await drainOutbox()).toEqual({ sent: 0, retrying: 0, dead: 1 });
    const [r] = await row(); expect(r.status).toBe('dead'); expect(r.body).toBe(''); expect(r.attempts).toBe(MAX_ATTEMPTS);
    expect(await drainOutbox()).toEqual({ sent: 0, retrying: 0, dead: 0 });
  });
  it('recovers when the provider comes back', async () => {
    mail.fail = true; await enqueueMail('a@example.test', 's', 'b'); await drainOutbox();
    mail.fail = false; await db().query("UPDATE email_outbox SET next_attempt_at=now()");
    expect(await drainOutbox()).toEqual({ sent: 1, retrying: 0, dead: 0 });
  });
  it('never sends the same message twice when workers run in parallel', async () => {
    for (let i = 0; i < 20; i++) await enqueueMail(`u${i}@example.test`, 's', 'b');
    await Promise.all([drainOutbox(), drainOutbox(), drainOutbox(), drainOutbox()]);
    expect(mail.sent).toHaveLength(20); expect(new Set(mail.sent.map((m) => m[0])).size).toBe(20);
  });
  it('queues inside the caller’s transaction: a rollback queues nothing', async () => {
    const c = await db().connect();
    try { await c.query('BEGIN'); await enqueueMail('a@example.test', 's', 'b', { client: c }); await c.query('ROLLBACK'); } finally { c.release(); }
    expect(await row()).toHaveLength(0);
  });
  it('sendNotice sends immediately and never throws, even when the provider is down', async () => {
    await sendNotice('a@example.test', 'now', 'b'); expect(mail.sent).toHaveLength(1);
    mail.fail = true; await expect(sendNotice('b@example.test', 'later', 'b')).resolves.toBeUndefined();
    expect((await row()).map((r) => r.status)).toEqual(['sent', 'pending']);
  });
  it('purges old finished rows and reports health', async () => {
    mail.fail = true; await enqueueMail('a@example.test', 's', 'b'); await drainOutbox();
    expect(await outboxStats()).toMatchObject({ pending: 1, dead: 0 });
    mail.fail = false; await enqueueMail('b@example.test', 's', 'b'); await drainOutbox();
    await db().query("UPDATE email_outbox SET sent_at=now()-interval '8 days' WHERE status='sent'");
    expect(await purgeOutbox()).toBe(1);
    expect(backoffMinutes(1)).toBe(1); expect(backoffMinutes(99)).toBe(360);
  });
});
