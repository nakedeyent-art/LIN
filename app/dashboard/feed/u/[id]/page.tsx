import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/session";
import { postsBy, profileOf, statusOf } from "@/lib/socialdb";
import { PostCard, authorLabel } from "@/components/post-card";
import { MusicCard } from "@/components/feed-ui";
import { Badge, Card } from "@/components/ui";
import { ROLES } from "@/lib/roles";
import { initial } from "@/lib/social";
import { MAX_LABEL, MAX_STATUS } from "@/lib/social";
import { blockUser, followUser, saveStatus, unfollowUser } from "../../actions";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string; before?: string }> }) {
  const s = await requireAccess("/dashboard/feed");
  const { id } = await params;
  const q = await searchParams;
  const u = await profileOf(s.userId, id);
  if (!u || (u.blocked && !u.i_blocked)) notFound();       // a blocked person sees nothing at all
  const family = u.self || u.guardian;
  const canSee = family || !u.minor || u.follower;
  const name = authorLabel(u.full_name, u.minor, family);
  const before = Number(q.before);
  const [status, feed] = await Promise.all([
    canSee && !u.blocked ? statusOf(u.id) : Promise.resolve(null),
    canSee && !u.blocked ? postsBy(s.userId, u.id, Number.isSafeInteger(before) && before > 0 ? before : undefined) : Promise.resolve({ posts: [], more: false }),
  ]);
  const mine = u.self ? await statusOf(s.userId) : null;
  return (
    <div style={{ maxWidth: 620 }}>
      <div className="tag"><Link href="/dashboard/feed">← Feed</Link></div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      <Card title={name} wide>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div aria-hidden style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 28, fontWeight: 700 }}>{initial(name)}</div>
          <div>
            <div>{ROLES[u.role as keyof typeof ROLES]?.label ?? u.role}{u.sport ? ` · ${u.sport}` : ""}{u.level ? ` · ${String(u.level).replace("_", " ")}` : ""}</div>
            <div className="muted">{u.followers} follower{u.followers === 1 ? "" : "s"}{u.minor && !family ? " · Under 18" : ""}</div>
            {status?.status_text && <div>&ldquo;{status.status_text}&rdquo;</div>}
          </div>
        </div>
        {!u.self && !u.blocked && !u.guardian && (
          <div style={{ marginTop: 10 }}>
            {u.follow_status === "approved" ? <form action={unfollowUser}><input type="hidden" name="user_id" value={u.id} /><button className="btn ghost" type="submit">Following ✓ (unfollow)</button></form>
              : u.follow_status === "pending" ? <><Badge tone="yellow">Requested</Badge> <form action={unfollowUser} style={{ display: "inline" }}><input type="hidden" name="user_id" value={u.id} /><button className="btn ghost" type="submit">Cancel request</button></form></>
              : <form action={followUser}><input type="hidden" name="user_id" value={u.id} /><button className="btn" type="submit">{u.minor ? "Request to follow" : "Follow"}</button></form>}
            {u.minor && !canSee && <p className="muted">This athlete is under 18. Their posts, status and music are visible only to followers a parent/guardian approves.</p>}
          </div>)}
        {!u.self && (
          <form action={blockUser} style={{ marginTop: 8 }}>
            <input type="hidden" name="user_id" value={u.id} />{u.i_blocked && <input type="hidden" name="undo" value="1" />}
            <button className="btn ghost" type="submit">{u.i_blocked ? "Unblock" : "Block"}</button>
          </form>)}
      </Card>
      {status?.music && <Card title="Now playing" wide><MusicCard music={status.music} label={status.label} /></Card>}
      {u.self && (
        <Card title="My status & music" wide>
          <form action={saveStatus} style={{ display: "grid", gap: 8, maxWidth: 460 }}>
            <input name="status_text" maxLength={MAX_STATUS} defaultValue={mine?.status_text ?? ""} placeholder="Status (e.g. Game day. Locked in.)" />
            <input name="music_link" defaultValue={mine?.music?.canonicalUrl ?? ""} placeholder="Paste a Spotify or Apple Music link" />
            <input name="music_label" maxLength={MAX_LABEL} defaultValue={mine?.label ?? ""} placeholder="Song label, e.g. “Blinding Lights — The Weeknd” (optional)" />
            <button className="btn" type="submit">Save</button>
            <p className="muted">Open the song in Spotify or Apple Music, choose Share → Copy link, and paste it here. Leave both fields empty to clear your status. Others only load the player if they choose to.</p>
          </form>
          {u.minor && <p className="muted">You&apos;re under 18: your profile is visible only to followers a parent/guardian approves.</p>}
        </Card>)}
      {canSee && !u.blocked ? (
        <>
          <h3>Posts</h3>
          {feed.posts.length === 0 ? <p className="muted">No posts yet.</p> : feed.posts.map((p) => <PostCard key={p.id} p={p} />)}
          {feed.more && <p><Link className="btn ghost" href={`/dashboard/feed/u/${u.id}?before=${feed.posts[feed.posts.length - 1].id}`}>Older posts →</Link></p>}
        </>) : null}
    </div>
  );
}
