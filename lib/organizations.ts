import type { PoolClient } from 'pg';
import { db } from './db';
import { validId } from './operations';

export type Org = { id: string; name: string; role: string };
export const MAX_ORGS_PER_USER = 25;
export const MAX_PENDING_INVITES = 50;
export const INVITE_DAYS = 14;

/** Organizations the user belongs to. Archived organizations are closed: they grant nothing, so they are excluded unless asked for. */
export async function organizationsFor(userId: string, o: { archived?: boolean } = {}): Promise<Org[]> {
  return (await db().query(
    `SELECT o.id,o.name,m.role FROM organizations o JOIN organization_members m ON m.organization_id=o.id
      WHERE m.user_id=$1 AND (o.archived_at IS NOT NULL) = $2 ORDER BY o.name`, [userId, !!o.archived])).rows;
}
export async function organizationFor(userId: string, id: string): Promise<Org | null> {
  return validId(id) ? (await organizationsFor(userId)).find((o) => o.id === id) ?? null : null;
}

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await db().connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

/** Locks the organization row (serialising ownership changes) and returns the caller's role in it, or null. */
async function lockedRole(c: PoolClient, orgId: string, userId: string): Promise<{ role: string | null; archived: boolean } | null> {
  const o = (await c.query('SELECT archived_at FROM organizations WHERE id=$1 FOR UPDATE', [orgId])).rows[0];
  if (!o) return null;
  const m = (await c.query('SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2', [orgId, userId])).rows[0];
  return { role: m?.role ?? null, archived: !!o.archived_at };
}
const ownerCount = async (c: PoolClient, orgId: string) =>
  (await c.query("SELECT count(*)::int AS n FROM organization_members WHERE organization_id=$1 AND role='owner'", [orgId])).rows[0].n as number;

export async function createOrganization(userId: string, name: string): Promise<Result & { id?: string }> {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n || n.length > 160) return fail('Enter an organization name of up to 160 characters.');
  return tx(async (c) => {
    await c.query('SELECT 1 FROM users WHERE id=$1 FOR UPDATE', [userId]);     // serialises the per-user limit
    const have = (await c.query("SELECT count(*)::int AS n FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=$1 AND m.role='owner' AND o.archived_at IS NULL", [userId])).rows[0].n;
    if (have >= MAX_ORGS_PER_USER) return fail(`You already own ${MAX_ORGS_PER_USER} organizations. Archive one first.`);
    const o = (await c.query('INSERT INTO organizations(name,created_by) VALUES($1,$2) RETURNING id', [n, userId])).rows[0];
    await c.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'owner')", [o.id, userId]);
    return { ok: true as const, id: o.id as string };
  });
}

/** Never reveals whether an account exists: every outcome except a hard limit reads the same to the inviter. */
export async function inviteMember(ownerId: string, orgId: string, email: string): Promise<Result> {
  if (!validId(orgId)) return fail('Unknown organization.');
  const generic: Result = { ok: true, message: 'If that verified account exists, an invitation is now waiting for them.' };
  return tx(async (c) => {
    const me = await lockedRole(c, orgId, ownerId);
    if (me?.role !== 'owner') return fail('Only an owner can invite people.');
    if (me.archived) return fail('This organization is archived.');
    await c.query("UPDATE organization_invites SET status='expired' WHERE organization_id=$1 AND status='pending' AND expires_at<=now()", [orgId]);
    const pending = (await c.query("SELECT count(*)::int AS n FROM organization_invites WHERE organization_id=$1 AND status='pending'", [orgId])).rows[0].n;
    if (pending >= MAX_PENDING_INVITES) return fail('Too many invitations are waiting. Cancel some first.');
    const u = (await c.query('SELECT id FROM users WHERE email=$1 AND email_verified_at IS NOT NULL AND deleted_at IS NULL AND suspended_at IS NULL', [email.trim().toLowerCase()])).rows[0];
    if (!u) return generic;
    if ((await c.query('SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2', [orgId, u.id])).rowCount) return generic;
    const ins = await c.query(
      "INSERT INTO organization_invites(organization_id,invited_user_id,invited_by,expires_at) VALUES($1,$2,$3,now()+make_interval(days=>$4)) ON CONFLICT DO NOTHING RETURNING id",
      [orgId, u.id, ownerId, INVITE_DAYS]);
    if (ins.rowCount) await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account','Organization invitation','/dashboard/organizations')", [u.id]);
    return generic;
  });
}

export async function respondInvite(userId: string, inviteId: string, accept: boolean): Promise<Result> {
  if (!validId(inviteId)) return fail('Unknown invitation.');
  return tx(async (c) => {
    const inv = (await c.query("SELECT * FROM organization_invites WHERE id=$1 AND invited_user_id=$2 AND status='pending' FOR UPDATE", [inviteId, userId])).rows[0];
    if (!inv) return fail('That invitation is no longer available.');
    const org = (await c.query('SELECT archived_at FROM organizations WHERE id=$1 FOR UPDATE', [inv.organization_id])).rows[0];
    if (new Date(inv.expires_at) <= new Date() || org?.archived_at) {
      await c.query("UPDATE organization_invites SET status='expired' WHERE id=$1", [inviteId]);
      return fail('That invitation has expired. Ask the owner to send a new one.');
    }
    if (accept) await c.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'member') ON CONFLICT DO NOTHING", [inv.organization_id, userId]);
    await c.query('UPDATE organization_invites SET status=$2 WHERE id=$1', [inviteId, accept ? 'accepted' : 'declined']);
    return { ok: true as const };
  });
}

