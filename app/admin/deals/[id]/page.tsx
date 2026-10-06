import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { adminDeal } from "@/lib/admindb";
import { formatCents } from "@/lib/deals";
import { Badge, Card, Grid } from "@/components/ui";
import { AdminForm } from "../../admin-form";
import { adminRetryPayment } from "../../actions";

const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function AdminDealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; error?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const q = await searchParams;
  const x = await adminDeal(id);
  if (!x) notFound();
  const { d, events, contract, payments, paymentEvents } = x;
  return (
    <>
      <h1>{d.title} <Badge tone="gray">{d.status}</Badge></h1>
      <div className="tag"><Link href="/admin/deals">← Deals</Link> · {formatCents(d.amount)} · <Link href={`/admin/users/${d.counterparty_uid}`}>{d.counterparty}</Link> → <Link href={`/admin/users/${d.athlete_uid}`}>{d.athlete}</Link></div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}
      <Grid>
        <Card title="Agreement" wide>
          {contract ? <p>Template {contract.template_version} · {contract.signatures} signature(s) · {contract.voided_at ? "voided" : contract.executed_at ? `executed ${fmt(contract.executed_at)}` : "not yet executed"}<br /><span className="muted">SHA-256 {contract.sha256}</span></p> : <p className="muted">No agreement yet.</p>}
          <p className="muted">{d.message_count} message(s) in the deal thread (text is not shown to admins).</p>
        </Card>
        <Card title="Payments" wide>
          {payments.length === 0 ? <p className="muted">No payment records.</p> : payments.map((p) => (
            <div key={p.id} style={{ marginBottom: 12 }}>
              <p><strong>{p.status}</strong> · {formatCents(p.amount_cents)} (fee {formatCents(p.fee_cents)}) · {p.attempts} attempt(s) · created {fmt(p.created_at)}</p>
              {p.last_error && <p className="muted">Last error: {p.last_error}</p>}
              {["releasing", "refunding"].includes(p.status) && (
                <AdminForm action={adminRetryPayment} hidden={{ deal_id: d.id, payment_id: p.id }} button="Retry processing"><p className="muted">Safe to repeat: Stripe calls are idempotent, so this can&apos;t pay out twice.</p></AdminForm>)}
            </div>))}
          {paymentEvents.length > 0 && <ul className="list">{paymentEvents.map((e, i) => <li key={i}>{fmt(e.created_at)} — {e.action}{e.detail ? `: ${e.detail}` : ""}</li>)}</ul>}
        </Card>
        <Card title="History" wide><ul className="list">{events.map((e, i) => <li key={i}>{fmt(e.created_at)} — {e.role.replace("_", " ")}: {e.action.replace("_", " ")} → {e.to_status}</li>)}</ul></Card>
      </Grid>
    </>
  );
}
