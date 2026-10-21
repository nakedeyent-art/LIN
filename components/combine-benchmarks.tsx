"use client";

import { useState } from "react";
import { SPORT_DRILLS, evaluateTier, type Drill, type BenchmarkTier } from "@/lib/benchmarks";


export function CombineBenchmarks({ onSelectMetric }: { onSelectMetric?: (label: string, unitHint: string) => void }) {
  const sports = Object.keys(SPORT_DRILLS);
  const [selectedSport, setSelectedSport] = useState<string>("Basketball");
  const [selectedDrillName, setSelectedDrillName] = useState<string>(SPORT_DRILLS["Basketball"][0].name);
  const [inputValue, setInputValue] = useState<string>("");

  const drills = SPORT_DRILLS[selectedSport] ?? [];
  const currentDrill = drills.find((d) => d.name === selectedDrillName) ?? drills[0];

  const numVal = parseFloat(inputValue);
  const tierResult = !isNaN(numVal) && numVal > 0 ? evaluateTier(numVal, currentDrill) : null;

  const handleSportChange = (sport: string) => {
    setSelectedSport(sport);
    const first = SPORT_DRILLS[sport]?.[0];
    if (first) {
      setSelectedDrillName(first.name);
      setInputValue("");
    }
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <span className="badge green">Combine Intelligence</span>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>Collegiate Benchmarks & Percentiles</h3>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13, maxWidth: 440 }}>
          Compare performance against official NCAA D1 Power 5, Mid-Major, D2, and D3 standards.
        </p>
      </div>

      {/* Sport Selector Pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {sports.map((sp) => (
          <button
            key={sp}
            type="button"
            onClick={() => handleSportChange(sp)}
            className={`btn small ${selectedSport === sp ? "" : "ghost"}`}
            style={{ fontSize: 12 }}
          >
            {sp}
          </button>
        ))}
      </div>

      {/* Drill Selection Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
        {drills.map((d) => (
          <button
            key={d.name}
            type="button"
            onClick={() => {
              setSelectedDrillName(d.name);
              setInputValue("");
            }}
            style={{
              background: selectedDrillName === d.name ? "var(--primary-soft)" : "transparent",
              color: selectedDrillName === d.name ? "var(--primary)" : "var(--muted)",
              border: `1px solid ${selectedDrillName === d.name ? "var(--primary)" : "transparent"}`,
              borderRadius: 6,
              padding: "5px 10px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Drill Standard & Interactive Evaluator */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, alignItems: "start" }}>
        {/* Left: Benchmark Standard Cards */}
        <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>{currentDrill.name}</strong>
            <span className="muted" style={{ fontSize: 12 }}>({currentDrill.unit})</span>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: "0 0 12px" }}>{currentDrill.hint}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "var(--primary-soft)", borderRadius: 4 }}>
              <span style={{ fontWeight: 650, color: "var(--primary)" }}>D1 Power 5 (Elite)</span>
              <span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>
                {currentDrill.lowerIsBetter ? `≤ ${currentDrill.d1Elite}` : `≥ ${currentDrill.d1Elite}`} {currentDrill.unit}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#eff6ff", borderRadius: 4 }}>
              <span style={{ fontWeight: 650, color: "#1d4ed8" }}>D1 Mid-Major</span>
              <span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>
                {currentDrill.lowerIsBetter ? `≤ ${currentDrill.d1Avg}` : `≥ ${currentDrill.d1Avg}`} {currentDrill.unit}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#fefce8", borderRadius: 4 }}>
              <span style={{ fontWeight: 650, color: "#a16207" }}>D2 / D3 Target</span>
              <span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>
                {currentDrill.lowerIsBetter ? `≤ ${currentDrill.d2Avg}` : `≥ ${currentDrill.d2Avg}`} {currentDrill.unit}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Test Input & Instant Rating */}
        <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
          <strong style={{ fontSize: 14, display: "block", marginBottom: 8 }}>Evaluate Your Metric</strong>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="number"
              step="0.01"
              placeholder={`Enter ${currentDrill.unit}...`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--panel)",
                color: "var(--text)",
                fontSize: 14,
              }}
            />
            {onSelectMetric && (
              <button
                type="button"
                onClick={() => onSelectMetric(currentDrill.name, currentDrill.unit)}
                className="btn ghost small"
                title="Autofill metric form"
              >
                Use Label
              </button>
            )}
          </div>

          {tierResult ? (
            <div style={{ padding: 12, background: "var(--panel)", borderRadius: 6, border: `1px solid ${tierResult.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 12 }}>Rating Bracket:</span>
                <span style={{ fontWeight: 800, color: tierResult.color, fontSize: 15 }}>{tierResult.tier}</span>
              </div>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
                {tierResult.tier === "D1 Power 5"
                  ? "Elite mark. High national recruit radar potential."
                  : tierResult.tier === "D1 Mid-Major"
                  ? "Strong collegiate profile. Competitive for scholarship evaluation."
                  : tierResult.tier === "D2 / D3"
                  ? "Solid collegiate standard. Projected varsity contributor."
                  : "Developmental mark. Work with your strength coach on targeted progression."}
              </p>
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Type your test score above to see which collegiate tier you rank into instantly.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
