import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { contentDetail } from "@/lib/admindb";
import { db } from "@/lib/db";
import { OUTCOME_LABEL, REASON_LABEL, isUrgent, type ReportReason } from "@/lib/reports";
import { Badge, Card, Grid } from "@/components/ui";
import { resolveContentReport } from "../../content-report-actions";

const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminContentReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  const s = await requireAdmin();
  const { id } = await params;
  const q = await searchParams;
  const x = await contentDetail(id);
  if (!x) notFound();
  const { r, comments, stats } = x;
  await db().query(
    `INSERT INTO admin_audit(admin_id, action, target_user_id, detail) SELECT $1,'view_content_report',$2,$3
      WHERE NOT EXISTS (SELECT 1 FROM admin_audit WHERE admin_id=$1 AND action='view_content_report' AND detail=$3 AND created_at > NOW() - INTERVAL '1 hour')`, [s.userId, r.sender_id, `report ${id}`]);
  const open = r.status === "open";
  return (
    <>
      <h1>{r.kind === "post" ? "Post" : "Comment"} report {isUrgent(r.reason) && <Badge tone="red">urgent</Badge>} <Badge tone={open ? "yellow" : "gray"}>{r.status}</Badge></h1>
      <div className="tag"><Link href="/admin/content-reports">← Post reports</Link>{r.involves_minor ? " · involves an athlete under 18" : ""}</div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      <Grid>
        <Card title="Report" wide>
          <p><strong>{REASON_LABEL[r.reason as ReportReason]}</strong> — reported by {r.reporter_name} ({r.reporter_email}) on {fmt(r.created_at)}</p>
          {r.note && <p>&ldquo;{r.note}&rdquo;</p>}
          {!open && <p className="muted">Resolved {r.resolved_at ? fmt(r.resolved_at) : ""}: {r.resolution}</p>}
        </Card>
        <Card title="The post" wide>
          <p className="muted">Reading this was logged.{r.post_hidden ? " (Hidden.)" : ""}</p>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.post_body}</p>
          {r.has_image && r.kind === "post" && <p><a className="btn ghost" href={`/admin/content-reports/${r.id}/image`}>View the picture</a></p>}
        </Card>
        {r.kind === "comment" && (
          <Card title="The comment in context" wide>
            <ol style={{ listStyle: "none", padding: 0 }}>{comments.map((c) => (
              <li key={c.id} style={{ marginBottom: 8, padding: c.reported ? 8 : 0, border: c.reported ? "1px solid var(--line)" : undefined, borderRadius: 8 }}>
                <strong>{c.name}</strong> <span className="muted">· {fmt(c.created_at)}{c.hidden ? " · hidden" : ""}{c.reported ? " · REPORTED" : ""}</span>
                <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.body}</div></li>))}</ol>
          </Card>)}
        <Card title="The author">
          <p><Link href={`/admin/users/${r.sender_id}`} style={{ textDecoration: "underline" }}>{r.sender_name}</Link> ({r.sender_email}){r.suspended_at ? " — suspended" : ""}</p>
          <p className="muted">{stats.hidden_before} item(s) already hidden · blocked by {stats.blocks_received} person/people</p>
        </Card>
        {open && (
          <Card title="Resolve">
            <form action={resolveContentReport} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
              <input type="hidden" name="report_id" value={r.id} />
              {(Object.keys(OUTCOME_LABEL) as (keyof typeof OUTCOME_LABEL)[]).filter((o) => o !== "suspend" || !r.sender_is_admin).map((o) => (
                <label key={o}><input type="radio" name="outcome" value={o} required /> {OUTCOME_LABEL[o]}</label>))}
              <input name="reason" placeholder="Reason (saved in the audit log)" minLength={10} maxLength={300} required autoComplete="off" />
              <input type="password" name="password" placeholder="Your password" autoComplete="current-password" required />
              <button className="btn" type="submit">Resolve</button>
              <span className="muted">Closes every open report on this item. The reporter hears the outcome in general terms; the author is never told who reported.</span>
            </form>
          </Card>)}
      </Grid>
    </>
  );
}
