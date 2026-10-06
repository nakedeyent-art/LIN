import type { PoolClient } from "pg";
import { db } from "./db";
import { maskEmail } from "./account";

type Q = Pick<PoolClient, "query"> | ReturnType<typeof db>;

export type GuardianState = {
  minor: boolean;
  linked: { name: string; email: string }[];
  pendingEmail: string | null;
  pendingInviteId: string | null;
  lastSentAt: Date | null;
};

/** Banner data for an athlete: are they a minor, who are their (active) guardians, is an invite pending? */
export async function guardianState(athleteId: string): Promise<GuardianState | null> {
  const p = (await db().query(
    "SELECT birth_date > (CURRENT_DATE - INTERVAL '18 years') AS minor FROM athlete_profiles WHERE user_id=$1", [athleteId])).rows[0];
  if (!p) return null;
  const linked = (await db().query(
    `SELECT u.full_name, u.email FROM guardian_links r JOIN users u ON u.id = r.member_id WHERE r.athlete_id=$1`, [athleteId])).rows;
  const inv = (await db().query(
    `SELECT id, guardian_email, last_sent_at FROM guardian_invites
      WHERE athlete_id=$1 AND status='pending' ORDER BY created_at DESC LIMIT 1`, [athleteId])).rows[0];
  return {
    minor: p.minor,
    linked: linked.map((l) => ({ name: l.full_name, email: l.email })),
    pendingEmail: inv?.guardian_email ?? null,
    pendingInviteId: inv?.id ?? null,
    lastSentAt: inv?.last_sent_at ?? null,
  };
}

export async function logGuardianEvent(athleteId: string, actorId: string, action: string, detail?: string, c?: Q): Promise<void> {
  await (c ?? db()).query("INSERT INTO guardian_events(athlete_id, actor_id, action, detail) VALUES ($1,$2,$3,$4)", [athleteId, actorId, action, detail ?? null]);
}

/** Minors may only be listed to sponsors while a guardian is linked. Call after any change that can remove the last one. */
export async function unlistIfNoGuardian(athleteId: string, c?: Q): Promise<boolean> {
  const r = await (c ?? db()).query(
    `UPDATE athlete_profiles SET discoverable = FALSE
      WHERE user_id=$1 AND discoverable AND birth_date > CURRENT_DATE - INTERVAL '18 years'
        AND NOT EXISTS (SELECT 1 FROM guardian_links g WHERE g.athlete_id = $1)`, [athleteId]);
  return !!r.rowCount;
}

export type GuardianRow = { relationshipId: string; userId: string; name: string; email: string; since: Date };
export type InviteRow = { id: string; email: string; invitedBy: string | null; expiresAt: Date | null };

export async function guardiansOf(athleteId: string): Promise<GuardianRow[]> {
  return (await db().query(
    `SELECT r.id, u.id AS uid, u.full_name, u.email, r.created_at FROM guardian_links r JOIN users u ON u.id = r.member_id
      WHERE r.athlete_id=$1 ORDER BY r.created_at`, [athleteId])).rows
    .map((r) => ({ relationshipId: r.id, userId: r.uid, name: r.full_name, email: r.email, since: r.created_at }));
}

export async function pendingGuardianInvites(athleteId: string): Promise<InviteRow[]> {
  return (await db().query(
    `SELECT id, guardian_email, invited_by, expires_at FROM guardian_invites
      WHERE athlete_id=$1 AND status='pending' AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at`, [athleteId])).rows
    .map((r) => ({ id: r.id, email: r.guardian_email, invitedBy: r.invited_by, expiresAt: r.expires_at }));
}

/** Minors this user is an active guardian of, with whether they're currently listed to sponsors. */
export async function minorsGuardedBy(userId: string) {
  return (await db().query(
    `SELECT u.id, u.full_name AS name, ap.sport, ap.discoverable AS listed
       FROM guardian_links r JOIN users u ON u.id = r.athlete_id JOIN athlete_profiles ap ON ap.user_id = u.id
      WHERE r.member_id=$1 ORDER BY u.full_name`, [userId])).rows as { id: string; name: string; sport: string | null; listed: boolean }[];
}

/** Athletes that were this user's minors and have since turned 18 (the user no longer has authority). */
export async function grownAthletesOf(userId: string) {
  return (await db().query(
    `SELECT u.id, u.full_name AS name, r.consent_confirmed_at IS NOT NULL AS sharing, r.can_view_academics AS academics, r.can_view_health AS health
       FROM athlete_relationships r JOIN users u ON u.id = r.athlete_id JOIN athlete_profiles ap ON ap.user_id = u.id
      WHERE r.member_id=$1 AND r.relationship='parent' AND r.guardian_approved
        AND ap.birth_date <= CURRENT_DATE - INTERVAL '18 years' ORDER BY u.full_name`, [userId])).rows as
    { id: string; name: string; sharing: boolean; academics: boolean; health: boolean }[];
}

/** For an adult athlete: their parent links and what (if anything) they currently share with each. */
export async function parentLinksOfAdult(athleteId: string) {
  return (await db().query(
    `SELECT r.id, u.full_name AS name, r.consent_confirmed_at IS NOT NULL AS sharing, r.can_view_academics AS academics, r.can_view_health AS health
       FROM athlete_relationships r JOIN users u ON u.id = r.member_id
      WHERE r.athlete_id=$1 AND r.relationship='parent' AND r.guardian_approved ORDER BY r.created_at`, [athleteId])).rows as
    { id: string; name: string; sharing: boolean; academics: boolean; health: boolean }[];
}

export async function recentGuardianEvents(athleteId: string) {
  return (await db().query(
    `SELECT e.action, e.detail, e.created_at, u.full_name AS actor FROM guardian_events e JOIN users u ON u.id = e.actor_id
      WHERE e.athlete_id=$1 ORDER BY e.created_at DESC, e.id LIMIT 12`, [athleteId])).rows as
    { action: string; detail: string | null; created_at: Date; actor: string }[];
}

export { maskEmail };
