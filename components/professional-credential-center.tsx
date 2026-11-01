"use client";

import { useState } from "react";
import {
  CREDENTIAL_TYPE_LABELS,
  evaluateProfessionalCredential,
  SAMPLE_TEAM_CREDENTIALS,
  validateLicenseFormat,
  type CredentialType,
  type ProfessionalCredentialRecord,
} from "@/lib/professional-credentials";

interface ProfessionalCredentialCenterProps {
  viewerRole: string;
  viewerName: string;
}

export function ProfessionalCredentialCenter({
  viewerRole,
  viewerName,
}: ProfessionalCredentialCenterProps) {
  const [credentials, setCredentials] = useState<ProfessionalCredentialRecord[]>(
    SAMPLE_TEAM_CREDENTIALS
  );
  const [showAddForm, setShowAddForm] = useState(false);

  const [credType, setCredType] = useState<CredentialType>("UAAA_STATE_AGENT");
  const [stateCode, setStateCode] = useState("FL");
  const [licenseNumber, setLicenseNumber] = useState("UAAA-FL-904112");
  const [authority, setAuthority] = useState("State Department of Business & Professional Regulation");
  const [expiresAt, setExpiresAt] = useState("2028-06-30");
  const [suretyBond, setSuretyBond] = useState("100000");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSubmitCredential = () => {
    setErrorMsg(null);
    const check = validateLicenseFormat(credType, licenseNumber);
    if (!check.valid) {
      setErrorMsg(check.reason ?? "Invalid license format.");
      return;
    }

    const holderRole: "manager" | "trainer" | "coach" =
      viewerRole === "trainer" ? "trainer" : viewerRole === "coach" ? "coach" : "manager";

    const newCred: ProfessionalCredentialRecord = {
      id: `cred-${Date.now()}`,
      holderName: viewerName,
      holderRole,
      credentialType: credType,
      issuingAuthority: authority.trim() || "State Licensing Board",
      stateJurisdiction: stateCode.trim().toUpperCase() || "National",
      licenseNumber: licenseNumber.trim().toUpperCase(),
      issuedAt: new Date().toISOString().slice(0, 10),
      expiresAt,
      status: "pending_review",
      suretyBondDollars: Number(suretyBond) || 0,
    };

    setCredentials((prev) => [newCred, ...prev]);
    setShowAddForm(false);
    setStatusMsg(
      `Submitted ${newCred.licenseNumber} for compliance verification. Until verified by LIN Compliance, it is labeled "Evidence Under Compliance Review".`
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
            <span className="badge teal">UAAA &amp; Professional Registry</span>
            <span className="badge green">
              {credentials.filter((c) => c.status === "verified").length} Verified
            </span>
            <span className="badge yellow">
              {credentials.filter((c) => c.status !== "verified").length} Self-Declared / Pending
            </span>
          </div>
          <h3 style={{ margin: "6px 0 2px", fontSize: 18 }}>
            Verified Professional Status &amp; Agent/Trainer Credentials
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Distinguishes independently verified state athlete-agent registrations (UAAA), surety bonds, and NSCA/CSCS certifications from self-declared claims.
          </p>
        </div>

        <button
          type="button"
          className="btn small ghost"
          onClick={() => setShowAddForm((v) => !v)}
        >
          {showAddForm ? "Close Credential Form" : "+ Submit Credential for Verification"}
        </button>
      </div>

      {statusMsg && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(20, 184, 166, 0.12)",
            border: "1px solid rgba(20, 184, 166, 0.35)",
            color: "#5eead4",
            fontSize: 13,
          }}
        >
          ✓ {statusMsg}
        </div>
      )}

      {showAddForm && (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--line)",
          }}
        >
          <h4 style={{ margin: "0 0 10px", fontSize: 15 }}>
            Submit Professional License or Certification Evidence
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
              Credential Category
              <select
                value={credType}
                onChange={(e) => setCredType(e.target.value as CredentialType)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "var(--bg)",
                  color: "var(--text)",
                  border: "1px solid var(--line)",
                }}
              >
                {(Object.keys(CREDENTIAL_TYPE_LABELS) as CredentialType[]).map((k) => (
                  <option key={k} value={k}>
                    {CREDENTIAL_TYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
              License / Registration Number
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="e.g., UAAA-FL-904112"
              />
            </label>

            <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
              Jurisdiction / State
              <input
                type="text"
                maxLength={12}
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                placeholder="FL, TX, National..."
              />
            </label>

            <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
              Expiration Date
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>

            <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
              Issuing Authority
              <input
                type="text"
                value={authority}
                onChange={(e) => setAuthority(e.target.value)}
              />
            </label>

            {credType === "UAAA_STATE_AGENT" && (
              <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
                Active Surety Bond ($ USD)
                <input
                  type="number"
                  step={10000}
                  value={suretyBond}
                  onChange={(e) => setSuretyBond(e.target.value)}
                />
              </label>
            )}
          </div>

          {errorMsg && (
            <p role="alert" className="error" style={{ marginTop: 10, fontSize: 12 }}>
              {errorMsg}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button type="button" className="btn small ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="button" className="btn small" onClick={handleSubmitCredential}>
              Submit for Registry Review
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {credentials.map((c) => {
          const audit = evaluateProfessionalCredential(c);
          const isVerified = audit.effectiveStatus === "verified";
          return (
            <div
              key={c.id}
              style={{
                padding: "14px 16px",
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.02)",
                border: isVerified
                  ? "1px solid rgba(34, 197, 94, 0.35)"
                  : "1px solid rgba(234, 179, 8, 0.35)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span
                    className={`badge ${
                      isVerified
                        ? "green"
                        : audit.effectiveStatus === "expired" || audit.effectiveStatus === "revoked"
                        ? "red"
                        : "yellow"
                    }`}
                  >
                    {isVerified ? "✓ " : "⚠ "}
                    {audit.trustBadgeLabel}
                  </span>
                  <strong style={{ fontSize: 14 }}>{c.holderName}</strong>
                  <span className="badge gray" style={{ fontSize: 11 }}>
                    {c.holderRole.toUpperCase()}
                  </span>
                </div>

                <div style={{ fontSize: 13, marginTop: 4, color: "var(--text)" }}>
                  {CREDENTIAL_TYPE_LABELS[c.credentialType]} ·{" "}
                  <code style={{ fontSize: 12 }}>{c.licenseNumber}</code> ({c.stateJurisdiction})
                </div>

                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Issued by {c.issuingAuthority} · Expires {c.expiresAt}
                  {c.suretyBondDollars
                    ? ` · $${c.suretyBondDollars.toLocaleString()} Surety Bond Verified`
                    : ""}
                </div>

                {audit.warnings.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#fde047" }}>
                    {audit.warnings.map((w, i) => (
                      <div key={i}>• {w}</div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ textAlign: "right", minWidth: 165 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: audit.eligibleForMinorRepresentation ? "#4ade80" : "#facc15",
                  }}
                >
                  {audit.eligibleForMinorRepresentation
                    ? "Cleared for Minor NIL Advisory"
                    : "Restricted: Adult / Non-Fiduciary Only"}
                </div>
                {c.verifiedByAdminAt && (
                  <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                    Audited {c.verifiedByAdminAt}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

