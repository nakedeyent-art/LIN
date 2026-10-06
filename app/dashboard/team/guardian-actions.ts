"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isValidEmail, normalizeEmail } from "@/lib/crypto";
import { DELETE_PHRASE, maskEmail } from "@/lib/account";
import { openDealCount, purgeAndAnonymize } from "@/lib/account-deletion";
import { canInviteGuardian, checkRemoval } from "@/lib/guardianship";
import { logGuardianEvent, unlistIfNoGuardian } from "@/lib/guardians";
import { sendMail } from "@/lib/mailer";
import { checkPassword } from "@/lib/reauth";
import { requireAccess } from "@/lib/session";
import { sendGuardianInvite } from "@/lib/verification";

const UUID = /^[0-9a-f-]{36}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (key: "msg" | "error", m: string): never => redirect(`/dashboard/team?${key}=${encodeURIComponent(m)}`);
const notify = async (to: string, subject: string, text: string) => { try { await sendMail(to, subject, text); } catch (e) { console.error("guardian notice failed", e); } };

/** Authority check used by every guardian action: a linked parent of an athlete who is STILL a minor. */
async function requireGuardianOf(athleteId: string) {
  const s = await requireAccess("/dashboard/team");
  if (s.role !== "parent" || !UUID.test(athleteId) ||
      !(await db().query("SELECT 1 FROM guardian_links WHERE athlete_id=$1 AND member_id=$2", [athleteId, s.userId])).rowCount)
    done("error", "Only a linked parent/guardian of an athlete under 18 can do this.");
  return s;
}

export async function inviteGuardian(formData: FormData) {
  const athleteId = str(formData, "athlete_id");
  const s = await requireGuardianOf(athleteId);
  const email = normalizeEmail(str(formData, "email"));
  if (!isValidEmail(email)) done("error", "Enter a valid email address.");
  if (email === s.email) done("error", "You're already a guardian.");
  const c = (await db().query(
    `SELECT (SELECT count(*)::int FROM guardian_links WHERE athlete_id=$1) AS linked,
            (SELECT count(*)::int FROM guardian_invites WHERE athlete_id=$1 AND status='pending' AND (expires_at IS NULL OR expires_at > NOW())) AS pending,
            EXISTS (SELECT 1 FROM guardian_links g JOIN users u ON u.id = g.member_id WHERE g.athlete_id=$1 AND u.email=$2) AS already,
            EXISTS (SELECT 1 FROM guardian_invites WHERE athlete_id=$1 AND status='pending' AND (expires_at IS NULL OR expires_at > NOW()) AND guardian_email=$2) AS dup,
            (SELECT email FROM users WHERE id=$1) AS athlete_email`, [athleteId, email])).rows[0];
  if (c.already) done("error", "That person is already a guardian.");
  if (c.dup) done("error", "There's already a pending invite for that address.");
  if (email === c.athlete_email) done("error", "That's the athlete's own address.");
  const cap = canInviteGuardian(c.linked, c.pending);
  if (!cap.ok) done("error", cap.error);
  const id = (await db().query(
    "INSERT INTO guardian_invites(athlete_id, guardian_email, invited_by) VALUES ($1,$2,$3) RETURNING id", [athleteId, email, s.userId])).rows[0].id;
  await logGuardianEvent(athleteId, s.userId, "invited", maskEmail(email));
  try { await sendGuardianInvite(id); } catch (e) { console.error("guardian invite failed", e); done("error", "Invite saved but the email couldn't be sent. Cancel it and try again."); }
  done("msg", `Invite sent to ${email}. It works for 14 days and needs a verified Parent account with that email.`);
}

export async function cancelGuardianInvite(formData: FormData) {
  const inviteId = str(formData, "invite_id");
  const inv = UUID.test(inviteId) ? (await db().query("SELECT athlete_id, guardian_email FROM guardian_invites WHERE id=$1 AND status='pending'", [inviteId])).rows[0] : null;
  if (!inv) done("error", "Unknown invite.");
  const s = await requireGuardianOf(inv.athlete_id);
  await db().query("UPDATE guardian_invites SET status='revoked', token_hash=NULL WHERE id=$1 AND status='pending'", [inviteId]);
  await logGuardianEvent(inv.athlete_id, s.userId, "invite_cancelled", maskEmail(inv.guardian_email));
  done("msg", "Invite cancelled.");
}

