"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { canManageTeam } from "@/lib/access";
import { isValidEmail, normalizeEmail } from "@/lib/crypto";
import { INVITABLE, MAX_PENDING_INVITES, sendConnectionInvite } from "@/lib/connections";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;
const done = (key: "msg" | "error", m: string): never => redirect(`/dashboard/team?${key}=${encodeURIComponent(m)}`);

export async function inviteMember(formData: FormData) {
  const s = await requireAccess("/dashboard/team");
  const athleteId = str(formData, "athlete_id");
  if (!UUID.test(athleteId) || !(await canManageTeam(s, athleteId))) done("error", "You can't manage this athlete's team.");
  const email = normalizeEmail(str(formData, "email"));
  const role = str(formData, "role");
  const academics = formData.get("academics") === "on", health = formData.get("health") === "on";
  if (!isValidEmail(email)) done("error", "Enter a valid email.");
  if (!(INVITABLE as readonly string[]).includes(role)) done("error", "Choose a role.");
  if (!academics && !health) done("error", "Choose at least one thing to share.");
  if (email === s.email) done("error", "You can't invite yourself.");
  const pending = (await db().query(
    "SELECT count(*)::int AS n, bool_or(invitee_email=$2 AND role=$3::user_role) AS dup FROM connection_invites WHERE athlete_id=$1 AND status='pending' AND expires_at > NOW()",
    [athleteId, email, role])).rows[0];
  if (pending.dup) done("error", "There's already a pending invite for that person and role.");
  if (pending.n >= MAX_PENDING_INVITES) done("error", `You can have at most ${MAX_PENDING_INVITES} pending invites.`);
  const id = (await db().query(
    `INSERT INTO connection_invites(athlete_id, invited_by, invitee_email, role, can_view_academics, can_view_health, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6, NOW()) RETURNING id`, [athleteId, s.userId, email, role, academics, health])).rows[0].id;
  try { await sendConnectionInvite(id); } catch (e) { console.error("connection invite failed", e); done("error", "Invite saved but the email couldn't be sent. Revoke it and try again."); }
  done("msg", `Invite sent to ${email}.`);
}

export async function revokeInvite(formData: FormData) {
  const s = await requireAccess("/dashboard/team");
  const id = str(formData, "invite_id");
  if (!UUID.test(id)) done("error", "Unknown invite.");
  const inv = (await db().query("SELECT athlete_id FROM connection_invites WHERE id=$1", [id])).rows[0];
  if (!inv || !(await canManageTeam(s, inv.athlete_id))) done("error", "You can't manage this invite.");
  await db().query("UPDATE connection_invites SET status='revoked', token_hash=NULL WHERE id=$1 AND status='pending'", [id]);
  done("msg", "Invite revoked.");
}

/** Removes a coach/trainer/manager/recruiter's access immediately. Guardian links are not removable here. */
export async function removeMember(formData: FormData) {
  const s = await requireAccess("/dashboard/team");
  const id = str(formData, "relationship_id");
  if (!UUID.test(id)) done("error", "Unknown connection.");
  const r = (await db().query("SELECT athlete_id, relationship FROM athlete_relationships WHERE id=$1", [id])).rows[0];
  if (!r || r.relationship === "parent" || !(await canManageTeam(s, r.athlete_id))) done("error", "You can't remove this connection.");
  await db().query("DELETE FROM athlete_relationships WHERE id=$1 AND relationship <> 'parent'", [id]);
  done("msg", "Access removed.");
}
