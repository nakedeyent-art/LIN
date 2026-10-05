import { db } from "./db";

export type GuardianState = {
  minor: boolean;
  linked: { name: string; email: string }[];
  pendingEmail: string | null;
  pendingInviteId: string | null;
  lastSentAt: Date | null;
};

export async function guardianState(athleteId: string): Promise<GuardianState | null> {
  const p = (await db().query(
    "SELECT birth_date > (CURRENT_DATE - INTERVAL '18 years') AS minor FROM athlete_profiles WHERE user_id=$1", [athleteId])).rows[0];
  if (!p) return null;
  const linked = (await db().query(
    `SELECT u.full_name, u.email FROM athlete_relationships r JOIN users u ON u.id = r.member_id
      WHERE r.athlete_id=$1 AND r.relationship='parent' AND r.guardian_approved`, [athleteId])).rows;
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

export async function linkedAthletes(guardianId: string): Promise<{ name: string; sport: string | null }[]> {
  const { rows } = await db().query(
    `SELECT u.full_name AS name, a.sport FROM athlete_relationships r
       JOIN users u ON u.id = r.athlete_id LEFT JOIN athlete_profiles a ON a.user_id = u.id
      WHERE r.member_id=$1 AND r.relationship='parent' AND r.guardian_approved ORDER BY u.full_name`, [guardianId]);
  return rows;
}
