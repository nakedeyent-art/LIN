"use client";

import { useState } from "react";
import {
  NFHS_STATE_RULES,
  validateHighSchoolNilDeal,
  UNIVERSAL_PROHIBITED_CATEGORIES,
  type StateNilStatus,
} from "@/lib/nfhs-eligibility";

export function StateEligibilityChecker() {
  const [selectedState, setSelectedState] = useState<string>("CA");
  const [isHighSchool, setIsHighSchool] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("Athletic Apparel & Footwear");
  const [usesUniform, setUsesUniform] = useState<boolean>(false);
  const [hasGuardianConsent, setHasGuardianConsent] = useState<boolean>(true);
  const [performanceContingency, setPerformanceContingency] = useState<boolean>(false);

  const validation = validateHighSchoolNilDeal({
    stateCode: selectedState,
    isHighSchool,
    industryCategory: selectedCategory,
    usesSchoolUniformOrMascot: usesUniform,
    hasGuardianConsent,
    isContingentOnAthleticPerformance: performanceContingency,
  });

  const stateList = Object.values(NFHS_STATE_RULES);

  const statusColors: Record<StateNilStatus, { bg: string; text: string; border: string }> = {
    permitted: { bg: "rgba(34, 197, 94, 0.12)", text: "var(--ok, #22c55e)", border: "rgba(34, 197, 94, 0.3)" },
    restricted: { bg: "rgba(234, 179, 8, 0.12)", text: "#eab308", border: "rgba(234, 179, 8, 0.3)" },
    prohibited: { bg: "rgba(239, 68, 68, 0.12)", text: "var(--danger, #ef4444)", border: "rgba(239, 68, 68, 0.3)" },
  };

  const style = statusColors[validation.status];

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏛️</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>50-State High School (NFHS) Eligibility Engine</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: style.bg,
                color: style.text,
                border: `1px solid ${style.border}`,
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              {validation.stateName} · {validation.status.toUpperCase()}
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Real-time state athletic association bylaws, uniform IP bans, disclosure timelines, and amateurism protection.
          </p>
        </div>
      </div>

      {/* State & Parameters Form */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 12 }}>
          State Association
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          >
            {stateList.map((s) => (
              <option key={s.stateCode} value={s.stateCode}>
                {s.stateName} ({s.stateCode}) — {s.status.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 12 }}>
          Athlete Level
          <select
            value={isHighSchool ? "hs" : "college"}
            onChange={(e) => setIsHighSchool(e.target.value === "hs")}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          >
            <option value="hs">High School Student-Athlete (Prep)</option>
            <option value="college">College / University (NCAA)</option>
          </select>
        </label>

        <label style={{ fontSize: 12 }}>
          Commercial Industry Category
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          >
            <option value="Athletic Apparel & Footwear">Athletic Apparel & Footwear</option>
            <option value="Local Restaurant & Dining">Local Restaurant & Dining</option>
            <option value="Tech & Mobile Apps">Tech & Mobile Apps</option>
            <option value="Youth Sports Training">Youth Sports Training</option>
            {UNIVERSAL_PROHIBITED_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                ⚠️ {c} (High Risk)
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Checkbox Toggles */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16, fontSize: 13 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={usesUniform}
            onChange={(e) => setUsesUniform(e.target.checked)}
          />
          Uses high school jersey, logo, or facility
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={hasGuardianConsent}
            onChange={(e) => setHasGuardianConsent(e.target.checked)}
          />
          Parent / Guardian Co-Signature
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={performanceContingency}
            onChange={(e) => setPerformanceContingency(e.target.checked)}
          />
          Pay-for-play performance clause
        </label>
      </div>

      {/* Eligibility Decision Box */}
      <div
        style={{
          background: validation.eligible ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
          border: `1px solid ${validation.eligible ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>{validation.eligible ? "✅" : "🚫"}</span>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            {validation.eligible
              ? "Eligible for Execution under State Athletic Bylaws"
              : "Eligibility Violation Detected — Deal Cannot Proceed"}
          </h3>
        </div>

        <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
          Governing Association: <strong>{validation.association}</strong> ({validation.stateName})
        </p>

        {validation.violations.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <strong style={{ color: "var(--danger, #ef4444)", fontSize: 12 }}>Critical Eligibility Violations:</strong>
            <ul style={{ margin: "4px 0 8px 16px", color: "var(--danger, #ef4444)", fontSize: 13 }}>
              {validation.violations.map((v, idx) => (
                <li key={idx}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        {validation.requiredActions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <strong style={{ fontSize: 12, color: "var(--text)" }}>Mandatory Compliance Actions:</strong>
            <ul style={{ margin: "4px 0 8px 16px", fontSize: 13 }}>
              {validation.requiredActions.map((a, idx) => (
                <li key={idx}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <strong style={{ color: "#eab308", fontSize: 12 }}>Compliance Advisories:</strong>
            <ul style={{ margin: "4px 0 0 16px", fontSize: 13, color: "var(--text)" }}>
              {validation.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
