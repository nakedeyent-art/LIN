import { saveDealWork } from "../work-actions";
import type { ComponentProps } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { capacityOn, dealContext, dealEvents, getDeal } from "@/lib/dealsdb";
import { ACTION_LABEL, availableActions, formatCents, STATUS_LABEL } from "@/lib/deals";
import { getContract } from "@/lib/contractdb";
import { canSign } from "@/lib/contract";
import { describePayment, fundingBlocker } from "@/lib/payment-rules";
import { livePaymentFor, payeeInfo, reconcilePayment } from "@/lib/payments";
import { paymentsEnabled } from "@/lib/stripe";
import { formatBps } from "@/lib/money";
import { Badge, Card as OriginalCard, Disclaimer, Grid, List, RecordSheet, Steps } from "@/components/ui";
import { athleteLabel, StatusBadge } from "@/components/deal-ui";
import { unreadByDeal } from "@/lib/messagesdb";
import { dealAction } from "../actions";
import { claimPayee, fundDeal } from "../payment-actions";

const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
const SIDE_NOTE = "Cancellation after funding needs both sides to agree; the sponsor is then refunded in full.";

export default async function DealDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; msg?: string; paid?: string; tab?: string }>;
}) {
  const s = await requireAccess("/dashboard/deals");
  const { id } = await params;
  const { error, msg, paid, tab: requestedTab } = await searchParams;
  const tabs = ["overview","deliverables","parties","messages","agreement","funding","compliance","activity"];
  const tab = tabs.includes(requestedTab??"") ? requestedTab! : "overview";
  const sections:Record<string,string>={Progress:"overview",Deliverables:"deliverables",Messages:"messages",Agreement:"agreement",Payment:"funding","Your decision":"overview",History:"activity"};
  const Card = (props:ComponentProps<typeof OriginalCard>) => tab==='overview'||sections[props.title]===tab ? <OriginalCard {...props}/> : null;
  let d = await getDeal(s.userId, id);
  if (!d) notFound();
  const who = await capacityOn(s.userId, d);
  if (!who) notFound();

  // Back from Stripe Checkout (or just curious): ask Stripe directly rather than waiting for the webhook.
  const enabled = paymentsEnabled();
  let pay = enabled ? await livePaymentFor(d.id) : null;
  if (pay?.status === "pending_checkout") { await reconcilePayment(pay.id); pay = await livePaymentFor(d.id); }

  const workItems=(await db().query("SELECT w.*,a.filename FROM deal_work_items w LEFT JOIN deal_attachments a ON a.id=w.attachment_id LEFT JOIN deal_messages m ON m.id=a.message_id WHERE w.deal_id=$1 ORDER BY w.due_on",[d.id])).rows;
  const proofOptions=(await db().query("SELECT a.id,a.filename FROM deal_attachments a JOIN deal_messages m ON m.id=a.message_id WHERE a.deal_id=$1 AND m.hidden_at IS NULL ORDER BY a.created_at DESC",[d.id])).rows;
  const ctx = await dealContext(d);
  const actions = availableActions(ctx, who);
  const events = await dealEvents(d.id);
  const k = await getContract(d.id);
  const payee = await payeeInfo(d.id);
  const disputed = pay ? (await db().query("SELECT 1 FROM payment_events WHERE payment_id=$1 AND action='dispute_opened' AND NOT EXISTS (SELECT 1 FROM payment_events e2 WHERE e2.payment_id=$1 AND e2.action='dispute_closed' AND e2.created_at > payment_events.created_at) LIMIT 1", [pay.id])).rowCount : 0;
  const unread = (await unreadByDeal(s.userId)).get(d.id) ?? 0;
  const mySig = k?.signatures.some((x) => x.userId === s.userId);
  const sign = k ? canSign({ who, athleteIsMinor: ctx.athleteIsMinor, status: d.status, expired: ctx.expired, voided: !!k.voidedAt, alreadySigned: !!mySig }) : null;
  const athleteSide = (who === "athlete" && !d.athlete_minor) || who === "guardian";
  const blocker = fundingBlocker({
    paymentsEnabled: enabled, dealStatus: d.status, contractExecuted: !!k?.executedAt && !k.voidedAt, isBuyer: who === "counterparty",
    payeeSet: payee.set, payeeIsValid: payee.valid, payeeReady: payee.ready, livePayment: pay?.status ?? null, expired: false,
  });
  const fee = pay?.feeCents ?? (k ? Math.floor((d.amount_cents * k.platformFeeBps) / 10000) : 0);
  const had = (a: string) => events.some((e) => e.action === a);
  const steps: [boolean, string][] = [
    [true, "Offer sent"], [had("accept"), "Athlete accepted"],
    ...(d.athlete_minor || had("approve") ? [[had("approve"), "Guardian approved"] as [boolean, string]] : []),
    [!!k?.executedAt, "Agreement signed by both sides"],
    ...(enabled ? [[!!pay && ["funded", "releasing", "released", "refunding", "refunded"].includes(pay.status), "Sponsor funded the deal"] as [boolean, string]] : []),
    [d.status === "completed", "Sponsor marked it completed"],
    ...(enabled ? [[pay?.status === "released", "Payment released"] as [boolean, string]] : []),
  ];

  return (
    <RecordSheet>
      <header className="record-header">
        <div>
          <p className="eyebrow">Deal record</p>
          <h1>{d.title} <StatusBadge d={d} /></h1>
          <div className="tag record-meta">
            <span>Amount: <strong>{formatCents(d.amount_cents)}</strong></span>
            <span>Counterparty: <strong>{d.counterparty_name}</strong></span>
            <span>Athlete: <strong>{athleteLabel(d, s.userId, who === "guardian")}</strong></span>
          </div>
        </div>
      </header>
      {msg && <p className="ok">{msg}</p>}
      {paid === "1" && pay && pay.status !== "pending_checkout" && !msg && <p className="ok">Thanks — your payment was received.</p>}
      {paid === "1" && pay?.status === "pending_checkout" && <p className="ok">Your payment is processing. This page updates automatically when it lands.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <nav className="record-tabs" aria-label="Deal sections">{tabs.map(t=><Link key={t} href={`?tab=${t}`} aria-current={tab===t?'page':undefined}>{t[0].toUpperCase()+t.slice(1)}</Link>)}</nav>
      {tab==='parties'&&<section className="work-panel"><h2>Parties and permissions</h2><table><tbody><tr><td>Athlete</td><td>{athleteLabel(d,s.userId,who==='guardian')}</td></tr><tr><td>Counterparty</td><td>{d.counterparty_name}</td></tr><tr><td>Your role</td><td>{who}</td></tr></tbody></table><p className="muted">The parties and current guardians can access this record. Team relationships alone do not grant deal access.</p></section>}
      {tab==='compliance'&&<section className="work-panel"><h2>Compliance checks</h2><p>{d.attested_at?'NIL compensation attestation recorded.':'Compensation attestation pending.'}</p><p>{d.athlete_minor?'Guardian approval is required for this athlete.':'Athlete is an adult.'}</p><p>{k?.executedAt?'Agreement executed.':'Agreement signatures outstanding.'}</p><Link className="record-link" href="/dashboard/compliance">Review compliance guidance →</Link></section>}
      <Grid>
        <Card title="Progress" wide><Steps steps={steps} /></Card>
        <Card title="Deliverables" wide>
          <h4>Operational checklist</h4><p className="muted">Checklist items coordinate delivery and do not amend the signed agreement. Approving proof does not release payment.</p>
          <table><thead><tr><th>Item</th><th>Due</th><th>Status / proof</th><th>Action</th></tr></thead><tbody>{workItems.map(item=><tr key={item.id}><td>{item.title}</td><td>{new Date(item.due_on).toISOString().slice(0,10)}</td><td>{item.status.replaceAll('_',' ')}{item.attachment_id&&proofOptions.some(a=>a.id===item.attachment_id)&&<p><a className="record-link" href={`/dashboard/deals/${id}/attachments/${item.attachment_id}`}>{item.filename}</a></p>}</td><td>{who==='counterparty'&&item.status==='submitted'?<form action={saveDealWork}><input type="hidden" name="deal_id" value={id}/><input type="hidden" name="item_id" value={item.id}/><button className="btn ghost" name="action" value="accepted">Accept proof</button><button className="btn ghost" name="action" value="changes_requested">Request changes</button></form>:who!=='counterparty'&&item.status!=='accepted'?<form action={saveDealWork} encType="multipart/form-data" style={{display:'flex',flexDirection:'column',gap:4}}><input type="hidden" name="deal_id" value={id}/><input type="hidden" name="item_id" value={item.id}/><input type="hidden" name="action" value="submit"/><label style={{fontSize:11}}>Upload file proof<input type="file" name="proof_file" accept=".png,.jpg,.jpeg,.pdf"/></label>{proofOptions.length>0&&<label style={{fontSize:11}}>Or select message file<select name="attachment_id"><option value="">-- Choose existing --</option>{proofOptions.map(a=><option key={a.id} value={a.id}>{a.filename}</option>)}</select></label>}<button className="btn ghost small" style={{marginTop:4}}>Submit proof</button></form>:null}</td></tr>)}</tbody></table>
          <p><Link className="record-link" href={`/dashboard/deals/${id}/messages`}>Upload performance evidence in Messages →</Link></p>
          {who==='counterparty'&&['active','awaiting_signature'].includes(d.status)&&<details><summary>Add checklist item</summary><form className="operation-form" action={saveDealWork}><input type="hidden" name="deal_id" value={id}/><input type="hidden" name="action" value="create"/><label>Deliverable<input type="text" name="title" maxLength={200} required/></label><label>Deadline<input type="date" name="due_on" required/></label><button className="btn ghost">Add deliverable</button></form></details>}
          <h4>Agreed deliverables</h4><p style={{ whiteSpace: "pre-wrap" }}>{d.deliverables}</p>
          {d.attested_at && <p className="muted">Offerer confirmed this compensation is for NIL deliverables only ({fmt(d.attested_at)}).</p>}
          {d.expires_at && ["offered", "guardian_review", "awaiting_signature"].includes(d.status) && <p className="muted">{d.status === "awaiting_signature" ? "Signing" : "Offer"} expires {fmt(d.expires_at)}.</p>}
        </Card>

        <Card title="Messages" wide>
          <p>{unread > 0 ? <Badge tone="yellow">{unread} unread</Badge> : <span className="muted">Talk to the other people on this deal.</span>}{d.athlete_minor ? <span className="muted"> Parents/guardians can read every message.</span> : null}</p>
          <p><Link className="btn" href={`/dashboard/deals/${d.id}/messages`}>Open messages</Link></p>
        </Card>

        {k && (
          <Card title="Agreement" wide>
            <p>{k.voidedAt ? <Badge tone="red">Voided</Badge> : k.executedAt ? <Badge tone="green">Fully executed {fmt(k.executedAt)}</Badge> : <Badge tone="yellow">Awaiting signatures</Badge>}{" "}
              <span className="muted">{k.signatures.length === 0 ? "No one has signed yet." : `Signed by ${k.signatures.map((x) => x.typedName).join(", ")}.`}</span></p>
            <p><Link className="btn" href={`/dashboard/deals/${d.id}/contract`}>{sign?.ok ? "Review & sign" : "View agreement"}</Link>{" "}
              <a className="btn ghost" href={`/dashboard/deals/${d.id}/contract/download`}>Download (.txt)</a></p>
            {who === "guardian" && d.status === "awaiting_signature" && <p className="muted">The agreement names the athlete by their full legal name and you sign on their behalf.</p>}
          </Card>)}

        {enabled && (d.status === "active" || d.status === "completed" || pay) && (
          <Card title="Payment" wide>
            <p><strong>{describePayment(pay ? { status: pay.status, attempts: pay.attempts } : null, { required: true })}</strong></p>
            <table><tbody>
              <tr><td>Sponsor pays</td><td>{formatCents(d.amount_cents)}</td></tr>
              <tr><td>Platform fee{k ? ` (${formatBps(k.platformFeeBps)})` : ""}</td><td>{formatCents(fee)}</td></tr>
              <tr><td>Payee receives</td><td>{formatCents(d.amount_cents - fee)}</td></tr>
              <tr><td>Payee</td><td>{payee.set ? <>{payee.name} {payee.valid ? (payee.ready ? <Badge tone="green">payouts ready</Badge> : <Badge tone="yellow">setting up payouts</Badge>) : <Badge tone="red">needs reassigning</Badge>}</> : <span className="muted">not set</span>}</td></tr>
            </tbody></table>
            {disputed ? <p role="alert" className="error">The cardholder opened a dispute on this payment. LIN doesn&apos;t resolve disputes automatically — contact support before relying on this payout.</p> : null}
            {pay?.lastError && athleteSide && <p className="muted">Last issue: {pay.lastError}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {who === "counterparty" && !blocker && <form action={fundDeal}><input type="hidden" name="deal_id" value={d.id} /><button className="btn" type="submit">{pay?.status === "pending_checkout" ? "Continue to payment" : "Fund this deal"}</button></form>}
              {athleteSide && ["active", "completed"].includes(d.status) && (!payee.valid || payee.userId !== s.userId) && !["released", "refunded", "refunding"].includes(pay?.status ?? "") && !(pay?.status === "releasing" && pay.attempts > 0) &&
                <form action={claimPayee}><input type="hidden" name="deal_id" value={d.id} /><button className="btn ghost" type="submit">Receive this payment myself</button></form>}
              {athleteSide && payee.userId === s.userId && !payee.ready && <Link className="btn" href="/dashboard/deals">Finish payout setup</Link>}
            </div>
            {who === "counterparty" && blocker && d.status === "active" && <p className="muted">{blocker}</p>}
            <p className="muted">Card details are entered on Stripe&apos;s secure page; this app never sees them. {SIDE_NOTE}</p>
          </Card>)}

        {actions.length > 0 && (
          <Card title="Your decision" wide>
            {who === "guardian" && d.status === "guardian_review" && <p>{d.athlete_name} accepted this offer. As a parent/guardian, you decide whether it moves to signing. The agreement will name {d.athlete_name} by their full legal name.</p>}
            {who === "athlete" && !d.athlete_minor && d.status === "guardian_review" && <p>You&apos;re now 18, so this deal no longer needs a guardian — you decide.</p>}
            {who === "athlete" && d.athlete_minor && <p className="muted">You&apos;re under 18: accepting sends this to your parent/guardian for final approval.</p>}
            {ctx.cancelRequestSide && <p className="muted">{ctx.cancelRequestSide === "buyer" ? "The sponsor" : "The athlete's side"} has asked to cancel and refund this deal.</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {actions.map((a) => (
                <form key={a} action={dealAction}>
                  <input type="hidden" name="deal_id" value={d.id} /><input type="hidden" name="action" value={a} />
                  <button className={`btn${["decline", "reject", "withdraw", "cancel", "request_cancel", "withdraw_cancel"].includes(a) ? " ghost" : ""}`} type="submit">
                    {a === "approve" && who === "athlete" ? "Confirm deal" : ACTION_LABEL[a]}</button>
                </form>))}
            </div>
          </Card>
        )}
        <Card title="History" wide>
          <List items={events.map((e) => <>{fmt(e.created_at)} — <strong>{e.role.replace("_", " ")}</strong>: {e.action.replace("_", " ")} → {STATUS_LABEL[e.to_status]}</>)} />
        </Card>
      </Grid>
      <Disclaimer>This record logs platform decisions and e-signatures; the agreement is a template, not legal advice. Funds are held by Stripe and released when the sponsor marks the deal complete.</Disclaimer>
    </RecordSheet>
  );
}
