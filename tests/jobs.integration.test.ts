import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('../lib/mailer', () => ({ appUrl: () => 'http://localhost:3113', sendMail: async () => {} }));
import { db } from '../lib/db';
import { runOperationsReminders, ENVELOPE_BATCH, REMINDER_BATCH } from '../lib/jobs/operations';
import { runScoutingWatch, nextWatchBatch } from '../lib/jobs/scouting-watch';

let athlete: string, recruiter: string;
async function user(name: string, role: string) {
  return (await db().query('INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now()) RETURNING id', [name.toLowerCase() + '@example.test', name, role, 'x'])).rows[0].id as string;
}
beforeEach(async () => {
  await db().query('TRUNCATE users CASCADE'); await db().query('TRUNCATE email_outbox');
  athlete = await user('Athlete', 'athlete'); recruiter = await user('Recruiter', 'recruiter');
  await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','college',CURRENT_DATE-INTERVAL '20 years')", [athlete]);
});
afterAll(async () => { await db().end(); });
const n = async (sql: string, p: unknown[] = []) => Number((await db().query(sql, p)).rows[0].n);

async function envelopes(live: number, overdue: number) {
  await db().query(`DO $$ DECLARE i INT; d UUID; v UUID; e UUID; BEGIN
    FOR i IN 1..${live + overdue} LOOP
      INSERT INTO athlete_documents(athlete_id,title,category,created_by) VALUES('${athlete}','Doc '||i,'contracts','${athlete}') RETURNING id INTO d;
      INSERT INTO document_versions(document_id,version,file_name,media_type,contents,sha256,uploaded_by) VALUES(d,1,'a.pdf','application/pdf','\\x00',repeat('0',64),'${athlete}') RETURNING id INTO v;
      INSERT INTO signing_envelopes(document_id,version_id,athlete_id,created_by,title,status,expires_at)
        VALUES(d,v,'${athlete}','${athlete}','Env '||i,'draft', CASE WHEN i<=${overdue} THEN now()-interval '1 hour' ELSE now()+interval '5 days' END) RETURNING id INTO e;
      INSERT INTO signing_recipients(envelope_id,user_id,capacity,signing_order) VALUES(e,'${athlete}','athlete',1);
      UPDATE signing_envelopes SET status='sent' WHERE id=e;
    END LOOP; END $$`);
}

describe('operations reminders reach every record, not just the first batch', () => {
  it('works through more live envelopes than one batch holds, across runs, and expires the overdue ones', async () => {
    const live = ENVELOPE_BATCH + 30;
    await envelopes(live, 12);
    const r1 = await runOperationsReminders({ dry: false });
    expect(r1.failed).toBe(0);
    expect(await n("SELECT count(*)::int AS n FROM signing_envelopes WHERE status='expired'")).toBe(12);
    expect(await n("SELECT count(*)::int AS n FROM signing_delivery_events WHERE kind='reminder'")).toBe(ENVELOPE_BATCH);
    await runOperationsReminders({ dry: false });
    expect(await n("SELECT count(*)::int AS n FROM signing_delivery_events WHERE kind='reminder'")).toBe(live);        // the tail was reached
    const before = await n('SELECT count(*)::int AS n FROM notifications');
    await runOperationsReminders({ dry: false });
    expect(await n('SELECT count(*)::int AS n FROM notifications')).toBe(before);                                       // idempotent for the day
    expect(await n('SELECT count(*)::int AS n FROM email_outbox WHERE dedupe_key IS NOT NULL')).toBe(live + 12);       // one generic email per recipient and event
    expect(await n("SELECT count(*)::int AS n FROM email_outbox WHERE body LIKE '%Env %' OR body LIKE '%Doc %'")).toBe(0);   // no document names in notices
  }, 120_000);

  it('works through more due tasks than one batch holds', async () => {
    const total = REMINDER_BATCH + 150;
    await db().query(`INSERT INTO operational_tasks(athlete_id,created_by,assigned_to,title,due_at) SELECT '${athlete}','${athlete}','${athlete}','T'||g, now()+(g||' minutes')::interval FROM generate_series(1,${total}) g`);
    const r1 = await runOperationsReminders({ dry: false });
    expect(r1.processed).toBe(REMINDER_BATCH);
    const r2 = await runOperationsReminders({ dry: false });
    expect(r2.processed).toBe(150);
    expect((await runOperationsReminders({ dry: false })).processed).toBe(0);
    expect(await n("SELECT count(*)::int AS n FROM notifications WHERE title='An operational task is due'")).toBe(total);
  }, 120_000);

  it('does nothing in a dry run and ignores tasks that are done', async () => {
    await db().query("INSERT INTO operational_tasks(athlete_id,created_by,assigned_to,title,due_at,status) VALUES($1,$1,$1,'Done one',now(),'done')", [athlete]);
    expect(await runOperationsReminders({ dry: true })).toEqual({ processed: 0, skipped: 0, failed: 0 });
    expect((await runOperationsReminders({ dry: false })).processed).toBe(0);
  });
});

