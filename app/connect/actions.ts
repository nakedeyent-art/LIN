"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { getSession } from "@/lib/session";

export async function acceptConnection(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const here = `/connect/accept?token=${encodeURIComponent(token)}`;
  const back = (msg: string): never => redirect(`${here}&error=${encodeURIComponent(msg)}`);
  const s = await getSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(here)}`);
  if (!s.emailVerified) back("Verify your email first.");
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    // One atomic claim: pending, unexpired, addressed to this verified email, for this account's role.
    const inv = await client.query(
      `UPDATE connection_invites SET status='accepted', accepted_by=$2, accepted_at=NOW(), token_hash=NULL
        WHERE token_hash=$1 AND status='pending' AND expires_at > NOW() AND invitee_email=$3 AND role::text=$4
        RETURNING athlete_id, role, can_view_academics, can_view_health`, [hashToken(token), s.userId, s.email, s.role]);
    if (!inv.rowCount) { await client.query("ROLLBACK"); return back("This invite is invalid, expired, or was sent to a different email or role."); }
    const i = inv.rows[0];
    await client.query(
      `INSERT INTO athlete_relationships(athlete_id, member_id, relationship, can_view_academics, can_view_health, guardian_approved)
       VALUES ($1,$2,$3,$4,$5,FALSE)
       ON CONFLICT (athlete_id, member_id) DO UPDATE SET relationship=EXCLUDED.relationship,
         can_view_academics=EXCLUDED.can_view_academics, can_view_health=EXCLUDED.can_view_health
       WHERE athlete_relationships.relationship <> 'parent'`, [i.athlete_id, s.userId, i.role, i.can_view_academics, i.can_view_health]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  redirect("/dashboard?connected=1");
}
