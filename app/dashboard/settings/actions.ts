"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, hashToken, isValidEmail, newSessionToken, normalizeEmail, verifyPassword } from "@/lib/crypto";
import { checkPassword } from "@/lib/reauth";
import { appUrl, sendMail } from "@/lib/mailer";
import { validateNewPassword } from "@/lib/password-policy";
import { DELETE_PHRASE, maskEmail, validateAthleteProfile, validateDisplayName } from "@/lib/account";
import { destroySession, endOtherSessions, requireUser } from "@/lib/session";
import { RESEND_COOLDOWN_SECONDS } from "@/lib/verification";
import { openDealCount, purgeAndAnonymize } from "@/lib/account-deletion";
import { LIVE_STATUSES, sqlIn } from "@/lib/deals";
import { MONEY_IN_FLIGHT } from "@/lib/payment-rules";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (key: "msg" | "error", m: string): never => redirect(`/dashboard/settings?${key}=${encodeURIComponent(m)}`);
const notify = async (to: string, subject: string, text: string) => { try { await sendMail(to, subject, text); } catch (e) { console.error("account notice failed", e); } };

async function reauth(userId: string, password: string): Promise<{ email: string; name: string; hash: string }> {
  const r = await checkPassword(userId, password);
  if (!r.ok) done("error", r.error);
  return r as { ok: true; email: string; name: string; hash: string };
}

/** Optional emails only. Security emails (verification, password, email change, deletion) are always sent. */
export async function updateEmailPrefs(formData: FormData) {
  const s = await requireUser();
  await db().query("UPDATE users SET email_deal_updates=$2, email_messages=$3 WHERE id=$1",
    [s.userId, formData.get("deal_updates") === "on", formData.get("messages") === "on"]);
  done("msg", "Email preferences saved.");
}

export async function updateProfile(formData: FormData) {
  const s = await requireUser();
  const name = str(formData, "name");
  const nameErr = validateDisplayName(name);
  if (nameErr) done("error", nameErr);
  if (s.role === "athlete") {
    const v = validateAthleteProfile({ sport: str(formData, "sport"), position: str(formData, "position"), state: str(formData, "state"), gradYear: str(formData, "grad_year") });
    if (!v.ok) done("error", v.error);
    const p = (v as { ok: true; value: { sport: string; position: string | null; state: string | null; gradYear: number | null } }).value;
    await db().query("UPDATE athlete_profiles SET sport=$2, position=$3, state=$4, grad_year=$5 WHERE user_id=$1", [s.userId, p.sport, p.position, p.state, p.gradYear]);
  }
  await db().query("UPDATE users SET full_name=$2 WHERE id=$1", [s.userId, name]);
  done("msg", "Profile saved.");
}

export async function changePassword(formData: FormData) {
  const s = await requireUser();
  const current = String(formData.get("current") ?? ""), next = String(formData.get("password") ?? ""), confirm = String(formData.get("confirm") ?? "");
  const me = await reauth(s.userId, current);
  const problem = validateNewPassword(next, me.email);
  if (problem) done("error", problem);
  if (next !== confirm) done("error", "The two new passwords don't match.");
  if (await verifyPassword(next, me.hash)) done("error", "Choose a password you haven't been using.");
  await db().query("UPDATE users SET password_hash=$2 WHERE id=$1", [s.userId, await hashPassword(next)]);
  await endOtherSessions(s.userId);
  await notify(me.email, "Your LIN password was changed",
    `Hi ${me.name},\n\nYour password was just changed and your other devices were signed out. If this wasn't you, reset your password right away from the login page.`);
  done("msg", "Password changed. Your other devices were signed out.");
}

export async function signOutOthers() {
  const s = await requireUser();
  await endOtherSessions(s.userId);
  done("msg", "Signed out of all other devices.");
}

