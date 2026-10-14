"use server";
import { redirect } from "next/navigation";
import { currentTokenHash, requireMfaPage } from "@/lib/session";
import { checkPassword } from "@/lib/reauth";
import type { CodesState } from "@/lib/mfa";
import { completeEnrollment, MFA_LOCK_MINUTES, MFA_MAX_FAILS, securityEvent, verifySecondStep } from "@/lib/mfa";
import { audit } from "@/lib/admindb";
import { sendNotice } from "@/lib/outbox";
import { safeNext } from "@/lib/redirect";
import { LIMITS, limitByIp, waitMessage } from "@/lib/ratelimit";

const notice = (to: string, subject: string, text: string) => sendNotice(to, subject, text).catch((e) => console.error("mfa notice failed", (e as Error).message));

/** Enrolment (mandatory for admins, optional for everyone else): password + the first code from the authenticator app. Returns the recovery codes once. */
export async function enrollMfa(_prev: CodesState, formData: FormData): Promise<CodesState> {
  const s = await requireMfaPage();
  const pw = await checkPassword(s.userId, String(formData.get("password") ?? ""));
  if (!pw.ok) return { error: pw.error };
  const tok = await currentTokenHash();
  if (!tok) return { error: "Please sign in again." };
  const r = await completeEnrollment(s.userId, String(formData.get("code") ?? ""), tok);
  if ("error" in r) return { error: r.error };
  if (s.isAdmin) await audit(s.userId, "mfa_enrolled", { userId: s.userId, detail: "authenticator app enrolled; recovery codes issued" });
  await notice(s.email, "Two-factor authentication is on for your LIN account",
    "An authenticator app was added to your LIN account and your other devices were signed out. If this wasn't you, change your password now and contact support.");
  return { codes: r.codes };
}

/** The second step at sign-in. */
export async function verifyMfa(formData: FormData) {
  const s = await requireMfaPage();
  const home = s.isAdmin ? "/admin" : "/dashboard";
  const next = safeNext(String(formData.get("next") ?? ""), home);
  const sensitive = formData.get("sensitive") === "1";
  const back = (m: string): never => redirect(`/mfa/verify?error=${encodeURIComponent(m)}&next=${encodeURIComponent(next)}${sensitive ? "&sensitive=1" : ""}`);
  const rl = await limitByIp(LIMITS.mfa);
  if (!rl.allowed) back(waitMessage(rl.retryAfterSeconds));
  const tok = await currentTokenHash();
  if (!tok) redirect("/login");
  const r = await verifySecondStep(s.userId, String(formData.get("code") ?? ""), tok!);
  if ("error" in r) {
    if (r.justLocked) {
      await securityEvent(s.userId, "mfa_locked");
      if (s.isAdmin) await audit(s.userId, "mfa_locked", { userId: s.userId, detail: `${MFA_MAX_FAILS} wrong codes in a row; locked ${MFA_LOCK_MINUTES} minutes` });
    }
    back(r.error);
  }
  const ok = r as { ok: true; usedRecovery: boolean; remaining: number };
  if (ok.usedRecovery) {
    await securityEvent(s.userId, "mfa_recovery_used");
    if (s.isAdmin) await audit(s.userId, "mfa_recovery_used", { userId: s.userId, detail: `${ok.remaining} recovery code(s) left` });
    await notice(s.email, "A recovery code was used on your LIN account", `Someone signed in to your LIN account with a one-time recovery code (${ok.remaining} left). If this wasn't you, change your password now and contact support.`);
    const where = s.isAdmin ? "/admin/mfa" : "/dashboard/settings";
    redirect(`${where}?msg=${encodeURIComponent(`You signed in with a recovery code. ${ok.remaining} left — create new codes soon.`)}`);
  }
  redirect(next);
}
