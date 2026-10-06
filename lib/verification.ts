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
      RETURNING i.guardian_email, i.invited_by, u.full_name AS athlete_name`, [inviteId, hashToken(token), GUARDIAN_DAYS]);
  const r = rows[0];
  if (!r) return;
  const inviter = r.invited_by ? (await db().query("SELECT full_name FROM users WHERE id=$1", [r.invited_by])).rows[0]?.full_name : null;
  await sendMail(r.guardian_email, `${r.athlete_name} invited you as a parent/guardian on LIN`,
    (inviter
      ? `${inviter}, a parent/guardian of ${r.athlete_name}, invited you to join as a parent/guardian on LIN, a platform for athlete name, image and likeness (NIL) activity.\n\n`
      : `${r.athlete_name} listed you as their parent/guardian on LIN, a platform for athlete name, image and likeness (NIL) activity.\n\n`) +
    `As a linked guardian you can review and approve deals and see their academic and health-plan information.\n\n` +
    `To accept, log in or create a Parent account using THIS email address (${r.guardian_email}), verify it, then open:\n` +
    `${appUrl()}/guardian/accept?token=${token}\n\nThis link expires in ${GUARDIAN_DAYS} days. If you don't know this athlete, ignore this email.`);
}

const RESET_HOURS = 1;
const RESET_MAX_PER_HOUR = 5;

/**
 * Emails a reset link if the address belongs to an account. Always silent about whether it does:
 * callers respond identically either way. Rate-limited per account (cooldown + hourly cap).
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const pool = db();
  const u = (await pool.query("SELECT id, full_name FROM users WHERE email=$1", [email])).rows[0];
  if (!u) return;
  const recent = (await pool.query(
    `SELECT count(*)::int AS hour, count(*) FILTER (WHERE created_at > NOW() - make_interval(secs => $2))::int AS minute
       FROM email_tokens WHERE user_id=$1 AND purpose='password_reset' AND created_at > NOW() - INTERVAL '1 hour'`,
    [u.id, RESEND_COOLDOWN_SECONDS])).rows[0];
  if (recent.minute > 0 || recent.hour >= RESET_MAX_PER_HOUR) return;
  const token = newSessionToken();
  await pool.query(
    `INSERT INTO email_tokens(token_hash, user_id, purpose, expires_at)
     VALUES ($1,$2,'password_reset', NOW() + make_interval(hours => $3))`, [hashToken(token), u.id, RESET_HOURS]);
  await sendMail(email, "Reset your LIN password",
    `Hi ${u.full_name},\n\nSomeone asked to reset the password for this account. To choose a new one, open:\n${appUrl()}/reset-password?token=${token}\n\n` +
    `This link works once and expires in ${RESET_HOURS} hour. If you didn't ask for this, you can ignore this email — your password hasn't changed.`);
}

/** Email of the account a still-valid reset token belongs to (read-only; does not consume it). */
export async function peekResetToken(token: string): Promise<string | null> {
  const r = await db().query(
    `SELECT u.email FROM email_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash=$1 AND t.purpose='password_reset' AND t.used_at IS NULL AND t.expires_at > NOW()`, [hashToken(token)]);
  return r.rows[0]?.email ?? null;
}

/**
 * Atomically spends the token and sets the new password. Also: ends every session (so a stolen session
 * can't outlive the reset), clears any login lockout, voids other outstanding reset links, and — since
 * the person just proved they control the mailbox — marks the email verified.
 */
export async function completePasswordReset(token: string, newHash: string): Promise<{ email: string; name: string } | null> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const t = await client.query(
      `UPDATE email_tokens SET used_at = NOW()
        WHERE token_hash=$1 AND purpose='password_reset' AND used_at IS NULL AND expires_at > NOW() RETURNING user_id`, [hashToken(token)]);
    if (!t.rowCount) { await client.query("ROLLBACK"); return null; }
    const uid = t.rows[0].user_id;
    const u = await client.query(
      `UPDATE users SET password_hash=$2, failed_logins=0, locked_until=NULL, email_verified_at = COALESCE(email_verified_at, NOW())
        WHERE id=$1 RETURNING email, full_name`, [uid, newHash]);
    await client.query("DELETE FROM sessions WHERE user_id=$1", [uid]);
    await client.query("UPDATE email_tokens SET used_at = NOW() WHERE user_id=$1 AND purpose='password_reset' AND used_at IS NULL", [uid]);
    await client.query("COMMIT");
    return { email: u.rows[0].email, name: u.rows[0].full_name };
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
