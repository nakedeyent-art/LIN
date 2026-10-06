/** Pure payment rules: who may fund, who may receive, and how a payment's state is described. */

export type PaymentStatus = "pending_checkout" | "funded" | "releasing" | "released" | "refunding" | "refunded" | "expired" | "failed";
export const LIVE_PAYMENT_STATUSES: PaymentStatus[] = ["pending_checkout", "funded", "releasing", "refunding"];
/** Money is (or may be) in motion: blocks account deletion for the people involved. */
export const MONEY_IN_FLIGHT: PaymentStatus[] = ["funded", "releasing", "refunding"];

/**
 * A payee is valid if they are the adult athlete themself, or — while the athlete is a minor — a *current* guardian.
 * (Stripe accounts need an adult; a guardian receives the money for the minor's benefit.)
 */
export function payeeValid(i: { athleteIsMinor: boolean; payeeIsAthlete: boolean; payeeIsCurrentGuardian: boolean }): boolean {
  return i.athleteIsMinor ? i.payeeIsCurrentGuardian : i.payeeIsAthlete;
}

/** Who can be a payee candidate at all, for the "set up payouts" button. */
export function canHavePayoutAccount(i: { role: string; isAdultAthlete: boolean; guardsAMinor: boolean }): boolean {
  return (i.role === "athlete" && i.isAdultAthlete) || (i.role === "parent" && i.guardsAMinor);
}

export type FundingInput = {
  paymentsEnabled: boolean; dealStatus: string; contractExecuted: boolean; isBuyer: boolean;
  payeeSet: boolean; payeeIsValid: boolean; payeeReady: boolean; livePayment: PaymentStatus | null; expired: boolean;
};

/** Returns why funding isn't possible right now, or null if the sponsor may start it. */
export function fundingBlocker(i: FundingInput): string | null {
  if (!i.paymentsEnabled) return "Payments aren't switched on for this installation.";
  if (!i.isBuyer) return "Only the sponsor funds a deal.";
  if (i.dealStatus !== "active" || !i.contractExecuted || i.expired) return "The deal must be fully signed and active before it can be funded.";
  if (i.livePayment === "funded" || i.livePayment === "releasing" || i.livePayment === "refunding") return "This deal is already funded.";
  if (!i.payeeSet || !i.payeeIsValid) return "The athlete's side needs to choose who receives the payment (they set this up under Payments).";
  if (!i.payeeReady) return "The payee hasn't finished payout setup yet. Funding opens as soon as they do.";
  return null;
}

export function describePayment(p: { status: PaymentStatus; attempts: number } | null, funding: { required: boolean }): string {
  if (!funding.required) return "Payments are off — this agreement doesn't move money.";
  if (!p) return "Awaiting funding";
  switch (p.status) {
    case "pending_checkout": return "Funding in progress (waiting for the sponsor's payment)";
    case "funded": return "Funded — held until the sponsor confirms completion";
    case "releasing": return p.attempts > 1 ? "Payout pending — retrying" : "Payout in progress";
    case "released": return "Paid out";
    case "refunding": return p.attempts > 1 ? "Refund pending — retrying" : "Refund in progress";
    case "refunded": return "Refunded to the sponsor";
    case "expired": return "Awaiting funding (the previous checkout expired)";
    case "failed": return "Payment failed";
  }
}
