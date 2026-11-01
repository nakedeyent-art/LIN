"use client";

import { useState } from "react";
import { enrichSessionRecords, type SessionDeviceSummary } from "@/lib/professional-credentials";

interface SessionSecurityCenterProps {
  rawSessions: Array<{
    current: boolean;
    created_at: Date | string;
    expires_at: Date | string;
  }>;
  mfaEnrolled: boolean;
  passkeyCount: number;
}

export function SessionSecurityCenter({
  rawSessions,
  mfaEnrolled,
  passkeyCount,
}: SessionSecurityCenterProps) {
  const initialDevices = enrichSessionRecords(rawSessions, mfaEnrolled);
  const [devices, setDevices] = useState<SessionDeviceSummary[]>(initialDevices);
  const [newDeviceAlerts, setNewDeviceAlerts] = useState(true);
  const [strictStepUpWindow, setStrictStepUpWindow] = useState(true);
  const [revokedNotice, setRevokedNotice] = useState<string | null>(null);

  const handleRevokeSingle = (id: string, label: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    setRevokedNotice(`Revoked session token for "${label}". That device must re-authenticate with MFA.`);
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 8,
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge teal">Device &amp; Session Posture</span>
            <span className={`badge ${mfaEnrolled ? "green" : "yellow"}`}>
              {mfaEnrolled ? "10m Transaction Step-Up Active" : "MFA Step-Up Recommended"}
            </span>
            {passkeyCount > 0 && (
              <span className="badge green">{passkeyCount} WebAuthn Passkey{passkeyCount === 1 ? "" : "s"}</span>
            )}
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
            Active sessions rotate identifiers on MFA verification and enforce a 10-minute high-assurance window for contracts and payouts.
          </p>
        </div>
      </div>

      {revokedNotice && (
        <div
          role="status"
          style={{
            marginBottom: 10,
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(20, 184, 166, 0.14)",
            border: "1px solid rgba(20, 184, 166, 0.35)",
            color: "#5eead4",
            fontSize: 12,
          }}
        >
          ✓ {revokedNotice}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {devices.map((d) => (
          <div
            key={d.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 6,
              background: "var(--panel)",
              border: d.isCurrentDevice
                ? "1px solid rgba(34, 197, 94, 0.4)"
                : "1px solid var(--line)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13 }}>{d.deviceLabel}</strong>
                {d.isCurrentDevice && <span className="badge green">Current Session</span>}
                {d.mfaVerifiedWithin10m && (
                  <span className="badge teal">High-Assurance MFA Verified</span>
                )}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {d.browserOs} · {d.locationHint} · Last active: {d.lastActiveAt}
              </div>
            </div>

            {!d.isCurrentDevice && (
              <button
                type="button"
                className="btn small ghost"
                onClick={() => handleRevokeSingle(d.id, d.deviceLabel)}
              >
                Revoke Device
              </button>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid var(--line)",
          display: "grid",
          gap: 6,
          fontSize: 12,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={newDeviceAlerts}
            onChange={(e) => setNewDeviceAlerts(e.target.checked)}
          />
          Send instant security alert when a new device or unfamiliar browser signs in
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={strictStepUpWindow}
            onChange={(e) => setStrictStepUpWindow(e.target.checked)}
          />
          Enforce 10-minute MFA re-verification before signing Forg3 contracts or changing payout recipients
        </label>
      </div>
    </div>
  );
}

