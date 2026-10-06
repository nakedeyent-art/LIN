import { db } from "../db";
import { appUrl, sendMail } from "../mailer";
import { notifyInApp } from "../notificationsdb";
import { classify, shouldGiveUp } from "./adulthood";
import { athleteAdultEmail, guardianAdultEmail } from "./adult-emails";

export type JobResult = { processed: number; skipped: number; failed: number };
const BATCH = 200;

/**
 * The 18th-birthday transition. For each athlete who is now an adult and hasn't been processed:
 *  - joined already 18+, or turned 18 long ago  -> mark done, no email
 *  - otherwise: revoke guardian invites that can no longer be accepted, record the transition in the guardian audit log,
 *    email the athlete (only if they actually had guardians) and each former guardian, then mark done.
 * Delivery is at-least-once with a retry cap: a failed athlete email leaves the row unmarked for the next run; after
 * MAX_ATTEMPTS the job gives up. Guardian emails are best-effort. `dry` reads only: no writes, no mail.
 */
export async function runAdultTransition(opts: { dry: boolean }): Promise<JobResult> {
  const pool = db();
  const today = (await pool.query("SELECT CURRENT_DATE::text AS d")).rows[0].d as string;
  const candidates = (await pool.query(
    `SELECT ap.user_id AS id FROM athlete_profiles ap JOIN users u ON u.id = ap.user_id
      WHERE ap.adult_notice_sent_at IS NULL AND u.deleted_at IS NULL
        AND ap.birth_date <= CURRENT_DATE - INTERVAL '18 years'
      ORDER BY ap.birth_date LIMIT ${BATCH}`)).rows.map((r) => r.id as string);

  const res: JobResult = { processed: 0, skipped: 0, failed: 0 };
  for (const id of candidates) {
    try {
      const r = await processOne(id, today, opts.dry);
      res[r] += 1;
    } catch (e) {
      res.failed += 1;
      console.error("adult-transition failed for an athlete:", (e as Error).message);   // no ids/emails in logs
    }
  }
  return res;
}

async function processOne(id: string, today: string, dry: boolean): Promise<keyof JobResult> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    // SKIP LOCKED: if another process somehow has this athlete, leave them to it.
    const a = (await client.query(
      `SELECT ap.birth_date::text AS birth, u.created_at::date::text AS created, u.email, u.full_name, ap.adult_notice_attempts AS attempts
         FROM athlete_profiles ap JOIN users u ON u.id = ap.user_id
        WHERE ap.user_id=$1 AND ap.adult_notice_sent_at IS NULL FOR UPDATE OF ap SKIP LOCKED`, [id])).rows[0];
    if (!a) { await client.query("ROLLBACK"); return "skipped"; }

    // Marking done always voids guardian invites: they can't be accepted for an adult, so they'd only be clutter.
    const mark = async () => {
      await client.query("UPDATE guardian_invites SET status='revoked', token_hash=NULL WHERE athlete_id=$1 AND status='pending'", [id]);
      await client.query("UPDATE athlete_profiles SET adult_notice_sent_at = NOW() WHERE user_id=$1", [id]);
    };
    const disposition = classify(a.birth, a.created, today);
    if (disposition !== "send") {
      if (!dry) { await mark(); await client.query("COMMIT"); } else await client.query("ROLLBACK");
      return "skipped";
    }

    const guardians = (await client.query(
      `SELECT g.id, g.full_name, g.email FROM athlete_relationships r JOIN users g ON g.id = r.member_id
        WHERE r.athlete_id=$1 AND r.relationship='parent' AND r.guardian_approved
          AND g.deleted_at IS NULL AND g.email_verified_at IS NOT NULL`, [id])).rows as { id: string; full_name: string; email: string }[];
    const hadGuardian = (await client.query(
      "SELECT 1 FROM athlete_relationships WHERE athlete_id=$1 AND relationship='parent' AND guardian_approved", [id])).rowCount! > 0;
    const pendingDeals = (await client.query("SELECT count(*)::int AS n FROM deals WHERE athlete_id=$1 AND status='guardian_review'", [id])).rows[0].n as number;

    if (dry) { await client.query("ROLLBACK"); return hadGuardian ? "processed" : "skipped"; }

    if (!hadGuardian) {                       // nothing changed for them: no guardian era to announce the end of
      await mark(); await client.query("COMMIT"); return "skipped";
    }

    if (a.attempts === 0) {                   // first time only: retries must not duplicate the audit entry
      await client.query("UPDATE guardian_invites SET status='revoked', token_hash=NULL WHERE athlete_id=$1 AND status='pending'", [id]);
      await client.query("INSERT INTO guardian_events(athlete_id, actor_id, action, detail) VALUES ($1,$1,'adult_transition','turned 18; guardian authority ended')", [id]);
    }
    await client.query("UPDATE athlete_profiles SET adult_notice_attempts = adult_notice_attempts + 1 WHERE user_id=$1", [id]);
    await client.query("COMMIT");   // release the row lock before talking to the mail provider

    const base = appUrl();
    try {
      const m = athleteAdultEmail({ name: a.full_name, pendingDeals, appUrl: base });
      await sendMail(a.email, m.subject, m.text);
    } catch (e) {
      const giveUp = shouldGiveUp(a.attempts + 1);
      if (giveUp) await db().query("UPDATE athlete_profiles SET adult_notice_sent_at = NOW() WHERE user_id=$1", [id]);
      console.error(`adult-transition: athlete email failed (${giveUp ? "giving up" : "will retry"}):`, (e as Error).message);
      return "failed";
    }
    await notifyInApp([id], { kind: "guardian", title: "You're 18 now: you make your own decisions about deals and sharing", href: "/dashboard/team" });
    for (const g of guardians) {
      await notifyInApp([g.id], { kind: "guardian", title: `${a.full_name} turned 18: your guardian access has ended`, href: "/dashboard" });
      try {
        const m = guardianAdultEmail({ guardianName: g.full_name, athleteName: a.full_name, pendingDeals, appUrl: base });
        await sendMail(g.email, m.subject, m.text);
      } catch (e) { console.error("adult-transition: guardian email failed:", (e as Error).message); }
    }
    await db().query("UPDATE athlete_profiles SET adult_notice_sent_at = NOW() WHERE user_id=$1", [id]);
    return "processed";
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}
