import Link from "next/link";
import { overview } from "@/lib/admindb";
import { outboxStats } from "@/lib/outbox";
import { Badge, Card, Grid, Stat } from "@/components/ui";

const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminHome() {
  const o = await overview();
  const mail = await outboxStats();
  const total = o.users.reduce((a, r) => a + r.n, 0);
  return (
    <>
      <h1>Admin overview</h1>
      <div className="tag">Support and oversight. Everything you change is recorded in the audit log.</div>
      <Grid>
        <Card title="Accounts"><Stat label="active accounts" value={String(total)} hint={`${o.suspended} suspended`} />
          <table><tbody>{o.users.map((r) => <tr key={r.role}><td>{r.role}</td><td>{r.n}</td></tr>)}</tbody></table></Card>
        <Card title="Deals"><table><tbody>{o.deals.length ? o.deals.map((r) => <tr key={r.status}><td><Link href={`/admin/deals?status=${r.status}`}>{r.status}</Link></td><td>{r.n}</td></tr>) : <tr><td className="muted">No deals yet.</td></tr>}</tbody></table></Card>
        <Card title="Needs attention">
          <p>{o.urgentReports > 0 ? <Badge tone="red">{o.urgentReports} urgent message report{o.urgentReports > 1 ? "s" : ""}</Badge> : o.openReports > 0 ? <Badge tone="yellow">{o.openReports} open message report{o.openReports > 1 ? "s" : ""}</Badge> : <Badge tone="green">No open message reports</Badge>} <Link href="/admin/reports">Review</Link></p>
          <p>{o.urgentContent > 0 ? <Badge tone="red">{o.urgentContent} urgent post/comment report{o.urgentContent > 1 ? "s" : ""}</Badge> : o.openContent > 0 ? <Badge tone="yellow">{o.openContent} open post/comment report{o.openContent > 1 ? "s" : ""}</Badge> : <Badge tone="green">No open post/comment reports</Badge>} <Link href="/admin/content-reports">Review</Link></p>
          <p>{o.openDisputes > 0 ? <Badge tone="red">{o.openDisputes} open card dispute{o.openDisputes > 1 ? "s" : ""}</Badge> : <Badge tone="green">No open disputes</Badge>}</p>
          <p>{o.pays.filter((p) => ["releasing", "refunding"].includes(p.status)).reduce((a, p) => a + p.n, 0) > 0
            ? <Badge tone="yellow">Payments stuck mid-processing</Badge> : <Badge tone="green">No payments mid-processing</Badge>}</p>
          <p>{o.failedJobs > 0 ? <Badge tone="red">{o.failedJobs} failed job run{o.failedJobs > 1 ? "s" : ""} this week</Badge> : <Badge tone="green">No failed jobs this week</Badge>}</p>
        </Card>
        <Card title="Email delivery">
          <p>{mail.dead > 0 ? <Badge tone="red">{mail.dead} notice{mail.dead > 1 ? "s" : ""} could not be delivered</Badge> : <Badge tone="green">No undeliverable notices</Badge>}</p>
          <p>{mail.pending > 0 ? <Badge tone={mail.oldestPendingMinutes !== null && mail.oldestPendingMinutes > 60 ? "yellow" : "gray"}>{mail.pending} waiting to send{mail.oldestPendingMinutes !== null ? ` (oldest ${mail.oldestPendingMinutes} min)` : ""}</Badge> : <Badge tone="green">Nothing waiting</Badge>}</p>
          <p className="muted">Security, signing and deal notices are retried automatically for about 9 hours. Sign-in links aren&apos;t queued: people can ask for a new one.</p>
        </Card>
        <Card title="Payments"><table><tbody>{o.pays.length ? o.pays.map((r) => <tr key={r.status}><td>{r.status}</td><td>{r.n}</td></tr>) : <tr><td className="muted">None.</td></tr>}</tbody></table></Card>
        <Card title="Scheduled jobs (latest run)" wide>
          {o.jobs.length ? <table><thead><tr><th>Job</th><th>Status</th><th>Started</th><th>Processed</th><th>Failed</th></tr></thead>
            <tbody>{o.jobs.map((j) => <tr key={j.job}><td>{j.job}</td><td>{j.status}</td><td>{fmt(j.started_at)}</td><td>{j.processed}</td><td>{j.failed}</td></tr>)}</tbody></table>
            : <p className="muted">No job has run yet. Check that the scheduler is calling /api/cron/daily.</p>}
        </Card>
      </Grid>
    </>
  );
}
