import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { db } from '../lib/db';
import { privateReports } from '../lib/scouting';

afterAll(async () => { await db().end(); });
beforeEach(async () => { await db().query('TRUNCATE users CASCADE'); });
const user = async (n: string, role: string) => (await db().query('INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now()) RETURNING id', [n + '@example.test', n, role, 'x'])).rows[0].id as string;

describe('archived organizations grant nothing', () => {
  it('stop sharing scouting reports with members once archived', async () => {
    const [athlete, author, member] = [await user('a', 'athlete'), await user('author', 'recruiter'), await user('member', 'recruiter')];
    const org = (await db().query("INSERT INTO organizations(name,created_by) VALUES('Scouts',$1) RETURNING id", [author])).rows[0].id;
    await db().query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner'),($1,$3,'member')", [org, author, member]);
    await db().query("INSERT INTO scouting_reports(athlete_id,author_id,title,notes,observed_on,organization_id) VALUES($1,$2,'R','n','2026-01-01',$3)", [athlete, author, org]);
    const as = { userId: member, role: 'recruiter' } as never;
    expect((await privateReports(as, athlete)).length).toBe(1);
    await db().query('UPDATE organizations SET archived_at=now() WHERE id=$1', [org]);
    expect((await privateReports(as, athlete)).length).toBe(0);
    expect((await privateReports({ userId: author, role: 'recruiter' } as never, athlete)).length).toBe(1);   // the author keeps their own work
  });
});
