"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAccess, requireRecentMfa, requireUser } from "@/lib/session";
import { canHavePayoutAccount } from "@/lib/payment-rules";
import { paymentsEnabled } from "@/lib/stripe";
import { startFunding, startPayoutOnboarding, UserError } from "@/lib/payments";
import { selectPayee } from "@/lib/payee";

const UUID = /^[0-9a-f-]{36}$/i;
const dealBack = (id: string, key: "msg" | "error", m: string): never => redirect(`/dashboard/deals/${id}?${key}=${encodeURIComponent(m)}`);
const listBack = (key: "msg" | "error", m: string): never => redirect(`/dashboard/deals?${key}=${encodeURIComponent(m)}`);

/** Sponsor → Stripe-hosted Checkout. Card details are entered on Stripe's page, never here. */
export async function fundDeal(formData: FormData) {
  const s = await requireAccess("/dashboard/deals");
  const id = String(formData.get("deal_id") ?? "");
  if (!UUID.test(id)) redirect("/dashboard/deals");
  await requireRecentMfa(s, `/dashboard/deals/${id}`);
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
  await requireRecentMfa(s, "/dashboard/deals");
  let url: string;
  try { url = await startPayoutOnboarding(s.userId, s.email); }
  catch (e) { console.error("payout onboarding failed:", (e as Error).message); return listBack("error", "We couldn't open payout setup. Please try again shortly."); }
  redirect(url);
}

/**
 * Chooses who receives the money. Only the athlete's side may do it: the adult athlete, or a CURRENT guardian of a minor.
 * A recipient can change while funds are held, but is fixed once a transfer has been attempted.
 */
export async function claimPayee(formData: FormData) {
  const s = await requireAccess("/dashboard/deals");
  const id = String(formData.get("deal_id") ?? "");
  if (!UUID.test(id)) redirect("/dashboard/deals");
  await requireRecentMfa(s, `/dashboard/deals/${id}`);
  const r = await selectPayee(s.userId, id);
  if (!r.ok) return dealBack(id, "error", r.error);
  dealBack(id, "msg", "You'll receive the payment for this deal. Finish payout setup if you haven't already.");
}
