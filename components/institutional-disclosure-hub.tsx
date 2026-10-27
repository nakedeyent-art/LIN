"use client";

import { useState } from "react";
import {
  NCAA_FBS_PROFILES,
  detectUniversityConflicts,
  generateUniversityDisclosurePacket,
  type NILDealForDisclosure,
  type UniversityProfile,
} from "@/lib/institutional-compliance";

export function InstitutionalDisclosureHub() {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("miami");
  const [athleteName, setAthleteName] = useState<string>("Devon Brooks");
  const [athleteSport, setAthleteSport] = useState<string>("Football");
  const [brandName, setBrandName] = useState<string>("Nike");
  const [category, setCategory] = useState<"apparel" | "beverage" | "nutrition" | "telecom" | "gaming" | "banking" | "other">("apparel");
  const [compensation, setCompensation] = useState<number>(12500);
  const [agentFeePct, setAgentFeePct] = useState<number>(15);
  const [usesSchoolMarks, setUsesSchoolMarks] = useState<boolean>(false);
  const [trademarkPermission, setTrademarkPermission] = useState<boolean>(false);
  const [activities, setActivities] = useState<string>("Social media brand ambassador campaign and training video sponsorship.");
  const [downloaded, setDownloaded] = useState<boolean>(false);

  const currentSchool: UniversityProfile =
    NCAA_FBS_PROFILES.find((s) => s.schoolId === selectedSchoolId) || NCAA_FBS_PROFILES[0];

  const currentDeal: NILDealForDisclosure = {
    dealId: "deal-auto-disc",
    athleteName,
    athleteId: "ath-curr",
    athleteSport,
    schoolId: selectedSchoolId,
    counterpartyBrand: brandName,
    category,
    totalCompensationDollars: compensation,
    startDate: "2026-09-01",
    endDate: "2026-12-31",
    usesSchoolTrademarks: usesSchoolMarks,
    schoolTrademarkPermissionGranted: trademarkPermission,
    agentName: "Certified Sports Agency",
    agentFeePercentage: agentFeePct,
    privateBankRoutingNumber: "021000021",
    privateBankAccountNumber: "9988776655",
    descriptionOfActivities: activities,
  };

  const conflictReport = detectUniversityConflicts(currentDeal, currentSchool);
  const packet = generateUniversityDisclosurePacket(currentDeal, currentSchool);

  const handleDownloadPacket = () => {
    const jsonString = JSON.stringify(packet, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `NCAA_University_Disclosure_${currentSchool.schoolId}_${packet.packetId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
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
            <span style={{ fontSize: 22 }}>🏛️</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Institutional NCAA NIL Disclosure & Compliance Portal</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: packet.submissionStatus === "APPROVED" ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                color: packet.submissionStatus === "APPROVED" ? "var(--ok, #22c55e)" : "var(--danger, #ef4444)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {packet.submissionStatus}
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Automated conflict check against university apparel contracts, exclusivity sponsors, and trademark co-licensing rules.
          </p>
        </div>

        <button
          type="button"
          className="btn small"
          onClick={handleDownloadPacket}
          style={{ fontSize: 12 }}
        >
          {downloaded ? "✓ Disclosure Exported!" : "📥 Download University Packet"}
        </button>
      </div>

      {/* Inputs Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 12 }}>
          University / Athletic Dept
          <select
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          >
            {NCAA_FBS_PROFILES.map((s) => (
              <option key={s.schoolId} value={s.schoolId}>
                {s.schoolName} ({s.primaryApparelPartner})
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 12 }}>
          Athlete Name & Sport
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input
              type="text"
              value={athleteName}
              onChange={(e) => setAthleteName(e.target.value)}
              style={{ width: "60%", padding: "6px 8px" }}
            />
            <input
              type="text"
              value={athleteSport}
              onChange={(e) => setAthleteSport(e.target.value)}
              style={{ width: "40%", padding: "6px 8px" }}
            />
          </div>
        </label>

        <label style={{ fontSize: 12 }}>
          Deal Brand / Sponsor
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Category & Value ($)
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              style={{ width: "55%", padding: "6px 8px" }}
            >
              <option value="apparel">Apparel & Footwear</option>
              <option value="beverage">Beverage & Energy</option>
              <option value="nutrition">Supplements / Food</option>
              <option value="telecom">Tech / Media</option>
              <option value="gaming">Gaming & Esports</option>
              <option value="other">Other Service</option>
            </select>
            <input
              type="number"
              min={0}
              step={500}
              value={compensation}
              onChange={(e) => setCompensation(Number(e.target.value) || 0)}
              style={{ width: "45%", padding: "6px 8px" }}
            />
          </div>
        </label>
      </div>

      {/* Trademark / Logo Checkboxes */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16, padding: "8px 12px", background: "var(--panel-2)", borderRadius: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={usesSchoolMarks}
            onChange={(e) => setUsesSchoolMarks(e.target.checked)}
          />
          <span>Deal includes school jersey, logo, or campus imagery</span>
        </label>

        {usesSchoolMarks && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={trademarkPermission}
              onChange={(e) => setTrademarkPermission(e.target.checked)}
            />
            <span style={{ color: trademarkPermission ? "var(--ok, #22c55e)" : "var(--danger, #ef4444)", fontWeight: 600 }}>
              Official University Co-Licensing License Granted
            </span>
          </label>
        )}
      </div>

      {/* Conflict Evaluation Banner */}
      <div
        style={{
          padding: 14,
          borderRadius: 8,
          border: conflictReport.conflictingDetails.length > 0 ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(34, 197, 94, 0.4)",
          background: conflictReport.conflictingDetails.length > 0 ? "rgba(239, 68, 68, 0.06)" : "rgba(34, 197, 94, 0.06)",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>{conflictReport.conflictingDetails.length > 0 ? "⚠️" : "✅"}</span>
          <strong style={{ fontSize: 13 }}>
            {conflictReport.conflictingDetails.length > 0
              ? `${conflictReport.conflictingDetails.length} Conflict / Compliance Warning(s) Identified`
              : "Institutional Compatibility Clear — Zero School Conflicts"}
          </strong>
        </div>

        {conflictReport.conflictingDetails.length > 0 ? (
          <ul style={{ margin: "4px 0 8px 20px", fontSize: 12, color: "var(--text)" }}>
            {conflictReport.conflictingDetails.map((detail, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>{detail}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: "4px 0", fontSize: 12, color: "var(--muted)" }}>
            Deal counterparty <strong>{brandName}</strong> does not conflict with {currentSchool.schoolName}&apos;s official contract with <strong>{currentSchool.primaryApparelPartner}</strong> or exclusive beverage/nutrition partners.
          </p>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 8, color: conflictReport.conflictingDetails.length > 0 ? "var(--danger, #ef4444)" : "var(--ok, #22c55e)" }}>
          Recommendation: {conflictReport.recommendedAction}
        </div>
      </div>

      {/* Compliance Metadata Redaction Notice */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <span>🔒 Redaction Engine: Sensitive bank routing / account numbers stripped before university export.</span>
        <span>Notice Window: {currentSchool.advanceDisclosureNoticeDays} Days Prior Notice Required</span>
      </div>
    </div>
  );
}
