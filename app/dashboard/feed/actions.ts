"use server";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { cleanText, followDecision, type CommentState, type ComposeState, MAX_COMMENT, MAX_COMMENTS_PER_10_MIN, MAX_FOLLOWS_PER_DAY, MAX_LABEL, MAX_POST, MAX_POSTS_PER_HOUR, MAX_STATUS } from "@/lib/social";
import { screenText } from "@/lib/content-filter";
import { MAX_FILE_BYTES, formatBytes, sniff } from "@/lib/attachments";
import { stripImage } from "@/lib/images";
import { parseMusicLink } from "@/lib/music";
import { isReason, MAX_NOTE, MAX_REPORTS_PER_DAY } from "@/lib/reports";
import { notifyInApp } from "@/lib/notificationsdb";
import { GUARDIAN_OF, getPost, IS_MINOR, profileOf } from "@/lib/socialdb";

const NAV = "/dashboard/feed";
const UUID = /^[0-9a-f-]{36}$/i;

const isMinorUser = async (id: string) =>
  !!(await db().query(`SELECT 1 WHERE ${IS_MINOR("$1::uuid")}`, [id])).rowCount;
const guardiansOf = async (athleteId: string) =>
  (await db().query("SELECT member_id FROM guardian_links WHERE athlete_id=$1", [athleteId])).rows.map((r) => r.member_id as string);

export async function createPost(_prev: ComposeState, formData: FormData): Promise<ComposeState> {
  const s = await requireAccess(NAV);
  const raw = String(formData.get("body") ?? "");
  const draft = raw.slice(0, 5000);                      // echoed back on error; validation below sees the full text, never a truncated copy
  const fail = (error: string): ComposeState => ({ error, draft });
  const c = cleanText(raw, MAX_POST);
  if (!c.ok) return fail(c.error);
  const minor = await isMinorUser(s.userId);
  const scr = screenText(c.text, { minorThread: minor, paymentsOn: false });
  if (!scr.ok) return fail(scr.error);
  const recent = (await db().query("SELECT count(*)::int AS n FROM posts WHERE author_id=$1 AND created_at > NOW() - INTERVAL '1 hour'", [s.userId])).rows[0].n;
  if (recent >= MAX_POSTS_PER_HOUR) return fail("You're posting very quickly. Take a short break and try again.");

  let img: { type: string; bytes: Uint8Array } | null = null;
  const file = formData.get("image");
  if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
    const f = file as File; const raw = new Uint8Array(await f.arrayBuffer());
    if (raw.length > MAX_FILE_BYTES) return fail(`Pictures must be under ${formatBytes(MAX_FILE_BYTES)}.`);
    const sn = sniff(raw);
    if (!sn || sn.type === "application/pdf") return fail("Pictures must be PNG or JPEG.");
    const named = screenText(f.name.replace(/\.[^.]*$/, ""), { minorThread: minor, paymentsOn: false });
    if (!named.ok) return fail(named.error);
    const clean = stripImage(sn.type, raw);
    if (!clean) return fail("That picture looks damaged. Try saving it again.");
    img = { type: sn.type, bytes: clean };
  }
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const id = (await client.query("INSERT INTO posts(author_id, body) VALUES ($1,$2) RETURNING id", [s.userId, c.text])).rows[0].id;
    if (img) await client.query("INSERT INTO post_images(post_id, content_type, size_bytes, sha256, data) VALUES ($1,$2,$3,$4,$5)",
      [id, img.type, img.bytes.length, createHash("sha256").update(img.bytes).digest("hex"), Buffer.from(img.bytes)]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }
  return { posted: Date.now() };
}

