"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess, requireUser } from "@/lib/session";
import { canHavePayoutAccount } from "@/lib/payment-rules";
import { paymentsEnabled } from "@/lib/stripe";
import { startFunding, startPayoutOnboarding, UserError } from "@/lib/payments";
import { capacityOn, type DealRow } from "@/lib/dealsdb";

const UUID = /^[0-9a-f-]{36}$/i;
const dealBack = (id: string, key: "msg" | "error", m: string): never => redirect(`/dashboard/deals/${id}?${key}=${encodeURIComponent(m)}`);
const listBack = (key: "msg" | "error", m: string): never => redirect(`/dashboard/deals?${key}=${encodeURIComponent(m)}`);

/** Sponsor → Stripe-hosted Checkout. Card details are entered on Stripe's page, never here. */
export async function fundDeal(formData: FormData) {
  const s = await requireAccess("/dashboard/deals");
  const id = String(formData.get("deal_id") ?? "");
  if (!UUID.test(id)) redirect("/dashboard/deals");
  let url: string;
  try { url = await startFunding(id, s.userId); }
  catch (e) { return dealBack(id, "error", e instanceof UserError ? e.message : "We couldn't start the payment. Please try again."); }
  redirect(url);
}

export async function startPayouts() {
  const s = await requireUser();
  if (!paymentsEnabled()) listBack("error", "Payments aren't switched on yet.");
  const adult = s.role === "athlete" && !!(await db().query("SELECT 1 FROM athlete_profiles WHERE user_id=$1 AND birth_date <= CURRENT_DATE - INTERVAL '18 years'", [s.userId])).rowCount;
  const guards = s.role === "parent" && !!(await db().query("SELECT 1 FROM guardian_links WHERE member_id=$1 LIMIT 1", [s.userId])).rowCount;
  if (!canHavePayoutAccount({ role: s.role, isAdultAthlete: adult, guardsAMinor: guards }))
    listBack("error", "Payouts are set up by adult athletes, or by a parent/guardian for an athlete under 18.");
  let url: string;
  try { url = await startPayoutOnboarding(s.userId, s.email); }
  catch (e) { console.error("payout onboarding failed:", (e as Error).message); return listBack("error", "We couldn't open payout setup. Please try again shortly."); }
  redirect(url);
}

/**
 * Chooses who receives the money. Only the athlete's side may do it: the adult athlete, or a CURRENT guardian of a minor.
 * Allowed until the payment is paid out or refunded (e.g. a guardian stepped down, or the athlete turned 18).
 */
export async function claimPayee(formData: FormData) {
  const s = await requireAccess("/dashboard/deals");
  const id = String(formData.get("deal_id") ?? "");
  if (!UUID.test(id)) redirect("/dashboard/deals");
  const d = (await db().query(
    `SELECT d.id, d.status, d.athlete_id, d.counterparty_id, COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS athlete_minor
       FROM deals d LEFT JOIN athlete_profiles ap ON ap.user_id = d.athlete_id WHERE d.id=$1`, [id])).rows[0] as DealRow | undefined;
  const who = d ? await capacityOn(s.userId, d, undefined) : null;
  const athleteSide = (who === "athlete" && !d!.athlete_minor) || who === "guardian";
  if (!d || !athleteSide) return dealBack(id, "error", "Only the athlete (or their guardian, if under 18) can choose who receives the payment.");
  if (!["active", "completed"].includes(d.status)) return dealBack(id, "error", "The payee can be chosen once the agreement is signed.");
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const live = (await client.query("SELECT id, status FROM deal_payments WHERE deal_id=$1 AND status IN ('pending_checkout','funded','releasing') FOR UPDATE", [id])).rows[0];
    await client.query("UPDATE deals SET payee_user_id=$2, updated_at=NOW() WHERE id=$1", [id, s.userId]);
    if (live) await client.query("UPDATE deal_payments SET payee_user_id=$2, updated_at=NOW() WHERE id=$1", [live.id, s.userId]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }
  dealBack(id, "msg", "You'll receive the payment for this deal. Finish payout setup if you haven't already.");
}
