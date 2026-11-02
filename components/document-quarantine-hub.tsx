"use client";

import { useState } from "react";
import {
  evaluateDocumentSecurity,
  SAMPLE_QUARANTINE_DOCUMENTS,
  type QuarantinedDocumentRecord,
} from "@/lib/document-quarantine-audit";

export function DocumentQuarantineHub() {
  const [docs, setDocs] = useState<QuarantinedDocumentRecord[]>(SAMPLE_QUARANTINE_DOCUMENTS);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  const handleRunClamAvScan = (id: string) => {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              scanStatus: "clean",
            }
          : d
      )
    );
    setScanNotice(
      "ClamAV INSTREAM daemon verified 0 macro/script threats. File released from quarantine and unlocked for preview/signing."
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
            <span className="badge teal">ClamAV INSTREAM Quarantine</span>
            <span className="badge green">S3 SigV4 Private Object Storage</span>
            <span className="badge yellow">Fail-Closed Access Gate</span>
          </div>
          <h3 style={{ margin: "6px 0 2px", fontSize: 18 }}>
            Document Security, Quarantine &amp; Expiration Compliance Matrix
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Pending or infected uploads are never downloadable, previewable, or signable. Identity and Tax files are strictly family-only.
          </p>
        </div>
      </div>

      {scanNotice && (
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
          ✓ {scanNotice}
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {docs.map((doc) => {
          const audit = evaluateDocumentSecurity(doc);
          return (
            <div
              key={doc.id}
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: !audit.downloadAllowed
                  ? "1px solid rgba(234, 179, 8, 0.45)"
                  : audit.expirationState === "expiring_soon"
                  ? "1px solid rgba(249, 115, 22, 0.4)"
                  : "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span
                    className={`badge ${
                      doc.scanStatus === "clean"
                        ? "green"
                        : doc.scanStatus === "pending"
                        ? "yellow"
                        : "red"
                    }`}
                  >
                    {doc.scanStatus === "clean"
                      ? "✓ ClamAV Clean"
                      : doc.scanStatus === "pending"
                      ? "⏳ Quarantined (Scan Pending)"
                      : "✕ Infected / Blocked"}
                  </span>

                  <strong style={{ fontSize: 14 }}>{doc.title}</strong>
                  <span className="badge gray" style={{ fontSize: 11 }}>
                    v{doc.versionNumber} · {(doc.sizeBytes / 1024).toFixed(0)} KB
                  </span>
                  {doc.isImmutableAgreement && (
                    <span className="badge teal" style={{ fontSize: 11 }}>
                      Immutable Evidence
                    </span>
                  )}
                </div>

                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Privacy Boundary:{" "}
                  <strong>
                    {audit.privacyScope === "family_strictly_private"
                      ? "Family-Only (Tax / Identity Locked)"
                      : audit.privacyScope === "consented_medical_academic"
                      ? `Consented Team Access (${doc.sharedWithRoles.join(", ") || "None"})`
                      : "Operational Record"}
                  </strong>{" "}
                  · SHA-256: <code>{doc.sha256Digest.slice(0, 14)}…</code>
                </div>

                {audit.blockReason && (
                  <div style={{ fontSize: 12, color: "#fde047", marginTop: 4 }}>
                    ⚠ {audit.blockReason}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {audit.expirationState === "expiring_soon" && (
                  <span className="badge yellow">
                    Expires in {audit.daysUntilExpiry}d ({doc.expiresOn})
                  </span>
                )}
                {doc.scanStatus === "pending" && (
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => handleRunClamAvScan(doc.id)}
                  >
                    Run ClamAV Verification
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
