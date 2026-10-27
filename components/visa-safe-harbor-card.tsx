"use client";

import { useState } from "react";
import {
  evaluateInternationalVisaDeal,
  generateDsoSafeHarborCertificate,
  type VisaType,
  type NilActivityType,
  type VisaDealEvaluationInput,
} from "@/lib/visa-safe-harbor";

export function VisaSafeHarborCard() {
  const [athleteName, setAthleteName] = useState<string>("Lucas Da Silva");
  const [countryOfCitizenship, setCountryOfCitizenship] = useState<string>("Brazil");
  const [visaType, setVisaType] = useState<VisaType>("F-1");
  const [brandName, setBrandName] = useState<string>("EA Sports College Football");
  const [activityType, setActivityType] = useState<NilActivityType>("passive_group_licensing");
  const [compensation, setCompensation] = useState<number>(600);
  const [locationOfPerformance, setLocationOfPerformance] = useState<"US_SOIL" | "OFFSHORE_INTERNATIONAL">("US_SOIL");
  const [countryOfPerformance, setCountryOfPerformance] = useState<string>("United States");
  const [travelProof, setTravelProof] = useState<string>("");
  const [dsoNotified, setDsoNotified] = useState<boolean>(true);
  const [downloadedCert, setDownloadedCert] = useState<boolean>(false);

  const evaluationInput: VisaDealEvaluationInput = {
    athleteId: "ath-intl-ui",
    athleteName,
    countryOfCitizenship,
    visaType,
    dealId: "deal-eval-current",
    brandName,
    activityType,
    totalCompensationDollars: compensation,
    physicalLocationOfPerformance: locationOfPerformance,
    countryOfPerformance: locationOfPerformance === "US_SOIL" ? "United States" : countryOfPerformance,
    travelProofReference: travelProof,
    dsoNotified,
  };

  const result = evaluateInternationalVisaDeal(evaluationInput);

  const handleDownloadCertificate = () => {
    const cert = generateDsoSafeHarborCertificate(evaluationInput);
    const blob = new Blob([cert.certificationText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DSO_NIL_Attestation_${athleteName.replaceAll(" ", "_")}_${cert.certificateId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadedCert(true);
    setTimeout(() => setDownloadedCert(false), 3000);
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
            <span style={{ fontSize: 22 }}>🛂</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>International Athlete F-1 / P-1A Visa Safe Harbor</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background:
                  result.riskLevel === "CRITICAL_IMMIGRATION_BREACH"
                    ? "rgba(239, 68, 68, 0.12)"
                    : result.riskLevel === "LOW_ADVISORY"
                    ? "rgba(234, 179, 8, 0.12)"
                    : "rgba(34, 197, 94, 0.12)",
                color:
                  result.riskLevel === "CRITICAL_IMMIGRATION_BREACH"
                    ? "var(--danger, #ef4444)"
                    : result.riskLevel === "LOW_ADVISORY"
                    ? "#eab308"
                    : "var(--ok, #22c55e)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {result.classification.replaceAll("_", " ")}
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Passive IP licensing vs active commercial labor engine, offshore geolocation audit, and SEVP DSO non-employment attestation generator.
          </p>
        </div>

        <button
          type="button"
          className="btn small"
          onClick={handleDownloadCertificate}
          style={{ fontSize: 12 }}
        >
          {downloadedCert ? "✓ Certificate Exported!" : "📥 Export DSO Attestation Packet"}
        </button>
      </div>

      {/* Input Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 12 }}>
          Athlete Citizenship & Visa Status
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input
              type="text"
              placeholder="Country"
              value={countryOfCitizenship}
              onChange={(e) => setCountryOfCitizenship(e.target.value)}
              style={{ width: "50%", padding: "6px 8px" }}
            />
            <select
              value={visaType}
              onChange={(e) => setVisaType(e.target.value as VisaType)}
              style={{ width: "50%", padding: "6px 8px" }}
            >
              <option value="F-1">F-1 Student Visa</option>
              <option value="P-1A">P-1A Athlete Visa</option>
              <option value="O-1A">O-1A Extraordinary</option>
              <option value="J-1">J-1 Exchange</option>
              <option value="US_CITIZEN_OR_PERMANENT_RESIDENT">US Citizen / Green Card</option>
            </select>
          </div>
        </label>

        <label style={{ fontSize: 12 }}>
          NIL Activity Classification
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value as NilActivityType)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          >
            <option value="passive_group_licensing">Passive Group Licensing (EA Sports, Cards)</option>
            <option value="passive_equity">Passive Equity Royalty / Brand Share</option>
            <option value="active_social_media">Active Social Media Endorsement</option>
            <option value="active_commercial_shoot">Active Commercial Shoot / In-Person</option>
            <option value="active_camp_or_clinic">Active Youth Camp / Clinic Coaching</option>
            <option value="active_autograph_signing">Active In-Person Autograph Signing</option>
          </select>
        </label>

        <label style={{ fontSize: 12 }}>
          Physical Location of Performance
          <select
            value={locationOfPerformance}
            onChange={(e) => setLocationOfPerformance(e.target.value as any)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          >
            <option value="US_SOIL">Inside United States (US Soil)</option>
            <option value="OFFSHORE_INTERNATIONAL">Outside US (Offshore International)</option>
          </select>
        </label>

        <label style={{ fontSize: 12 }}>
          Deal Brand & Amount ($)
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              style={{ width: "60%", padding: "6px 8px" }}
            />
            <input
              type="number"
              value={compensation}
              onChange={(e) => setCompensation(Number(e.target.value) || 0)}
              style={{ width: "40%", padding: "6px 8px" }}
            />
          </div>
        </label>
      </div>

      {/* Offshore Travel Proof Input (Shown if Offshore is selected) */}
      {locationOfPerformance === "OFFSHORE_INTERNATIONAL" && (
        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <label style={{ fontSize: 12 }}>
              Country of Performance
              <input
                type="text"
                placeholder="e.g. Canada, Bahamas, Brazil"
                value={countryOfPerformance}
                onChange={(e) => setCountryOfPerformance(e.target.value)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              Travel Verification Proof (Flight / Border Stamp / Hotel)
              <input
                type="text"
                placeholder="e.g. Air Canada Flight AC892 Boarding Pass & Toronto Stamp"
                value={travelProof}
                onChange={(e) => setTravelProof(e.target.value)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Legal Status Banner */}
      <div
        style={{
          padding: 14,
          borderRadius: 8,
          border:
            result.riskLevel === "CRITICAL_IMMIGRATION_BREACH"
              ? "1px solid rgba(239, 68, 68, 0.4)"
              : result.riskLevel === "LOW_ADVISORY"
              ? "1px solid rgba(234, 179, 8, 0.4)"
              : "1px solid rgba(34, 197, 94, 0.4)",
          background:
            result.riskLevel === "CRITICAL_IMMIGRATION_BREACH"
              ? "rgba(239, 68, 68, 0.06)"
              : result.riskLevel === "LOW_ADVISORY"
              ? "rgba(234, 179, 8, 0.06)"
              : "rgba(34, 197, 94, 0.06)",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>
            {result.riskLevel === "CRITICAL_IMMIGRATION_BREACH"
              ? "🚫"
              : result.riskLevel === "LOW_ADVISORY"
              ? "⚠️"
              : "✅"}
          </span>
          <strong
            style={{
              fontSize: 13,
              color:
                result.riskLevel === "CRITICAL_IMMIGRATION_BREACH"
                  ? "var(--danger, #ef4444)"
                  : result.riskLevel === "LOW_ADVISORY"
                  ? "#eab308"
                  : "var(--ok, #22c55e)",
            }}
          >
            {result.summary}
          </strong>
        </div>

        <ul style={{ margin: "6px 0 8px 20px", fontSize: 12, color: "var(--text)" }}>
          {result.reasons.map((r, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{r}</li>
          ))}
        </ul>

        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 8, color: "var(--primary)" }}>
          Designated School Official (DSO) Directive: {result.safeHarborGuidance}
        </div>
      </div>

      {/* Footer / SEVP Citation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <span>Statutory Authority: 8 CFR § 214.2(f)(9) (Student Employment Restrictions) & ICE SEVP Guidance</span>
        <span>SEVIS Record Safety Audit Active</span>
      </div>
    </div>
  );
}
