import { db } from "./db";
import { appUrl, sendMail } from "./mailer";
import { THREAD_PAGE } from "./messaging";
import { messageTitle } from "./notifications";
import { notifyInApp } from "./notificationsdb";

export type ThreadMessage = { id: number; sender_id: string; sender_name: string; body: string; created_at: Date };

/** Latest messages, oldest first. The caller has already proven the viewer may see this deal. */
export async function listThread(dealId: string): Promise<{ messages: ThreadMessage[]; total: number }> {
  const [m, t] = await Promise.all([
    db().query(
      `SELECT * FROM (SELECT m.id::float8 AS id, m.sender_id, u.full_name AS sender_name, m.body, m.created_at
                        FROM deal_messages m JOIN users u ON u.id = m.sender_id WHERE m.deal_id = $1 ORDER BY m.id DESC LIMIT $2) x ORDER BY id`,
      [dealId, THREAD_PAGE]),
    db().query("SELECT count(*)::int AS n FROM deal_messages WHERE deal_id=$1", [dealId]),
  ]);
  return { messages: m.rows, total: t.rows[0].n };
}

export async function markRead(dealId: string, userId: string): Promise<void> {
  await db().query(
    `INSERT INTO deal_message_reads(deal_id, user_id, last_read_id)
       VALUES ($1, $2, COALESCE((SELECT max(id) FROM deal_messages WHERE deal_id=$1), 0))
     ON CONFLICT (deal_id, user_id) DO UPDATE SET last_read_id = GREATEST(deal_message_reads.last_read_id, EXCLUDED.last_read_id)`,
    [dealId, userId]);
}

/** Unread messages (from other people) per deal, for every deal this user can see. */
export async function unreadByDeal(userId: string): Promise<Map<string, number>> {
  const r = await db().query(
    `SELECT m.deal_id, count(*)::int AS n
       FROM deal_messages m
       JOIN deals d ON d.id = m.deal_id
  LEFT JOIN deal_message_reads rd ON rd.deal_id = m.deal_id AND rd.user_id = $1
      WHERE m.sender_id <> $1 AND m.id > COALESCE(rd.last_read_id, 0)
        AND (d.counterparty_id = $1 OR d.athlete_id = $1 OR EXISTS (
              SELECT 1 FROM guardian_links g WHERE g.athlete_id = d.athlete_id AND g.member_id = $1))
      GROUP BY m.deal_id`, [userId]);
  return new Map(r.rows.map((x) => [x.deal_id as string, x.n as number]));
}

/** Inserts the message and returns who should get a "you have a message" email (one per unread burst). Rate limit is checked in the same transaction. */
export async function insertMessage(dealId: string, senderId: string, body: string, maxPerMinute: number): Promise<{ ok: true; emails: string[]; others: string[]; title: string } | { ok: false; limited: true }> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`msg:${dealId}:${senderId}`]);
    const recent = (await client.query(
      "SELECT count(*)::int AS n FROM deal_messages WHERE deal_id=$1 AND sender_id=$2 AND created_at > NOW() - INTERVAL '1 minute'", [dealId, senderId])).rows[0].n;
    if (recent >= maxPerMinute) { await client.query("ROLLBACK"); return { ok: false, limited: true }; }
    // Everyone else on the deal gets an in-app notification; people with nothing unread yet (and email on) also get an email.
    const people = (await client.query(
      `WITH p AS (
         SELECT u.id, u.email, u.email_messages FROM deals d JOIN users u ON u.id IN (d.athlete_id, d.counterparty_id) WHERE d.id = $1
         UNION
         SELECT u.id, u.email, u.email_messages FROM deals d JOIN guardian_links g ON g.athlete_id = d.athlete_id JOIN users u ON u.id = g.member_id WHERE d.id = $1)
       SELECT p.id, p.email, p.email_messages AS wants_email,
              NOT EXISTS (SELECT 1 FROM deal_messages m LEFT JOIN deal_message_reads rd ON rd.deal_id = m.deal_id AND rd.user_id = p.id
                           WHERE m.deal_id = $1 AND m.sender_id <> p.id AND m.id > COALESCE(rd.last_read_id, 0)) AS nothing_unread
         FROM p WHERE p.id <> $2 AND p.email NOT LIKE '%@deleted.invalid'`, [dealId, senderId])).rows as
      { id: string; email: string; wants_email: boolean; nothing_unread: boolean }[];
    const title = (await client.query("SELECT title FROM deals WHERE id=$1", [dealId])).rows[0].title as string;
    await client.query("INSERT INTO deal_messages(deal_id, sender_id, body) VALUES ($1,$2,$3)", [dealId, senderId, body]);
    await client.query("COMMIT");
    return { ok: true, emails: people.filter((p) => p.wants_email && p.nothing_unread).map((p) => p.email), others: people.map((p) => p.id), title };
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }
}

/** Never includes the message text — just a link behind login. */
export async function notifyNewMessage(dealId: string, r: { emails: string[]; others: string[]; title: string }): Promise<void> {
  for (const uid of r.others) await notifyInApp([uid], { kind: "message", title: messageTitle(r.title, 1), href: `/dashboard/deals/${dealId}/messages`, coalesceKey: `msg:${dealId}` });
  const text = `You have a new message on a NIL deal.\n\nLog in to read and reply: ${appUrl()}/dashboard/deals/${dealId}/messages\n\nYou can change which emails you get under Settings.`;
  await Promise.all(r.emails.map((e) => sendMail(e, "New message on a NIL deal", text).catch((err) => console.error("message notification failed", err))));
}
