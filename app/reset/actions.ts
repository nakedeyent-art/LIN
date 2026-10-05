"use server";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { hashPassword, isValidEmail, normalizeEmail } from "@/lib/crypto";
import { sendMail } from "@/lib/mailer";
import { validateNewPassword } from "@/lib/password-policy";
import { completePasswordReset, peekResetToken, sendPasswordReset } from "@/lib/verification";

/**
 * Always answers the same way, whether or not the email has an account; the lookup and email run after the
 * response so timing doesn't reveal it either.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!isValidEmail(email)) redirect(`/forgot-password?error=${encodeURIComponent("Enter a valid email address.")}`);
  after(async () => {
    try { await sendPasswordReset(email); } catch (e) { console.error("password reset email failed", e); }
  });
  redirect("/forgot-password?sent=1");
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const back = (msg: string): never => redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(msg)}`);

  const email = await peekResetToken(token);
  if (!email) redirect(`/reset-password?token=${encodeURIComponent(token)}`); // page shows the "invalid or expired" state
  const problem = validateNewPassword(password, email!);
  if (problem) back(problem);
  if (password !== confirm) back("The two passwords don't match.");

  // Hash before taking the token so a validation error never burns the link.
  const done = await completePasswordReset(token, await hashPassword(password));
  if (!done) redirect(`/reset-password?token=${encodeURIComponent(token)}`);
  try {
    await sendMail(done!.email, "Your LIN password was changed",
      `Hi ${done!.name},\n\nYour password was just changed and you've been signed out everywhere. If this was you, no action is needed.\n` +
      `If it wasn't, reset your password again right away from the login page.`);
  } catch (e) { console.error("password-changed notice failed", e); }
  redirect("/login?reset=1");
}
