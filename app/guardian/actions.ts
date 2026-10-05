"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { guardianState } from "@/lib/guardians";
import { RESEND_COOLDOWN_SECONDS, sendGuardianInvite } from "@/lib/verification";

export async function acceptGuardianInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const back = (msg: string): never => redirect(`/guardian/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(msg)}`);
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent("/guardian/accept?token=" + token)}`);
  if (s.role !== "parent") back("Only a Parent / Guardian account can accept this invite.");
  if (!s.emailVerified) back("Verify your email first.");

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    // Single atomic claim: pending, unexpired, and addressed to THIS verified account's email.
    const inv = await client.query(
      `UPDATE guardian_invites SET status='accepted', accepted_by=$2, accepted_at=NOW(), token_hash=NULL
        WHERE token_hash=$1 AND status='pending' AND expires_at > NOW() AND guardian_email=$3
        RETURNING athlete_id`, [hashToken(token), s.userId, s.email]);
    if (!inv.rowCount) { await client.query("ROLLBACK"); return back("This invite is invalid, expired, or was sent to a different email address."); }
    await client.query(
      `INSERT INTO athlete_relationships(athlete_id, member_id, relationship, can_view_academics, can_view_health, guardian_approved)
       VALUES ($1,$2,'parent',TRUE,TRUE,TRUE)
       ON CONFLICT (athlete_id, member_id) DO UPDATE
         SET relationship='parent', can_view_academics=TRUE, can_view_health=TRUE, guardian_approved=TRUE`,
      [inv.rows[0].athlete_id, s.userId]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  redirect("/dashboard?linked=1");
}

export async function resendGuardianInvite() {
  const s = await getSession();
  if (!s || s.role !== "athlete" || !s.emailVerified) redirect("/login");
  const g = await guardianState(s.userId);
  if (!g?.pendingInviteId) redirect("/dashboard");
  const wait = g.lastSentAt && Date.now() - new Date(g.lastSentAt).getTime() < RESEND_COOLDOWN_SECONDS * 1000;
  if (wait) redirect("/dashboard?invite=wait");
  try { await sendGuardianInvite(g.pendingInviteId); } catch (e) { console.error("guardian invite failed", e); redirect("/dashboard?invite=error"); }
  redirect("/dashboard?invite=sent");
}