/**
 * Remove another guardian, or step down yourself. The guardian count is re-read inside a transaction that locks the
 * athlete's row, so two guardians removing each other at once can't leave a minor with none.
 */
export async function removeGuardian(formData: FormData) {
  const relId = str(formData, "relationship_id");
  const rel = UUID.test(relId) ? (await db().query(
    "SELECT r.athlete_id, r.member_id, u.email, u.full_name FROM guardian_links r JOIN users u ON u.id = r.member_id WHERE r.id=$1", [relId])).rows[0] : null;
  if (!rel) done("error", "Unknown guardian.");
  const s = await requireGuardianOf(rel.athlete_id);
  const self = rel.member_id === s.userId;

  const client = await db().connect();
  let leavesNone = false, athleteEmail = "", athleteName = "";
  try {
    await client.query("BEGIN");
    await client.query("SELECT 1 FROM athlete_profiles WHERE user_id=$1 FOR UPDATE", [rel.athlete_id]);
    const linked = (await client.query("SELECT count(*)::int AS n FROM guardian_links WHERE athlete_id=$1", [rel.athlete_id])).rows[0].n;
    const stillThere = (await client.query("SELECT 1 FROM guardian_links WHERE athlete_id=$1 AND member_id=$2", [rel.athlete_id, s.userId])).rowCount;
    const deals = await openDealCount(rel.athlete_id);
    const check = checkRemoval({ actorIsGuardian: !!stillThere, targetIsSelf: self, guardiansLinked: linked, openDeals: deals });
    if (!check.ok) { await client.query("ROLLBACK"); return done("error", check.error); }
    leavesNone = check.leavesNone;
    await client.query("DELETE FROM athlete_relationships WHERE id=$1", [relId]);
    if (leavesNone) await unlistIfNoGuardian(rel.athlete_id, client);
    await logGuardianEvent(rel.athlete_id, s.userId, self ? "stepped_down" : "removed", self ? undefined : rel.full_name, client);
    const a = (await client.query("SELECT email, full_name FROM users WHERE id=$1", [rel.athlete_id])).rows[0];
    athleteEmail = a.email; athleteName = a.full_name;
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }

  if (!self) await notify(rel.email, "You were removed as a guardian on LIN",
    `${s.name} removed you as a parent/guardian of ${athleteName} on LIN. You no longer have access to their information or deals.`);
  await notify(athleteEmail, "A guardian on your LIN account changed",
    `${self ? `${s.name} stepped down` : `${rel.full_name} was removed`} as a parent/guardian on your account.` +
    (leavesNone ? "\nYou now have no linked guardian: deals are on hold and you're unlisted from sponsors until a parent/guardian joins." : ""));
  done("msg", self ? (leavesNone ? "You stepped down. The athlete is now unlisted until another guardian joins." : "You stepped down as a guardian.") : `${rel.full_name} was removed as a guardian.`);
}

export async function setMinorListing(formData: FormData) {
  const athleteId = str(formData, "athlete_id");
  const s = await requireGuardianOf(athleteId);
  const on = formData.get("on") === "1";
  await db().query("UPDATE athlete_profiles SET discoverable=$2 WHERE user_id=$1", [athleteId, on]);
  await logGuardianEvent(athleteId, s.userId, "listing_changed", on ? "listed to sponsors" : "unlisted");
  done("msg", on ? "Listed: sponsors can now find this athlete and send offers (you approve each deal)." : "Unlisted: sponsors can no longer find this athlete.");
}

