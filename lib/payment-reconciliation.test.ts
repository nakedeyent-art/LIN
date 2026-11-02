import { describe, expect, it } from "vitest";
import {
  evaluatePaymentReconciliation,
  type UncertainTransferRecord,
} from "./payment-reconciliation";

describe("Payment Reconciliation & Dispute Freeze Engine", () => {
  const baseRecord: UncertainTransferRecord = {
    paymentId: "pay-1",
    dealId: "deal-1",
    dealTitle: "Test Campaign",
    sponsorName: "Sponsor Co",
    payeeName: "Guardian Payee",
    grossAmountCents: 150_000,
    platformFeeCents: 7_500,
    state: "releasing_transfer",
    transferAttempts: 1,
    hasOpenCardDispute: false,
    payeeStripeReady: true,
    idempotencyKey: "idem_123",
  };

  it("blocks transfers and payee changes whenever a card dispute is open", () => {
    const res = evaluatePaymentReconciliation({
      ...baseRecord,
      hasOpenCardDispute: true,
      state: "dispute_frozen",
    });
    expect(res.canRetryTransfer).toBe(false);
    expect(res.canReassignPayee).toBe(false);
    expect(res.canIssueSponsorRefund).toBe(false);
    expect(res.blockReason).toContain("Open cardholder dispute");
  });

  it("prohibits payee reassignment once a transfer attempt has occurred, but permits idempotent retry", () => {
    const res = evaluatePaymentReconciliation(baseRecord);
    expect(res.canRetryTransfer).toBe(true);
    expect(res.canReassignPayee).toBe(false);
    expect(res.requiresDualAdminMfa).toBe(true);
    expect(res.recommendedAction).toContain("idem_123");
  });

  it("permits payee reassignment when zero transfer attempts have been made and payee is not ready", () => {
    const res = evaluatePaymentReconciliation({
      ...baseRecord,
      state: "funded_escrow",
      transferAttempts: 0,
      payeeStripeReady: false,
    });
    expect(res.canRetryTransfer).toBe(false);
    expect(res.canReassignPayee).toBe(true);
  });
});
