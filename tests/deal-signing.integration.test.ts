import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('../lib/mailer', () => ({ appUrl: () => 'http://localhost:3113', sendMail: async () => {} }));
import { db } from '../lib/db';
import type { Session } from '../lib/session';
import { createContractForDeal, voidContract } from '../lib/contractdb';
import { prepareDealSigning, completeLinkedDeal } from '../lib/deal-signing';

let sponsor: Session, athlete: Session, dealId: string;
async function user(name: string, role: Session['role']): Promise<Session> {
  const id = (await db().query('INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now()) RETURNING id', [name.toLowerCase() + '@example.test', name, role, 'x'])).rows[0].id;
  return { userId: id, name, email: name.toLowerCase() + '@example.test', role, emailVerified: true, isAdmin: false };
}
beforeEach(async () => {
  await db().query('TRUNCATE users CASCADE');
  sponsor = await user('Sponsor', 'sponsor'); athlete = await user('Athlete', 'athlete');
  await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date,discoverable) VALUES($1,'Soccer','college',CURRENT_DATE-INTERVAL '20 years',true)", [athlete.userId]);
  dealId = (await db().query(`INSERT INTO deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at)
    VALUES($1,$2,'Camp appearance',150000,'Two posts and an appearance in November','awaiting_signature',now(),now()+interval '10 days') RETURNING id`, [athlete.userId, sponsor.userId])).rows[0].id;
  const c = await db().connect(); try { await createContractForDeal(c, dealId); } finally { c.release(); }
});
afterAll(async () => { await db().end(); });
const envelope = async () => (await db().query('SELECT * FROM signing_envelopes WHERE deal_id=$1', [dealId])).rows[0];

describe('a deal that ends while its agreement is out for signature', () => {
  it('voids the Forg3 envelope together with the contract, invalidates signing links, and tells the signers', async () => {
    const envId = await prepareDealSigning(sponsor, dealId);
    expect((await envelope()).status).toBe('sent');
    await db().query("INSERT INTO signing_sessions(envelope_id,recipient_id,user_id,token_hash,expires_at) SELECT $1,id,user_id,repeat('a',64),now()+interval '1 hour' FROM signing_recipients WHERE envelope_id=$1 AND capacity='sponsor'", [envId]);
    const c = await db().connect();
    try { await c.query('BEGIN'); await c.query("UPDATE deals SET status='withdrawn' WHERE id=$1", [dealId]); await voidContract(c, dealId); await c.query('COMMIT'); } finally { c.release(); }
    expect((await envelope()).status).toBe('voided');
    expect((await db().query('SELECT count(*)::int AS n FROM signing_sessions WHERE envelope_id=$1', [envId])).rows[0].n).toBe(0);
    expect((await db().query("SELECT count(*)::int AS n FROM signing_events WHERE envelope_id=$1 AND action='envelope.voided_with_deal'", [envId])).rows[0].n).toBe(1);
    expect((await db().query("SELECT count(*)::int AS n FROM notifications WHERE href=$1", ['/dashboard/signing/' + envId])).rows[0].n).toBe(2);
  });
  it('keeps a completed agreement’s envelope untouched', async () => {
    const envId = await prepareDealSigning(sponsor, dealId);
    await db().query("UPDATE signing_envelopes SET status='completed',completed_at=now() WHERE id=$1", [envId]);
    const c = await db().connect();
    try { await c.query('BEGIN'); await voidContract(c, dealId); await c.query('COMMIT'); } finally { c.release(); }
    expect((await envelope()).status).toBe('completed');
  });
});

