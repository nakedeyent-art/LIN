import { requireUser } from "@/lib/session";
import { startPayouts } from "../../deals/payment-actions";

/** Expired Stripe links return here. Reuse the POST action's eligibility and MFA checks. */
export default async function PayoutRefresh() {
  await requireUser();
  return <>
    <h1>Continue payout setup</h1>
    <p>Your payout setup link expired. Continue to open a new secure link.</p>
    <form action={startPayouts}><button className="btn" type="submit">Continue payout setup</button></form>
  </>;
}
