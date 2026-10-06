import { jobRuns } from "@/lib/admindb";
import { Card } from "@/components/ui";

const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminJobs() {
  const runs = await jobRuns();
  return (
    <>
      <h1>Scheduled jobs</h1>
      <div className="tag">Jobs run when your scheduler calls /api/cron/daily. Counts only — no personal data is logged.</div>
      <Card title="Recent runs" wide>
        {runs.length === 0 ? <p className="muted">No runs recorded yet.</p> : <table><thead><tr><th>Job</th><th>Status</th><th>Started</th><th>Processed</th><th>Skipped</th><th>Failed</th><th>Error</th></tr></thead>
          <tbody>{runs.map((r, i) => <tr key={i}><td>{r.job}</td><td>{r.status}</td><td>{fmt(r.started_at)}</td><td>{r.processed}</td><td>{r.skipped}</td><td>{r.failed}</td><td>{r.error ?? ""}</td></tr>)}</tbody></table>}
      </Card>
    </>
  );
}
