import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { paymentsEnabled } from "@/lib/stripe";
import { startPayoutOnboarding } from "@/lib/payments";

/** The onboarding link expired or was reopened: issue a fresh one. */
export default async function PayoutRefresh() {
  const s = await requireUser();
  if (!paymentsEnabled()) redirect("/dashboard/deals");
  let url: string;
  try { url = await startPayoutOnboarding(s.userId, s.email); }
  catch { redirect(`/dashboard/deals?error=${encodeURIComponent("We couldn't reopen payout setup. Please try again.")}`); }
  redirect(url);
}
