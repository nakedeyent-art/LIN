"use client";

import { useState } from "react";
import {
  calculateCollectiveHealth,
  detectPayForPlayRisks,
  generateAuditCertificate,
  type DisbursementGrant,
} from "@/lib/collective-audit";

const SAMPLE_GRANTS: DisbursementGrant[] = [
  {
    id: "cg-1",
    athleteId: "ath-1",
    athleteName: "Marcus Johnson",
    sport: "Basketball",
    grantTitle: "Metro Youth Foundation Annual Keynote & Clinic",
    disbursedAmount: 3000,
    fairMarketValueEstimate: 3000,
    deliverableType: "Community Event Keynote",
    proofUrl: "https://metrofoundation.org/events/2026/marcus-recap",
    proofSubmittedAt: "Jul 10, 2026",
    proofVerified: true,
    nonContingencyAttested: true,
    auditStatus: "compliant",
    riskFlags: [],
  },
  {
    id: "cg-2",
    athleteId: "ath-2",
    athleteName: "Jordan Bell",
    sport: "Basketball",
    grantTitle: "State Children's Hospital PSA Video Series",
    disbursedAmount: 2500,
    fairMarketValueEstimate: 2500,
    deliverableType: "Public Service Announcement (Video)",
    proofUrl: "https://vimeo.com/statehospital/jordan-psa",
    proofSubmittedAt: "Jul 14, 2026",
    proofVerified: true,
    nonContingencyAttested: true,
    auditStatus: "compliant",
    riskFlags: [],
  },
  {
    id: "cg-3",
    athleteId: "ath-3",
    athleteName: "Tyrese Maxey",
    sport: "Football",
    grantTitle: "Boys & Girls Club Skills Day",
    disbursedAmount: 2000,
    fairMarketValueEstimate: 2000,
    deliverableType: "Youth Clinic Coaching",
    proofUrl: undefined,
    proofSubmittedAt: undefined,
    proofVerified: false,
    nonContingencyAttested: true,
    auditStatus: "action_required",
    riskFlags: [
      {
        code: "MISSING_PROOF_DOCUMENTATION",
        level: "medium",
        message: "No verified deliverable proof (URL/photo/sign-in) submitted to validate genuine NIL activity.",
      },
    ],
  },
  {
    id: "cg-4",
    athleteId: "ath-4",
    athleteName: "Cam Whitmore",
    sport: "Track",
    grantTitle: "Charity 5K Race Starter & Media Advocate",
    disbursedAmount: 1800,
    fairMarketValueEstimate: 1800,
    deliverableType: "Charity Appearance (In-Person)",
    proofUrl: "https://city5k.org/ambassadors/cam-whitmore",
    proofSubmittedAt: "Jun 28, 2026",
    proofVerified: true,
    nonContingencyAttested: true,
    auditStatus: "compliant",
    riskFlags: [],
  },
  {
    id: "cg-5",
    athleteId: "ath-5",
    athleteName: "Jalen Green",
    sport: "Basketball",
    grantTitle: "Exclusive signed memorabilia pack (50 jerseys)",
    disbursedAmount: 4500,
    fairMarketValueEstimate: 4500,
    deliverableType: "Signed Memorabilia & Autograph Session",
    proofUrl: "https://collective.org/inventory/jersey-batch-884",
    proofSubmittedAt: "Jul 02, 2026",
    proofVerified: true,
    nonContingencyAttested: true,
    auditStatus: "compliant",
    riskFlags: [],
  },
];

