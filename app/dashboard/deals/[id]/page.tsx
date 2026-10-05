import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/session";
import { capacityOn, dealContext, dealEvents, getDeal } from "@/lib/dealsdb";
import { ACTION_LABEL, availableActions, formatCents, STATUS_LABEL } from "@/lib/deals";
import { Card, Disclaimer, Grid, List } from "@/components/ui";
import { athleteLabel, StatusBadge } from "@/components/deal-ui";
import { dealAction } from "../actions";

export default async function DealDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; msg?: string }>;
}) {
  const s = await requireAccess("/dashboard/deals");
  const { id } = await params;
  const { error, msg } = await searchParams;
  const d = await getDeal(s.userId, id);
  if (!d) notFound();
  const who = await capacityOn(s.userId, d);
  if (!who) notFound();
  const actions = availableActions(await dealContext(d), who);
  const events = await dealEvents(d.id);
  const fmt = (x: Date) => new Date(x).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <h1>{d.title} <StatusBadge d={d} /></h1>
      <div className="tag">{formatCents(d.amount_cents)} · {d.counterparty_name} → {athleteLabel(d, s.userId, who === "guardian")}</div>
      {msg && <p className="ok">{msg}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <Grid>
        <Card title="Deliverables" wide><p style={{ whiteSpace: "pre-wrap" }}>{d.deliverables}</p>
          {d.attested_at && <p className="muted">Offerer confirmed this compensation is for NIL deliverables only ({fmt(d.attested_at)}).</p>}
          {d.expires_at && (d.status === "offered" || d.status === "guardian_review") && <p className="muted">Offer expires {fmt(d.expires_at)}.</p>}
        </Card>
        {actions.length > 0 && (
          <Card title="Your decision" wide>
            {who === "guardian" && d.status === "guardian_review" && <p>{d.athlete_name} accepted this offer. As a parent/guardian, you decide whether it becomes active.</p>}
            {who === "athlete" && d.athlete_minor && <p className="muted">You&apos;re under 18: accepting sends this to your parent/guardian for final approval.</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {actions.map((a) => (
                <form key={a} action={dealAction}>
                  <input type="hidden" name="deal_id" value={d.id} /><input type="hidden" name="action" value={a} />
                  <button className={`btn${a === "decline" || a === "reject" || a === "withdraw" ? " ghost" : ""}`} type="submit">{ACTION_LABEL[a]}</button>
                </form>))}
            </div>
          </Card>
        )}
        <Card title="History" wide>
          <List items={events.map((e) => <>{fmt(e.created_at)} — <strong>{e.role.replace("_", " ")}</strong>: {e.action} → {STATUS_LABEL[e.to_status]}</>)} />
        </Card>
      </Grid>
      <Disclaimer>This record is a log of platform decisions, not a substitute for a signed contract. Active deals can&apos;t be cancelled here — handle terminations with the other party directly.</Disclaimer>
    </>
  );
}