describe('scouting watch covers the whole board over successive runs', () => {
  it('examines least-recently-checked entries first, so nobody is starved', async () => {
    const athletes: string[] = [];
    for (let i = 0; i < 7; i++) athletes.push(await user('Prospect' + i, 'athlete'));
    for (const a of athletes) await db().query("INSERT INTO recruiting_board(recruiter_id,athlete_id) VALUES($1,$2)", [recruiter, a]);
    const seen = new Set<string>();
    for (let run = 0; run < 3; run++) {
      const r = await runScoutingWatch({ dry: false, batch: 3 });
      expect(r.failed).toBe(0);
      (await db().query('SELECT athlete_id FROM scouting_watch_state WHERE checked_at IS NOT NULL')).rows.forEach((x) => seen.add(x.athlete_id));
    }
    expect(seen.size).toBe(7);                                                          // 3 + 3 + 1 across three runs
    const next = await nextWatchBatch(2);
    expect(next).toHaveLength(2);                                                       // the cycle simply continues
  });
  it('one failing entry does not stop the rest', async () => {
    const a = await user('P1', 'athlete'), b = await user('P2', 'athlete');
    for (const x of [a, b]) await db().query("INSERT INTO recruiting_board(recruiter_id,athlete_id) VALUES($1,$2)", [recruiter, x]);
    await db().query("INSERT INTO scouting_watch_state(recruiter_id,athlete_id,profile_digest) VALUES($1,$2,'x')", [recruiter, a]);
    await db().query('ALTER TABLE scouting_watch_state ADD CONSTRAINT boom CHECK (athlete_id <> \'' + a + '\' OR checked_at IS NULL)');
    try {
      const r = await runScoutingWatch({ dry: false });
      expect(r.failed).toBe(1);
      expect(await n('SELECT count(*)::int AS n FROM scouting_watch_state WHERE athlete_id=$1 AND checked_at IS NOT NULL', [b])).toBe(1);
    } finally { await db().query('ALTER TABLE scouting_watch_state DROP CONSTRAINT boom'); }
  });
});

describe('signing notices', () => {
  it('a second signature and the completion are not swallowed by same-day dedupe, but a retry still is', async () => {
    const { deliverSigningNotices } = await import('../lib/signing');
    await envelopes(1, 0);
    const id = (await db().query('SELECT id FROM signing_envelopes LIMIT 1')).rows[0].id;
    await deliverSigningNotices(id, 'progress', '1');
    await deliverSigningNotices(id, 'progress', '1');           // retry: deduplicated
    await deliverSigningNotices(id, 'progress', '2');
    await deliverSigningNotices(id, 'completed', '2');
    expect(await n('SELECT count(*)::int AS n FROM signing_delivery_events WHERE envelope_id=$1', [id])).toBe(3);
    expect(await n("SELECT count(*)::int AS n FROM notifications WHERE title LIKE 'Agreement completed'")).toBe(1);
  });
});
