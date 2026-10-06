import { db } from "./db";
import { isSafeHref, NOTIFICATION_RETENTION_DAYS, PAGE_SIZE, type NotificationKind } from "./notifications";

export type NotificationRow = { id: number; kind: NotificationKind; title: string; href: string | null; count: number; created_at: Date; read_at: Date | null };
type Runner = Pick<ReturnType<typeof db>, "query">;

/** Adds an in-app notification. With a coalesce key, a repeat while one is still unread bumps it instead of piling up. Never throws. */
export async function notifyInApp(userIds: string[], n: { kind: NotificationKind; title: string; href?: string | null; coalesceKey?: string }, c: Runner = db()): Promise<void> {
  const href = isSafeHref(n.href) ? n.href : null;
  for (const id of new Set(userIds)) {
    try {
      await c.query(
        `INSERT INTO notifications(user_id, kind, title, href, coalesce_key) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, coalesce_key) WHERE read_at IS NULL AND coalesce_key IS NOT NULL
         DO UPDATE SET count = notifications.count + 1, title = EXCLUDED.title, created_at = NOW()`,
        [id, n.kind, n.title.slice(0, 200), href, n.coalesceKey ?? null]);
    } catch (e) { console.error("in-app notification failed", (e as Error).message); }
  }
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return (await db().query("SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL", [userId])).rows[0].n;
}

export async function listNotifications(userId: string): Promise<NotificationRow[]> {
  return (await db().query(
    "SELECT id::float8 AS id, kind, title, href, count, created_at, read_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2", [userId, PAGE_SIZE])).rows;
}

/** Returns the link to follow (null if it isn't theirs). */
export async function markOneRead(userId: string, id: number): Promise<string | null> {
  const r = await db().query("UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id=$1 AND user_id=$2 RETURNING href", [id, userId]);
  return r.rows[0]?.href ?? null;
}
export async function markAllRead(userId: string): Promise<void> {
  await db().query("UPDATE notifications SET read_at = NOW() WHERE user_id=$1 AND read_at IS NULL", [userId]);
}

/** Housekeeping: read notifications expire after the retention window; anything over a year old goes regardless. */
export async function purgeOldNotifications(): Promise<number> {
  const r = await db().query(
    `DELETE FROM notifications WHERE (read_at IS NOT NULL AND read_at < NOW() - make_interval(days => $1)) OR created_at < NOW() - INTERVAL '365 days'`,
    [NOTIFICATION_RETENTION_DAYS]);
  return r.rowCount ?? 0;
}
