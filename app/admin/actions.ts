"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { checkPassword } from "@/lib/reauth";
import { canActOnUser, validateReason, type UserAction } from "@/lib/admin";
import { audit, targetOf, userForAdmin } from "@/lib/admindb";
import { sendVerificationEmail } from "@/lib/verification";
import { unlistIfNoGuardian } from "@/lib/guardians";
import { refundPayment, releasePayment } from "@/lib/payments";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;

/** Every change needs the admin's password again plus a written reason, and leaves an append-only audit entry. */
async function gate(f: FormData, back: (k: "msg" | "error", m: string) => never) {
  const s = await requireAdmin();
  const bad = validateReason(str(f, "reason"));
  if (bad) back("error", bad);
  const pw = await checkPassword(s.userId, String(f.get("password") ?? ""));
  if (!pw.ok) back("error", pw.error);
  return { s, reason: str(f, "reason") };
}

export async function adminUserAction(formData: FormData) {
  const id = str(formData, "user_id"), action = str(formData, "action") as UserAction;
  if (!UUID.test(id)) redirect("/admin/users");
  const back = (k: "msg" | "error", m: string): never => redirect(`/admin/users/${id}?${k}=${encodeURIComponent(m)}`);
  const { s, reason } = await gate(formData, back);

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT 1 FROM users WHERE id=$1 FOR UPDATE", [id]);
    const u = await userForAdmin(id, client);
    if (!u) { await client.query("ROLLBACK"); return redirect("/admin/users"); }
    const birth = str(formData, "birth_date");
    if (!["suspend", "unsuspend", "unlock", "set_birth_date", "resend_verification"].includes(action)) { await client.query("ROLLBACK"); return back("error", "Unknown action."); }
    const ok = canActOnUser(s.userId, targetOf(u), action as UserAction, birth);
    if (!ok.ok) { await client.query("ROLLBACK"); return back("error", ok.error); }

    let detail = reason, msg = "Done.";
    if (action === "suspend") {
      await client.query("UPDATE users SET suspended_at=NOW() WHERE id=$1", [id]);
      await client.query("DELETE FROM sessions WHERE user_id=$1", [id]);
      msg = "Account suspended and signed out everywhere.";
    } else if (action === "unsuspend") {
      await client.query("UPDATE users SET suspended_at=NULL WHERE id=$1", [id]); msg = "Account restored.";
    } else if (action === "unlock") {
      await client.query("UPDATE users SET failed_logins=0, locked_until=NULL WHERE id=$1", [id]); msg = "Lockout cleared.";
    } else if (action === "set_birth_date") {
      await client.query("UPDATE athlete_profiles SET birth_date=$2 WHERE user_id=$1", [id, birth]);
      // A minor with no guardian can't be listed to sponsors.
      await unlistIfNoGuardian(id, client);
      detail = `${reason} [birth date ${u.birth_date} -> ${birth}]`; msg = "Birth date corrected.";
    }
    await audit(s.userId, action, { userId: id, detail }, client);
    await client.query("COMMIT");
    if (action === "resend_verification") { await sendVerificationEmail(id, true).catch(() => {}); msg = "Verification email sent."; }
    back("msg", msg);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }
}

/** Re-runs a stuck release/refund. Safe: the Stripe calls carry idempotency keys, so it can't pay twice. */
export async function adminRetryPayment(formData: FormData) {
  const dealId = str(formData, "deal_id"), paymentId = str(formData, "payment_id");
  if (!UUID.test(dealId) || !UUID.test(paymentId)) redirect("/admin/deals");
  const back = (k: "msg" | "error", m: string): never => redirect(`/admin/deals/${dealId}?${k}=${encodeURIComponent(m)}`);
  const { s, reason } = await gate(formData, back);
  const p = (await db().query("SELECT status FROM deal_payments WHERE id=$1 AND deal_id=$2", [paymentId, dealId])).rows[0];
  if (!p) back("error", "No such payment.");
  if (!["releasing", "refunding"].includes(p.status)) back("error", "Only a payment that is mid-release or mid-refund can be retried.");
  await audit(s.userId, "retry_payment", { dealId, detail: `${reason} [${p.status}]` });
  const r = p.status === "releasing" ? await releasePayment(paymentId) : await refundPayment(paymentId);
  back(r.ok ? "msg" : "error", r.ok ? "Processed." : `Still failing: ${r.error ?? "see the payment log"}`);
}
