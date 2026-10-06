import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { db } from "./db";
import { unlistIfNoGuardian } from "./guardians";

export const OPEN_DEAL_STATUSES = "('offered','guardian_review','active')";

export async function openDealCount(userId: string): Promise<number> {
  return (await db().query(
    `SELECT count(*)::int AS n FROM deals WHERE (athlete_id=$1 OR counterparty_id=$1) AND status IN ${OPEN_DEAL_STATUSES}`, [userId])).rows[0].n;
}

/**
 * Purge-and-anonymize, inside the caller's transaction. Personal data is removed; the users row stays as
 * "Deleted user" so counterparties' deal history and the audit trail remain intact. The email address is freed.
 * Any minor left without a guardian by this is unlisted from sponsors.
 */
export async function purgeAndAnonymize(client: PoolClient, id: string, email: string): Promise<void> {
  const run = (q: string) => client.query(q, [id]);
  const guarded = (await client.query("SELECT athlete_id FROM guardian_links WHERE member_id=$1", [id])).rows.map((r) => r.athlete_id as string);
  await run("DELETE FROM sessions WHERE user_id=$1");
  await run("DELETE FROM email_tokens WHERE user_id=$1");
  await run("DELETE FROM athlete_relationships WHERE athlete_id=$1 OR member_id=$1");
  await run("DELETE FROM connection_invites WHERE athlete_id=$1 OR invited_by=$1 OR accepted_by=$1");
  await run("DELETE FROM guardian_invites WHERE athlete_id=$1 OR accepted_by=$1 OR invited_by=$1");
  await run("DELETE FROM guardian_events WHERE athlete_id=$1");
  await client.query("UPDATE connection_invites SET status='revoked', token_hash=NULL WHERE invitee_email=$1 AND status='pending'", [email]);
  await client.query("UPDATE guardian_invites SET status='revoked', token_hash=NULL WHERE guardian_email=$1 AND status='pending'", [email]);
  await run("DELETE FROM academic_logs WHERE athlete_id=$1");
  await run("DELETE FROM study_sessions WHERE athlete_id=$1");
  await run("DELETE FROM food_logs WHERE athlete_id=$1");
  await run("DELETE FROM nutrition_plans WHERE athlete_id=$1");
  await run("DELETE FROM athlete_workouts WHERE athlete_id=$1");
  await run("UPDATE nutrition_plans SET prescribed_by=NULL WHERE prescribed_by=$1");
  await run("UPDATE athlete_workouts SET prescribed_by=NULL WHERE prescribed_by=$1");
  await run("UPDATE study_sessions SET verified_by=NULL WHERE verified_by=$1");
  await run("DELETE FROM disclaimer_acceptances WHERE athlete_id=$1 OR accepted_by=$1");
  await run("DELETE FROM recruiting_board WHERE recruiter_id=$1 OR athlete_id=$1");
  await run("DELETE FROM events WHERE organizer_id=$1");
  await run("DELETE FROM athlete_profiles WHERE user_id=$1");
  await run("DELETE FROM manager_declarations WHERE manager_id=$1");
  await client.query(
    `UPDATE users SET email=$2, full_name='Deleted user', password_hash=$3, failed_logins=0, locked_until=NULL,
            email_verified_at=NULL, deleted_at=NOW() WHERE id=$1`,
    [id, `deleted-${id}@deleted.invalid`, "!" + randomBytes(24).toString("hex")]);
  for (const athleteId of guarded) await unlistIfNoGuardian(athleteId, client);
}
