export type PaymentLifecycleState =
  | "pending_checkout"
  | "funded_escrow"
  | "releasing_transfer"
  | "released_settled"
  | "refunding_sponsor"
  | "refunded_complete"
  | "dispute_frozen";

export interface UncertainTransferRecord {
  paymentId: string;
  dealId: string;
  dealTitle: string;
  sponsorName: string;
  payeeName: string;
  grossAmountCents: number;
  platformFeeCents: number;
  state: PaymentLifecycleState;
  transferAttempts: number;
  hasOpenCardDispute: boolean;
  payeeStripeReady: boolean;
  idempotencyKey: string;
  lastError?: string;
}

export interface ReconciliationActionEvaluation {
  canRetryTransfer: boolean;
  canReassignPayee: boolean;
  canIssueSponsorRefund: boolean;
  requiresDualAdminMfa: boolean;
  recommendedAction: string;
  blockReason?: string;
}

export function evaluatePaymentReconciliation(
  record: UncertainTransferRecord
): ReconciliationActionEvaluation {
  // Never release or retry payout while a cardholder dispute is open
  if (record.hasOpenCardDispute || record.state === "dispute_frozen") {
    return {
      canRetryTransfer: false,
      canReassignPayee: false,
      canIssueSponsorRefund: false,
      requiresDualAdminMfa: true,
      recommendedAction: "Hold in Escrow — Await Stripe Chargeback Resolution",
      blockReason:
        "Open cardholder dispute: Payout transfers and payee changes are strictly frozen until dispute closes.",
    };
  }

  // Payee cannot be changed once transfer attempts > 0 or settled/refunded
  const canReassignPayee =
    (record.state === "funded_escrow" || record.state === "releasing_transfer") &&
    record.transferAttempts === 0;

  if (record.state === "released_settled" || record.state === "refunded_complete") {
    return {
      canRetryTransfer: false,
      canReassignPayee: false,
      canIssueSponsorRefund: false,
      requiresDualAdminMfa: false,
      recommendedAction: "No Action Needed — Ledger Settled",
    };
  }

  if (!record.payeeStripeReady) {
    return {
      canRetryTransfer: false,
      canReassignPayee,
      canIssueSponsorRefund: true,
      requiresDualAdminMfa: record.grossAmountCents >= 100_000,
      recommendedAction: canReassignPayee
        ? "Prompt Payee KYC Completion or Reassign Eligible Guardian Payee"
        : "Await Payee Stripe Connect Onboarding Completion",
      blockReason: "Payee Stripe Connect account has not completed identity/payout verification.",
    };
  }

  const canRetryTransfer =
    record.state === "releasing_transfer" || record.state === "funded_escrow";

  return {
    canRetryTransfer,
    canReassignPayee,
    canIssueSponsorRefund: record.state === "funded_escrow",
    requiresDualAdminMfa: record.grossAmountCents >= 100_000,
    recommendedAction:
      record.transferAttempts > 0
        ? `Reconcile & Retry Transfer with Pinned Idempotency Key (${record.idempotencyKey})`
        : "Ready for Automated Settlement",
  };
}

export const SAMPLE_RECONCILIATION_RECORDS: UncertainTransferRecord[] = [
  {
    paymentId: "pay-rec-101",
    dealId: "deal-881",
    dealTitle: "Apex Hydration Fall Combine Showcase",
    sponsorName: "Apex Hydration",
    payeeName: "Sandra Vance (Custodial Guardian UGMA)",
    grossAmountCents: 185_000,
    platformFeeCents: 9_250,
    state: "releasing_transfer",
    transferAttempts: 1,
    hasOpenCardDispute: false,
    payeeStripeReady: true,
    idempotencyKey: "idem_rel_deal881_v1",
    lastError: "Stripe network timeout during transfer poll; row lock released safely before network call.",
  },
  {
    paymentId: "pay-rec-102",
    dealId: "deal-889",
    dealTitle: "Metro Sportswear Local Appearance",
    sponsorName: "Metro Sportswear",
    payeeName: "Devon Brooks",
    grossAmountCents: 120_000,
    platformFeeCents: 6_000,
    state: "dispute_frozen",
    transferAttempts: 0,
    hasOpenCardDispute: true,
    payeeStripeReady: true,
    idempotencyKey: "idem_rel_deal889_v1",
    lastError: "Cardholder opened inquiry; automatic escrow freeze triggered.",
  },
  {
    paymentId: "pay-rec-103",
    dealId: "deal-894",
    dealTitle: "Regional Speed Clinic Guest Coach",
    sponsorName: "NextGen Speed Lab",
    payeeName: "Unverified Minor Account",
    grossAmountCents: 75_000,
    platformFeeCents: 3_750,
    state: "funded_escrow",
    transferAttempts: 0,
    hasOpenCardDispute: false,
    payeeStripeReady: false,
    idempotencyKey: "idem_rel_deal894_v1",
    lastError: "Waiting for linked guardian to complete Stripe Connect onboarding.",
  },
];
