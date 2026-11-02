"use client";

import { useState } from "react";
import {
  generateExportManifest,
  type DataExportCategory,
} from "@/lib/data-export-audit";

interface DataPrivacyCenterProps {
  userRole: string;
}

const CATEGORY_LABELS: Record<DataExportCategory, string> = {
  account_identity: "Account Identity & Profile Credentials",
  athlete_profile_athletics: "Athletics, Measurables & Brand Card",
  academic_and_grades: "Academics, Study Hall & GPA Records",
  nutrition_and_fitness: "Nutrition Plans, Meals & Workouts",
  deals_and_contracts: "NIL Deals, Terms Versions & Escrow Ledger",
  team_and_family_sharing: "Team Roster & Guardian Authority Grants",
  documents_and_forg3_signing: "Document Center & Forg3 Signatures",
  sports_travel_and_events: "Schedules, Tournaments & Travel Routes",
  scouting_and_recruiting: "Scouting Reports & Recruiter Interactions",
  communications_and_social: "Direct Messages Written & Feed Posts",
  security_mfa_and_passkeys: "Passkeys (WebAuthn) & Security Events",
  organizations_and_audit: "Organizations, Memberships & Audit Logs",
};

export function DataPrivacyExportCenter({ userRole }: DataPrivacyCenterProps) {
  const [downloading, setDownloading] = useState(false);
  const sampleCounts: Record<DataExportCategory, number> = {
    account_identity: 1,
    athlete_profile_athletics: userRole === "athlete" ? 1 : 0,
    academic_and_grades: userRole === "athlete" ? 14 : 0,
    nutrition_and_fitness: userRole === "athlete" ? 38 : 0,
    deals_and_contracts: 4,
    team_and_family_sharing: 2,
    documents_and_forg3_signing: 6,
    sports_travel_and_events: 5,
    scouting_and_recruiting: userRole === "recruiter" ? 12 : 0,
    communications_and_social: 18,
    security_mfa_and_passkeys: 2,
    organizations_and_audit: 1,
  };

  const manifest = generateExportManifest("self", sampleCounts, true);

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 20,
        marginTop: 16,
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
            <span className="badge teal">GDPR Article 20 &amp; CCPA Portable Export</span>
            <span className="badge green">Mutual Privacy Protection Enforced</span>
          </div>
          <h3 style={{ margin: "6px 0 2px", fontSize: 18 }}>
            Personal Data Inventory &amp; Statutory Retention Manifest
          </h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Exports include all data attributed to your account. To protect mutual privacy, messages written by counterparties are excluded, and executed transaction evidence is retained for statutory accounting.
          </p>
        </div>

        <form
          action="/dashboard/settings/export"
          method="post"
          onSubmit={() => setDownloading(true)}
        >
          <button type="submit" className="btn small" disabled={downloading}>
            {downloading ? "Preparing JSON Archive..." : "Download Full Data Archive (.JSON)"}
          </button>
        </form>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
          marginTop: 12,
        }}
      >
        {(Object.keys(CATEGORY_LABELS) as DataExportCategory[]).map((cat) => (
          <div
            key={cat}
            style={{
              padding: "10px 12px",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <span style={{ color: "var(--text)" }}>{CATEGORY_LABELS[cat]}</span>
            <span className="badge gray" style={{ fontSize: 11 }}>
              {sampleCounts[cat]} items
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 6,
          background: "rgba(20, 184, 166, 0.08)",
          border: "1px solid rgba(20, 184, 166, 0.25)",
          fontSize: 12,
          color: "var(--text)",
        }}
      >
        <strong>Legal &amp; Tax Retention Schedule:</strong>
        <div style={{ marginTop: 4 }} className="muted">
          • NIL Deal Financial &amp; Tax Audits: Retained for {manifest.retentionRules.dealAuditRetentionYears} years per IRS Schedule C guidelines.
          <br />
          • Notifications History: Purged automatically after {manifest.retentionRules.notificationRetentionDays} days.
          <br />
          • Anonymization Guarantee: {manifest.retentionRules.tombstonePreservationNote}
        </div>
      </div>
    </div>
  );
}
