import { db } from "./db";
import { MAX_QUERY } from "./search";

const VISIBLE = `(d.counterparty_id = $1 OR d.athlete_id = $1 OR EXISTS (SELECT 1 FROM guardian_links r WHERE r.athlete_id = d.athlete_id AND r.member_id = $1))`;

export type DealHit = { id: string; title: string; status: string; counterparty_name: string; athlete_name: string; athlete_minor: boolean; athlete_id: string };
export type MessageHit = DealHit & { message_id: number; body: string; created_at: Date; sender_id: string };

/** Deals the user can see whose title or other party's name matches. */
export async function searchDeals(userId: string, q: string): Promise<DealHit[]> {
  const like = "%" + q.slice(0, MAX_QUERY).replace(/[\\%_]/g, "\\$&") + "%";
  return (await db().query(
    `SELECT d.id, d.title, d.status, c.full_name AS counterparty_name, a.full_name AS athlete_name, d.athlete_id,
            COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS athlete_minor
       FROM deals d JOIN users a ON a.id = d.athlete_id JOIN users c ON c.id = d.counterparty_id LEFT JOIN athlete_profiles ap ON ap.user_id = d.athlete_id
      WHERE ${VISIBLE} AND (d.title ILIKE $2 OR c.full_name ILIKE $2 OR a.full_name ILIKE $2) ORDER BY d.created_at DESC LIMIT 25`, [userId, like])).rows;
}

/** Messages in deals the user can see. Hidden and removed messages never match. Words are ANDed; "quotes", OR and -minus work (websearch syntax). */
export async function searchMessages(userId: string, q: string): Promise<MessageHit[]> {
  return (await db().query(
    `SELECT d.id, d.title, d.status, c.full_name AS counterparty_name, a.full_name AS athlete_name, d.athlete_id,
            COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS athlete_minor,
            m.id::float8 AS message_id, m.body, m.created_at, m.sender_id
       FROM deal_messages m JOIN deals d ON d.id = m.deal_id JOIN users a ON a.id = d.athlete_id JOIN users c ON c.id = d.counterparty_id
       LEFT JOIN athlete_profiles ap ON ap.user_id = d.athlete_id
      WHERE ${VISIBLE} AND m.hidden_at IS NULL AND m.body <> '[message removed]'
        AND to_tsvector('simple', m.body) @@ websearch_to_tsquery('simple', $2)
      ORDER BY m.created_at DESC LIMIT 30`, [userId, q])).rows;
}
