"use server";
import { redirect } from "next/navigation";
import { currentTokenHash, requireAdminBasic } from "@/lib/session";
import { checkPassword } from "@/lib/reauth";
import type { CodesState } from "@/lib/mfa";
import { completeEnrollment, MFA_LOCK_MINUTES, MFA_MAX_FAILS, verifySecondStep } from "@/lib/mfa";
import { audit } from "@/lib/admindb";
import { sendMail } from "@/lib/mailer";
import { safeNext } from "@/lib/redirect";

const notice = (to: string, subject: string, text: string) => sendMail(to, subject, text).catch((e) => console.error("mfa notice failed", (e as Error).message));

/** Enrolment: password + the first code from the authenticator app. Returns the recovery codes once. */
export async function enrollMfa(_prev: CodesState, formData: FormData): Promise<CodesState> {
  const s = await requireAdminBasic();
  const pw = await checkPassword(s.userId, String(formData.get("password") ?? ""));
  if (!pw.ok) return { error: pw.error };
  const tok = await currentTokenHash();
  if (!tok) return { error: "Please sign in again." };
  const r = await completeEnrollment(s.userId, String(formData.get("code") ?? ""), tok);
  if ("error" in r) return { error: r.error };
  await audit(s.userId, "mfa_enrolled", { userId: s.userId, detail: "authenticator app enrolled; recovery codes issued" });
  await notice(s.email, "Two-factor authentication is on for your LIN admin account", "An authenticator app was added to your LIN admin account. If this wasn't you, sign in and review your account, or ask whoever runs the server to reset it.");
  return { codes: r.codes };
}

/** The second step at sign-in. */
export async function verifyMfa(formData: FormData) {
  const s = await requireAdminBasic();
  const next = safeNext(String(formData.get("next") ?? ""), "/admin");
  const back = (m: string): never => redirect(`/mfa/verify?error=${encodeURIComponent(m)}&next=${encodeURIComponent(next)}`);
  const tok = await currentTokenHash();
  if (!tok) redirect("/login");
  const r = await verifySecondStep(s.userId, String(formData.get("code") ?? ""), tok!);
  if ("error" in r) {
    if (r.justLocked) await audit(s.userId, "mfa_locked", { userId: s.userId, detail: `${MFA_MAX_FAILS} wrong codes in a row; locked ${MFA_LOCK_MINUTES} minutes` });
    back(r.error);
  }
  const ok = r as { ok: true; usedRecovery: boolean; remaining: number };
  if (ok.usedRecovery) {
    await audit(s.userId, "mfa_recovery_used", { userId: s.userId, detail: `${ok.remaining} recovery code(s) left` });
    await notice(s.email, "A recovery code was used on your LIN admin account", `Someone signed in to your LIN admin account with a one-time recovery code (${ok.remaining} left). If this wasn't you, change your password now and ask whoever runs the server to reset two-factor authentication.`);
    redirect(`/admin/mfa?msg=${encodeURIComponent(`You signed in with a recovery code. ${ok.remaining} left — set up new codes soon.`)}`);
  }
  redirect(next);
}
