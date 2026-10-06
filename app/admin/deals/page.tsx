import Link from "next/link";
import { adminDeals } from "@/lib/admindb";
import { formatCents } from "@/lib/deals";
import { Card } from "@/components/ui";

const STATUSES = ["offered", "guardian_review", "awaiting_signature", "active", "completed", "declined", "withdrawn", "cancelled"];
const fmt = (x: Date) => new Date(x).toLocaleDateString("en-US", { dateStyle: "medium" });

export default async function AdminDeals({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const st = STATUSES.includes(status ?? "") ? status : undefined;
  const deals = await adminDeals(st);
  return (
    <>
      <h1>Deals</h1>
      <p>{["all", ...STATUSES].map((s) => <Link key={s} className="btn ghost" style={{ marginRight: 6 }} href={s === "all" ? "/admin/deals" : `/admin/deals?status=${s}`}>{s}</Link>)}</p>
      <Card title={`${deals.length} deal${deals.length === 1 ? "" : "s"}${deals.length === 100 ? " (latest 100)" : ""}`} wide>
        <table><thead><tr><th>Deal</th><th>Sponsor</th><th>Athlete</th><th>Amount</th><th>Status</th><th>Payment</th><th>Created</th></tr></thead>
          <tbody>{deals.map((d) => <tr key={d.id}><td><Link href={`/admin/deals/${d.id}`} style={{ textDecoration: "underline" }}>{d.title}</Link></td><td>{d.counterparty}</td><td>{d.athlete}</td>
            <td>{formatCents(d.amount_cents)}</td><td>{d.status}</td><td>{d.payment_status ?? "—"}</td><td>{fmt(d.created_at)}</td></tr>)}</tbody></table>
      </Card>
    </>
  );
}
