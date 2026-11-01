"use client";

import { useState } from "react";
import {
  type DeliverableProofInput,
  type DeliverableVerificationReport,
  type EscrowReleaseSummary,
  evaluateDeliverableSubmission,
  evaluateEscrowReleaseEligibility,
} from "@/lib/deal-proof-release";

export interface DeliverableWorkItemUI {
  id: string;
  title: string;
  dueOn: string;
  status: "pending" | "submitted" | "accepted" | "changes_requested";
  proofUrl?: string;
  captionText?: string;
  proofType?: string;
  attachmentId?: string;
  filename?: string;
}

interface DeliverableProofHubProps {
  dealId: string;
  dealTitle: string;
  sponsorName: string;
  amountCents: number;
  isMinor: boolean;
  escrowFunded: boolean;
  viewerRole: string; // 'counterparty' (sponsor/brand) vs 'athlete' vs 'guardian'
  initialWorkItems: DeliverableWorkItemUI[];
}

export function DeliverableProofHub({
  dealId,
  dealTitle,
  sponsorName,
  amountCents,
  isMinor,
  escrowFunded,
  viewerRole,
  initialWorkItems,
}: DeliverableProofHubProps) {
  const [workItems, setWorkItems] = useState<DeliverableWorkItemUI[]>(initialWorkItems);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // Submission Form State (for Athlete)
  const [proofType, setProofType] = useState<"social_post_url" | "screenshot_image" | "attendance_signoff">("social_post_url");
  const [proofUrl, setProofUrl] = useState<string>("");
  const [captionText, setCaptionText] = useState<string>("#ad Excited to partner with " + sponsorName + " for this season!");

  // Escrow Release State
  const [isDisbursed, setIsDisbursed] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const dealAmountDollars = amountCents / 100;

  const releaseSummary: EscrowReleaseSummary = evaluateEscrowReleaseEligibility({
    dealId,
    dealTitle,
    dealAmountDollars,
    isMinorAthlete: isMinor,
    workItems,
    escrowFunded,
    alreadyDisbursed: isDisbursed,
  });

  const isCounterparty = viewerRole === "counterparty";
  const isAthlete = viewerRole === "athlete";

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  // Real-time FTC check preview for current caption input
  const currentFtcCheck = evaluateDeliverableSubmission({
    itemId: activeItemId ?? "preview",
    itemTitle: "Draft Preview",
    proofType,
    proofUrlOrPath: proofUrl,
    postCaptionText: captionText,
    sponsorBrand: sponsorName,
    submittedAt: new Date().toISOString(),
  });

  const handleAthleteSubmitProof = (itemId: string) => {
    setWorkItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: "submitted",
              proofUrl: proofUrl || "https://instagram.com/p/sample_post",
              captionText,
              proofType,
            }
          : item
      )
    );
    setActiveItemId(null);
    showNotification("✓ Deliverable proof submitted! Automated FTC scan passed to brand review.");
  };

  const handleAcceptItem = (itemId: string) => {
    setWorkItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: "accepted" } : item))
    );
    showNotification("✓ Deliverable accepted.");
  };

  const handleRequestChanges = (itemId: string) => {
    setWorkItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: "changes_requested" } : item))
    );
    showNotification("⚠️ Revision requested from athlete.");
  };

  const handleExecuteEscrowRelease = () => {
    setIsDisbursed(true);
    showNotification(`💰 $${releaseSummary.netPayeePayoutDollars.toLocaleString()} disbursed to ${isMinor ? "Guardian Custodial Escrow" : "Athlete Bank Account"}!`);
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
      {/* Toast Notification */}
      {notice && (
        <div
          style={{
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid #22c55e",
            borderRadius: 6,
            padding: "10px 14px",
            color: "#4ade80",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {notice}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge green">NIL Proof &amp; Escrow Release</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {workItems.filter((w) => w.status === "accepted").length} of {workItems.length} Deliverables Completed
            </span>
          </div>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
            Deliverables Verification &amp; Escrow Payout Hub
          </h3>
        </div>

        {/* Escrow Status Tag */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Escrow Security Status</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: isDisbursed ? "#38bdf8" : escrowFunded ? "#22c55e" : "#eab308",
              marginTop: 2,
            }}
          >
            {isDisbursed
              ? "● Funds Disbursed"
              : escrowFunded
              ? "● 100% Pre-Funded in Escrow"
              : "▲ Awaiting Escrow Deposit"}
          </div>
        </div>
      </div>

      {/* Deliverable Items Checklist */}
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {workItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: item.status === "accepted" ? "#4ade80" : "var(--text)",
                  }}
                >
                  {item.status === "accepted" ? "✓ " : "○ "} {item.title}
                </span>

                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background:
                      item.status === "accepted"
                        ? "rgba(34, 197, 94, 0.15)"
                        : item.status === "submitted"
                        ? "rgba(56, 189, 248, 0.15)"
                        : item.status === "changes_requested"
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(148, 163, 184, 0.15)",
                    color:
                      item.status === "accepted"
                        ? "#4ade80"
                        : item.status === "submitted"
                        ? "#38bdf8"
                        : item.status === "changes_requested"
                        ? "#f87171"
                        : "var(--text-muted)",
                  }}
                >
                  {item.status.replace("_", " ")}
                </span>
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Due by: {new Date(item.dueOn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>

              {/* Submitted Proof URL & FTC Badge */}
              {item.proofUrl && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href={item.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "#38bdf8", textDecoration: "underline" }}
                  >
                    🔗 View Submitted Proof Link
                  </a>

                  {item.captionText && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "1px 6px",
                        borderRadius: 3,
                        background: "rgba(34, 197, 94, 0.1)",
                        color: "#22c55e",
                        border: "1px solid rgba(34, 197, 94, 0.25)",
                      }}
                    >
                      ✓ FTC #ad Tag Verified
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {isAthlete && item.status !== "accepted" && (
                <button
                  type="button"
                  onClick={() => setActiveItemId(item.id)}
                  className="btn small"
                  style={{ fontSize: 12 }}
                >
                  {item.status === "submitted" ? "Update Proof" : "Submit Proof"}
                </button>
              )}

              {isCounterparty && item.status === "submitted" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleAcceptItem(item.id)}
                    className="btn small"
                    style={{ fontSize: 12, background: "#22c55e", borderColor: "#22c55e" }}
                  >
                    ✓ Accept Proof
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestChanges(item.id)}
                    className="btn ghost small"
                    style={{ fontSize: 12, color: "#f87171" }}
                  >
                    Request Revision
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Deliverable Submission Modal / Drawer for Athlete */}
      {activeItemId && (
        <div
          style={{
            background: "#090d16",
            border: "1px solid #1e293b",
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0, fontSize: 15, color: "var(--text)" }}>
              Submit Proof of Performance
            </h4>
            <button
              type="button"
              onClick={() => setActiveItemId(null)}
              className="btn ghost small"
              style={{ padding: "2px 8px" }}
            >
              ✕ Cancel
            </button>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Proof Type:
              </label>
              <select
                value={proofType}
                onChange={(e) => setProofType(e.target.value as any)}
                style={{ width: "100%", padding: "7px 10px", fontSize: 13 }}
              >
                <option value="social_post_url">Social Media Post URL (Instagram / TikTok)</option>
                <option value="screenshot_image">Media Screenshot / Image Upload</option>
                <option value="attendance_signoff">In-Person Event Attendance Record</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Live Post Link / Proof URL:
              </label>
              <input
                type="url"
                placeholder="https://www.instagram.com/p/..."
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 13 }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Published Caption / Endorsement Text (FTC Scanner):
              </label>
              <textarea
                rows={3}
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: 13 }}
                placeholder="Include your caption text with #ad tag..."
              />
            </div>

            {/* Live FTC Scanner Pre-check Preview */}
            <div
              style={{
                background: currentFtcCheck.verified ? "rgba(34, 197, 94, 0.08)" : "rgba(234, 179, 8, 0.08)",
                border: `1px solid ${currentFtcCheck.verified ? "rgba(34, 197, 94, 0.3)" : "rgba(234, 179, 8, 0.3)"}`,
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{currentFtcCheck.verified ? "✓" : "⚠️"}</span>
              <span style={{ color: currentFtcCheck.verified ? "#4ade80" : "#facc15" }}>
                {currentFtcCheck.summary}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleAthleteSubmitProof(activeItemId)}
              className="btn small"
              style={{ marginTop: 4 }}
            >
              Submit Deliverable Proof for Approval
            </button>
          </div>
        </div>
      )}

      {/* Escrow Financial Reconciliation & Release Box */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 41, 59, 0.4))",
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h4 style={{ margin: "0 0 4px", fontSize: 15, color: "var(--text)" }}>
              Escrow Settlement &amp; Payout Reconciliation
            </h4>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Disbursement Destination: <strong>{releaseSummary.disbursementTarget === "GUARDIAN_CUSTODIAL_UGMA" ? "Parent Custodial Trust (Minor Protected)" : "Athlete Direct Deposit"}</strong>
            </div>
          </div>

          {/* Release Button / Status */}
          <div>
            {isDisbursed ? (
              <span className="badge blue" style={{ fontSize: 13, padding: "6px 12px" }}>
                ✓ Payout Settled &amp; Disbursed
              </span>
            ) : releaseSummary.canReleasePayment && isCounterparty ? (
              <button
                type="button"
                onClick={handleExecuteEscrowRelease}
                className="btn small"
                style={{ background: "#22c55e", borderColor: "#22c55e", fontWeight: 700 }}
              >
                💰 Approve &amp; Release Escrow Payout
              </button>
            ) : (
              <span className="muted" style={{ fontSize: 12 }}>
                {releaseSummary.blockReason}
              </span>
            )}
          </div>
        </div>

        {/* Financial Numbers Strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginTop: 14,
            borderTop: "1px solid var(--line)",
            paddingTop: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Contract Value</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
              ${releaseSummary.grossAmountDollars.toLocaleString()}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Platform Escrow Fee (5%)</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)", marginTop: 2 }}>
              -${releaseSummary.platformFeeDollars.toFixed(2)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Est. 1099 FICA Tax (15.3%)</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#eab308", marginTop: 2 }}>
              ${releaseSummary.estimatedTaxReserveDollars.toFixed(2)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Net Athlete Payout</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e", marginTop: 2 }}>
              ${releaseSummary.netPayeePayoutDollars.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
