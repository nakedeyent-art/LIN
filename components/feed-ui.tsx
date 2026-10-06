"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import type { CommentState, ComposeState } from "@/lib/social";
import { MAX_COMMENT, MAX_POST } from "@/lib/social";
import { embedHeight, PROVIDER_LABEL, type MusicLink } from "@/lib/music";

export function Composer({ action }: { action: (p: ComposeState, f: FormData) => Promise<ComposeState> }) {
  const [state, act, pending] = useActionState(action, {} as ComposeState);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { if (state.posted) { ref.current?.reset(); setPreview(null); router.refresh(); } }, [state.posted, router]);
  return (
    <form ref={ref} action={act} style={{ display: "grid", gap: 8, marginBottom: 16 }}>
      <textarea key={`${state.posted ?? 0}:${state.error ?? ""}`} name="body" rows={3} maxLength={MAX_POST} required defaultValue={state.draft ?? ""} placeholder="Share an update, a win, a highlight…" />
      {preview && /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Selected picture preview" style={{ maxWidth: 240, borderRadius: 8 }} />}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label className="btn ghost" style={{ cursor: "pointer" }}>📷 Add a picture
          <input type="file" name="image" accept="image/png,image/jpeg" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} /></label>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Posting…" : "Post"}</button>
        <span className="muted">Pictures are PNG/JPEG up to 2 MB; location and camera data are removed.</span>
      </div>
      {state.error && <p role="alert" className="error">{state.error}{state.draft ? " Your text is still here; re-add the picture." : ""}</p>}
    </form>
  );
}

export function LikeButton({ postId, liked, likes, toggle }: { postId: number; liked: boolean; likes: number; toggle: (id: number) => Promise<{ liked: boolean; likes: number } | { error: string }> }) {
  const [state, setState] = useState({ liked, likes });
  const [optimistic, setOptimistic] = useOptimistic(state, (cur, _x: null) => ({ liked: !cur.liked, likes: cur.likes + (cur.liked ? -1 : 1) }));
  const [, start] = useTransition();
  return (
    <button type="button" className="btn ghost" aria-pressed={optimistic.liked} aria-label={optimistic.liked ? "Unlike" : "Like"}
      onClick={() => start(async () => { setOptimistic(null); const r = await toggle(postId); if (!("error" in r)) setState(r); })}>
      {optimistic.liked ? "❤️" : "🤍"} {optimistic.likes}
    </button>
  );
}

export function CommentForm({ postId, action }: { postId: number; action: (p: CommentState, f: FormData) => Promise<CommentState> }) {
  const [state, act, pending] = useActionState(action, {} as CommentState);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => { if (state.sent) { ref.current?.reset(); router.refresh(); } }, [state.sent, router]);
  return (
    <form ref={ref} action={act} style={{ display: "grid", gap: 6, maxWidth: 520 }}>
      <input type="hidden" name="post_id" value={postId} />
      <textarea key={`${state.sent ?? 0}:${state.error ?? ""}`} name="body" rows={2} maxLength={MAX_COMMENT} required defaultValue={state.draft ?? ""} placeholder="Add a comment" />
      {state.error && <p role="alert" className="error">{state.error}</p>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Sending…" : "Comment"}</button>
    </form>
  );
}

/** The third-party player only loads after a click, so merely viewing a profile never contacts Spotify or Apple. */
export function MusicCard({ music, label }: { music: MusicLink; label: string | null }) {
  const [on, setOn] = useState(false);
  const name = PROVIDER_LABEL[music.provider];
  return (
    <div>
      <p>🎵 {label ? <strong>{label}</strong> : "Now playing"} <span className="muted">on {name}</span></p>
      {on ? (
        <iframe title={`${name} player`} src={music.embedUrl} width="100%" height={embedHeight(music)} style={{ maxWidth: 480, border: 0, borderRadius: 12 }}
          allow="autoplay *; encrypted-media *; clipboard-write" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
          referrerPolicy="no-referrer" loading="lazy" />
      ) : (
        <p><button type="button" className="btn ghost" onClick={() => setOn(true)}>▶ Load {name} player</button>{" "}
          <a className="btn ghost" href={music.canonicalUrl} target="_blank" rel="noopener noreferrer nofollow">Open in {name}</a></p>
      )}
      {!on && <p className="muted">Loading the player lets {name} see that you visited this page.</p>}
    </div>
  );
}
