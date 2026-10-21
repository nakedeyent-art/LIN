"use client";

import { useState } from "react";
import {
  buildContractTerms,
  CLAUSE_PRESETS,
  EXCLUSIVITY_DESCRIPTIONS,
  validateContractLength,
  type CampaignPreset,
  type ExclusivityScope,
} from "@/lib/contract-clauses";

export function ClauseBuilder({
  athleteName,
  isMinor,
  onApply,
}: {
  athleteName?: string;
  isMinor?: boolean;
  onApply: (title: string, amount: number, deliverables: string) => void;
}) {
  const [preset, setPreset] = useState<CampaignPreset>("social_ambassador");
  const [specificDeliverables, setSpecificDeliverables] = useState<string>(
    CLAUSE_PRESETS["social_ambassador"].defaultDeliverables
  );
  const [ftcDisclosure, setFtcDisclosure] = useState<boolean>(true);
  const [schoolMarksProtection, setSchoolMarksProtection] = useState<boolean>(true);
  const [moralsClause, setMoralsClause] = useState<boolean>(true);
  const [deliverableProofGate, setDeliverableProofGate] = useState<boolean>(true);
  const [exclusivity, setExclusivity] = useState<ExclusivityScope>("non_exclusive");
  const [campaignDurationDays, setCampaignDurationDays] = useState<number>(30);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [applied, setApplied] = useState<boolean>(false);

  const handlePresetSelect = (newPreset: CampaignPreset) => {
    setPreset(newPreset);
    setSpecificDeliverables(CLAUSE_PRESETS[newPreset].defaultDeliverables);
  };

  const terms = buildContractTerms({
    preset,
    athleteName,
    isMinor,
    specificDeliverables,
    ftcDisclosure,
    schoolMarksProtection,
    moralsClause,
    deliverableProofGate,
    exclusivity,
    campaignDurationDays,
  });

  const validation = validateContractLength(terms);

  const handleApply = () => {
    const p = CLAUSE_PRESETS[preset];
    onApply(p.title, p.suggestedAmount, terms);
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 16,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>⚖️</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>NIL Contract Clause & Term Sheet Builder</span>
            {isMinor && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  background: "rgba(249, 115, 22, 0.12)",
                  color: "var(--needs)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                Minor Guardian Protection Active
              </span>
            )}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Preset legal standards for FTC disclosures, institutional IP protection, morals clauses, and proof milestones.
          </div>
        </div>

        <button
          type="button"
          className="btn ghost small"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Collapse Builder ▲" : "Configure Clauses ▼"}
        </button>
      </div>

      {isExpanded && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          {/* Preset Buttons */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
              1. Select Campaign Template
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
              {(Object.keys(CLAUSE_PRESETS) as CampaignPreset[]).map((pKey) => {
                const p = CLAUSE_PRESETS[pKey];
                const active = preset === pKey;
                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => handlePresetSelect(pKey)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: active ? "1px solid var(--primary)" : "1px solid var(--line)",
                      background: active ? "rgba(20, 184, 166, 0.1)" : "var(--panel-2)",
                      color: active ? "var(--primary)" : "var(--text)",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    <div>{p.title}</div>
                    <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>
                      ~${p.suggestedAmount}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Specific Deliverables Field */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Core Deliverable Description (Customize):
            </label>
            <textarea
              value={specificDeliverables}
              onChange={(e) => setSpecificDeliverables(e.target.value)}
              rows={2}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                color: "var(--text)",
                fontSize: 13,
              }}
            />
          </div>

          {/* Legal Clause Toggles */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
              2. Compliance & Protection Clauses
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, fontSize: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={ftcDisclosure}
                  onChange={(e) => setFtcDisclosure(e.target.checked)}
                />
                <span><strong>FTC Disclosures</strong> (#ad, 16 CFR Part 255)</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={schoolMarksProtection}
                  onChange={(e) => setSchoolMarksProtection(e.target.checked)}
                />
                <span><strong>Institutional IP</strong> (No school marks)</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={moralsClause}
                  onChange={(e) => setMoralsClause(e.target.checked)}
                />
                <span><strong>Mutual Morals Clause</strong> (Brand safety)</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={deliverableProofGate}
                  onChange={(e) => setDeliverableProofGate(e.target.checked)}
                />
                <span><strong>Proof Gate</strong> (Pay on verification)</span>
              </label>
            </div>
          </div>

          {/* Exclusivity Scope */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              Exclusivity Scope:
            </label>
            <select
              value={exclusivity}
              onChange={(e) => setExclusivity(e.target.value as ExclusivityScope)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                color: "var(--text)",
                fontSize: 13,
              }}
            >
              <option value="non_exclusive">Non-Exclusive (Standard / Recommended)</option>
              <option value="apparel_footwear">Category Exclusive: Apparel & Footwear</option>
              <option value="beverage_hydration">Category Exclusive: Hydration & Energy Beverages</option>
              <option value="supplements_nutrition">Category Exclusive: Supplements & Nutrition</option>
              <option value="fitness_facility">Category Exclusive: Training Facilities & Gyms</option>
            </select>
          </div>

          {/* Live Preview Pane */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                Live Generated Term Sheet Preview
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  color: validation.valid ? "var(--ok)" : "var(--needs)",
                  fontWeight: 700,
                }}
              >
                {validation.charCount} / 2,000 chars {validation.valid ? "✓" : "⚠️"}
              </span>
            </div>
            <pre
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: 12,
                fontSize: 11,
                fontFamily: "var(--mono)",
                whiteSpace: "pre-wrap",
                maxHeight: 180,
                overflowY: "auto",
                color: "var(--text)",
                lineHeight: 1.45,
              }}
            >
              {terms}
            </pre>
          </div>

          {/* Apply Button */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              className="btn small"
              onClick={handleApply}
              disabled={!validation.valid}
            >
              {applied ? "✓ Applied to Offer!" : "Apply Clauses to Offer Form →"}
            </button>
            <span className="muted" style={{ fontSize: 12 }}>
              Sets offer title, suggested amount (${CLAUSE_PRESETS[preset].suggestedAmount}), and compliant legal terms.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
