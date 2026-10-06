import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { paymentsEnabled } from "@/lib/stripe";
import { refreshPayoutAccount } from "@/lib/payments";

/** Stripe sends people here after onboarding; we read the account's real state from Stripe rather than trusting the redirect. */
export default async function PayoutReturn() {
  const s = await requireUser();
  if (!paymentsEnabled()) redirect("/dashboard/deals");
  let msg = "Payout setup saved.";
  try {
    const a = await refreshPayoutAccount(s.userId);
    msg = a?.payoutsEnabled ? "Payouts are ready — you can receive payments." : "Payout setup isn't finished yet. Reopen it to complete the remaining steps.";
  } catch (e) { console.error("payout refresh failed:", (e as Error).message); msg = "We couldn't confirm your payout status yet. Check back in a moment."; }
  redirect(`/dashboard/deals?msg=${encodeURIComponent(msg)}`);
}
