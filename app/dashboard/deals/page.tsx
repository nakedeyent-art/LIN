import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { listDeals } from "@/lib/dealsdb";
import { db } from "@/lib/db";
import { Card, Disclaimer, Grid } from "@/components/ui";
import { DealTable } from "@/components/deal-ui";
import { setDiscoverable } from "./actions";

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const s = await requireAccess("/dashboard/deals");
  const { error } = await searchParams;
  const deals = await listDeals(s.userId);
  const listed = s.role === "athlete"
    ? (await db().query("SELECT discoverable FROM athlete_profiles WHERE user_id=$1", [s.userId])).rows[0]?.discoverable as boolean | undefined
    : undefined;
  const needs = deals.filter((d) =>
    (s.role === "athlete" && d.status === "offered") || (s.role === "parent" && d.status === "guardian_review")).length;
  return (
    <>
      <h1>Deals</h1>
      <div className="tag">{s.role === "parent" ? "Approve or reject your athlete's deals." : s.role === "athlete" ? "Review offers. Under 18? A guardian must approve before a deal is active." : "Your offers and active deals."}</div>
      {error && <p role="alert" className="error">{error}</p>}
      {needs > 0 && <p className="ok">{needs} deal{needs > 1 ? "s" : ""} waiting for your decision.</p>}
      <Grid>
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
        <Card title="All deals" wide><DealTable deals={deals} viewerId={s.userId} role={s.role} /></Card>
      </Grid>
      <Disclaimer>Compensation must be for real NIL deliverables at fair market value — never for enrollment, recruitment or athletic performance. State and association rules vary; have counsel review before launch.</Disclaimer>
    </>
  );
}
