import { db } from "./db";
import { hashToken, newSessionToken } from "./crypto";
import { appUrl, sendMail } from "./mailer";

export const INVITE_DAYS = 14;
export const MAX_PENDING_INVITES = 10;
export const INVITABLE = ["coach", "trainer", "manager", "recruiter"] as const;
export type Invitable = (typeof INVITABLE)[number];

/** Issues the token and emails the invitee. */
export async function sendConnectionInvite(inviteId: string): Promise<void> {
  const token = newSessionToken();
  const { rows } = await db().query(
    `UPDATE connection_invites i SET token_hash=$2, expires_at = NOW() + make_interval(days => $3)
       FROM users a WHERE i.id=$1 AND i.status='pending' AND a.id = i.athlete_id
       RETURNING i.invitee_email, i.role, i.can_view_academics, i.can_view_health, a.full_name`, [inviteId, hashToken(token), INVITE_DAYS]);
  const r = rows[0];
  if (!r) return;
  const sees = [r.can_view_academics && "academic progress", r.can_view_health && "nutrition and training"].filter(Boolean).join(" and ");
  await sendMail(r.invitee_email, `${r.full_name} invited you to their team on LIN`,
    `${r.full_name} (or their parent/guardian) invited you to connect as their ${String(r.role).replace("_", " ")} on LIN. You would be able to see: ${sees}.\n\n` +
    `Log in or create a ${String(r.role).replace("_", " ")} account using THIS email address (${r.invitee_email}), verify it, then open:\n` +
    `${appUrl()}/connect/accept?token=${token}\n\nThis link expires in ${INVITE_DAYS} days. If you don't know this athlete, ignore this email.`);
}