describe('authority changing while an agreement waits for signature', () => {
  let guardian: Session;
  beforeEach(async () => {
    guardian = await user('Guardian', 'parent');
    await db().query("UPDATE athlete_profiles SET birth_date=CURRENT_DATE-INTERVAL '16 years' WHERE user_id=$1", [athlete.userId]);
    await db().query("INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved) VALUES($1,$2,'parent',true)", [athlete.userId, guardian.userId]);
    await db().query('UPDATE deals SET guardian_approved_by=$2 WHERE id=$1', [dealId, guardian.userId]);
  });
  const recipients = async (id: string) => (await db().query('SELECT capacity,user_id FROM signing_recipients WHERE envelope_id=$1 ORDER BY signing_order', [id])).rows;

  it('a minor’s agreement goes to the guardian, and asking again returns the same envelope', async () => {
    const id = await prepareDealSigning(sponsor, dealId);
    expect((await recipients(id)).map((r) => r.capacity)).toEqual(['sponsor', 'guardian']);
    expect(await prepareDealSigning(sponsor, dealId)).toBe(id);
  });
  it('when the athlete turns 18 the stuck guardian envelope is replaced by one the athlete signs', async () => {
    const old = await prepareDealSigning(sponsor, dealId);
    await db().query("UPDATE athlete_profiles SET birth_date=CURRENT_DATE-INTERVAL '18 years'-INTERVAL '1 day' WHERE user_id=$1", [athlete.userId]);
    const fresh = await prepareDealSigning(sponsor, dealId);
    expect(fresh).not.toBe(old);
    expect((await db().query('SELECT status FROM signing_envelopes WHERE id=$1', [old])).rows[0].status).toBe('voided');
    expect((await recipients(fresh)).map((r) => [r.capacity, r.user_id])).toEqual([['sponsor', sponsor.userId], ['athlete', athlete.userId]]);
    expect((await db().query("SELECT status FROM signing_envelopes WHERE id=$1", [fresh])).rows[0].status).toBe('sent');
    expect((await db().query("SELECT count(*)::int AS n FROM signing_events WHERE envelope_id=$1 AND action='envelope.reissued_authority_changed'", [old])).rows[0].n).toBe(1);
    expect(await prepareDealSigning(sponsor, dealId)).toBe(fresh);                       // and it is stable afterwards
  });
  it('when the guardian is removed and another is linked, the agreement is reissued to the current guardian', async () => {
    const second = await user('Guardian2', 'parent');
    await db().query("INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved) VALUES($1,$2,'parent',true)", [athlete.userId, second.userId]);
    const old = await prepareDealSigning(sponsor, dealId);
    await db().query('DELETE FROM athlete_relationships WHERE athlete_id=$1 AND member_id=$2', [athlete.userId, guardian.userId]);
    const fresh = await prepareDealSigning(sponsor, dealId);
    expect(fresh).not.toBe(old);
    expect((await recipients(fresh))[1]).toMatchObject({ capacity: 'guardian', user_id: second.userId });
  });
  it('with no guardian left it refuses with a clear error', async () => {
    await prepareDealSigning(sponsor, dealId);
    await db().query('DELETE FROM athlete_relationships WHERE athlete_id=$1', [athlete.userId]);
    await expect(prepareDealSigning(sponsor, dealId)).rejects.toThrow(/guardian/i);
  });
  it('never replaces an envelope whose stale recipient already signed', async () => {
    const id = await prepareDealSigning(sponsor, dealId);
    const g = (await db().query("SELECT id FROM signing_recipients WHERE envelope_id=$1 AND capacity='guardian'", [id])).rows[0].id;
    await db().query("UPDATE signing_recipients SET status='signed' WHERE id=$1", [g]);
    await db().query("UPDATE athlete_profiles SET birth_date=CURRENT_DATE-INTERVAL '19 years' WHERE user_id=$1", [athlete.userId]);
    expect(await prepareDealSigning(sponsor, dealId)).toBe(id);
  });
});

describe('who may start the generated agreement, and what the legacy evidence records', () => {
  it('refuses a minor athlete; the sponsor or a guardian starts it', async () => {
    const guardian = await user('Guardian', 'parent');
    await db().query("UPDATE athlete_profiles SET birth_date=CURRENT_DATE-INTERVAL '16 years' WHERE user_id=$1", [athlete.userId]);
    await db().query("INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved) VALUES($1,$2,'parent',true)", [athlete.userId, guardian.userId]);
    await expect(prepareDealSigning(athlete, dealId)).rejects.toThrow(/guardian must start/);
    expect(await envelope()).toBeUndefined();
    expect(typeof await prepareDealSigning(guardian, dealId)).toBe('string');
  });
  it('an adult athlete may start it', async () => {
    expect(typeof await prepareDealSigning(athlete, dealId)).toBe('string');
  });
  it('records the hash of the signed PDF alongside the contract text hash', async () => {
    const envId = await prepareDealSigning(sponsor, dealId);
    const pdfHash = (await db().query('SELECT v.sha256 FROM signing_envelopes e JOIN document_versions v ON v.id=e.version_id WHERE e.id=$1', [envId])).rows[0].sha256 as string;
    const recs = (await db().query('SELECT r.id,r.user_id,(SELECT id FROM signing_fields f WHERE f.recipient_id=r.id AND f.kind=\'signature\') AS field FROM signing_recipients r WHERE r.envelope_id=$1', [envId])).rows;
    for (const r of recs) {
      await db().query('INSERT INTO signing_evidence(envelope_id,recipient_id,user_id,document_sha256,field_values,consent_version) VALUES($1,$2,$3,$4,$5,$6)', [envId, r.id, r.user_id, pdfHash, JSON.stringify({ [r.field]: 'Signed Name' }), 'v1']);
      await db().query("UPDATE signing_recipients SET status='signed',signed_at=now() WHERE id=$1", [r.id]);
    }
    const c = await db().connect();
    try { await c.query('BEGIN'); await completeLinkedDeal(c, envId, sponsor.userId); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    const sigs = (await db().query('SELECT cs.document_sha256,cs.signed_pdf_sha256,k.sha256 AS text_hash FROM contract_signatures cs JOIN contracts k ON k.id=cs.contract_id WHERE k.deal_id=$1', [dealId])).rows;
    expect(sigs.length).toBe(2);
    for (const x of sigs) { expect(x.signed_pdf_sha256).toBe(pdfHash); expect(x.document_sha256).toBe(x.text_hash); expect(x.signed_pdf_sha256).not.toBe(x.document_sha256); }
    expect((await db().query('SELECT status FROM deals WHERE id=$1', [dealId])).rows[0].status).toBe('active');
  });
});