export function CollectiveAuditSuite({
  initialGrants,
  collectiveName = "Champions Student-Athlete Collective",
}: {
  initialGrants?: DisbursementGrant[];
  collectiveName?: string;
}) {
  const hasLive = Boolean(initialGrants && initialGrants.length > 0);
  const [mode, setMode] = useState<"live" | "demo">(hasLive ? "live" : "live");
  const [grants, setGrants] = useState<DisbursementGrant[]>(() =>
    hasLive ? initialGrants! : []
  );
  const [filter, setFilter] = useState<"all" | "compliant" | "action_required" | "flagged">("all");
  const [copiedCert, setCopiedCert] = useState<boolean>(false);

  const activeGrants = mode === "demo" ? SAMPLE_GRANTS : grants;
  const health = calculateCollectiveHealth(activeGrants);

  const filteredGrants = activeGrants.filter((g) => {
    if (filter === "all") return true;
    return g.auditStatus === filter;
  });

  const handleApproveProof = (grantId: string) => {
    if (mode === "demo") return;
    setGrants((prev) =>
      prev.map((g) =>
        g.id === grantId
          ? {
              ...g,
              proofVerified: true,
              proofUrl: g.proofUrl ?? `/dashboard/deals/${g.id}`,
              auditStatus: "compliant",
              riskFlags: [],
            }
          : g
      )
    );
  };

  const handleExportCertificate = () => {
    const rawCert = generateAuditCertificate(
      mode === "demo" ? `${collectiveName} (PREVIEW DEMO)` : collectiveName,
      health
    );
    const cert =
      mode === "demo"
        ? `[DEMO SANDBOX PREVIEW - NOT VALID COMPLIANCE PROOF]\n\n${rawCert}`
        : rawCert;
    navigator.clipboard.writeText(cert);
    setCopiedCert(true);
    setTimeout(() => setCopiedCert(false), 2500);
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 20,
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏛️</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{collectiveName}</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background:
                  health.auditReadiness === "NCAA Audit-Ready"
                    ? "rgba(34, 197, 94, 0.12)"
                    : "rgba(249, 115, 22, 0.12)",
                color: health.auditReadiness === "NCAA Audit-Ready" ? "var(--ok)" : "var(--needs)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid var(--line)",
              }}
            >
              {health.auditReadiness}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            NCAA & State Compliance Radar: Genuine Deliverables, Fair Market Value (FMV), and Pay-for-Play Preventions.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className={`btn small ${mode === "demo" ? "" : "ghost"}`}
            onClick={() => setMode((m) => (m === "live" ? "demo" : "live"))}
            style={{ fontSize: 12 }}
          >
            {mode === "demo" ? "← Back to Live Grants" : "Sandbox Simulation"}
          </button>
          <button
            type="button"
            onClick={handleExportCertificate}
            className="btn small"
          >
            {copiedCert ? "✓ Certificate Copied!" : "📜 Export NCAA Audit Certificate"}
          </button>
        </div>
      </div>

      {mode === "demo" && (
        <div
          style={{
            background: "rgba(234, 179, 8, 0.12)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            borderRadius: 6,
            padding: "8px 12px",
            marginBottom: 16,
            fontSize: 12,
            color: "var(--text)",
          }}
        >
          <strong>⚠️ Sandbox Simulation (Sample Data):</strong> Displaying mock collective disbursements to demonstrate NCAA pay-for-play rule screenings, FMV threshold triggers, and proof verification gates.
        </div>
      )}

      {mode === "live" && grants.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "36px 16px",
            background: "var(--panel-2)",
            borderRadius: 8,
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ fontSize: 32 }}>🏛️</span>
          <h3 style={{ margin: "10px 0 6px", fontSize: 16 }}>No Collective Disbursements On File</h3>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
            Active NIL agreements and submitted deliverable proof documents will automatically appear here for institutional audit certification.
          </p>
          <button
            type="button"
            className="btn small ghost"
            onClick={() => setMode("demo")}
          >
            Explore Sandbox Simulation (Demo Grants) →
          </button>
        </div>
      )}

      {!(mode === "live" && grants.length === 0) && (
        <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Total Disbursed</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--primary)" }}>
            ${health.totalCapitalDisbursed.toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>Across {health.totalGrantsCount} athlete grants</div>
        </div>

        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Compliance Health</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--ok)" }}>
            {health.complianceScorePercent}%
          </div>
          <div className="muted" style={{ fontSize: 11 }}>{health.compliantCount} of {health.totalGrantsCount} verified clean</div>
        </div>

        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Pending Proof</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--mono)", color: health.actionRequiredCount > 0 ? "var(--needs)" : "var(--muted)" }}>
            {health.actionRequiredCount}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>Deliverables missing photo/link</div>
        </div>

        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Pay-For-Play Risks</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--mono)", color: health.flaggedCount > 0 ? "red" : "var(--ok)" }}>
            {health.flaggedCount}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>Strict amateurism protection</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`btn small ${filter === "all" ? "" : "ghost"}`}
          style={{ fontSize: 11, padding: "3px 8px" }}
        >
          All Grants ({grants.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("compliant")}
          className={`btn small ${filter === "compliant" ? "" : "ghost"}`}
          style={{ fontSize: 11, padding: "3px 8px" }}
        >
          Verified Compliant ({health.compliantCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("action_required")}
          className={`btn small ${filter === "action_required" ? "" : "ghost"}`}
          style={{ fontSize: 11, padding: "3px 8px" }}
        >
          Action Required ({health.actionRequiredCount})
        </button>
      </div>

      {/* Audit Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
              <th style={{ padding: "8px 6px" }}>Athlete & Grant</th>
              <th style={{ padding: "8px 6px" }}>Deliverable Type</th>
              <th style={{ padding: "8px 6px" }}>Disbursement / FMV</th>
              <th style={{ padding: "8px 6px" }}>Proof Documentation</th>
              <th style={{ padding: "8px 6px" }}>Attestation</th>
              <th style={{ padding: "8px 6px" }}>Audit Status</th>
              <th style={{ padding: "8px 6px" }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredGrants.map((g) => (
              <tr key={g.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: "10px 6px" }}>
                  <div style={{ fontWeight: 700 }}>{g.athleteName}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{g.grantTitle}</div>
                </td>
                <td style={{ padding: "10px 6px" }}>
                  <span style={{ fontSize: 12 }}>{g.deliverableType}</span>
                </td>
                <td style={{ padding: "10px 6px", fontFamily: "var(--mono)" }}>
                  <div style={{ fontWeight: 700 }}>${g.disbursedAmount}</div>
                  <div className="muted" style={{ fontSize: 10 }}>FMV: ${g.fairMarketValueEstimate}</div>
                </td>
                <td style={{ padding: "10px 6px" }}>
                  {g.proofVerified && g.proofUrl ? (
                    <a
                      href={g.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="record-link"
                      style={{ fontSize: 11 }}
                    >
                      View Verified Proof ↗
                    </a>
                  ) : (
                    <span style={{ color: "var(--needs)", fontSize: 11, fontWeight: 700 }}>
                      ⚠️ Proof Pending
                    </span>
                  )}
                </td>
                <td style={{ padding: "10px 6px" }}>
                  {g.nonContingencyAttested ? (
                    <span style={{ color: "var(--ok)", fontSize: 11, fontWeight: 700 }}>
                      Signed ✓
                    </span>
                  ) : (
                    <span style={{ color: "var(--needs)", fontSize: 11 }}>Missing</span>
                  )}
                </td>
                <td style={{ padding: "10px 6px" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background:
                        g.auditStatus === "compliant"
                          ? "rgba(34, 197, 94, 0.12)"
                          : "rgba(249, 115, 22, 0.12)",
                      color: g.auditStatus === "compliant" ? "var(--ok)" : "var(--needs)",
                    }}
                  >
                    {g.auditStatus.replace("_", " ")}
                  </span>
                </td>
                <td style={{ padding: "10px 6px", textAlign: "right" }}>
                  {g.auditStatus !== "compliant" && (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => handleApproveProof(g.id)}
                      style={{ fontSize: 11, padding: "3px 8px" }}
                    >
                      Verify Proof ✓
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}
