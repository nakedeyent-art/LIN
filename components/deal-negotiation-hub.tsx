"use client";

import { useState, useMemo } from "react";
import {
  computeRedlineDiffs,
  computeTermsHash,
  transitionNegotiationStatus,
  validateCounterofferTerms,
  type DealTermVersion,
  type ExclusivityScope,
  type NegotiationStatus,
} from "@/lib/deal-negotiation";

interface DealNegotiationHubProps {
  dealId: string;
  dealTitle: string;
  initialAmountCents: number;
  initialDeliverables: string;
  sponsorName: string;
  athleteName: string;
  isMinor: boolean;
  viewerRole: "athlete" | "guardian" | "counterparty";
  dealStatus: string;
}

const EXCLUSIVITY_LABELS: Record<ExclusivityScope, string> = {
  none: "Non-Exclusive (Open Brand Deals)",
  category_only: "Category-Only Exclusivity",
  full_sector: "Full Sector Exclusivity",
};

const STATUS_BADGE: Record<NegotiationStatus, { label: string; color: string; bg: string }> = {
  initial_offer: { label: "v1.0 Initial Terms Open", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.14)" },
  countered_by_athlete: { label: "Athlete Counteroffer Pending Sponsor", color: "#f97316", bg: "rgba(249, 115, 22, 0.16)" },
  countered_by_sponsor: { label: "Sponsor Counteroffer Pending Athlete", color: "#facc15", bg: "rgba(234, 179, 8, 0.16)" },
  pending_guardian_ratification: { label: "Awaiting Guardian Co-Ratification", color: "#a855f7", bg: "rgba(168, 85, 247, 0.16)" },
  terms_locked: { label: "Immutable Terms Locked for Forg3 Signing", color: "#4ade80", bg: "rgba(34, 197, 94, 0.15)" },
  rejected: { label: "Negotiation Declined", color: "#f87171", bg: "rgba(239, 68, 68, 0.15)" },
};

