import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { db } from '../lib/db';
import * as org from '../lib/organizations';
import { eraseOperations } from '../lib/operations-erasure';

let a: string, b: string, c: string, d: string;
async function user(name: string) {
  return (await db().query('INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now()) RETURNING id', [name.toLowerCase() + '@example.test', name, 'coach', 'x'])).rows[0].id as string;
}
const emailOf = (n: string) => n.toLowerCase() + '@example.test';
const members = async (o: string) => (await db().query('SELECT user_id,role FROM organization_members WHERE organization_id=$1', [o])).rows as { user_id: string; role: string }[];
async function newOrg(owner = a) { const r = await org.createOrganization(owner, 'Prep Club'); if (!r.ok || !r.id) throw new Error('create failed'); return r.id; }
async function join(o: string, user: string, ago = 0) {
  await db().query("INSERT INTO organization_members(organization_id,user_id,role,joined_at) VALUES($1,$2,'member',now() - make_interval(mins=>$3))", [o, user, ago]);
}

beforeEach(async () => {
  await db().query('TRUNCATE users CASCADE');
  [a, b, c, d] = [await user('Alpha'), await user('Bravo'), await user('Charlie'), await user('Delta')];
});
afterAll(async () => { await db().end(); });

describe('organization invitations', () => {
  it('can invite again after a decline, a cancellation, an expiry and a removal', async () => {
    const o = await newOrg();
    for (const how of ['decline', 'revoke', 'expire', 'remove'] as const) {
      expect((await org.inviteMember(a, o, emailOf('Bravo'))).ok).toBe(true);
      const inv = (await db().query("SELECT id FROM organization_invites WHERE organization_id=$1 AND status='pending'", [o])).rows;
      expect(inv, how).toHaveLength(1);
      if (how === 'decline') expect((await org.respondInvite(b, inv[0].id, false)).ok).toBe(true);
      if (how === 'revoke') expect((await org.revokeInvite(a, inv[0].id)).ok).toBe(true);
      if (how === 'expire') { await db().query("UPDATE organization_invites SET expires_at=now()-interval '1 minute' WHERE id=$1", [inv[0].id]); expect((await org.respondInvite(b, inv[0].id, true)).ok).toBe(false); }
      if (how === 'remove') { expect((await org.respondInvite(b, inv[0].id, true)).ok).toBe(true); expect((await org.removeMember(a, o, b)).ok).toBe(true); }
    }
    expect((await members(o)).map((m) => m.user_id)).toEqual([a]);
  });
  it('keeps one pending invitation per person and never reveals whether an account exists', async () => {
    const o = await newOrg();
    const known = await org.inviteMember(a, o, emailOf('Bravo')), unknown = await org.inviteMember(a, o, 'nobody@example.test');
    expect(known).toEqual(unknown);
    await org.inviteMember(a, o, emailOf('Bravo'));
    expect((await db().query("SELECT count(*)::int AS n FROM organization_invites WHERE status='pending'")).rows[0].n).toBe(1);
    expect((await db().query('SELECT count(*)::int AS n FROM notifications WHERE user_id=$1', [b])).rows[0].n).toBe(1);
  });
  it('only invites verified, active accounts and existing members are not re-invited', async () => {
    const o = await newOrg();
    await db().query('UPDATE users SET suspended_at=now() WHERE id=$1', [b]);
    await db().query('UPDATE users SET email_verified_at=NULL WHERE id=$1', [c]);
    await join(o, d);
    for (const n of ['Bravo', 'Charlie', 'Delta']) await org.inviteMember(a, o, emailOf(n));
    expect((await db().query("SELECT count(*)::int AS n FROM organization_invites")).rows[0].n).toBe(0);
  });
  it('only owners invite or cancel, and only the invitee answers', async () => {
    const o = await newOrg(); await join(o, b);
    expect((await org.inviteMember(b, o, emailOf('Charlie'))).ok).toBe(false);
    expect((await org.inviteMember(d, o, emailOf('Charlie'))).ok).toBe(false);
    await org.inviteMember(a, o, emailOf('Charlie'));
    const id = (await db().query("SELECT id FROM organization_invites WHERE status='pending'")).rows[0].id;
    expect((await org.respondInvite(d, id, true)).ok).toBe(false);
    expect((await org.revokeInvite(b, id)).ok).toBe(false);
    expect((await org.revokeInvite(a, id)).ok).toBe(true);
    expect((await org.respondInvite(c, id, true)).ok).toBe(false);
  });
  it('archiving withdraws open invitations and blocks new ones', async () => {
    const o = await newOrg(); await org.inviteMember(a, o, emailOf('Bravo'));
    expect((await org.setArchived(a, o, true)).ok).toBe(true);
    expect((await db().query("SELECT count(*)::int AS n FROM organization_invites WHERE status='pending'")).rows[0].n).toBe(0);
    expect((await org.inviteMember(a, o, emailOf('Charlie'))).ok).toBe(false);
  });
});

