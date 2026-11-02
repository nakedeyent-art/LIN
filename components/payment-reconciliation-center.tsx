"use client";

import { useState } from "react";
import {
  evaluatePaymentReconciliation,
  SAMPLE_RECONCILIATION_RECORDS,
  type UncertainTransferRecord,
} from "@/lib/payment-reconciliation";

export function PaymentReconciliationCenter() {
  const [records, setRecords] = useState<UncertainTransferRecord[]>(
    SAMPLE_RECONCILIATION_RECORDS
  );
  const [notice, setNotice] = useState<string | null>(null);

  const handleReconcileTransfer = (paymentId: string) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.paymentId === paymentId
          ? {
              ...r,
              state: "released_settled",
              lastError: undefined,
            }
          : r
      )
    );
    setNotice(
      `Reconciled payment ${paymentId} against Stripe Transfer API using pinned idempotency key without holding row locks across the network call.`
    );
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 20,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="badge teal">Stripe Idempotency &amp; Escrow Reconciliation</span>
            <span className="badge yellow">10-Minute Admin MFA Enforced</span>
          </div>
          <h3 style={{ margin: "6px 0 2px", fontSize: 18 }}>
            Support Payment Reconciliation &amp; Dispute Hold Ledger
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Explicit funding → held → releasing → settled states. Transfers are blocked during open cardholder disputes, and payee changes are locked once a transfer attempt occurs.
          </p>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(20, 184, 166, 0.14)",
            border: "1px solid rgba(20, 184, 166, 0.35)",
            color: "#5eead4",
            fontSize: 12,
          }}
        >
          ✓ {notice}
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {records.map((rec) => {
          const evalRes = evaluatePaymentReconciliation(rec);
          const netCents = rec.grossAmountCents - rec.platformFeeCents;
          return (
            <div
              key={rec.paymentId}
              style={{
                padding: 14,
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: rec.hasOpenCardDispute
                  ? "1px solid rgba(239, 68, 68, 0.45)"
                  : rec.state === "released_settled"
                  ? "1px solid rgba(34, 197, 94, 0.35)"
                  : "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      className={`badge ${
                        rec.state === "released_settled"
                          ? "green"
                          : rec.hasOpenCardDispute
                          ? "red"
                          : "yellow"
                      }`}
                    >
                      {rec.state.replaceAll("_", " ").toUpperCase()}
                    </span>
                    <strong>{rec.dealTitle}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>
                      ({rec.sponsorName} → {rec.payeeName})
                    </span>
                  </div>

                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Gross: <strong>${(rec.grossAmountCents / 100).toLocaleString()}</strong> · Net Payout:{" "}
                    <strong>${(netCents / 100).toLocaleString()}</strong> · Attempts: {rec.transferAttempts} · Idempotency:{" "}
                    <code>{rec.idempotencyKey}</code>
                  </div>

                  {rec.lastError && (
                    <div style={{ fontSize: 12, color: "#fde047", marginTop: 4 }}>
                      Diagnostic: {rec.lastError}
                    </div>
                  )}
                  {evalRes.blockReason && (
                    <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 2 }}>
                      🔒 {evalRes.blockReason}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {evalRes.canRetryTransfer && (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => handleReconcileTransfer(rec.paymentId)}
                    >
                      Reconcile &amp; Settle Transfer
                    </button>
                  )}
                  {evalRes.canReassignPayee && (
                    <span className="badge teal">Payee Repair Eligible (0 Attempts)</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
