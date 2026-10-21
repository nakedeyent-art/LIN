"use client";

import { useState } from "react";

type BenchmarkTier = {
  tier: "D1 Power 5" | "D1 Mid-Major" | "D2 / D3" | "Developmental";
  color: string;
};

type Drill = {
  name: string;
  unit: string;
  lowerIsBetter?: boolean;
  d1Elite: number;
  d1Avg: number;
  d2Avg: number;
  hint: string;
};

const SPORT_DRILLS: Record<string, Drill[]> = {
  Basketball: [
    { name: "Max Vertical Leap", unit: "inches", d1Elite: 38, d1Avg: 34, d2Avg: 29, hint: "Measured from stationary 2-step approach" },
    { name: "Standing Vertical", unit: "inches", d1Elite: 32, d1Avg: 28, d2Avg: 24, hint: "No-step vertical jump reach" },
    { name: "Lane Agility", unit: "seconds", lowerIsBetter: true, d1Elite: 10.8, d1Avg: 11.4, d2Avg: 12.2, hint: "Full key figure-8 sprint and slide" },
    { name: "3/4 Court Sprint", unit: "seconds", lowerIsBetter: true, d1Elite: 3.15, d1Avg: 3.32, d2Avg: 3.55, hint: "Baseline to opposite free throw line" },
    { name: "Standing Reach", unit: "inches", d1Elite: 106, d1Avg: 100, d2Avg: 94, hint: "One-arm overhead fingertip reach" },
  ],
  Football: [
    { name: "40-Yard Dash", unit: "seconds", lowerIsBetter: true, d1Elite: 4.45, d1Avg: 4.62, d2Avg: 4.85, hint: "Laser-timed electronic sprint" },
    { name: "20-Yard Shuttle (5-10-5)", unit: "seconds", lowerIsBetter: true, d1Elite: 4.1, d1Avg: 4.28, d2Avg: 4.5, hint: "Lateral agility and change of direction" },
    { name: "Broad Jump", unit: "inches", d1Elite: 122, d1Avg: 114, d2Avg: 104, hint: "Standing horizontal explosive power" },
    { name: "3-Cone L-Drill", unit: "seconds", lowerIsBetter: true, d1Elite: 6.85, d1Avg: 7.12, d2Avg: 7.42, hint: "Curved running and hip mobility" },
    { name: "Bench Press (225 lbs)", unit: "reps", d1Elite: 22, d1Avg: 16, d2Avg: 10, hint: "NCAA standard combine resistance" },
  ],
  Baseball: [
    { name: "60-Yard Dash", unit: "seconds", lowerIsBetter: true, d1Elite: 6.6, d1Avg: 6.85, d2Avg: 7.15, hint: "Standard scout baseline speed" },
    { name: "Exit Velocity (Tee)", unit: "mph", d1Elite: 95, d1Avg: 88, d2Avg: 82, hint: "Radar-tracked ball exit speed" },
    { name: "Throwing Velocity", unit: "mph", d1Elite: 90, d1Avg: 84, d2Avg: 78, hint: "Infield/Outfield/Fastball radar gun" },
    { name: "Pop Time (Catchers)", unit: "seconds", lowerIsBetter: true, d1Elite: 1.95, d1Avg: 2.05, d2Avg: 2.18, hint: "Glove hit to 2nd base tag" },
  ],
  Soccer: [
    { name: "30-Meter Sprint", unit: "seconds", lowerIsBetter: true, d1Elite: 3.9, d1Avg: 4.12, d2Avg: 4.35, hint: "Acceleration and linear speed" },
    { name: "Agility T-Test", unit: "seconds", lowerIsBetter: true, d1Elite: 9.5, d1Avg: 10.1, d2Avg: 10.8, hint: "Multi-directional soccer movement" },
    { name: "Yo-Yo Intermittent Recovery", unit: "level", d1Elite: 20.2, d1Avg: 18.5, d2Avg: 16.0, hint: "Aerobic match endurance capacity" },
  ],
  Track: [
    { name: "100m Dash", unit: "seconds", lowerIsBetter: true, d1Elite: 10.5, d1Avg: 10.85, d2Avg: 11.35, hint: "FAT electronic sprint" },
    { name: "400m Dash", unit: "seconds", lowerIsBetter: true, d1Elite: 47.5, d1Avg: 49.5, d2Avg: 52.0, hint: "Full lap sprint endurance" },
    { name: "Long Jump", unit: "inches", d1Elite: 288, d1Avg: 264, d2Avg: 240, hint: "Runway takeoff distance" },
  ],
  Volleyball: [
    { name: "Approach Spike Touch", unit: "inches", d1Elite: 124, d1Avg: 118, d2Avg: 111, hint: "Peak fingertip height on spike attack" },
    { name: "Block Touch Reach", unit: "inches", d1Elite: 118, d1Avg: 112, d2Avg: 105, hint: "Stationary two-handed net block jump" },
  ],
};

function evaluateTier(val: number, drill: Drill): BenchmarkTier {
  if (drill.lowerIsBetter) {
    if (val <= drill.d1Elite) return { tier: "D1 Power 5", color: "var(--primary)" };
    if (val <= drill.d1Avg) return { tier: "D1 Mid-Major", color: "#2563eb" };
    if (val <= drill.d2Avg) return { tier: "D2 / D3", color: "#ca8a04" };
    return { tier: "Developmental", color: "var(--muted)" };
  } else {
    if (val >= drill.d1Elite) return { tier: "D1 Power 5", color: "var(--primary)" };
    if (val >= drill.d1Avg) return { tier: "D1 Mid-Major", color: "#2563eb" };
    if (val >= drill.d2Avg) return { tier: "D2 / D3", color: "#ca8a04" };
    return { tier: "Developmental", color: "var(--muted)" };
  }
}

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
