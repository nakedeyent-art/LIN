import { cache } from "react";
import { db } from "@/lib/db";
import type { Session } from "@/lib/session";
import { getEnvelope } from "@/lib/signing";
import { capacityOn, dealContext, listDeals } from "@/lib/dealsdb";
import { availableActions, formatCents, isOpen } from "@/lib/deals";

/**
 * "Needs you" items: decisions only this viewer can make right now.
 * Shared by the left-rail badge and the Today feed so both always agree.
 * Every item is re-authorized through the same checks the record pages use
 * (getEnvelope for signatures, capacityOn + availableActions for deals).
 */
export type NeedsYouItem = {
  key: string;
  kind: "signature" | "deal";
  title: string;
  detail: string;
  href: string;
  cta: string;
};

/**
 * Deal actions that mean "the other side is waiting on you": responding to an offer, a guardian's approval,
 * or agreeing to the other side's cancellation request. Housekeeping actions (withdraw, cancel, complete)
 * are always available to someone and would flag every live deal forever, so they are excluded.
 */
const DECISIONS = new Set(["accept", "approve", "agree_cancel"]);

/** Per-request memo: the rail and the page both ask. Keyed by the serialized session (primitives only). */
const memo = cache((key: string) => compute(JSON.parse(key) as Session));
export const needsYou = (s: Session): Promise<NeedsYouItem[]> => memo(JSON.stringify(s));

async function compute(s: Session): Promise<NeedsYouItem[]> {
  const [sigRows, deals] = await Promise.all([
    db().query(
      `SELECT DISTINCT e.id, e.title, e.expires_at FROM signing_envelopes e JOIN signing_recipients r ON r.envelope_id=e.id
        WHERE r.user_id=$1 AND r.status<>'signed' AND e.status IN ('sent','viewed','partially_signed') AND e.expires_at>now()
        ORDER BY e.expires_at LIMIT 30`, [s.userId]),
    listDeals(s.userId),
  ]);
  const signatures = (await Promise.all(sigRows.rows.map(async (e) => ((await getEnvelope(s, e.id)) ? e : null)))).filter(Boolean) as { id: string; title: string; expires_at: Date }[];
  const items: NeedsYouItem[] = signatures.map((e) => ({
    key: `sig-${e.id}`, kind: "signature", title: e.title,
    detail: `Signature requested · expires ${new Date(e.expires_at).toISOString().slice(0, 10)}`,
    href: `/dashboard/signing/${e.id}`, cta: "Review and sign",
  }));
  for (const d of deals.filter((x) => isOpen(x.status) || x.status === "active")) {
    const who = await capacityOn(s.userId, d);
    if (!who) continue;
    const ctx = await dealContext(d);
    if (ctx.expired) continue;
    const acts = availableActions(ctx, who).filter((a) => DECISIONS.has(a));
    if (!acts.length) continue;
    const detail = who === "guardian" && d.status === "guardian_review"
      ? `${d.athlete_name} accepted · your approval decides`
      : who === "athlete" && d.status === "offered" ? `${d.counterparty_name} offered ${formatCents(d.amount_cents)}`
      : `${formatCents(d.amount_cents)} · ${d.counterparty_name}`;
    items.push({ key: `deal-${d.id}`, kind: "deal", title: d.title, detail, href: `/dashboard/deals/${d.id}`,
      cta: who === "guardian" && d.status === "guardian_review" ? "Approve or reject" : who === "athlete" && d.status === "offered" ? "Respond to offer" : "Decide" });
  }
  return items;
}
