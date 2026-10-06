import type { Metadata } from "next";
import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { feedFor } from "@/lib/socialdb";
import { PostCard } from "@/components/post-card";
import { Composer } from "@/components/feed-ui";
import { Disclaimer } from "@/components/ui";
import { createPost } from "./actions";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ tab?: string; before?: string; msg?: string }> }) {
  const s = await requireAccess("/dashboard/feed");
  const sp = await searchParams;
  const tab = sp.tab === "discover" ? "discover" : "following";
  const before = Number(sp.before);
  const { posts, more } = await feedFor(s.userId, tab, Number.isSafeInteger(before) && before > 0 ? before : undefined);
  const wards = (await db().query("SELECT count(*)::int AS n FROM guardian_links WHERE member_id=$1", [s.userId])).rows[0].n as number;
  const pending = wards ? (await db().query(`SELECT count(*)::int AS n FROM follows f JOIN guardian_links g ON g.athlete_id = f.followee_id WHERE g.member_id=$1 AND f.status='pending'`, [s.userId])).rows[0].n as number : 0;
  return (
    <div style={{ maxWidth: 620 }}>
      <h1>Feed</h1>
      <div className="tag">Updates from people you follow, and what&apos;s new across LIN. <Link href={`/dashboard/feed/u/${s.userId}`}>My profile</Link>{wards > 0 && <> · <Link href="/dashboard/feed/requests">Follow requests{pending ? ` (${pending})` : ""}</Link></>}</div>
      {sp.msg && <p className="ok">{sp.msg}</p>}
      <Composer action={createPost} />
      <p>
        <Link className={`btn${tab === "following" ? "" : " ghost"}`} href="/dashboard/feed">Following</Link>{" "}
        <Link className={`btn${tab === "discover" ? "" : " ghost"}`} href="/dashboard/feed?tab=discover">Discover</Link>
      </p>
      {posts.length === 0 ? <p className="muted">{tab === "following" ? "Nothing here yet. Post something, or follow people from Discover." : "No public posts yet."}</p> : posts.map((p) => <PostCard key={p.id} p={p} />)}
      {more && <p><Link className="btn ghost" href={`/dashboard/feed?${tab === "discover" ? "tab=discover&" : ""}before=${posts[posts.length - 1].id}`}>Older posts →</Link></p>}
      <Disclaimer>Posts from athletes under 18 are shown only to followers a parent/guardian has approved. Keep it respectful: report anything that isn&apos;t.</Disclaimer>
    </div>
  );
}
