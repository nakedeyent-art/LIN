import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { listDeals } from "@/lib/dealsdb";
import { db } from "@/lib/db";
import { Badge, Card, Disclaimer, Grid } from "@/components/ui";
import { getPayoutAccount } from "@/lib/payments";
import { paymentsEnabled } from "@/lib/stripe";
import { startPayouts } from "./payment-actions";
import { DealTable } from "@/components/deal-ui";
import { unreadByDeal } from "@/lib/messagesdb";
import { setDiscoverable } from "./actions";

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string }> }) {
  const s = await requireAccess("/dashboard/deals");
  const { error, msg } = await searchParams;
  const deals = await listDeals(s.userId);
  const unread = await unreadByDeal(s.userId);
  const listed = s.role === "athlete"
    ? (await db().query("SELECT discoverable FROM athlete_profiles WHERE user_id=$1", [s.userId])).rows[0]?.discoverable as boolean | undefined
    : undefined;
  const canPaid = paymentsEnabled() && (s.role === "parent"
    ? !!(await db().query("SELECT 1 FROM guardian_links WHERE member_id=$1 LIMIT 1", [s.userId])).rowCount
    : s.role === "athlete" && !!(await db().query("SELECT 1 FROM athlete_profiles WHERE user_id=$1 AND birth_date <= CURRENT_DATE - INTERVAL '18 years'", [s.userId])).rowCount);
  const acct = canPaid ? await getPayoutAccount(s.userId) : null;
  const needs = deals.filter((d) =>
    (s.role === "athlete" && d.status === "offered") || (s.role === "parent" && d.status === "guardian_review") ||
    (d.status === "awaiting_signature" && !d.signed_by_me && !(s.role === "athlete" && d.athlete_minor))).length;
  return (
    <>
      <h1>Deals</h1>
      <div className="tag">{s.role === "parent" ? "Approve or reject your athlete's deals." : s.role === "athlete" ? "Review offers. Under 18? A guardian must approve before a deal is active." : "Your offers and active deals."}</div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {needs > 0 && <p className="ok">{needs} deal{needs > 1 ? "s" : ""} waiting for your decision or signature.</p>}
      <Grid>
        {canPaid && (
          <Card title="Payouts" wide>
            <p>{acct?.payoutsEnabled ? <Badge tone="green">Payouts ready</Badge> : acct ? <Badge tone="yellow">Setup unfinished</Badge> : <Badge tone="gray">Not set up</Badge>}{" "}
              {s.role === "parent" ? "You receive payments for athletes you're guardian of, for their benefit." : "You receive payments for your deals."}</p>
            <form action={startPayouts}><button className="btn" type="submit">{acct ? (acct.payoutsEnabled ? "Update payout details" : "Continue payout setup") : "Set up payouts"}</button></form>
            <p className="muted">Identity and bank details are collected by Stripe, not stored here. Money for an athlete under 18 goes to a parent/guardian — custodial and tax rules vary by state.</p>
          </Card>
        )}
        {s.role === "athlete" && (
          <Card title="Sponsor visibility" wide>
            <p>{listed ? "You're listed — sponsors can find you and send offers." : "You're not listed. Sponsors can't find or approach you."}</p>
            <form action={setDiscoverable}><input type="hidden" name="on" value={listed ? "0" : "1"} />
              <button className="btn" type="submit">{listed ? "Unlist me" : "List me to sponsors"}</button></form>
            <p className="muted">Sponsors see your sport, position and level only{""} — never your email or birth date. Under 18, sponsors see first name and last initial.</p>
          </Card>
        )}
        {["sponsor", "booster", "gym_owner"].includes(s.role) && (
          <Card title="New offer" wide><Link className="btn" href="/dashboard/athletes">Find athletes</Link></Card>
        )}
        <Card title="All deals" wide><DealTable deals={deals} viewerId={s.userId} role={s.role} unread={unread} /></Card>
      </Grid>
      <Disclaimer>Compensation must be for real NIL deliverables at fair market value — never for enrollment, recruitment or athletic performance. State and association rules vary; have counsel review before launch.</Disclaimer>
    </>
  );
}
