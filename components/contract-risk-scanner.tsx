"use client";

import { useState } from "react";
import {
  analyzeContractRisk,
  type ContractRiskReport,
} from "@/lib/contract-risk-analyzer";

const SAMPLE_PREDATORY_CONTRACT = `
SPONSORSHIP & ATHLETE ENDORSEMENT AGREEMENT

1. TERM & GRANT OF RIGHTS:
Athlete hereby irrevocably grants to Sponsor the perpetual, worldwide right and license to use, reproduce, broadcast, and exploit Athlete's Name, Image, Likeness, voice, and athletic persona in perpetuity throughout the universe in any and all media now known or hereafter devised.

2. CATEGORY EXCLUSIVITY:
Athlete agrees that Athlete shall not endorse any other commercial brand or enter into any competing athletic sponsorship during the term of this agreement.

3. TERMINATION AT WILL:
Sponsor may terminate this Agreement at any time in its sole discretion without liability, upon which no further compensation shall be due or payable to Athlete.

4. MORAL CONDUCT:
If Athlete engages in any conduct that in the sole opinion of Sponsor brings Sponsor into disrepute or offends public taste, Sponsor may immediately void this agreement and demand clawback of prior compensation.

5. INTELLECTUAL PROPERTY & WORK FOR HIRE:
All content, social reels, training videos, and materials created by Athlete under this agreement shall be considered a work made for hire, and all copyright shall vest exclusively in Sponsor.
`.trim();

const SAMPLE_SAFE_CONTRACT = `
STANDARD BALANCED NIL ENDORSEMENT AGREEMENT

1. LIMITED TERM:
This agreement shall remain effective for six (6) months from the execution date. All rights revert immediately to the Athlete upon expiration.

2. NON-EXCLUSIVE MARKETING LICENSE:
Athlete grants Sponsor a non-exclusive license to repost campaign deliverable assets solely during the 6-month term on Sponsor's official digital channels.

3. DELIVERABLE SCOPE & ESCROW COMPENSATION:
Athlete shall provide two (2) Instagram Reels complying with FTC 16 CFR Part 255 disclosure guidelines. Compensation of $2,000 shall be held in verified escrow and released upon deliverable verification.

4. MUTUAL TERMINATION:
Either party may terminate upon thirty (30) days written notice. In the event Sponsor cancels without breach, a 50% kill fee shall be disbursed to Athlete for reserved dates.

5. ATHLETE IP OWNERSHIP:
Athlete retains full ownership of all underlying intellectual property, copyright, and personal athletic training content.
`.trim();

