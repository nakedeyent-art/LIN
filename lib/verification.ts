import { db } from "./db";
import { hashToken, newSessionToken } from "./crypto";
import { appUrl, sendMail } from "./mailer";

export const RESEND_COOLDOWN_SECONDS = 60;
const VERIFY_HOURS = 24;
const GUARDIAN_DAYS = 14;

/** Creates a verification token and emails the link. Returns false if rate-limited. */
export async function sendVerificationEmail(userId: string, force = false): Promise<boolean> {
  const pool = db();
  if (!force) {
    const recent = await pool.query(
      `SELECT 1 FROM email_tokens WHERE user_id=$1 AND purpose='verify_email'
         AND created_at > NOW() - make_interval(secs => $2)`, [userId, RESEND_COOLDOWN_SECONDS]);
    if (recent.rowCount) return false;
  }
  const u = (await pool.query("SELECT email, full_name FROM users WHERE id=$1 AND email_verified_at IS NULL", [userId])).rows[0];
  if (!u) return true; // already verified: nothing to send
  const token = newSessionToken();
  await pool.query(
    `INSERT INTO email_tokens(token_hash, user_id, purpose, expires_at)
     VALUES ($1,$2,'verify_email', NOW() + make_interval(hours => $3))`, [hashToken(token), userId, VERIFY_HOURS]);
  await sendMail(u.email, "Confirm your email for LIN",
    `Hi ${u.full_name},\n\nConfirm your email address:\n${appUrl()}/verify?token=${token}\n\nThis link expires in ${VERIFY_HOURS} hours. If you didn't create an account, ignore this email.`);
  return true;
}

/** Atomically consumes a token; returns the user id or null if invalid/expired/used. */
export async function consumeVerifyToken(token: string): Promise<string | null> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const t = await client.query(
      `UPDATE email_tokens SET used_at = NOW()
       WHERE token_hash=$1 AND purpose='verify_email' AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id`, [hashToken(token)]);
    if (!t.rowCount) { await client.query("ROLLBACK"); return null; }
    await client.query("UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id=$1", [t.rows[0].user_id]);
    await client.query("COMMIT");
    return t.rows[0].user_id;
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}

export async function peekVerifyToken(token: string): Promise<boolean> {
  const r = await db().query(
    "SELECT 1 FROM email_tokens WHERE token_hash=$1 AND purpose='verify_email' AND used_at IS NULL AND expires_at > NOW()",
    [hashToken(token)]);
  return !!r.rowCount;
}

/** (Re)issues the guardian invite token — replacing any older one — and emails the guardian. */
export async function sendGuardianInvite(inviteId: string): Promise<void> {
  const token = newSessionToken();
  const { rows } = await db().query(
    `UPDATE guardian_invites i
        SET token_hash=$2, expires_at = NOW() + make_interval(days => $3), last_sent_at = NOW()
       FROM users u
      WHERE i.id=$1 AND i.status='pending' AND u.id = i.athlete_id
      RETURNING i.guardian_email, u.full_name AS athlete_name`, [inviteId, hashToken(token), GUARDIAN_DAYS]);
  const r = rows[0];
  if (!r) return;
  await sendMail(r.guardian_email, `${r.athlete_name} invited you as a parent/guardian on LIN`,
    `${r.athlete_name} listed you as their parent/guardian on LIN, a platform for athlete name, image and likeness (NIL) activity.\n\n` +
    `As a linked guardian you can review and approve deals and see their academic and health-plan information.\n\n` +
    `To accept, log in or create a Parent account using THIS email address (${r.guardian_email}), verify it, then open:\n` +
    `${appUrl()}/guardian/accept?token=${token}\n\nThis link expires in ${GUARDIAN_DAYS} days. If you don't know this athlete, ignore this email.`);
}
