"use client";

import { useState } from "react";
import {
  buildMinimumContextCaseView,
  SAMPLE_SCOPED_CASES,
  validateAppealAdjudication,
  type ModeratorScope,
  type ScopedModerationCase,
} from "@/lib/scoped-moderation";
import { REASON_LABEL } from "@/lib/reports";

export function ScopedModerationCenter() {
  const [viewerScope, setViewerScope] = useState<ModeratorScope>("minor_protection_specialist");
  const [cases, setCases] = useState<ScopedModerationCase[]>(SAMPLE_SCOPED_CASES);
  const [appealRationale, setAppealRationale] = useState<string>(
    "Secondary review confirmed no external payment solicitation occurred; restoring post with warning note."
  );
  const [banner, setBanner] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdjudicateAppeal = (
    caseId: string,
    decision: "upheld_by_second_reviewer" | "overturned_restored"
  ) => {
    setErrorMsg(null);
    const target = cases.find((c) => c.id === caseId);
    if (!target) return;

    const check = validateAppealAdjudication({
      caseItem: target,
      reviewerModeratorId: "mod-secondary-independent",
      reviewerScope: viewerScope,
      decision,
      rationale: appealRationale,
    });

    if (!check.allowed) {
      setErrorMsg(check.error ?? "Appeal adjudication not permitted.");
      return;
    }

    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              appealStatus: decision,
              appealReviewerId: "mod-secondary-independent",
            }
          : c
      )
    );
    setBanner(
      `Appeal for ${caseId} adjudicated (${
        decision === "overturned_restored" ? "Overturned & Restored" : "Sanction Upheld"
      }) under independent dual-control audit.`
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
            <span className="badge teal">Minimum-Context Trust &amp; Safety</span>
            <span className="badge green">PII &amp; Financial Redaction Active</span>
          </div>
          <h3 style={{ margin: "6px 0 2px", fontSize: 18 }}>
            Scoped Moderation Queue &amp; Dual-Control Appeals
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Moderators inspect only redacted snippets without access to private tax, bank, or academic records. Appeals require an independent second reviewer.
          </p>
        </div>

        <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
          Active Moderator Scope Simulation
          <select
            value={viewerScope}
            onChange={(e) => setViewerScope(e.target.value as ModeratorScope)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              background: "var(--bg)",
              color: "var(--text)",
              border: "1px solid var(--line)",
              fontSize: 12,
            }}
          >
            <option value="trust_safety_reviewer">Routine Trust &amp; Safety Reviewer (Scoped)</option>
            <option value="minor_protection_specialist">Minor Protection Specialist</option>
            <option value="full_admin">Full Oversight Admin</option>
          </select>
        </label>
      </div>

      {banner && (
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
          ✓ {banner}
        </div>
      )}

      {errorMsg && (
        <p role="alert" className="error" style={{ marginBottom: 12, fontSize: 12 }}>
          {errorMsg}
        </p>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {cases.map((c) => {
          const view = buildMinimumContextCaseView(c, viewerScope);
          return (
            <div
              key={c.id}
              style={{
                padding: 14,
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border:
                  view.slaTier === "P0_CRITICAL_15M"
                    ? "1px solid rgba(239, 68, 68, 0.45)"
                    : "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span
                    className={`badge ${
                      view.slaTier === "P0_CRITICAL_15M" ? "red" : "yellow"
                    }`}
                  >
                    {view.slaTier}
                  </span>
                  <strong>{c.id}</strong>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {REASON_LABEL[c.reason]} · Reported by {c.reporterDisplay}
                  </span>
                </div>
                <span className="badge gray" style={{ fontSize: 11 }}>
                  {view.piiTokensRedacted} PII token{view.piiTokensRedacted === 1 ? "" : "s"} auto-masked
                </span>
              </div>

              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "rgba(0,0,0,0.3)",
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              >
                “{view.redactedSnippet}”
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 10,
                  fontSize: 12,
                }}
              >
                <div className="muted">
                  Suspension Authority:{" "}
                  <strong style={{ color: view.canExecuteSuspension ? "#4ade80" : "#facc15" }}>
                    {view.canExecuteSuspension ? "Permitted in Current Scope" : "Escalation Required"}
                  </strong>
                  {view.requiresMinorSpecialistEscalation &&
                    " · Auto-escalated to Minor Protection Specialist"}
                </div>

                {c.appealStatus === "appeal_submitted" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      value={appealRationale}
                      onChange={(e) => setAppealRationale(e.target.value)}
                      placeholder="Audit rationale for appeal..."
                      style={{ fontSize: 12, minWidth: 240 }}
                    />
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() => handleAdjudicateAppeal(c.id, "upheld_by_second_reviewer")}
                    >
                      Uphold Sanction
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => handleAdjudicateAppeal(c.id, "overturned_restored")}
                    >
                      Overturn &amp; Restore
                    </button>
                  </div>
                )}

                {c.appealStatus !== "none" && c.appealStatus !== "appeal_submitted" && (
                  <span className="badge green">
                    Appeal Resolved: {c.appealStatus.replaceAll("_", " ")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