describe('ownership', () => {
  it('never leaves an organization without an owner', async () => {
    const o = await newOrg(); await join(o, b);
    expect((await org.leaveOrganization(a, o)).ok).toBe(false);
    expect((await org.setRole(a, o, a, 'member')).ok).toBe(false);
    expect((await org.setRole(a, o, b, 'owner')).ok).toBe(true);
    expect((await org.setRole(a, o, a, 'member')).ok).toBe(true);
    expect((await org.setRole(b, o, b, 'member')).ok).toBe(false);
    expect((await org.leaveOrganization(b, o)).ok).toBe(false);
    expect((await members(o)).filter((m) => m.role === 'owner')).toHaveLength(1);
  });
  it('two owners stepping down at the same moment cannot both succeed', async () => {
    const o = await newOrg(); await join(o, b); await org.setRole(a, o, b, 'owner');
    const results = await Promise.all([org.setRole(a, o, a, 'member'), org.setRole(b, o, b, 'member'), org.setRole(a, o, b, 'member'), org.leaveOrganization(b, o)]);
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect((await members(o)).filter((m) => m.role === 'owner').length).toBe(1);
  });
  it('members cannot change roles, remove people or archive', async () => {
    const o = await newOrg(); await join(o, b); await join(o, c);
    expect((await org.setRole(b, o, c, 'owner')).ok).toBe(false);
    expect((await org.removeMember(b, o, c)).ok).toBe(false);
    expect((await org.setArchived(b, o, true)).ok).toBe(false);
    expect((await org.leaveOrganization(b, o)).ok).toBe(true);
  });
  it('removal only ever removes members, never an owner', async () => {
    const o = await newOrg(); await join(o, b); await org.setRole(a, o, b, 'owner');
    expect((await org.removeMember(a, o, b)).ok).toBe(false);
    expect(await members(o)).toHaveLength(2);
  });
});

describe('archiving', () => {
  it('closes access until restored, and is invisible to non-members', async () => {
    const o = await newOrg(); await join(o, b);
    await org.setArchived(a, o, true);
    expect(await org.organizationFor(a, o)).toBeNull(); expect(await org.organizationFor(b, o)).toBeNull();
    expect((await org.organizationsFor(a, { archived: true })).map((x) => x.id)).toEqual([o]);
    expect((await org.setArchived(c, o, false)).ok).toBe(false);
    expect((await org.setRole(a, o, b, 'owner')).ok).toBe(false);
    await org.setArchived(a, o, false);
    expect((await org.organizationFor(b, o))?.role).toBe('member');
  });
  it('limits how many organizations one person can own', async () => {
    for (let i = 0; i < org.MAX_ORGS_PER_USER; i++) expect((await org.createOrganization(a, 'Club ' + i)).ok).toBe(true);
    expect((await org.createOrganization(a, 'One more')).ok).toBe(false);
    const first = (await org.organizationsFor(a))[0].id; await org.setArchived(a, first, true);
    expect((await org.createOrganization(a, 'One more')).ok).toBe(true);
    expect((await org.createOrganization(b, '   ')).ok).toBe(false);
  });
});

describe('account deletion', () => {
  const erase = async (id: string) => { const cl = await db().connect(); try { await cl.query('BEGIN'); await cl.query("UPDATE users SET deleted_at=now() WHERE id=$1", [id]); await eraseOperations(cl, id); await cl.query('COMMIT'); } finally { cl.release(); } };
  it('hands a sole owner’s organization to the longest-standing member and tells them', async () => {
    const o = await newOrg(); await join(o, b, 5); await join(o, c, 60);
    await erase(a);
    const m = await members(o);
    expect(m.find((x) => x.user_id === c)?.role).toBe('owner'); expect(m.find((x) => x.user_id === b)?.role).toBe('member');
    expect((await db().query("SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND title LIKE 'You are now the owner%'", [c])).rows[0].n).toBe(1);
  });
  it('skips deleted or suspended members when choosing a successor', async () => {
    const o = await newOrg(); await join(o, b, 90); await join(o, c, 10);
    await db().query('UPDATE users SET suspended_at=now() WHERE id=$1', [b]);
    await erase(a);
    expect((await members(o)).find((x) => x.role === 'owner')?.user_id).toBe(c);
  });
  it('archives an organization when nobody eligible remains, and keeps co-owned ones untouched', async () => {
    const solo = await newOrg(), shared = await newOrg(); await join(shared, b); await org.setRole(a, shared, b, 'owner');
    await erase(a);
    expect((await org.organizationsFor(b, { archived: true }))).toHaveLength(0);
    expect((await db().query('SELECT archived_at FROM organizations WHERE id=$1', [solo])).rows[0].archived_at).not.toBeNull();
    expect((await db().query('SELECT archived_at FROM organizations WHERE id=$1', [shared])).rows[0].archived_at).toBeNull();
    expect((await members(shared)).map((x) => x.user_id)).toEqual([b]);
  });
  it('withdraws invitations sent by or to the deleted person', async () => {
    const o = await newOrg(); await join(o, b); await org.setRole(a, o, b, 'owner');
    await org.inviteMember(a, o, emailOf('Charlie')); await org.inviteMember(b, o, emailOf('Alpha'));
    await erase(a);
    expect((await db().query("SELECT count(*)::int AS n FROM organization_invites WHERE status='pending'")).rows[0].n).toBe(0);
  });
});
