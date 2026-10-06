"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { maskEmail } from "@/lib/account";
import { sendMail } from "@/lib/mailer";
import { endOtherSessions, getSession } from "@/lib/session";

export async function confirmEmailChange(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const back = (msg: string): never => redirect(`/confirm-email?token=${encodeURIComponent(token)}&error=${encodeURIComponent(msg)}`);
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent("/confirm-email?token=" + token)}`);

  const client = await db().connect();
  let oldEmail = "", newEmail = "";
  try {
    await client.query("BEGIN");
    // Only the account that requested the change may spend the token (blocks "click this link" tricks on another user).
    const t = await client.query(
      `UPDATE email_tokens SET used_at = NOW()
        WHERE token_hash=$1 AND purpose='change_email' AND user_id=$2 AND used_at IS NULL AND expires_at > NOW() RETURNING payload`,
      [hashToken(token), s.userId]);
    if (!t.rowCount) { await client.query("ROLLBACK"); return back("This link is invalid, expired, or belongs to a different account."); }
    newEmail = t.rows[0].payload;
    oldEmail = s.email;
    try {
      await client.query("UPDATE users SET email=$2, email_verified_at=NOW() WHERE id=$1", [s.userId, newEmail]);
    } catch (e) {
      if ((e as { code?: string }).code === "23505") { await client.query("ROLLBACK"); return back("That address is now used by another account."); }
      throw e;
    }
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }

  await endOtherSessions(s.userId);
  try {
    await sendMail(oldEmail, "Your LIN email address was changed",
      `Your LIN account email was changed to ${maskEmail(newEmail)} and your other devices were signed out.\nIf this wasn't you, contact support immediately.`);
  } catch (e) { console.error("email-change notice failed", e); }
  redirect(`/dashboard/settings?msg=${encodeURIComponent("Email address updated.")}`);
}
