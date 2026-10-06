"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { guardianState, logGuardianEvent } from "@/lib/guardians";
import { isValidEmail, normalizeEmail } from "@/lib/crypto";
import { maskEmail } from "@/lib/account";
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
          AND EXISTS (SELECT 1 FROM athlete_profiles ap WHERE ap.user_id = guardian_invites.athlete_id AND ap.birth_date > CURRENT_DATE - INTERVAL '18 years')
        RETURNING athlete_id`, [hashToken(token), s.userId, s.email]);
    if (!inv.rowCount) { await client.query("ROLLBACK"); return back("This invite is invalid, expired, was sent to a different email address, or the athlete is now an adult."); }
    await client.query(
      `INSERT INTO athlete_relationships(athlete_id, member_id, relationship, can_view_academics, can_view_health, guardian_approved)
       VALUES ($1,$2,'parent',TRUE,TRUE,TRUE)
       ON CONFLICT (athlete_id, member_id) DO UPDATE
         SET relationship='parent', can_view_academics=TRUE, can_view_health=TRUE, guardian_approved=TRUE`,
      [inv.rows[0].athlete_id, s.userId]);
    await logGuardianEvent(inv.rows[0].athlete_id, s.userId, "accepted", undefined, client);
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

/**
 * A minor with NO linked guardian can name one (also how a mistyped address at signup gets fixed): any older pending
 * invite is replaced. Once a guardian is linked, further guardians are added by guardians, never by the minor.
 */
export async function inviteMyGuardian(formData: FormData) {
  const s = await getSession();
  if (!s || s.role !== "athlete" || !s.emailVerified) redirect("/login");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const fail = (m: string): never => redirect(`/dashboard?invite=${encodeURIComponent("err:" + m)}`);
  const g = await guardianState(s.userId);
  if (!g?.minor) fail("Only athletes under 18 need a guardian.");
  if (g!.linked.length > 0) fail("You already have a linked guardian; they can invite others.");
  if (!isValidEmail(email)) fail("Enter a valid email address.");
  if (email === s.email) fail("That's your own address.");
  await db().query("UPDATE guardian_invites SET status='revoked', token_hash=NULL WHERE athlete_id=$1 AND status='pending'", [s.userId]);
  const id = (await db().query("INSERT INTO guardian_invites(athlete_id, guardian_email) VALUES ($1,$2) RETURNING id", [s.userId, email])).rows[0].id;
  await logGuardianEvent(s.userId, s.userId, "invited", maskEmail(email));
  try { await sendGuardianInvite(id); } catch (e) { console.error("guardian invite failed", e); fail("Saved, but the email couldn't be sent. Try again shortly."); }
  redirect("/dashboard?invite=sent");
}