/** Called from the like button (no navigation). Returns the new state. */
export async function toggleLike(postId: number): Promise<{ liked: boolean; likes: number } | { error: string }> {
  const s = await requireAccess(NAV);
  const p = await getPost(s.userId, postId);
  if (!p) return { error: "That post isn't available." };
  const del = await db().query("DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2", [postId, s.userId]);
  if (!del.rowCount) await db().query("INSERT INTO post_likes(post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [postId, s.userId]);
  const likes = (await db().query("SELECT count(*)::int AS n FROM post_likes WHERE post_id=$1", [postId])).rows[0].n;
  return { liked: !del.rowCount, likes };
}

export async function addComment(_prev: CommentState, formData: FormData): Promise<CommentState> {
  const s = await requireAccess(NAV);
  const postId = Number(formData.get("post_id"));
  const raw = String(formData.get("body") ?? "");
  const draft = raw.slice(0, 2000);
  const fail = (error: string): CommentState => ({ error, draft });
  const p = await getPost(s.userId, postId);
  if (!p) return fail("That post isn't available.");
  const c = cleanText(raw, MAX_COMMENT);
  if (!c.ok) return fail(c.error);
  // A minor on either side of the conversation means no contact details or links.
  const minorInvolved = p.author_minor || (await isMinorUser(s.userId));
  const scr = screenText(c.text, { minorThread: minorInvolved, paymentsOn: false });
  if (!scr.ok) return fail(scr.error);
  const recent = (await db().query("SELECT count(*)::int AS n FROM post_comments WHERE author_id=$1 AND created_at > NOW() - INTERVAL '10 minutes'", [s.userId])).rows[0].n;
  if (recent >= MAX_COMMENTS_PER_10_MIN) return fail("You're commenting very quickly. Wait a moment and try again.");
  await db().query("INSERT INTO post_comments(post_id, author_id, body) VALUES ($1,$2,$3)", [postId, s.userId, c.text]);
  const notify = new Set<string>([p.author_id]);
  if (p.author_minor) (await guardiansOf(p.author_id)).forEach((g) => notify.add(g));
  notify.delete(s.userId);
  for (const uid of notify) await notifyInApp([uid], { kind: "message", title: "New comment on a post", href: `${NAV}/post/${postId}`, coalesceKey: `cmt:${postId}` });
  return { sent: Date.now() };
}

export async function deleteOwn(formData: FormData) {
  const s = await requireAccess(NAV);
  const kind = String(formData.get("kind")), id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) redirect(NAV);
  if (kind === "post") {
    await db().query("UPDATE posts SET deleted_at = NOW() WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL", [id, s.userId]);
    redirect(`${NAV}?msg=${encodeURIComponent("Post deleted.")}`);
  }
  const post = (await db().query("UPDATE post_comments SET deleted_at = NOW() WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL RETURNING post_id", [id, s.userId])).rows[0];
  redirect(post ? `${NAV}/post/${post.post_id}?msg=${encodeURIComponent("Comment deleted.")}` : NAV);
}

