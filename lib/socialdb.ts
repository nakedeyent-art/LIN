import type { PoolClient } from "pg";
import { db } from "./db";
import { FEED_PAGE } from "./social";
import { linkFromStored, type MusicLink } from "./music";

type Q = Pick<PoolClient, "query">;

/** Blocked either way (including a CURRENT guardian blocking for a minor). a and b are SQL expressions. */
export const SOC_BLOCKED = (a: string, b: string) => `EXISTS (SELECT 1 FROM user_blocks ub WHERE
    (ub.blocker_id = ${a} AND ub.blocked_id = ${b}) OR (ub.blocker_id = ${b} AND ub.blocked_id = ${a})
 OR (ub.athlete_id = ${a} AND ub.blocked_id = ${b} AND EXISTS (SELECT 1 FROM guardian_links gl WHERE gl.athlete_id = ${a} AND gl.member_id = ub.blocker_id))
 OR (ub.athlete_id = ${b} AND ub.blocked_id = ${a} AND EXISTS (SELECT 1 FROM guardian_links gl WHERE gl.athlete_id = ${b} AND gl.member_id = ub.blocker_id)))`;
export const IS_MINOR = (u: string) => `EXISTS (SELECT 1 FROM athlete_profiles mp WHERE mp.user_id = ${u} AND mp.birth_date > CURRENT_DATE - INTERVAL '18 years')`;
const APPROVED_FOLLOW = (v: string, a: string) => `EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${v} AND f.followee_id = ${a} AND f.status = 'approved')`;
const GUARDS = (v: string, a: string) => `EXISTS (SELECT 1 FROM guardian_links gg WHERE gg.athlete_id = ${a} AND gg.member_id = ${v})`;

/** The single visibility rule for a post (mirrors postVisible in lib/social.ts). $1 is always the viewer. */
export const VISIBLE_POST = `(p.deleted_at IS NULL AND p.hidden_at IS NULL AND au.deleted_at IS NULL AND au.suspended_at IS NULL
  AND NOT ${SOC_BLOCKED("$1::uuid", "p.author_id")}
  AND (p.author_id = $1 OR NOT ${IS_MINOR("p.author_id")} OR ${APPROVED_FOLLOW("$1", "p.author_id")} OR ${GUARDS("$1", "p.author_id")}))`;

export type PostRow = {
  id: number; author_id: string; author_name: string; author_role: string; author_minor: boolean; author_sport: string | null;
  body: string; created_at: Date; has_image: boolean; likes: number; comments: number; liked: boolean;
  music_provider: string | null; music_label: string | null; status_text: string | null; family: boolean;
};
const POST_SELECT = `SELECT p.id::float8 AS id, p.author_id, au.full_name AS author_name, au.role AS author_role, ${IS_MINOR("p.author_id")} AS author_minor,
       ap.sport AS author_sport, p.body, p.created_at, EXISTS (SELECT 1 FROM post_images i WHERE i.post_id = p.id) AS has_image,
       (SELECT count(*)::int FROM post_likes l WHERE l.post_id = p.id) AS likes,
       (SELECT count(*)::int FROM post_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL AND c.hidden_at IS NULL) AS comments,
       EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = $1) AS liked,
       ps.music_provider, ps.music_label, ps.status_text, (p.author_id = $1 OR ${GUARDS("$1", "p.author_id")}) AS family
  FROM posts p JOIN users au ON au.id = p.author_id LEFT JOIN athlete_profiles ap ON ap.user_id = p.author_id LEFT JOIN profile_status ps ON ps.user_id = p.author_id`;

export async function feedFor(viewerId: string, tab: "following" | "discover", before?: number): Promise<{ posts: PostRow[]; more: boolean }> {
  const scope = tab === "following"
    ? `(p.author_id = $1 OR ${APPROVED_FOLLOW("$1", "p.author_id")} OR ${GUARDS("$1", "p.author_id")})`
    : `(p.author_id <> $1 AND NOT ${IS_MINOR("p.author_id")})`;
  const rows = (await db().query(
    `${POST_SELECT} WHERE ${VISIBLE_POST} AND ${scope} AND ($2::bigint IS NULL OR p.id < $2) ORDER BY p.id DESC LIMIT $3`,
    [viewerId, before ?? null, FEED_PAGE + 1])).rows as PostRow[];
  return { posts: rows.slice(0, FEED_PAGE), more: rows.length > FEED_PAGE };
}

