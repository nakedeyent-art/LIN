"use client";

import { useState } from "react";
import {
  evaluateRosterReadiness,
  SAMPLE_EVENT_ROSTER,
  type EventAttendeeRosterItem,
} from "@/lib/event-roster-consent";

interface MultiAthleteRosterProps {
  eventName?: string;
  venueTimezone?: string;
  userRole?: string;
}

export function MultiAthleteRosterCenter({
  eventName = "National Prep Showcase & Tournament",
  venueTimezone = "America/New_York (EST)",
}: MultiAthleteRosterProps) {
  const [roster, setRoster] = useState<EventAttendeeRosterItem[]>(SAMPLE_EVENT_ROSTER);
  const [notice, setNotice] = useState<string | null>(null);

  const audit = evaluateRosterReadiness(roster);

  const handleGrantConsent = (athleteId: string, athleteName: string) => {
    setRoster((prev) =>
      prev.map((a) =>
        a.athleteId === athleteId
          ? {
              ...a,
              consentStatus: "granted",
              consentGrantedAt: "Just now (Digital Verification)",
              travelConflictWarning: undefined,
            }
          : a
      )
    );
    setNotice(`Verified electronic travel consent for ${athleteName}. Clearance status updated.`);
  };

  const handleSendReminder = (athleteName: string) => {
    setNotice(`Automated guardian travel consent reminder queued for ${athleteName}.`);
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
            <span className="badge teal">Multi-Athlete Travel Roster</span>
            <span className={`badge ${audit.readyForDeparture ? "green" : "yellow"}`}>
              {audit.readinessRatePercent}% Departure Ready
            </span>
            <span className="badge gray">Venue TZ: {venueTimezone}</span>
          </div>
          <h3 style={{ margin: "6px 0 2px", fontSize: 18 }}>
            Team Roster Attendance &amp; Guardian Travel Consent Hub
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Event: <strong>{eventName}</strong> · Organizers manage the event while families retain consent authority over their own athlete.
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {audit.totalAthletes} Athletes ({audit.minorCount} Minors)
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {audit.pendingConsentCount} Pending Consents · {audit.unresolvedConflicts} Warnings
          </div>
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
        {roster.map((ath) => (
          <div
            key={ath.athleteId}
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: ath.travelConflictWarning
                ? "1px solid rgba(249, 115, 22, 0.4)"
                : ath.consentStatus === "pending"
                ? "1px solid rgba(234, 179, 8, 0.35)"
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
                <strong style={{ fontSize: 14 }}>{ath.athleteName}</strong>
                <span className="badge gray" style={{ fontSize: 11 }}>
                  {ath.sport} · {ath.position ?? "General"}
                </span>
                <span
                  className={`badge ${
                    ath.consentStatus === "granted"
                      ? "green"
                      : ath.consentStatus === "not_required_adult"
                      ? "teal"
                      : "yellow"
                  }`}
                  style={{ fontSize: 11 }}
                >
                  {ath.consentStatus === "granted"
                    ? "✓ Guardian Consent Granted"
                    : ath.consentStatus === "not_required_adult"
                    ? "Adult (Self-Authorized)"
                    : "⏳ Consent Pending"}
                </span>
              </div>

              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Emergency Contact: <strong>{ath.emergencyContactName ?? "N/A"}</strong> ({ath.emergencyContactPhone ?? "On File"}) · Medical Clearance:{" "}
                <span style={{ color: ath.hasMedicalClearance ? "#4ade80" : "#f87171" }}>
                  {ath.hasMedicalClearance ? "Active" : "Pending Form"}
                </span>
                {ath.consentGrantedAt && ` · Consented: ${ath.consentGrantedAt}`}
              </div>

              {ath.travelConflictWarning && (
                <div style={{ fontSize: 12, color: "#fde047", marginTop: 4 }}>
                  ⚠ Turnaround Alert: {ath.travelConflictWarning}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {ath.consentStatus === "pending" && (
                <>
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => handleSendReminder(ath.athleteName)}
                  >
                    Resend Notice
                  </button>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => handleGrantConsent(ath.athleteId, ath.athleteName)}
                  >
                    Authorize Consent
                  </button>
                </>
              )}
              {ath.consentStatus === "granted" && (
                <span className="badge green">Departure Cleared</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

