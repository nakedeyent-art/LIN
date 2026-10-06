"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { checkPassword } from "@/lib/reauth";
import { canActOnUser, validateReason } from "@/lib/admin";
import { audit, targetOf, userForAdmin } from "@/lib/admindb";
import { isOutcome } from "@/lib/reports";
import { notifyInApp } from "@/lib/notificationsdb";
import { sendMail } from "@/lib/mailer";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/**
 * Resolves a report (and every other open report on the same message). Needs the admin's password and a reason, and is audited.
 * Hiding keeps the original text for the record; users just see "[removed by a moderator]".
 */
export async function resolveReport(formData: FormData) {
  const id = str(formData, "report_id"), outcome = str(formData, "outcome");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/reports");
  const back = (k: "msg" | "error", m: string): never => redirect(`/admin/reports/${id}?${k}=${encodeURIComponent(m)}`);
  const s = await requireAdmin();
  if (!isOutcome(outcome)) back("error", "Choose what to do.");
  const bad = validateReason(str(formData, "reason"));
  if (bad) back("error", bad);
  const pw = await checkPassword(s.userId, String(formData.get("password") ?? ""));
  if (!pw.ok) back("error", pw.error);
  const reason = str(formData, "reason");

  const client = await db().connect();
  let senderEmail: string | null = null, senderId = "", dealId = "";
  const reporters: string[] = [];
  try {
    await client.query("BEGIN");
    const r = (await client.query(
      `SELECT r.id, r.message_id, r.deal_id, r.reason, r.status, m.sender_id FROM message_reports r JOIN deal_messages m ON m.id=r.message_id WHERE r.id=$1 FOR UPDATE OF r`, [id])).rows[0];
    if (!r) { await client.query("ROLLBACK"); return redirect("/admin/reports"); }
    if (r.status !== "open") { await client.query("ROLLBACK"); return back("error", "This report was already resolved."); }
    senderId = r.sender_id; dealId = r.deal_id;
    const out = outcome as "dismiss" | "hide" | "warn" | "suspend";

    if (out === "suspend") {
      const u = await userForAdmin(senderId, client);
      const ok = u ? canActOnUser(s.userId, targetOf(u), "suspend") : { ok: false as const, error: "That account no longer exists." };
      if (!ok.ok) { await client.query("ROLLBACK"); return back("error", ok.error); }
      await client.query("UPDATE users SET suspended_at=NOW() WHERE id=$1", [senderId]);
      await client.query("DELETE FROM sessions WHERE user_id=$1", [senderId]);
    }
    if (out !== "dismiss") await client.query("UPDATE deal_messages SET hidden_at=COALESCE(hidden_at, NOW()), hidden_by=COALESCE(hidden_by, $2) WHERE id=$1", [r.message_id, s.userId]);
    const resolved = (await client.query(
      `UPDATE message_reports SET status=$2, resolved_by=$3, resolved_at=NOW(), resolution=$4 WHERE message_id=$1 AND status='open' RETURNING reporter_id`,
      [r.message_id, out === "dismiss" ? "dismissed" : "actioned", s.userId, reason])).rows;
    reporters.push(...resolved.map((x) => x.reporter_id as string));
    await audit(s.userId, "resolve_report", { userId: senderId, dealId, detail: `[${out}] ${reason} (report ${id})` }, client);
    if (out === "warn" || out === "suspend") senderEmail = (await client.query("SELECT email FROM users WHERE id=$1", [senderId])).rows[0]?.email ?? null;
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { client.release(); }

  // After commit: tell people. The reporter hears the outcome in general terms; the sender is told a message was removed (not who reported).
  await notifyInApp(reporters, { kind: "account", title: outcome === "dismiss" ? "A moderator reviewed your report and found no violation" : "A moderator reviewed your report and took action", href: `/dashboard/deals/${dealId}/messages` });
  if (outcome === "warn" || outcome === "suspend") {
    await notifyInApp([senderId], { kind: "account", title: "A message you sent was removed for breaking the community rules", href: `/dashboard/deals/${dealId}/messages` });
    if (senderEmail) await sendMail(senderEmail, "A message you sent on LIN was removed",
      `A moderator removed a message you sent on a NIL deal because it broke our community rules (be respectful, no harassment or inappropriate content, no contact or payment outside LIN where it isn't allowed).${outcome === "suspend" ? "\n\nYour account has been suspended. Contact support if you think this is a mistake." : "\n\nPlease keep conversations respectful; repeated violations can lead to suspension."}`).catch(() => {});
  }
  back("msg", outcome === "dismiss" ? "Report dismissed." : outcome === "hide" ? "Message hidden." : outcome === "warn" ? "Message hidden and the sender warned." : "Message hidden and the sender suspended.");
}

