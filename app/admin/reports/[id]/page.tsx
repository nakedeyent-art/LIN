import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { reportDetail } from "@/lib/admindb";
import { db } from "@/lib/db";
import { OUTCOME_LABEL, REASON_LABEL, type ReportReason, isUrgent } from "@/lib/reports";
import { formatBytes } from "@/lib/attachments";
import { Badge, Card, Grid } from "@/components/ui";
import { resolveReport } from "../../report-actions";

const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminReport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  const s = await requireAdmin();
  const { id } = await params;
  const q = await searchParams;
  const x = await reportDetail(id);
  if (!x) notFound();
  const { r, context, stats } = x;
  // Reading someone's conversation is itself logged (once per hour per report).
  await db().query(
    `INSERT INTO admin_audit(admin_id, action, target_user_id, target_deal_id, detail) SELECT $1,'view_report',$2,$3,$4
      WHERE NOT EXISTS (SELECT 1 FROM admin_audit WHERE admin_id=$1 AND action='view_report' AND detail=$4 AND created_at > NOW() - INTERVAL '1 hour')`,
    [s.userId, r.sender_id, r.deal_id, `report ${id}`]);
  const open = r.status === "open";
  return (
    <>
      <h1>Report {isUrgent(r.reason) && <Badge tone="red">urgent</Badge>} <Badge tone={open ? "yellow" : "gray"}>{r.status}</Badge></h1>
      <div className="tag"><Link href="/admin/reports">← Reports</Link> · deal <Link href={`/admin/deals/${r.deal_id}`}>{r.deal_title}</Link>{r.athlete_minor ? " · involves an athlete under 18" : ""}</div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      <Grid>
        <Card title="Report" wide>
          <p><strong>{REASON_LABEL[r.reason as ReportReason]}</strong> — reported by {r.reporter_name} ({r.reporter_email}) on {fmt(r.created_at)}</p>
          {r.note && <p>&ldquo;{r.note}&rdquo;</p>}
          {!open && <p className="muted">Resolved {r.resolved_at ? fmt(r.resolved_at) : ""}: {r.resolution}</p>}
        </Card>
        <Card title="The message in context" wide>
          <p className="muted">Only the reported message and up to three either side are shown. Reading this was logged.</p>
          <ol style={{ listStyle: "none", padding: 0 }}>{context.map((m) => (
            <li key={m.id} style={{ marginBottom: 10, padding: m.reported ? 8 : 0, border: m.reported ? "1px solid var(--line)" : undefined, borderRadius: 8 }}>
              <div><strong>{m.name}</strong> <span className="muted">· {fmt(m.created_at)}{m.hidden ? " · hidden" : ""}{m.reported ? " · REPORTED" : ""}</span></div>
              <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</div>
              {m.reported && m.files.map((f: { id: string; name: string; size: number }) => (
                <a key={f.id} className="btn ghost" style={{ marginRight: 6 }} href={`/admin/reports/${r.id}/attachment/${f.id}`}>📎 {f.name} ({formatBytes(f.size)})</a>))}
            </li>))}</ol>
        </Card>
        <Card title="The sender">
          <p><Link href={`/admin/users/${r.sender_id}`} style={{ textDecoration: "underline" }}>{r.sender_name}</Link> ({r.sender_email}){r.suspended_at ? " — suspended" : ""}</p>
          <p className="muted">{stats.hidden_before} message(s) already hidden · {stats.open_reports} open report(s) · blocked by {stats.blocks_received} person/people</p>
        </Card>
        {open && (
          <Card title="Resolve">
            <form action={resolveReport} style={{ display: "grid", gap: 6, maxWidth: 420 }}>
              <input type="hidden" name="report_id" value={r.id} />
              {(Object.keys(OUTCOME_LABEL) as (keyof typeof OUTCOME_LABEL)[]).filter((o) => o !== "suspend" || !r.sender_is_admin).map((o) => (
                <label key={o}><input type="radio" name="outcome" value={o} required /> {OUTCOME_LABEL[o]}</label>))}
              <input name="reason" placeholder="Reason (saved in the audit log)" minLength={10} maxLength={300} required autoComplete="off" />
              <input type="password" name="password" placeholder="Your password" autoComplete="current-password" required />
              <button className="btn" type="submit">Resolve</button>
              <span className="muted">Resolving closes every open report on this message. The reporter is told the outcome in general terms; the sender is never told who reported.</span>
            </form>
          </Card>)}
      </Grid>
    </>
  );
}
