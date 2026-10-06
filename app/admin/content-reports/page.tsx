import Link from "next/link";
import { contentQueue } from "@/lib/admindb";
import { REASON_LABEL, type ReportReason } from "@/lib/reports";
import { Badge, Card } from "@/components/ui";

const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminContentReports({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const resolved = (await searchParams).show === "resolved";
  const rows = await contentQueue(resolved ? "resolved" : "open");
  return (
    <>
      <h1>Post &amp; comment reports</h1>
      <p><Link className="btn ghost" href="/admin/content-reports">Open</Link> <Link className="btn ghost" href="/admin/content-reports?show=resolved">Resolved</Link></p>
      <Card title={`${rows.length} ${resolved ? "resolved" : "open"}`} wide>
        {rows.length === 0 ? <p className="muted">Nothing here.</p> : <table><thead><tr><th>Reported</th><th>What</th><th>Reason</th><th>By</th><th>Reported by</th><th></th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{fmt(r.created_at)}</td><td>{r.kind}</td>
            <td>{r.urgent && <><Badge tone="red">urgent</Badge> </>}{REASON_LABEL[r.reason as ReportReason]}</td><td>{r.author}</td><td>{r.reporter}</td>
            <td><Link href={`/admin/content-reports/${r.id}`} style={{ textDecoration: "underline" }}>{resolved ? r.status : "Review"}</Link></td></tr>)}</tbody></table>}
      </Card>
    </>
  );
}