export function ContractRiskScanner() {
  const [contractText, setContractText] = useState<string>(SAMPLE_PREDATORY_CONTRACT);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [downloadedReport, setDownloadedReport] = useState<boolean>(false);

  const report: ContractRiskReport = analyzeContractRisk(contractText);

  const handleCopyClause = (clause: string, idx: number) => {
    navigator.clipboard.writeText(clause);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleExportReport = () => {
    const lines = [
      `====================================================================`,
      `LIN NIL AI CONTRACT REDLINE & PREDATORY CLAUSE AUDIT REPORT`,
      `Date: ${new Date().toISOString()}`,
      `Risk Tier: ${report.overallRiskTier}`,
      `Predatory Risk Score: ${report.predatoryRiskScore} / 100`,
      `Safe to Sign: ${report.safeToSign ? "YES" : "NO - COUNTER-AMENDMENT REQUIRED"}`,
      `====================================================================`,
      ``,
      `EXECUTIVE SUMMARY:`,
      report.executiveSummary,
      ``,
      `FLAGGED PREDATORY CLAUSES (${report.flaggedClauses.length}):`,
      ...report.flaggedClauses.map(
        (c, i) => `
[#${i + 1}] ${c.title} (${c.severity})
Matched Snippet: ${c.matchedSnippet}
Risk Assessment: ${c.riskExplanation}
Recommended Counter-Clause:
${c.recommendedCounterClause}
--------------------------------------------------------------------`
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Contract_Redline_Report_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadedReport(true);
    setTimeout(() => setDownloadedReport(false), 3000);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🔍</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>AI Contract Risk Analyzer & Predatory Clause Detector</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background:
                  report.overallRiskTier === "CRITICAL_PREDATORY_RISK"
                    ? "rgba(239, 68, 68, 0.12)"
                    : report.overallRiskTier === "MODERATE_CONCERN"
                    ? "rgba(234, 179, 8, 0.12)"
                    : "rgba(34, 197, 94, 0.12)",
                color:
                  report.overallRiskTier === "CRITICAL_PREDATORY_RISK"
                    ? "var(--danger, #ef4444)"
                    : report.overallRiskTier === "MODERATE_CONCERN"
                    ? "#eab308"
                    : "var(--ok, #22c55e)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {report.overallRiskTier.replaceAll("_", " ")} ({report.predatoryRiskScore}/100)
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Automated redlining of perpetual IP traps, unpaid exclusivity, unilateral cancellation, and work-for-hire rights grabs.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn small"
            onClick={handleExportReport}
            style={{ fontSize: 12 }}
          >
            {downloadedReport ? "✓ Report Exported!" : "📥 Export Redline Audit"}
          </button>
        </div>
      </div>

      {/* Preset Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setContractText(SAMPLE_PREDATORY_CONTRACT)}
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 4,
            border: "1px solid rgba(239, 68, 68, 0.4)",
            background: "rgba(239, 68, 68, 0.08)",
            color: "var(--danger, #ef4444)",
            cursor: "pointer",
          }}
        >
          Load Predatory Contract Sample
        </button>
        <button
          type="button"
          onClick={() => setContractText(SAMPLE_SAFE_CONTRACT)}
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 4,
            border: "1px solid rgba(34, 197, 94, 0.4)",
            background: "rgba(34, 197, 94, 0.08)",
            color: "var(--ok, #22c55e)",
            cursor: "pointer",
          }}
        >
          Load Balanced Standard Contract Sample
        </button>
      </div>

      {/* Textarea Input */}
      <label style={{ fontSize: 12, display: "block", marginBottom: 16 }}>
        Contract Agreement Text / Term Sheet
        <textarea
          rows={6}
          value={contractText}
          onChange={(e) => setContractText(e.target.value)}
          placeholder="Paste deal contract clauses or term sheet here..."
          style={{
            width: "100%",
            marginTop: 4,
            padding: "8px 10px",
            fontSize: 12,
            fontFamily: "monospace",
            borderRadius: 6,
          }}
        />
      </label>

      {/* Score and Flagged Clauses */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            padding: 12,
            borderRadius: 6,
            background: report.safeToSign ? "rgba(34, 197, 94, 0.06)" : "rgba(239, 68, 68, 0.06)",
            border: report.safeToSign ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>{report.safeToSign ? "✅" : "🚨"}</span>
            <strong>{report.executiveSummary}</strong>
          </div>
        </div>

        {report.flaggedClauses.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {report.flaggedClauses.map((clause, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background:
                          clause.severity === "CRITICAL"
                            ? "var(--danger, #ef4444)"
                            : clause.severity === "HIGH"
                            ? "#eab308"
                            : "var(--primary)",
                        color: "#fff",
                      }}
                    >
                      {clause.severity}
                    </span>
                    <strong style={{ fontSize: 13 }}>{clause.title}</strong>
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    borderLeft: "3px solid var(--danger, #ef4444)",
                    padding: "6px 10px",
                    fontSize: 11,
                    fontFamily: "monospace",
                    marginBottom: 8,
                    color: "var(--text)",
                  }}
                >
                  {clause.matchedSnippet}
                </div>

                <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted)" }}>
                  {clause.riskExplanation}
                </p>

                <div
                  style={{
                    background: "var(--panel)",
                    border: "1px dashed var(--line)",
                    borderRadius: 6,
                    padding: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ok, #22c55e)" }}>
                      🛡️ Recommended Protective Counter-Clause:
                    </span>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => handleCopyClause(clause.recommendedCounterClause, idx)}
                      style={{ fontSize: 10, padding: "2px 8px" }}
                    >
                      {copiedIndex === idx ? "✓ Copied!" : "📋 Copy Clause"}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--text)" }}>
                    {clause.recommendedCounterClause}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
