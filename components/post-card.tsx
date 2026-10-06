import Link from "next/link";
import { displayName } from "@/lib/deals";
import { initial, timeAgo } from "@/lib/social";
import { PROVIDER_LABEL, type Provider } from "@/lib/music";
import type { PostRow } from "@/lib/socialdb";
import { LikeButton } from "./feed-ui";
import { ROLES } from "@/lib/roles";
import { toggleLike } from "@/app/dashboard/feed/actions";

export const authorLabel = (name: string, minor: boolean, family: boolean) => (minor && !family ? displayName(name, true) : name);

/** One post. Minors are shown as "First L." to everyone outside their family. */
export function PostCard({ p, linkPost = true }: { p: PostRow; linkPost?: boolean }) {
  const name = authorLabel(p.author_name, p.author_minor, p.family);
  const role = ROLES[p.author_role as keyof typeof ROLES]?.label ?? p.author_role;
  return (
    <article className="card" style={{ marginBottom: 14 }}>
      <header style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <div aria-hidden style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>{initial(name)}</div>
        <div>
          <Link href={`/dashboard/feed/u/${p.author_id}`} style={{ fontWeight: 600 }}>{name}</Link>
          <div className="muted">{role}{p.author_sport ? ` · ${p.author_sport}` : ""} · {timeAgo(new Date(p.created_at))}</div>
          {p.music_label && p.music_provider && <div className="muted">🎵 {p.music_label} · {PROVIDER_LABEL[p.music_provider as Provider]}</div>}
        </div>
      </header>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{p.body}</p>
      {p.has_image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/dashboard/feed/image/${p.id}`} alt="Picture in this post" loading="lazy" style={{ maxWidth: "100%", maxHeight: 520, borderRadius: 10 }} />}
      <footer style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <LikeButton postId={p.id} liked={p.liked} likes={p.likes} toggle={toggleLike} />
        {linkPost ? <Link className="btn ghost" href={`/dashboard/feed/post/${p.id}`}>💬 {p.comments}</Link> : <span className="muted">💬 {p.comments}</span>}
      </footer>
    </article>
  );
}
