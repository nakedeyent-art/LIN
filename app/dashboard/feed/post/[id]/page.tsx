import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/session";
import { commentsFor, getPost } from "@/lib/socialdb";
import { PostCard, authorLabel } from "@/components/post-card";
import { CommentForm } from "@/components/feed-ui";
import { REASON_LABEL, REPORT_REASONS } from "@/lib/reports";
import { timeAgo } from "@/lib/social";
import { addComment, deleteOwn, reportContent } from "../../actions";

export const metadata: Metadata = { title: "Post" };

function ReportForm({ kind, id, postId }: { kind: "post" | "comment"; id: number; postId: number }) {
  return (
    <details>
      <summary className="muted" style={{ cursor: "pointer" }}>Report</summary>
      <form action={reportContent} style={{ display: "grid", gap: 6, maxWidth: 380, marginTop: 6 }}>
        <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} /><input type="hidden" name="post_id" value={postId} />
        <select name="reason" required defaultValue=""><option value="" disabled>What&apos;s wrong?</option>{REPORT_REASONS.map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}</select>
        <textarea name="note" rows={2} maxLength={500} placeholder="Anything we should know? (optional)" />
        <button className="btn ghost" type="submit">Send report</button>
      </form>
    </details>
  );
}

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  const s = await requireAccess("/dashboard/feed");
  const id = Number((await params).id);
  const q = await searchParams;
  const p = await getPost(s.userId, id);
  if (!p) notFound();
  const comments = await commentsFor(s.userId, id);
  return (
    <div style={{ maxWidth: 620 }}>
      <div className="tag"><Link href="/dashboard/feed">← Feed</Link></div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      <PostCard p={p} linkPost={false} />
      <p>{p.author_id === s.userId
        ? <form action={deleteOwn}><input type="hidden" name="kind" value="post" /><input type="hidden" name="id" value={p.id} /><button className="btn ghost" type="submit">Delete my post</button></form>
        : <ReportForm kind="post" id={p.id} postId={p.id} />}</p>
      <h3>Comments</h3>
      {comments.length === 0 ? <p className="muted">No comments yet.</p> : (
        <ol style={{ listStyle: "none", padding: 0 }}>{comments.map((c) => (
          <li key={c.id} style={{ marginBottom: 12 }}>
            <div><Link href={`/dashboard/feed/u/${c.author_id}`} style={{ fontWeight: 600 }}>{c.author_id === s.userId ? "You" : authorLabel(c.author_name, c.author_minor, c.family)}</Link> <span className="muted">· {timeAgo(new Date(c.created_at))}</span></div>
            <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.body}</div>
            {c.author_id === s.userId
              ? <form action={deleteOwn}><input type="hidden" name="kind" value="comment" /><input type="hidden" name="id" value={c.id} /><button className="btn ghost" type="submit">Delete</button></form>
              : c.reported ? <span className="muted">Reported</span> : <ReportForm kind="comment" id={c.id} postId={p.id} />}
          </li>))}</ol>)}
      <CommentForm postId={p.id} action={addComment} />
      {p.author_minor && <p className="muted">This athlete is under 18: contact details and links can&apos;t be shared in comments, and their parent/guardian can read everything.</p>}
    </div>
  );
}
