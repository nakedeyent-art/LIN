"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SAMPLE_SAVED_FILTERS,
  type DigestCadence,
  type SavedDiscoveryFilter,
} from "@/lib/notification-digest";

export function NotificationDigestCenter() {
  const [cadence, setCadence] = useState<DigestCadence>("daily_morning_7am");
  const [quietHours, setQuietHours] = useState(true);
  const [filters, setFilters] = useState<SavedDiscoveryFilter[]>(SAMPLE_SAVED_FILTERS);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const toggleFilterAlert = (id: string) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, alertOnNewMatches: !f.alertOnNewMatches } : f))
    );
    setSavedBanner("Updated saved discovery filter alert preference.");
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
            <span className="badge teal">Digest &amp; Discovery Automation</span>
            <span className="badge green">Zero-PII Outbox Enforced</span>
          </div>
          <h3 style={{ margin: "6px 0 2px", fontSize: 18 }}>
            Notification Digest Cadence &amp; Saved Discovery Filters
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Control delivery windows and saved marketplace/recruiting filters while keeping minors&apos; discovery protections and zero-amount email previews intact.
          </p>
        </div>

        <label style={{ fontSize: 12, display: "grid", gap: 4 }}>
          Digest Delivery Schedule
          <select
            value={cadence}
            onChange={(e) => {
              setCadence(e.target.value as DigestCadence);
              setSavedBanner("Saved notification digest delivery schedule.");
            }}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              background: "var(--bg)",
              color: "var(--text)",
              border: "1px solid var(--line)",
              fontSize: 12,
            }}
          >
            <option value="instant">Instant Real-Time Delivery</option>
            <option value="daily_morning_7am">Daily Morning Digest (7:00 AM Local)</option>
            <option value="weekly_sunday_rollup">Weekly Sunday Executive Rollup</option>
          </select>
        </label>
      </div>

      {savedBanner && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(20, 184, 166, 0.14)",
            border: "1px solid rgba(20, 184, 166, 0.35)",
            color: "#5eead4",
            fontSize: 12,
          }}
        >
          ✓ {savedBanner}
        </div>
      )}

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          marginBottom: 14,
        }}
      >
        <input
          type="checkbox"
          checked={quietHours}
          onChange={(e) => {
            setQuietHours(e.target.checked);
            setSavedBanner("Updated Student-Athlete School-Night Quiet Hours setting.");
          }}
        />
        Enforce Student-Athlete School-Night Quiet Hours (10:00 PM – 7:00 AM local: hold commercial &amp; recruiting pings for morning digest; urgent MFA/signing notices always deliver)
      </label>

      <div style={{ display: "grid", gap: 8 }}>
        {filters.map((f) => (
          <div
            key={f.id}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{f.label}</strong>
                {f.respectsMinorPrivacyGate && (
                  <span className="badge green" style={{ fontSize: 10 }}>
                    Minor Privacy Gate Active
                  </span>
                )}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {f.criteriaSummary}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className={`btn small ${f.alertOnNewMatches ? "" : "ghost"}`}
                onClick={() => toggleFilterAlert(f.id)}
              >
                {f.alertOnNewMatches ? "Alerts On" : "Alerts Muted"}
              </button>
              <Link href={f.targetRoute} className="btn small ghost">
                Open View →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
