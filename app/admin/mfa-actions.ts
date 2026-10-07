"use server";
import { requireAdmin } from "@/lib/session";
import { checkPassword } from "@/lib/reauth";
import { regenerateRecovery } from "@/lib/mfa";
import { audit } from "@/lib/admindb";
import { sendMail } from "@/lib/mailer";
import type { CodesState } from "@/lib/mfa";

/** New recovery codes: needs the password and a fresh authenticator code. The old codes stop working. */
export async function regenerateCodes(_prev: CodesState, formData: FormData): Promise<CodesState> {
  const s = await requireAdmin();
  const pw = await checkPassword(s.userId, String(formData.get("password") ?? ""));
  if (!pw.ok) return { error: pw.error };
  const r = await regenerateRecovery(s.userId, String(formData.get("code") ?? ""));
  if ("error" in r) return { error: r.error };
  await audit(s.userId, "mfa_recovery_regenerated", { userId: s.userId, detail: "new recovery codes issued; old ones revoked" });
  await sendMail(s.email, "New recovery codes for your LIN admin account", "New recovery codes were generated for your admin account; the old ones no longer work. If this wasn't you, change your password now.").catch(() => {});
  return { codes: r.codes };
}
