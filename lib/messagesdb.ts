import { db } from "./db";
import { appUrl, sendMail } from "./mailer";
import { createHash } from "node:crypto";
import { THREAD_PAGE } from "./messaging";
import { MAX_FILES_PER_DEAL } from "./attachments";
import { messageTitle } from "./notifications";
import { notifyInApp } from "./notificationsdb";

export type ThreadMessage = {
  id: number; sender_id: string; sender_name: string; body: string; created_at: Date; hidden: boolean; reported: boolean;
  files: { id: string; name: string; size: number }[];
};

const MSG_SELECT = `SELECT m.id::float8 AS id, m.sender_id, u.full_name AS sender_name, m.body, m.created_at, m.hidden_at IS NOT NULL AS hidden,
       EXISTS (SELECT 1 FROM message_reports r WHERE r.message_id = m.id AND r.reporter_id = $2) AS reported,
       COALESCE((SELECT json_agg(json_build_object('id', a.id, 'name', a.filename, 'size', a.size_bytes) ORDER BY a.created_at)
                   FROM deal_attachments a WHERE a.message_id = m.id), '[]'::json) AS files
  FROM deal_messages m JOIN users u ON u.id = m.sender_id`;

/** Latest messages, oldest first. The caller has already proven the viewer may see this deal. */
export async function listThread(dealId: string, viewerId: string): Promise<{ messages: ThreadMessage[]; total: number }> {
  const [m, t] = await Promise.all([
    db().query(`SELECT * FROM (${MSG_SELECT} WHERE m.deal_id = $1 ORDER BY m.id DESC LIMIT $3) x ORDER BY id`, [dealId, viewerId, THREAD_PAGE]),
    db().query("SELECT count(*)::int AS n FROM deal_messages WHERE deal_id=$1", [dealId]),
  ]);
  return { messages: m.rows, total: t.rows[0].n };
}

/** Messages newer than `after`, for the live feed. */
export async function messagesAfter(dealId: string, viewerId: string, after: number): Promise<ThreadMessage[]> {
  return (await db().query(`${MSG_SELECT} WHERE m.deal_id = $1 AND m.id > $3 ORDER BY m.id LIMIT 100`, [dealId, viewerId, after])).rows;
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
export type NewFile = { filename: string; type: string; bytes: Uint8Array };
export async function insertMessage(dealId: string, senderId: string, body: string, maxPerMinute: number, files: NewFile[] = []): Promise<{ ok: true; emails: string[]; others: string[]; title: string } | { ok: false; limited: true } | { ok: false; error: string }> {
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
    if (files.length) {
      const have = (await client.query("SELECT count(*)::int AS n FROM deal_attachments WHERE deal_id=$1", [dealId])).rows[0].n as number;
      if (have + files.length > MAX_FILES_PER_DEAL) { await client.query("ROLLBACK"); return { ok: false, error: `This conversation has reached its limit of ${MAX_FILES_PER_DEAL} attachments.` }; }
    }
    const mid = (await client.query("INSERT INTO deal_messages(deal_id, sender_id, body) VALUES ($1,$2,$3) RETURNING id", [dealId, senderId, body])).rows[0].id as string;
    for (const f of files) {
      await client.query(
        "INSERT INTO deal_attachments(message_id, deal_id, uploader_id, filename, content_type, size_bytes, sha256, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [mid, dealId, senderId, f.filename, f.type, f.bytes.length, createHash("sha256").update(f.bytes).digest("hex"), Buffer.from(f.bytes)]);
    }
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