/** A guardian may delete a minor's account (same purge-and-anonymize as self-deletion); open deals must be resolved first. */
export async function deleteMinorAccount(formData: FormData) {
  const athleteId = str(formData, "athlete_id");
  const s = await requireGuardianOf(athleteId);
  if (str(formData, "confirm") !== DELETE_PHRASE) done("error", `Type ${DELETE_PHRASE} to confirm.`);
  const pw = await checkPassword(s.userId, String(formData.get("password") ?? ""));
  if (!pw.ok) done("error", pw.error);
  const deals = await openDealCount(athleteId);
  if (deals > 0) done("error", `This athlete has ${deals} open deal${deals > 1 ? "s" : ""}. Resolve ${deals > 1 ? "them" : "it"} first.`);

  const a = (await db().query("SELECT email, full_name FROM users WHERE id=$1", [athleteId])).rows[0];
  const guardians = (await db().query("SELECT u.email FROM guardian_links g JOIN users u ON u.id = g.member_id WHERE g.athlete_id=$1", [athleteId])).rows.map((r) => r.email as string);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT 1 FROM users WHERE id=$1 FOR UPDATE", [athleteId]);
    if (await openDealCount(athleteId)) { await client.query("ROLLBACK"); return done("error", "A deal opened while you were confirming. Resolve it first."); }
    await purgeAndAnonymize(client, athleteId, a.email);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }
  for (const to of new Set([a.email, ...guardians]))
    await notify(to, "A LIN account was deleted", `The account for ${a.full_name} was deleted by their parent/guardian ${s.name}. Personal data was removed; records of deals are kept without their name.`);
  done("msg", `${a.full_name}'s account was deleted.`);
}

// ---------- adult athletes: consent transfers at 18 ----------

async function requireAdultAthlete() {
  const s = await requireAccess("/dashboard/team");
  const adult = s.role === "athlete" && (await db().query(
    "SELECT 1 FROM athlete_profiles WHERE user_id=$1 AND birth_date <= CURRENT_DATE - INTERVAL '18 years'", [s.userId])).rowCount;
  if (!adult) done("error", "Only an athlete who is 18 or older can change this.");
  return s;
}
const parentLink = async (relId: string, athleteId: string) =>
  UUID.test(relId) ? (await db().query(
    `SELECT r.id, u.full_name FROM athlete_relationships r JOIN users u ON u.id = r.member_id
      WHERE r.id=$1 AND r.athlete_id=$2 AND r.relationship='parent' AND r.guardian_approved`, [relId, athleteId])).rows[0] : null;

/** At 18 a former guardian has no access. The athlete can choose to keep sharing — view-only, only what they pick. */
export async function shareWithParent(formData: FormData) {
  const s = await requireAdultAthlete();
  const link = await parentLink(str(formData, "relationship_id"), s.userId);
  if (!link) done("error", "Unknown parent/guardian.");
  const academics = formData.get("academics") === "on", health = formData.get("health") === "on";
  if (!academics && !health) done("error", "Choose at least one thing to share (or use \"Stop sharing\").");
  await db().query("UPDATE athlete_relationships SET consent_confirmed_at=NOW(), can_view_academics=$2, can_view_health=$3 WHERE id=$1", [link.id, academics, health]);
  await logGuardianEvent(s.userId, s.userId, "adult_sharing_granted", link.full_name);
  done("msg", `Sharing with ${link.full_name} (view-only).`);
}

export async function stopSharingWithParent(formData: FormData) {
  const s = await requireAdultAthlete();
  const link = await parentLink(str(formData, "relationship_id"), s.userId);
  if (!link) done("error", "Unknown parent/guardian.");
  await db().query("UPDATE athlete_relationships SET consent_confirmed_at=NULL WHERE id=$1", [link.id]);
  await logGuardianEvent(s.userId, s.userId, "adult_sharing_stopped", link.full_name);
  done("msg", `Stopped sharing with ${link.full_name}.`);
}

export async function removeParentLink(formData: FormData) {
  const s = await requireAdultAthlete();
  const link = await parentLink(str(formData, "relationship_id"), s.userId);
  if (!link) done("error", "Unknown parent/guardian.");
  await db().query("DELETE FROM athlete_relationships WHERE id=$1", [link.id]);
  await logGuardianEvent(s.userId, s.userId, "adult_link_removed", link.full_name);
  done("msg", `${link.full_name} was removed from your account.`);
}