/** Starts an email change: the link goes to the NEW address, a heads-up to the OLD one. */
export async function requestEmailChange(formData: FormData) {
  const s = await requireUser();
  const newEmail = normalizeEmail(str(formData, "new_email"));
  const me = await reauth(s.userId, String(formData.get("password") ?? ""));
  if (!isValidEmail(newEmail)) done("error", "Enter a valid email address.");
  if (newEmail === me.email) done("error", "That's already your email address.");
  const pool = db();
  const lim = (await pool.query(
    `SELECT count(*)::int AS hour, count(*) FILTER (WHERE created_at > NOW() - make_interval(secs => $2))::int AS minute
       FROM email_tokens WHERE user_id=$1 AND purpose='change_email' AND created_at > NOW() - INTERVAL '1 hour'`, [s.userId, RESEND_COOLDOWN_SECONDS])).rows[0];
  if (lim.minute > 0) done("error", "Please wait a minute before requesting another change.");
  if (lim.hour >= 5) done("error", "Too many email-change requests. Try again later.");
  const taken = (await pool.query("SELECT 1 FROM users WHERE email=$1", [newEmail])).rowCount;
  // Same answer whether or not the address is taken, so this can't be used to probe for accounts.
  if (!taken) {
    const token = newSessionToken();
    await pool.query("UPDATE email_tokens SET used_at=NOW() WHERE user_id=$1 AND purpose='change_email' AND used_at IS NULL", [s.userId]);
    await pool.query(
      `INSERT INTO email_tokens(token_hash, user_id, purpose, payload, expires_at) VALUES ($1,$2,'change_email',$3, NOW() + INTERVAL '1 hour')`,
      [hashToken(token), s.userId, newEmail]);
    await notify(newEmail, "Confirm your new LIN email address",
      `Hi ${me.name},\n\nConfirm that this is your new email address for LIN (you must be logged in to your account in this browser):\n${appUrl()}/confirm-email?token=${token}\n\nThis link works once and expires in 1 hour. If you didn't ask for this, ignore this email.`);
    await notify(me.email, "An email change was requested on your LIN account",
      `Hi ${me.name},\n\nSomeone (hopefully you) asked to change your account email to ${maskEmail(newEmail)}. Nothing changes until that address is confirmed.\nIf this wasn't you, change your password now.`);
  }
  done("msg", `If ${newEmail} can be used, we've sent a confirmation link to it. Your email won't change until you open it.`);
}

export async function cancelEmailChange() {
  const s = await requireUser();
  await db().query("UPDATE email_tokens SET used_at=NOW() WHERE user_id=$1 AND purpose='change_email' AND used_at IS NULL", [s.userId]);
  done("msg", "Pending email change cancelled.");
}

/** Open deals (either side), money in flight, and — for guardians — linked minors' open deals must be resolved first. */
async function deletionBlockers(userId: string, role: string): Promise<string | null> {
  const mine = await openDealCount(userId);
  if (mine > 0) return `You have ${mine} open deal${mine > 1 ? "s" : ""} (offered, awaiting signatures, or active). Resolve ${mine > 1 ? "them" : "it"} first.`;
  const money = (await db().query(
    `SELECT count(*)::int AS n FROM deal_payments p JOIN deals d ON d.id = p.deal_id
      WHERE p.status IN ${sqlIn(MONEY_IN_FLIGHT)} AND (p.payee_user_id=$1 OR d.counterparty_id=$1 OR d.athlete_id=$1)`, [userId])).rows[0].n;
  if (money > 0) return "A payment connected to you is still being held or processed. Wait for it to finish first.";
  if (role === "parent") {
    const kids = (await db().query(
      `SELECT count(*)::int AS n FROM deals d JOIN guardian_links r ON r.athlete_id = d.athlete_id
        WHERE r.member_id=$1 AND d.status IN ${sqlIn(LIVE_STATUSES)}`, [userId])).rows[0].n;
    if (kids > 0) return "An athlete you're linked to has open deals that need a guardian. Resolve them first.";
  }
  return null;
}

/**
 * Purge-and-anonymize rather than DELETE: personal data goes, the users row stays as "Deleted user" so the other
 * party's deal history and the audit trail remain intact. The original email address is freed for reuse.
 */
export async function deleteAccount(formData: FormData) {
  const s = await requireUser();
  if (str(formData, "confirm") !== DELETE_PHRASE) done("error", `Type ${DELETE_PHRASE} to confirm.`);
  const me = await reauth(s.userId, String(formData.get("password") ?? ""));
  const blocker = await deletionBlockers(s.userId, s.role);
  if (blocker) done("error", blocker);

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT 1 FROM users WHERE id=$1 FOR UPDATE", [s.userId]);
    await purgeAndAnonymize(client, s.userId, me.email);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }

  await notify(me.email, "Your LIN account was deleted",
    `Hi ${me.name},\n\nYour LIN account has been deleted and your personal data removed. Records of deals you took part in are kept without your name, as the other party's records.\nIf you didn't do this, contact support immediately.`);
  await destroySession();
  redirect("/login?deleted=1");
}
