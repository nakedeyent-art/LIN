import Link from "next/link";
import { auditLog } from "@/lib/admindb";
import { Card } from "@/components/ui";
import { ACTION_LABEL, type AdminAction } from "@/lib/admin";

const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminAudit() {
  const rows = await auditLog(200);
  return (
    <>
      <h1>Audit log</h1>
      <div className="tag">Append-only. Shows who did what, to whom, and why.</div>
      <Card title={`Latest ${rows.length}`} wide>
        <table><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead><tbody>{rows.map((r) => (
          <tr key={r.id}><td>{fmt(r.created_at)}</td><td>{r.admin_email}</td><td>{ACTION_LABEL[r.action as AdminAction] ?? (r.action === "view_user" ? "Viewed account" : r.action)}</td>
            <td>{r.target_email ?? (r.target_deal_id ? <Link href={`/admin/deals/${r.target_deal_id}`}>deal</Link> : "—")}</td><td>{r.detail ?? ""}</td></tr>))}</tbody></table>
      </Card>
    </>
  );
}
