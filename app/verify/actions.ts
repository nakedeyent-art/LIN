"use server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { consumeVerifyToken, sendVerificationEmail } from "@/lib/verification";
import { db } from "@/lib/db";
import { isValidEmail, normalizeEmail, verifyPassword } from "@/lib/crypto";
import { clearFailures, recordFailure } from "@/lib/lockout";

export async function confirmEmail(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const userId = await consumeVerifyToken(token);
  if (!userId) redirect(`/verify?error=${encodeURIComponent("This link is invalid, expired or already used.")}`);
  const s = await getSession();
  redirect(s ? "/dashboard" : "/login?verified=1");
}

export async function resendVerification() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.emailVerified) redirect("/dashboard");
  let sent = false;
  try { sent = await sendVerificationEmail(s.userId); } catch (e) {
    console.error("verification email failed", e);
    redirect(`/verify-email?error=${encodeURIComponent("We couldn't send the email. Please try again shortly.")}`);
  }
  redirect(sent ? "/verify-email?sent=1" : `/verify-email?error=${encodeURIComponent("Please wait a minute before requesting another email.")}`);
}

/** Mistyped address at signup: an UNVERIFIED account can switch it (password required) and gets a fresh link. */
export async function changeUnverifiedEmail(formData: FormData) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.emailVerified) redirect("/dashboard/settings");
  const err = (m: string): never => redirect(`/verify-email?error=${encodeURIComponent(m)}`);
  const email = normalizeEmail(String(formData.get("new_email") ?? ""));
  const u = (await db().query("SELECT password_hash, locked_until FROM users WHERE id=$1", [s.userId])).rows[0];
  if (u.locked_until && new Date(u.locked_until) > new Date()) err("Too many attempts. Try again in 15 minutes.");
  if (!(await verifyPassword(String(formData.get("password") ?? ""), u.password_hash))) { await recordFailure(s.userId); err("Your password is incorrect."); }
  await clearFailures(s.userId);
  if (!isValidEmail(email)) err("Enter a valid email address.");
  try {
    await db().query("UPDATE users SET email=$2 WHERE id=$1 AND email_verified_at IS NULL", [s.userId, email]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") err("That email is already used by another account.");
    throw e;
  }
  await db().query("DELETE FROM email_tokens WHERE user_id=$1 AND purpose='verify_email'", [s.userId]);
  try { await sendVerificationEmail(s.userId, true); } catch (e) { console.error("verification email failed", e); err("Address updated, but we couldn't send the email. Try Resend."); }
  redirect("/verify-email?sent=1");
}
