"use server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { consumeVerifyToken, sendVerificationEmail } from "@/lib/verification";

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
