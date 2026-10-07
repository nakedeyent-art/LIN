"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { checkPassword } from "@/lib/reauth";
import type { CodesState } from "@/lib/mfa";
import { disableMfa, regenerateRecovery, securityEvent } from "@/lib/mfa";
import { sendMail } from "@/lib/mailer";

const notice = (to: string, subject: string, text: string) => sendMail(to, subject, text).catch((e) => console.error("mfa notice failed", (e as Error).message));
const done = (k: "msg" | "error", m: string): never => redirect(`/dashboard/settings?${k}=${encodeURIComponent(m)}`);

/** New recovery codes: password + a live authenticator code. The old codes stop working. */
export async function regenerateMyCodes(_prev: CodesState, formData: FormData): Promise<CodesState> {
  const s = await requireUser();
  const pw = await checkPassword(s.userId, String(formData.get("password") ?? ""));
  if (!pw.ok) return { error: pw.error };
  const r = await regenerateRecovery(s.userId, String(formData.get("code") ?? ""));
  if ("error" in r) return { error: r.error };
  await securityEvent(s.userId, "mfa_codes_regenerated");
  await notice(s.email, "New recovery codes for your LIN account", "New recovery codes were created for your account; the old ones no longer work. If this wasn't you, change your password now and contact support.");
  return { codes: r.codes };
}

/** Turns two-factor off. Needs the password and a current code (or an unused recovery code). Admins can't: it's mandatory for them. */
export async function disableMyMfa(formData: FormData) {
  const s = await requireUser();
  if (s.isAdmin) done("error", "Two-factor is required for admin accounts.");
  const pw = await checkPassword(s.userId, String(formData.get("password") ?? ""));
  if (!pw.ok) done("error", pw.error);
  const r = await disableMfa(s.userId, String(formData.get("code") ?? ""));
  if ("error" in r) done("error", r.error);
  await securityEvent(s.userId, "mfa_disabled");
  await notice(s.email, "Two-factor authentication was turned off on your LIN account", "Two-factor authentication was turned off. If this wasn't you, change your password now and contact support.");
  done("msg", "Two-factor authentication is off.");
}
