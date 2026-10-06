import type { PoolClient } from "pg";
import { db } from "./db";
import { appUrl, sendMail } from "./mailer";
import {
  type Capacity, type DealContext, type DealStatus, STATUS_LABEL,
} from "./deals";
import { paymentsEnabled } from "./stripe";
import { notifyInApp } from "./notificationsdb";

export type DealRow = {
  id: string; title: string; amount_cents: number; deliverables: string; status: DealStatus;
  expires_at: Date | null; created_at: Date; attested_at: Date | null;
  athlete_id: string; counterparty_id: string;
  athlete_name: string; athlete_minor: boolean; counterparty_name: string; counterparty_role: string;
  signed_by_me?: boolean;
};

/** Visibility rule, in one place: the two parties and the athlete's linked guardians. */
const VISIBLE = `(d.counterparty_id = $1 OR d.athlete_id = $1 OR EXISTS (
  SELECT 1 FROM guardian_links r
   WHERE r.athlete_id = d.athlete_id AND r.member_id = $1))`;

const SELECT = `
  SELECT d.id, d.title, d.amount_cents::float8 AS amount_cents, d.deliverables, d.status, d.expires_at, d.created_at, d.attested_at,
         d.athlete_id, d.counterparty_id, a.full_name AS athlete_name,
         COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS athlete_minor,
         c.full_name AS counterparty_name, c.role AS counterparty_role,
         EXISTS (SELECT 1 FROM contract_signatures s JOIN contracts k ON k.id = s.contract_id
                  WHERE k.deal_id = d.id AND s.signer_user_id = $1) AS signed_by_me
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
    `SELECT 1 FROM guardian_links WHERE athlete_id=$1 LIMIT 1`, [athleteId]);
  return !!(await q).rowCount;
}

/** Which hat is this user wearing on this deal? (null = no standing at all) */
export async function capacityOn(userId: string, d: Pick<DealRow, "athlete_id" | "counterparty_id">, c?: PoolClient): Promise<Capacity | null> {
  if (d.counterparty_id === userId) return "counterparty";
  if (d.athlete_id === userId) return "athlete";
  const r = await (c ?? db()).query(
    `SELECT 1 FROM guardian_links WHERE athlete_id=$1 AND member_id=$2`,
    [d.athlete_id, userId]);
  return r.rowCount ? "guardian" : null;
}

async function moneyState(dealId: string, c?: PoolClient) {
  const r = (await (c ?? db()).query(
    `SELECT d.cancel_requested_side AS side, EXISTS (SELECT 1 FROM deal_payments p WHERE p.deal_id = d.id AND p.status = 'funded') AS funded
       FROM deals d WHERE d.id=$1`, [dealId])).rows[0];
  return { funded: !!r?.funded, fundingRequired: paymentsEnabled(), cancelRequestSide: (r?.side ?? null) as "buyer" | "athlete_side" | null };
}

export async function dealContext(d: DealRow, c?: PoolClient): Promise<DealContext> {
  return {
    status: d.status,
    expired: !!d.expires_at && new Date(d.expires_at) < new Date(),
    athleteIsMinor: d.athlete_minor,
    athleteHasGuardian: d.athlete_minor ? await hasLinkedGuardian(d.athlete_id, c) : false,
    ...(await moneyState(d.id, c)),
  };
}

/** Tells whoever needs to know, in-app and (if they haven't opted out) by email. Never includes amounts/terms — just a link behind login. */
export async function notifyDeal(dealId: string, actorId: string, newStatus: DealStatus, created = false): Promise<void> {
  try {
    const d = (await db().query("SELECT d.title, d.athlete_id, d.counterparty_id FROM deals d WHERE d.id = $1", [dealId])).rows[0];
    if (!d) return;
    const guardians = (await db().query("SELECT member_id FROM guardian_links WHERE athlete_id=$1", [d.athlete_id])).rows.map((r) => r.member_id as string);
    let ids: string[];
    if (created) ids = [d.athlete_id];
    else if (newStatus === "guardian_review") ids = guardians;
    else ids = [d.counterparty_id, d.athlete_id, ...guardians];
    ids = [...new Set(ids)].filter((i) => i !== actorId);
    if (!ids.length) return;
    const title = created ? `New offer: "${d.title}"` : `"${d.title}" is now ${STATUS_LABEL[newStatus]}`;
    await notifyInApp(ids, { kind: "deal", title, href: `/dashboard/deals/${dealId}` });
    const people = (await db().query(
      "SELECT email FROM users WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL AND email_deal_updates", [ids])).rows.map((r) => r.email as string);
    const subject = created ? "You have a new NIL offer" : `NIL deal update: ${STATUS_LABEL[newStatus]}`;
    const text = `${created ? "A new offer is waiting for you" : `A deal ("${d.title}") is now: ${STATUS_LABEL[newStatus]}`}.\n\nLog in to review: ${appUrl()}/dashboard/deals/${dealId}\n\nYou can change which emails you get under Settings.`;
    await Promise.all(people.map((e) => sendMail(e, subject, text)));
  } catch (e) { console.error("deal notification failed", e); }
}
