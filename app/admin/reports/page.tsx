import Link from "next/link";
import { reportQueue } from "@/lib/admindb";
import { REASON_LABEL, type ReportReason } from "@/lib/reports";
import { Badge, Card } from "@/components/ui";

const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const resolved = (await searchParams).show === "resolved";
  const rows = await reportQueue(resolved ? "resolved" : "open");
  return (
    <>
      <h1>Message reports</h1>
      <p><Link className="btn ghost" href="/admin/reports">Open</Link> <Link className="btn ghost" href="/admin/reports?show=resolved">Resolved</Link></p>
      <Card title={`${rows.length} ${resolved ? "resolved" : "open"}`} wide>
        {rows.length === 0 ? <p className="muted">Nothing here.</p> : <table><thead><tr><th>Reported</th><th>Reason</th><th>Message from</th><th>Reported by</th><th></th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{fmt(r.created_at)}</td>
            <td>{r.urgent && <><Badge tone="red">urgent</Badge> </>}{REASON_LABEL[r.reason as ReportReason]}{r.reports_on_message > 1 ? ` (${r.reports_on_message} reports)` : ""}</td>
            <td>{r.sender}</td><td>{r.reporter}</td><td><Link href={`/admin/reports/${r.id}`} style={{ textDecoration: "underline" }}>{resolved ? r.status : "Review"}</Link></td></tr>)}</tbody></table>}
      </Card>
    </>
  );
}