export async function followUser(formData: FormData) {
  const s = await requireAccess(NAV);
  const target = String(formData.get("user_id") ?? "");
  const back = (k: "msg" | "error", m: string): never => redirect(`${NAV}/u/${target}?${k}=${encodeURIComponent(m)}`);
  if (!UUID.test(target)) redirect(NAV);
  const t = await profileOf(s.userId, target);
  if (!t) back("error", "You can't follow this person.");
  const today = (await db().query("SELECT count(*)::int AS n FROM follows WHERE follower_id=$1 AND created_at > NOW() - INTERVAL '1 day'", [s.userId])).rows[0].n;
  if (today >= MAX_FOLLOWS_PER_DAY) back("error", "You've followed a lot of people today. Try again tomorrow.");
  const d = followDecision({ id: s.userId, role: s.role, isGuardianOfTarget: t.guardian },
    { id: target, isMinor: t.minor, unavailable: false }, { blocked: t.blocked, existing: t.follow_status });
  if (!d.ok) back("error", d.error);
  await db().query("INSERT INTO follows(follower_id, followee_id, status) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [s.userId, target, (d as { status: string }).status]);
  if ((d as { status: string }).status === "pending") {
    await notifyInApp(await guardiansOf(target), { kind: "guardian", title: `${s.name} asked to follow your athlete. Approve or decline`, href: `${NAV}/requests`, coalesceKey: `freq:${target}` });
    back("msg", "Request sent. A parent/guardian has to approve it before you can see their posts.");
  }
  await notifyInApp([target], { kind: "account", title: `${s.name} started following you`, href: `${NAV}/u/${s.userId}`, coalesceKey: `fol:${s.userId}` });
  back("msg", "Following.");
}

export async function unfollowUser(formData: FormData) {
  const s = await requireAccess(NAV);
  const target = String(formData.get("user_id") ?? "");
  if (!UUID.test(target)) redirect(NAV);
  await db().query("DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2", [s.userId, target]);
  redirect(`${NAV}/u/${target}?msg=${encodeURIComponent("Unfollowed.")}`);
}

/** A guardian decides who can follow their athlete: approve or decline a request, or remove a current follower. */
export async function decideFollow(formData: FormData) {
  const s = await requireAccess(NAV);
  const athlete = String(formData.get("athlete_id") ?? ""), follower = String(formData.get("follower_id") ?? ""), act = String(formData.get("act") ?? "");
  const back = (k: "msg" | "error", m: string): never => redirect(`${NAV}/requests?${k}=${encodeURIComponent(m)}`);
  if (!UUID.test(athlete) || !UUID.test(follower)) redirect(NAV);
  if (!(await GUARDIAN_OF(s.userId, athlete))) back("error", "Only a parent/guardian of this athlete can do that.");
  if (act === "approve") {
    const r = await db().query("UPDATE follows SET status='approved', decided_by=$3 WHERE follower_id=$1 AND followee_id=$2 AND status='pending' RETURNING 1", [follower, athlete, s.userId]);
    if (r.rowCount) await notifyInApp([follower], { kind: "account", title: "Your follow request was approved", href: `${NAV}/u/${athlete}` });
    back("msg", r.rowCount ? "Approved." : "That request is no longer pending.");
  }
  if (act === "deny" || act === "remove") {
    await db().query("DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2", [follower, athlete]);
    back("msg", act === "deny" ? "Declined." : "Removed.");
  }
  back("error", "Unknown action.");
}

export async function blockUser(formData: FormData) {
  const s = await requireAccess(NAV);
  const target = String(formData.get("user_id") ?? ""), unblock = formData.get("undo") === "1";
  if (!UUID.test(target) || target === s.userId) redirect(NAV);
  if (unblock) {
    // A minor can block for safety, but only a guardian lifts a block that protects them.
    if (await isMinorUser(s.userId)) redirect(`${NAV}/u/${target}?error=${encodeURIComponent("A parent/guardian lifts blocks that protect an athlete under 18.")}`);
    await db().query("DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_id=$2", [s.userId, target]);
    redirect(`${NAV}/u/${target}?msg=${encodeURIComponent("Unblocked.")}`);
  }
  await db().query("INSERT INTO user_blocks(blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [s.userId, target]);
  await db().query("DELETE FROM follows WHERE (follower_id=$1 AND followee_id=$2) OR (follower_id=$2 AND followee_id=$1)", [s.userId, target]);
  redirect(`${NAV}?msg=${encodeURIComponent("Blocked. You won't see each other's posts, comments or profile, and messaging between you on any shared deal is off.")}`);
}

export async function reportContent(formData: FormData) {
  const s = await requireAccess(NAV);
  const kind = String(formData.get("kind")), id = Number(formData.get("id")), postId = Number(formData.get("post_id"));
  const back = (k: "msg" | "error", m: string): never => redirect(`${NAV}/post/${postId}?${k}=${encodeURIComponent(m)}`);
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(postId) || (kind !== "post" && kind !== "comment")) redirect(NAV);
  const p = await getPost(s.userId, postId);
  if (!p) redirect(NAV);
  const reason = String(formData.get("reason") ?? "");
  if (!isReason(reason)) back("error", "Choose what's wrong.");
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_NOTE);
  const author = kind === "post"
    ? (id === postId ? p.author_id : null)
    : (await db().query("SELECT author_id FROM post_comments WHERE id=$1 AND post_id=$2 AND deleted_at IS NULL AND hidden_at IS NULL", [id, postId])).rows[0]?.author_id ?? null;
  if (!author) back("error", "That isn't available to report.");
  if (author === s.userId) back("error", "You can't report your own content.");
  const today = (await db().query("SELECT count(*)::int AS n FROM content_reports WHERE reporter_id=$1 AND created_at > NOW() - INTERVAL '1 day'", [s.userId])).rows[0].n;
  if (today >= MAX_REPORTS_PER_DAY) back("error", "You've sent a lot of reports today. Please try again tomorrow.");
  const ins = await db().query(
    `INSERT INTO content_reports(kind, post_id, comment_id, reporter_id, reason, note) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
    [kind, postId, kind === "comment" ? id : null, s.userId, reason, note || null]);
  back("msg", ins.rowCount ? "Thanks — a moderator will review this. You can also block this person from their profile." : "You've already reported that.");
}

export async function saveStatus(formData: FormData) {
  const s = await requireAccess(NAV);
  const back = (k: "msg" | "error", m: string): never => redirect(`${NAV}/u/${s.userId}?${k}=${encodeURIComponent(m)}`);
  const minor = await isMinorUser(s.userId);
  const text = String(formData.get("status_text") ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_STATUS + 1);
  const label = String(formData.get("music_label") ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LABEL + 1);
  const link = String(formData.get("music_link") ?? "");
  if (text.length > MAX_STATUS) back("error", `Status can be up to ${MAX_STATUS} characters.`);
  if (label.length > MAX_LABEL) back("error", `The song label can be up to ${MAX_LABEL} characters.`);
  for (const t of [text, label]) if (t) { const r = screenText(t, { minorThread: minor, paymentsOn: false }); if (!r.ok) back("error", r.error); }
  let m: ReturnType<typeof parseMusicLink> | null = null;
  if (link.trim()) { m = parseMusicLink(link); if ("error" in m) back("error", m.error); }
  const music = m && !("error" in m) ? m : null;
  if (!text && !music) { await db().query("DELETE FROM profile_status WHERE user_id=$1", [s.userId]); back("msg", "Status cleared."); }
  await db().query(
    `INSERT INTO profile_status(user_id, status_text, music_provider, music_kind, music_id, music_label) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id) DO UPDATE SET status_text=$2, music_provider=$3, music_kind=$4, music_id=$5, music_label=$6, updated_at=NOW()`,
    [s.userId, text || null, music?.provider ?? null, music?.kind ?? null, music?.id ?? null, music ? label || null : null]);
  back("msg", "Status updated.");
}

