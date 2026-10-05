import type { PoolClient } from "pg";
import { db } from "./db";
import { appUrl, sendMail } from "./mailer";
import {
  type Capacity, type DealAction, type DealContext, type DealStatus, STATUS_LABEL,
} from "./deals";

export type DealRow = {
  id: string; title: string; amount_cents: number; deliverables: string; status: DealStatus;
  expires_at: Date | null; created_at: Date; attested_at: Date | null;
  athlete_id: string; counterparty_id: string;
  athlete_name: string; athlete_minor: boolean; counterparty_name: string; counterparty_role: string;
};

/** Visibility rule, in one place: the two parties and the athlete's linked guardians. */
const VISIBLE = `(d.counterparty_id = $1 OR d.athlete_id = $1 OR EXISTS (
  SELECT 1 FROM athlete_relationships r
   WHERE r.athlete_id = d.athlete_id AND r.member_id = $1 AND r.relationship = 'parent' AND r.guardian_approved))`;

const SELECT = `
  SELECT d.id, d.title, d.amount_cents::float8 AS amount_cents, d.deliverables, d.status, d.expires_at, d.created_at, d.attested_at,
         d.athlete_id, d.counterparty_id, a.full_name AS athlete_name,
         COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS athlete_minor,
         c.full_name AS counterparty_name, c.role AS counterparty_role
    FROM deals d
    JOIN users a ON a.id = d.athlete_id
    LEFT JOIN athlete_profiles ap ON ap.user_id = d.athlete_id
    JOIN users c ON c.id = d.counterparty_id`;

export async function listDeals(userId: string): Promise<DealRow[]> {
  return (await db().query(`${SELECT} WHERE ${VISIBLE} ORDER BY d.created_at DESC`, [userId])).rows;
}

export async function getDeal(userId: string, dealId: string): Promise<DealRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(dealId)) return null;
  return (await db().query(`${SELECT} WHERE d.id = $2 AND ${VISIBLE}`, [userId, dealId])).rows[0] ?? null;
}

export async function dealEvents(dealId: string) {
  return (await db().query(
    `SELECT e.action, e.to_status, e.created_at, u.role FROM deal_events e JOIN users u ON u.id = e.actor_id
      WHERE e.deal_id = $1 ORDER BY e.created_at, e.id`, [dealId])).rows as
    { action: string; to_status: DealStatus; created_at: Date; role: string }[];
}

export async function hasLinkedGuardian(athleteId: string, c?: PoolClient): Promise<boolean> {
  const q = (c ?? db()).query(
    `SELECT 1 FROM athlete_relationships WHERE athlete_id=$1 AND relationship='parent' AND guardian_approved LIMIT 1`, [athleteId]);
  return !!(await q).rowCount;
}

/** Which hat is this user wearing on this deal? (null = no standing at all) */
export async function capacityOn(userId: string, d: Pick<DealRow, "athlete_id" | "counterparty_id">, c?: PoolClient): Promise<Capacity | null> {
  if (d.counterparty_id === userId) return "counterparty";
  if (d.athlete_id === userId) return "athlete";
  const r = await (c ?? db()).query(
    `SELECT 1 FROM athlete_relationships WHERE athlete_id=$1 AND member_id=$2 AND relationship='parent' AND guardian_approved`,
    [d.athlete_id, userId]);
  return r.rowCount ? "guardian" : null;
}

export async function dealContext(d: DealRow, c?: PoolClient): Promise<DealContext> {
  return {
    status: d.status,
    expired: !!d.expires_at && new Date(d.expires_at) < new Date(),
    athleteIsMinor: d.athlete_minor,
    athleteHasGuardian: d.athlete_minor ? await hasLinkedGuardian(d.athlete_id, c) : false,
  };
}

/** Emails whoever needs to know. Never includes amounts/terms — just a link behind login. */
export async function notifyDeal(dealId: string, actorId: string, newStatus: DealStatus, created = false): Promise<void> {
  try {
    const p = (await db().query(
      `SELECT d.title, a.email AS athlete_email, c.email AS cp_email, a.id AS athlete_id, c.id AS cp_id,
              COALESCE((SELECT array_agg(g.email) FROM athlete_relationships r JOIN users g ON g.id = r.member_id
                         WHERE r.athlete_id = d.athlete_id AND r.relationship='parent' AND r.guardian_approved), '{}') AS guardian_emails
         FROM deals d JOIN users a ON a.id = d.athlete_id JOIN users c ON c.id = d.counterparty_id WHERE d.id = $1`, [dealId])).rows[0];
    if (!p) return;
    let to: string[];
    if (created) to = [p.athlete_email];
    else if (newStatus === "guardian_review") to = p.guardian_emails;
    else to = [p.cp_email, p.athlete_email, ...p.guardian_emails];
    const actor = (await db().query("SELECT email FROM users WHERE id=$1", [actorId])).rows[0]?.email;
    to = [...new Set(to)].filter((e) => e && e !== actor);
    const subject = created ? "You have a new NIL offer" : `NIL deal update: ${STATUS_LABEL[newStatus]}`;
    const text = `${created ? "A new offer is waiting for you" : `A deal ("${p.title}") is now: ${STATUS_LABEL[newStatus]}`}.\n\nLog in to review: ${appUrl()}/dashboard/deals/${dealId}`;
    await Promise.all(to.map((e) => sendMail(e, subject, text)));
  } catch (e) { console.error("deal notification failed", e); }
}