export async function postsBy(viewerId: string, authorId: string, before?: number): Promise<{ posts: PostRow[]; more: boolean }> {
  const rows = (await db().query(
    `${POST_SELECT} WHERE ${VISIBLE_POST} AND p.author_id = $4 AND ($2::bigint IS NULL OR p.id < $2) ORDER BY p.id DESC LIMIT $3`,
    [viewerId, before ?? null, FEED_PAGE + 1, authorId])).rows as PostRow[];
  return { posts: rows.slice(0, FEED_PAGE), more: rows.length > FEED_PAGE };
}

export async function getPost(viewerId: string, postId: number): Promise<PostRow | null> {
  if (!Number.isSafeInteger(postId)) return null;
  return (await db().query(`${POST_SELECT} WHERE ${VISIBLE_POST} AND p.id = $2`, [viewerId, postId])).rows[0] ?? null;
}

export type CommentRow = { id: number; author_id: string; author_name: string; author_minor: boolean; body: string; created_at: Date; reported: boolean; family: boolean };
export async function commentsFor(viewerId: string, postId: number): Promise<CommentRow[]> {
  return (await db().query(
    `SELECT c.id::float8 AS id, c.author_id, u.full_name AS author_name, ${IS_MINOR("c.author_id")} AS author_minor, c.body, c.created_at,
            EXISTS (SELECT 1 FROM content_reports r WHERE r.comment_id = c.id AND r.reporter_id = $1) AS reported,
            (c.author_id = $1 OR ${GUARDS("$1", "c.author_id")}) AS family
       FROM post_comments c JOIN users u ON u.id = c.author_id
      WHERE c.post_id = $2 AND c.deleted_at IS NULL AND c.hidden_at IS NULL AND u.deleted_at IS NULL AND u.suspended_at IS NULL
        AND NOT ${SOC_BLOCKED("$1::uuid", "c.author_id")}
      ORDER BY c.id LIMIT 100`, [viewerId, postId])).rows;
}

/** Whether the viewer may see this person's profile content (status, music, posts). */
export async function profileOf(viewerId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const u = (await db().query(
    `SELECT u.id, u.full_name, u.role, ap.sport, ap.level, ${IS_MINOR("u.id")} AS minor,
            (u.id = $1) AS self, ${GUARDS("$1", "u.id")} AS guardian, ${APPROVED_FOLLOW("$1", "u.id")} AS follower,
            (SELECT status FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.id) AS follow_status,
            (SELECT count(*)::int FROM follows f WHERE f.followee_id = u.id AND f.status = 'approved') AS followers,
            ${SOC_BLOCKED("$1::uuid", "u.id")} AS blocked,
            EXISTS (SELECT 1 FROM user_blocks ub WHERE ub.blocker_id = $1 AND ub.blocked_id = u.id) AS i_blocked
       FROM users u LEFT JOIN athlete_profiles ap ON ap.user_id = u.id
      WHERE u.id = $2 AND u.deleted_at IS NULL AND u.suspended_at IS NULL`, [viewerId, userId])).rows[0];
  return u ?? null;
}

export type StatusRow = { status_text: string | null; label: string | null; music: MusicLink | null; updated_at: Date };
export async function statusOf(userId: string, c: Q = db()): Promise<StatusRow | null> {
  const r = (await c.query("SELECT status_text, music_provider, music_kind, music_id, music_label, updated_at FROM profile_status WHERE user_id=$1", [userId])).rows[0];
  if (!r) return null;
  const music = r.music_provider ? linkFromStored(r.music_provider, r.music_kind, r.music_id) : null;
  if (!r.status_text && !music) return null;
  return { status_text: r.status_text, label: r.music_label, music, updated_at: r.updated_at };
}

/** Guardian view of a minor's follow requests and approved followers. */
export async function followersForGuardian(guardianId: string) {
  return (await db().query(
    `SELECT w.athlete_id, wu.full_name AS athlete_name, f.follower_id, fu.full_name AS follower_name, fu.role AS follower_role, f.status, f.created_at
       FROM guardian_links w JOIN users wu ON wu.id = w.athlete_id
       JOIN follows f ON f.followee_id = w.athlete_id JOIN users fu ON fu.id = f.follower_id
      WHERE w.member_id = $1 AND fu.deleted_at IS NULL ORDER BY (f.status = 'pending') DESC, f.created_at DESC LIMIT 200`, [guardianId])).rows as {
    athlete_id: string; athlete_name: string; follower_id: string; follower_name: string; follower_role: string; status: string; created_at: Date }[];
}
export const GUARDIAN_OF = async (guardianId: string, athleteId: string, c: Q = db()) =>
  !!(await c.query("SELECT 1 FROM guardian_links WHERE athlete_id=$1 AND member_id=$2", [athleteId, guardianId])).rowCount;