export function DealNegotiationHub({
  dealId,
  dealTitle,
  initialAmountCents,
  initialDeliverables,
  sponsorName,
  athleteName,
  isMinor,
  viewerRole,
  dealStatus,
}: DealNegotiationHubProps) {
  const initialVersion: DealTermVersion = useMemo(
    () => ({
      versionNumber: 1,
      versionLabel: "v1.0",
      proposedByRole: "sponsor",
      proposedByName: sponsorName,
      createdAt: "Nov 1, 2026 · 09:30 AM",
      amountCents: initialAmountCents,
      deliverablesSummary:
        initialDeliverables || "2 Instagram Reels + 1 TikTok post featuring product with #ad disclosure",
      deliverableCount: 3,
      usageRightsDays: 180,
      exclusivityScope: "category_only",
      includesAcademicSafeHarbor: true,
      notes: "Initial sponsor offer terms issued via NIL Marketplace.",
      termsHash: computeTermsHash({
        dealId,
        versionNumber: 1,
        amountCents: initialAmountCents,
        deliverablesSummary:
          initialDeliverables || "2 Instagram Reels + 1 TikTok post featuring product with #ad disclosure",
        deliverableCount: 3,
        usageRightsDays: 180,
        exclusivityScope: "category_only",
        includesAcademicSafeHarbor: true,
      }),
    }),
    [dealId, initialAmountCents, initialDeliverables, sponsorName]
  );

  const [versions, setVersions] = useState<DealTermVersion[]>([initialVersion]);
  const [status, setStatus] = useState<NegotiationStatus>(
    ["active", "completed"].includes(dealStatus)
      ? "terms_locked"
      : dealStatus === "guardian_review"
      ? "pending_guardian_ratification"
      : "initial_offer"
  );

  const [showCounterForm, setShowCounterForm] = useState(false);
  const latestVersion = versions[versions.length - 1];
  const previousVersion = versions.length > 1 ? versions[versions.length - 2] : initialVersion;

  // Draft counteroffer state
  const [draftDollars, setDraftDollars] = useState<string>(String(Math.round((latestVersion.amountCents / 100) * 1.2)));
  const [draftDeliverableCount, setDraftDeliverableCount] = useState<number>(latestVersion.deliverableCount);
  const [draftUsageDays, setDraftUsageDays] = useState<number>(90);
  const [draftExclusivity, setDraftExclusivity] = useState<ExclusivityScope>(latestVersion.exclusivityScope);
  const [draftSafeHarbor, setDraftSafeHarbor] = useState<boolean>(true);
  const [draftSummary, setDraftSummary] = useState<string>(latestVersion.deliverablesSummary);
  const [draftNotes, setDraftNotes] = useState<string>(
    "Counteroffer adjusting compensation to match verified audience engagement rate and limiting usage window to 90 days."
  );
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const draftAmountCents = Math.round((parseFloat(draftDollars) || 0) * 100);

  const validation = useMemo(
    () =>
      validateCounterofferTerms({
        amountCents: draftAmountCents,
        deliverablesSummary: draftSummary,
        deliverableCount: draftDeliverableCount,
        usageRightsDays: draftUsageDays,
        exclusivityScope: draftExclusivity,
        includesAcademicSafeHarbor: draftSafeHarbor,
        isMinorAthlete: isMinor,
        previousVersion: latestVersion,
      }),
    [
      draftAmountCents,
      draftSummary,
      draftDeliverableCount,
      draftUsageDays,
      draftExclusivity,
      draftSafeHarbor,
      isMinor,
      latestVersion,
    ]
  );

  const redlines = useMemo(
    () => (versions.length > 1 ? computeRedlineDiffs(previousVersion, latestVersion) : []),
    [versions.length, previousVersion, latestVersion]
  );

  const actorRole: "sponsor" | "athlete" | "guardian" =
    viewerRole === "counterparty" ? "sponsor" : viewerRole === "guardian" ? "guardian" : "athlete";

  const handleSubmitCounteroffer = () => {
    if (!validation.valid) return;
    const nextNum = versions.length + 1;
    const label = `v1.${nextNum - 1}`;
    const newVersion: DealTermVersion = {
      versionNumber: nextNum,
      versionLabel: label,
      proposedByRole: actorRole,
      proposedByName:
        actorRole === "sponsor"
          ? sponsorName
          : actorRole === "guardian"
          ? `${athleteName}'s Guardian`
          : athleteName,
      createdAt: "Just now",
      amountCents: draftAmountCents,
      deliverablesSummary: draftSummary.trim(),
      deliverableCount: draftDeliverableCount,
      usageRightsDays: draftUsageDays,
      exclusivityScope: draftExclusivity,
      includesAcademicSafeHarbor: draftSafeHarbor,
      notes: draftNotes.trim() || undefined,
      termsHash: computeTermsHash({
        dealId,
        versionNumber: nextNum,
        amountCents: draftAmountCents,
        deliverablesSummary: draftSummary.trim(),
        deliverableCount: draftDeliverableCount,
        usageRightsDays: draftUsageDays,
        exclusivityScope: draftExclusivity,
        includesAcademicSafeHarbor: draftSafeHarbor,
      }),
    };

    setVersions((prev) => [...prev, newVersion]);
    const nextStat = transitionNegotiationStatus(status, "counter", actorRole, isMinor);
    setStatus(nextStat);
    setShowCounterForm(false);
    setBannerMsg(
      `Published ${label} counteroffer with immutable SHA-256 hash ${newVersion.termsHash.slice(0, 12)}...`
    );
  };

  const handleAcceptTerms = () => {
    const nextStat = transitionNegotiationStatus(status, "accept", actorRole, isMinor);
    setStatus(nextStat);
    if (nextStat === "pending_guardian_ratification") {
      setBannerMsg(
        `Terms (${latestVersion.versionLabel}) accepted by athlete. Routed to parent/guardian for mandatory minor ratification.`
      );
    } else {
      setBannerMsg(
        `Terms (${latestVersion.versionLabel}) mutually locked! Immutable hash ${latestVersion.termsHash.slice(0, 16)}... pinned to Forg3 signing envelope.`
      );
    }
  };

  const handleGuardianRatify = () => {
    const nextStat = transitionNegotiationStatus(status, "guardian_ratify", "guardian", isMinor);
    setStatus(nextStat);
    setBannerMsg(
      `Guardian ratified ${latestVersion.versionLabel} terms for ${athleteName}. Contract is now locked for execution.`
    );
  };

  const badge = STATUS_BADGE[status];

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 18,
        marginTop: 12,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="badge teal">Counteroffer &amp; Terms Versioning</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 99,
                background: badge.bg,
                color: badge.color,
              }}
            >
              {badge.label}
            </span>
            {isMinor && (
              <span className="badge yellow">Minor Guardian Ratification Enforced</span>
            )}
          </div>
          <h4 style={{ margin: "6px 0 2px", fontSize: 16 }}>
            Negotiation Ledger &amp; Immutable Term Sheet ({latestVersion.versionLabel})
          </h4>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Every counteroffer creates an auditable version with a cryptographic SHA-256 digest. Changed terms for under-18 athletes require guardian ratification.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {status !== "terms_locked" && (
            <button
              type="button"
              className="btn small ghost"
              onClick={() => setShowCounterForm((v) => !v)}
            >
              {showCounterForm ? "Close Counteroffer Editor" : "Propose Counteroffer"}
            </button>
          )}
          {status !== "terms_locked" && status !== "pending_guardian_ratification" && (
            <button
              type="button"
              className="btn small"
              onClick={handleAcceptTerms}
            >
              Accept {latestVersion.versionLabel} Terms
            </button>
          )}
          {status === "pending_guardian_ratification" && (
            <button
              type="button"
              className="btn small"
              style={{ background: "#14b8a6", color: "#042f2e", fontWeight: 700 }}
              onClick={handleGuardianRatify}
            >
              Guardian Co-Ratify {latestVersion.versionLabel}
            </button>
          )}
        </div>
      </div>

      {bannerMsg && (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(20, 184, 166, 0.12)",
            border: "1px solid rgba(20, 184, 166, 0.35)",
            color: "#5eead4",
            fontSize: 13,
          }}
        >
          ✓ {bannerMsg}
        </div>
      )}

      {/* Active Version Summary Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        <div style={{ padding: 12, borderRadius: 8, background: "var(--panel)", border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11 }}>Current Proposed Compensation</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            ${(latestVersion.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            {latestVersion.deliverableCount} deliverables · ~${Math.round(latestVersion.amountCents / 100 / Math.max(1, latestVersion.deliverableCount * 2))}/hr est.
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: "var(--panel)", border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11 }}>Exclusivity &amp; Usage Window</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
            {EXCLUSIVITY_LABELS[latestVersion.exclusivityScope]}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            {latestVersion.usageRightsDays}-day brand licensing window
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: "var(--panel)", border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11 }}>Academic &amp; Team Priority</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: latestVersion.includesAcademicSafeHarbor ? "#4ade80" : "#facc15" }}>
            {latestVersion.includesAcademicSafeHarbor ? "Protected (Safe Harbor Active)" : "Standard Commercial Terms"}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            Classes &amp; official games supersede shoots
          </div>
        </div>

        <div style={{ padding: 12, borderRadius: 8, background: "var(--panel)", border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11 }}>Pinned Version Digest (SHA-256)</div>
          <div style={{ fontSize: 12, fontFamily: "monospace", marginTop: 4, color: "var(--text)" }}>
            {latestVersion.termsHash.slice(0, 20)}…
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
            Proposed by {latestVersion.proposedByName}
          </div>
        </div>
      </div>

      {/* Redline Diff View when multiple versions exist */}
      {redlines.length > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 8,
            background: "rgba(249, 115, 22, 0.06)",
            border: "1px solid rgba(249, 115, 22, 0.25)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#fdba74" }}>
            Redline Comparison ({previousVersion.versionLabel} → {latestVersion.versionLabel})
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {redlines.map((diff) => (
              <div
                key={diff.field}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "rgba(0,0,0,0.25)",
                }}
              >
                <div>
                  <strong>{diff.field}:</strong>{" "}
                  <span style={{ textDecoration: "line-through", color: "#f87171", marginRight: 6 }}>
                    {diff.previousValue}
                  </span>
                  <span style={{ color: "#4ade80", fontWeight: 600 }}>→ {diff.proposedValue}</span>
                </div>
                <span className="muted" style={{ fontSize: 11 }}>{diff.deltaSummary}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Counteroffer Builder */}
      {showCounterForm && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 8,
            background: "var(--panel)",
            border: "1px solid var(--line)",
          }}
        >
          <h4 style={{ margin: "0 0 10px", fontSize: 15 }}>
            Draft Counteroffer ({`v1.${versions.length}`}) — {dealTitle}
          </h4>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
              Proposed Compensation ($ USD)
              <input
                type="number"
                min={25}
                step={25}
                value={draftDollars}
                onChange={(e) => setDraftDollars(e.target.value)}
              />
            </label>

            <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
              Deliverable Count
              <input
                type="number"
                min={1}
                max={50}
                value={draftDeliverableCount}
                onChange={(e) => setDraftDeliverableCount(Number(e.target.value) || 1)}
              />
            </label>

            <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
              Usage Licensing Window (Days)
              <select
                value={draftUsageDays}
                onChange={(e) => setDraftUsageDays(Number(e.target.value))}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--bg)",
                  color: "var(--text)",
                  border: "1px solid var(--line)",
                }}
              >
                <option value={30}>30 Days (Campaign Only)</option>
                <option value={90}>90 Days (Single Season)</option>
                <option value={180}>180 Days (Half Year)</option>
                <option value={365}>365 Days (Annual License)</option>
              </select>
            </label>

            <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
              Exclusivity Scope
              <select
                value={draftExclusivity}
                onChange={(e) => setDraftExclusivity(e.target.value as ExclusivityScope)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--bg)",
                  color: "var(--text)",
                  border: "1px solid var(--line)",
                }}
              >
                <option value="none">Non-Exclusive</option>
                <option value="category_only">Category-Only Exclusivity</option>
                <option value="full_sector">Full Sector Exclusivity</option>
              </select>
            </label>
          </div>

          <label style={{ fontSize: 12, display: "grid", gap: 4, marginTop: 12 }}>
            Deliverable Scope &amp; Performance Terms
            <textarea
              rows={2}
              value={draftSummary}
              onChange={(e) => setDraftSummary(e.target.value)}
              style={{
                padding: 8,
                borderRadius: 6,
                background: "var(--bg)",
                color: "var(--text)",
                border: "1px solid var(--line)",
              }}
            />
          </label>

          <label style={{ fontSize: 12, display: "grid", gap: 4, marginTop: 10 }}>
            Negotiation Rationale / Note to Counterparty
            <input
              type="text"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              placeholder="Explain the basis for your counteroffer..."
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={draftSafeHarbor}
              onChange={(e) => setDraftSafeHarbor(e.target.checked)}
            />
            Include Academic &amp; Official Team Conflict Safe Harbor (athlete may reschedule around exams &amp; games without penalty)
          </label>

          {/* Compliance & Guardian Warnings */}
          {validation.violations.length > 0 && (
            <div
              role="alert"
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 6,
                background: "rgba(239, 68, 68, 0.14)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                fontSize: 12,
              }}
            >
              {validation.violations.map((v, i) => (
                <div key={i}>• {v}</div>
              ))}
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 6,
                background: "rgba(234, 179, 8, 0.12)",
                border: "1px solid rgba(234, 179, 8, 0.35)",
                color: "#fde047",
                fontSize: 12,
              }}
            >
              {validation.warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Estimated Hourly Rate:{" "}
              <strong>${(validation.effectiveHourlyRateCents / 100).toFixed(2)}/hr</strong>
              {validation.requiresGuardianRatification && " · Will require Guardian Co-Ratification"}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn small ghost" onClick={() => setShowCounterForm(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn small"
                disabled={!validation.valid}
                onClick={handleSubmitCounteroffer}
              >
                Publish Counteroffer (v1.{versions.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Audit Table */}
      <details style={{ marginTop: 14 }}>
        <summary style={{ fontSize: 12, cursor: "pointer", color: "var(--text-muted)" }}>
          Term Version History ({versions.length} version{versions.length === 1 ? "" : "s"} recorded)
        </summary>
        <table style={{ marginTop: 8, fontSize: 12 }}>
          <thead>
            <tr>
              <th>Version</th>
              <th>Proposed By</th>
              <th>Compensation</th>
              <th>Deliverables / Exclusivity</th>
              <th>SHA-256 Digest</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.versionLabel}>
                <td>
                  <strong>{v.versionLabel}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{v.createdAt}</div>
                </td>
                <td>
                  {v.proposedByName}{" "}
                  <span className="badge gray" style={{ fontSize: 10 }}>{v.proposedByRole}</span>
                </td>
                <td>${(v.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                <td>
                  {v.deliverableCount} items · {v.usageRightsDays}d · {EXCLUSIVITY_LABELS[v.exclusivityScope]}
                  {v.notes && <div className="muted" style={{ fontSize: 11 }}>“{v.notes}”</div>}
                </td>
                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{v.termsHash.slice(0, 14)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

