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

/** Resolves a post/comment report (and every other open report on the same item). Same safeguards as message reports. */
export async function resolveContentReport(formData: FormData) {
  const id = str(formData, "report_id"), outcome = str(formData, "outcome");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/content-reports");
  const back = (k: "msg" | "error", m: string): never => redirect(`/admin/content-reports/${id}?${k}=${encodeURIComponent(m)}`);
  const s = await requireAdmin();
  if (!isOutcome(outcome)) back("error", "Choose what to do.");
  const bad = validateReason(str(formData, "reason"));
  if (bad) back("error", bad);
  const pw = await checkPassword(s.userId, String(formData.get("password") ?? ""));
  if (!pw.ok) back("error", pw.error);
  const reason = str(formData, "reason");

  const client = await db().connect();
  let senderId = "", senderEmail: string | null = null;
  const reporters: string[] = [];
  try {
    await client.query("BEGIN");
    const r = (await client.query(
      `SELECT r.id, r.kind, r.post_id, r.comment_id, r.status, COALESCE(c.author_id, p.author_id) AS sender_id
         FROM content_reports r JOIN posts p ON p.id = r.post_id LEFT JOIN post_comments c ON c.id = r.comment_id WHERE r.id=$1 FOR UPDATE OF r`, [id])).rows[0];
    if (!r) { await client.query("ROLLBACK"); return redirect("/admin/content-reports"); }
    if (r.status !== "open") { await client.query("ROLLBACK"); return back("error", "This report was already resolved."); }
    senderId = r.sender_id;
    const out = outcome as "dismiss" | "hide" | "warn" | "suspend";
    if (out === "suspend") {
      const u = await userForAdmin(senderId, client);
      const ok = u ? canActOnUser(s.userId, targetOf(u), "suspend") : { ok: false as const, error: "That account no longer exists." };
      if (!ok.ok) { await client.query("ROLLBACK"); return back("error", ok.error); }
      await client.query("UPDATE users SET suspended_at=NOW() WHERE id=$1", [senderId]);
      await client.query("DELETE FROM sessions WHERE user_id=$1", [senderId]);
    }
    if (out !== "dismiss") {
      if (r.kind === "post") await client.query("UPDATE posts SET hidden_at=COALESCE(hidden_at,NOW()), hidden_by=COALESCE(hidden_by,$2) WHERE id=$1", [r.post_id, s.userId]);
      else await client.query("UPDATE post_comments SET hidden_at=COALESCE(hidden_at,NOW()), hidden_by=COALESCE(hidden_by,$2) WHERE id=$1", [r.comment_id, s.userId]);
    }
    const resolved = (await client.query(
      `UPDATE content_reports SET status=$4, resolved_by=$5, resolved_at=NOW(), resolution=$6
        WHERE status='open' AND kind=$1 AND post_id=$2 AND COALESCE(comment_id,0)=COALESCE($3::bigint,0) RETURNING reporter_id`,
      [r.kind, r.post_id, r.comment_id, out === "dismiss" ? "dismissed" : "actioned", s.userId, reason])).rows;
    reporters.push(...resolved.map((x) => x.reporter_id as string));
    await audit(s.userId, "resolve_content_report", { userId: senderId, detail: `[${out}] ${reason} (report ${id})` }, client);
    if (out === "warn" || out === "suspend") senderEmail = (await client.query("SELECT email FROM users WHERE id=$1", [senderId])).rows[0]?.email ?? null;
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }

  await notifyInApp(reporters, { kind: "account", title: outcome === "dismiss" ? "A moderator reviewed your report and found no violation" : "A moderator reviewed your report and took action" });
  if (outcome === "warn" || outcome === "suspend") {
    await notifyInApp([senderId], { kind: "account", title: "Something you posted was removed for breaking the community rules" });
    if (senderEmail) await sendMail(senderEmail, "Something you posted on LIN was removed",
      `A moderator removed something you posted because it broke our community rules (be respectful, no harassment or inappropriate content, and no contact details in conversations with young athletes).${outcome === "suspend" ? "\n\nYour account has been suspended. Contact support if you think this is a mistake." : "\n\nRepeated violations can lead to suspension."}`).catch(() => {});
  }
  back("msg", outcome === "dismiss" ? "Report dismissed." : outcome === "hide" ? "Content hidden." : outcome === "warn" ? "Content hidden and the author warned." : "Content hidden and the author suspended.");
}
