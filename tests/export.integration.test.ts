import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { db } from '../lib/db';
import { buildExport } from '../lib/data-export';

let a: string, b: string, r: string, deal: string;
async function user(name: string, role: string) {
  return (await db().query('INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now()) RETURNING id', [name.toLowerCase() + '@example.test', name, role, 'SECRET-HASH'])).rows[0].id as string;
}
beforeEach(async () => {
  await db().query('TRUNCATE users CASCADE');
  a = await user('Alice', 'athlete'); b = await user('Bob', 'sponsor'); r = await user('Rita', 'recruiter');
  await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','college',CURRENT_DATE-INTERVAL '20 years')", [a]);
  deal = (await db().query("INSERT INTO deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at) VALUES($1,$2,'Camp',150000,'Two posts and an appearance in November','active',now()) RETURNING id", [a, b])).rows[0].id;
  await db().query("INSERT INTO deal_messages(deal_id,sender_id,body) VALUES($1,$2,'Alice wrote this'),($1,$3,'Bob wrote this')", [deal, a, b]);
  await db().query("INSERT INTO posts(author_id,body) VALUES($1,'Alice post'),($2,'Bob post')", [a, b]);
  await db().query("INSERT INTO follows(follower_id,followee_id,status) VALUES($1,$2,'approved')", [b, a]);
  await db().query("INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)", [a, r]);
  await db().query("INSERT INTO security_events(user_id,action) VALUES($1,'mfa_enabled')", [a]);
  await db().query("INSERT INTO notifications(user_id,kind,title) VALUES($1,'account','Hello')", [a]);
  await db().query("INSERT INTO organizations(name,created_by) VALUES('Club',$1)", [a]);
  await db().query("INSERT INTO organization_members(organization_id,user_id,role) SELECT id,$1,'owner' FROM organizations", [a]);
});
afterAll(async () => { await db().end(); });

describe('personal data export', () => {
  it('runs every query and contains the person’s own records', async () => {
    const x = await buildExport(a) as Record<string, any>;
    expect(x.account.email).toBe('alice@example.test');
    expect(x.messagesWritten.map((m: any) => m.body)).toEqual(['Alice wrote this']);
    expect(x.posts.map((p: any) => p.body)).toEqual(['Alice post']);
    expect(x.followers).toEqual([expect.objectContaining({ person: 'Bob', status: 'approved' })]);
    expect(x.blocks).toEqual([expect.objectContaining({ person: 'Rita' })]);
    expect(x.securityActivity.map((e: any) => e.action)).toEqual(['mfa_enabled']);
    expect(x.notifications).toHaveLength(1);
    expect(x.organizations).toEqual([expect.objectContaining({ name: 'Club', role: 'owner' })]);
    expect(x.twoFactor).toEqual({ enabled: false });
  });
  it('never includes another person’s messages or posts, or credentials', async () => {
    const mine = JSON.stringify(await buildExport(a));
    expect(mine).not.toContain('Bob wrote this'); expect(mine).not.toContain('Bob post'); expect(mine).not.toContain('SECRET-HASH');
    const bobs = JSON.stringify(await buildExport(b));
    expect(bobs).toContain('Bob wrote this'); expect(bobs).not.toContain('Alice wrote this'); expect(bobs).not.toContain('Alice post');
  });
  it('keeps private evaluations private: a recruiter’s report about an athlete is not in the athlete’s export', async () => {
    await db().query("INSERT INTO scouting_reports(athlete_id,author_id,title,notes,observed_on) VALUES($1,$2,'Eval','PRIVATE ASSESSMENT',CURRENT_DATE)", [a, r]).catch(async () => {
      const cols = (await db().query("SELECT column_name FROM information_schema.columns WHERE table_name='scouting_reports' AND is_nullable='NO' AND column_default IS NULL")).rows.map((c) => c.column_name);
      throw new Error('scouting_reports needs: ' + cols.join(','));
    });
    expect(JSON.stringify(await buildExport(a))).not.toContain('PRIVATE ASSESSMENT');
    expect(JSON.stringify(await buildExport(r))).toContain('PRIVATE ASSESSMENT');
  });
});