export async function revokeInvite(ownerId: string, inviteId: string): Promise<Result> {
  if (!validId(inviteId)) return fail('Unknown invitation.');
  return tx(async (c) => {
    const inv = (await c.query("SELECT organization_id FROM organization_invites WHERE id=$1 AND status='pending'", [inviteId])).rows[0];
    if (!inv) return fail('That invitation is no longer pending.');
    const me = await lockedRole(c, inv.organization_id, ownerId);
    if (me?.role !== 'owner') return fail('Only an owner can cancel invitations.');
    await c.query("UPDATE organization_invites SET status='revoked' WHERE id=$1 AND status='pending'", [inviteId]);
    return { ok: true as const };
  });
}

export async function removeMember(ownerId: string, orgId: string, userId: string): Promise<Result> {
  if (!validId(orgId) || !validId(userId)) return fail('Unknown member.');
  return tx(async (c) => {
    const me = await lockedRole(c, orgId, ownerId);
    if (me?.role !== 'owner') return fail('Only an owner can remove members.');
    const gone = await c.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND role='member'", [orgId, userId]);
    return gone.rowCount ? { ok: true as const } : fail('Owners are removed by first stepping down.');
  });
}

/** A member leaves. An owner may leave only if another owner remains. */
export async function leaveOrganization(userId: string, orgId: string): Promise<Result> {
  if (!validId(orgId)) return fail('Unknown organization.');
  return tx(async (c) => {
    const me = await lockedRole(c, orgId, userId);
    if (!me?.role) return fail('You are not a member of this organization.');
    if (me.role === 'owner' && (await ownerCount(c, orgId)) <= 1) return fail('You are the only owner. Make someone else an owner, or archive the organization.');
    await c.query('DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2', [orgId, userId]);
    return { ok: true as const };
  });
}

/** Owners can add co-owners and step down; the last owner can never be removed or demoted, so management cannot be stranded. */
export async function setRole(ownerId: string, orgId: string, targetId: string, role: 'owner' | 'member'): Promise<Result> {
  if (!validId(orgId) || !validId(targetId)) return fail('Unknown member.');
  return tx(async (c) => {
    const me = await lockedRole(c, orgId, ownerId);
    if (me?.role !== 'owner') return fail('Only an owner can change roles.');
    if (me.archived) return fail('This organization is archived.');
    const t = (await c.query('SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2', [orgId, targetId])).rows[0];
    if (!t) return fail('That person is not a member.');
    if (t.role === role) return { ok: true as const };
    if (role === 'member' && (await ownerCount(c, orgId)) <= 1) return fail('An organization must keep at least one owner.');
    await c.query('UPDATE organization_members SET role=$3 WHERE organization_id=$1 AND user_id=$2', [orgId, targetId, role]);
    if (role === 'owner') await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account','You are now an owner of an organization','/dashboard/organizations')", [targetId]);
    return { ok: true as const };
  });
}

/** Closes an organization: no new invitations or roles; it grants no access to shared records until restored by an owner. */
export async function setArchived(ownerId: string, orgId: string, archived: boolean): Promise<Result> {
  if (!validId(orgId)) return fail('Unknown organization.');
  return tx(async (c) => {
    const me = await lockedRole(c, orgId, ownerId);
    if (me?.role !== 'owner') return fail('Only an owner can do that.');
    await c.query('UPDATE organizations SET archived_at = CASE WHEN $2 THEN COALESCE(archived_at, now()) ELSE NULL END WHERE id=$1', [orgId, archived]);
    if (archived) await c.query("UPDATE organization_invites SET status='revoked' WHERE organization_id=$1 AND status='pending'", [orgId]);
    return { ok: true as const };
  });
}

/**
 * Account deletion: leave every organization without stranding it. If the person was the last owner, the longest-standing member becomes
 * owner (and is told); if nobody else is left, the organization is archived. Their pending invitations in either direction are withdrawn.
 */
export async function departAllOrganizations(c: PoolClient, userId: string): Promise<void> {
  const mine = (await c.query('SELECT organization_id FROM organization_members WHERE user_id=$1 ORDER BY organization_id', [userId])).rows;
  for (const { organization_id: orgId } of mine) {
    await c.query('SELECT 1 FROM organizations WHERE id=$1 FOR UPDATE', [orgId]);
    const role = (await c.query('SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2', [orgId, userId])).rows[0]?.role;
    await c.query('DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2', [orgId, userId]);
    if (role === 'owner' && (await ownerCount(c, orgId)) === 0) {
      const next = (await c.query('SELECT m.user_id FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND u.deleted_at IS NULL AND u.suspended_at IS NULL ORDER BY m.joined_at, m.user_id LIMIT 1', [orgId])).rows[0];
      if (next) {
        await c.query("UPDATE organization_members SET role='owner' WHERE organization_id=$1 AND user_id=$2", [orgId, next.user_id]);
        await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account','You are now the owner of an organization','/dashboard/organizations')", [next.user_id]);
      } else {
        await c.query('UPDATE organizations SET archived_at=COALESCE(archived_at, now()) WHERE id=$1', [orgId]);
      }
    }
  }
  await c.query("UPDATE organization_invites SET status='revoked' WHERE (invited_user_id=$1 OR invited_by=$1) AND status='pending'", [userId]);
}
