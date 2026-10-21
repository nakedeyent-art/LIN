"use client";

import { useState } from "react";

export type ReadinessLog = {
  sleepHours: number;
  sleepQuality: number; // 1-5
  muscleSoreness: number; // 1-5 (1=fresh, 5=very sore)
  mentalStress: number; // 1-5 (1=calm, 5=high stress)
  motivation: number; // 1-5
  notes?: string;
};

export function WellnessCheckin({ athleteName }: { athleteName?: string }) {
  const [sleepHours, setSleepHours] = useState<number>(8);
  const [sleepQuality, setSleepQuality] = useState<number>(4);
  const [soreness, setSoreness] = useState<number>(2);
  const [mentalStress, setMentalStress] = useState<number>(2);
  const [motivation, setMotivation] = useState<number>(4);
  const [notes, setNotes] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Readiness algorithm: 0 - 100%
  // Optimal: 8+ hrs sleep (25 pts), quality 5 (20 pts), low soreness (20 pts), low stress (20 pts), high motivation (15 pts)
  const sleepPts = Math.min(25, (sleepHours / 8) * 25);
  const qualityPts = (sleepQuality / 5) * 20;
  const sorenessPts = ((6 - soreness) / 5) * 20;
  const stressPts = ((6 - mentalStress) / 5) * 20;
  const motivationPts = (motivation / 5) * 15;
  const readinessScore = Math.round(sleepPts + qualityPts + sorenessPts + stressPts + motivationPts);

  const getStatus = (score: number) => {
    if (score >= 80) return { label: "Optimal / Game Ready", color: "var(--ok)", tone: "green", advice: "Prime physiological and mental state. Full training intensity authorized." };
    if (score >= 60) return { label: "Moderate / Normal", color: "#2563eb", tone: "blue", advice: "Adequate readiness. Maintain standard workout volume and ensure post-training hydration." };
    return { label: "Fatigued / High Stress", color: "var(--needs)", tone: "yellow", advice: "Intervention recommended: consider active recovery, mobility, and reducing high-impact load." };
  };

  const status = getStatus(readinessScore);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 18,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🧠</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                Daily Readiness & Mental Wellness Check-in
              </h3>
              <span className="badge green">Holistic OS</span>
            </div>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12.5 }}>
              Track sleep, central nervous system fatigue, and psychological stress for peak performance.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)" }}>
              Readiness Score
            </span>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--mono)", color: status.color }}>
              {readinessScore}%
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="btn ghost small"
          >
            {isExpanded ? "Collapse" : submitted ? "Update Log" : "Log Check-in"}
          </button>
        </div>
      </div>

      {/* Readiness gauge bar */}
      <div style={{ height: 6, background: "var(--line)", borderRadius: 99, overflow: "hidden", margin: "14px 0 10px" }}>
        <div style={{ width: `${readinessScore}%`, height: "100%", background: status.color, transition: "width 0.3s ease" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span style={{ fontWeight: 650, color: status.color }}>Status: {status.label}</span>
        <span className="muted">{status.advice}</span>
      </div>

      {/* Expanded Interactive Logger */}
      {isExpanded && (
        <form onSubmit={handleSubmit} style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 650, marginBottom: 4 }}>
                Sleep Duration: <strong style={{ color: "var(--primary)" }}>{sleepHours}h</strong>
              </label>
              <input
                type="range"
                min="4"
                max="12"
                step="0.5"
                value={sleepHours}
                onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
                <span>4h</span>
                <span>8h (Target)</span>
                <span>12h</span>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 650, marginBottom: 4 }}>
                Sleep Quality: <strong>{sleepQuality}/5</strong>
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSleepQuality(lvl)}
                    className={`btn small ${sleepQuality === lvl ? "" : "ghost"}`}
                    style={{ flex: 1, padding: "4px 0", fontSize: 11 }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <span className="muted" style={{ fontSize: 11, display: "block", marginTop: 2 }}>
                {sleepQuality <= 2 ? "Restless / Woke up tired" : sleepQuality >= 4 ? "Deep uninterrupted sleep" : "Average rest"}
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 650, marginBottom: 4 }}>
                Physical Soreness: <strong>{soreness}/5</strong>
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSoreness(lvl)}
                    className={`btn small ${soreness === lvl ? "needs" : "ghost"}`}
                    style={{ flex: 1, padding: "4px 0", fontSize: 11 }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <span className="muted" style={{ fontSize: 11, display: "block", marginTop: 2 }}>
                {soreness <= 2 ? "Fresh legs / minimal aches" : soreness >= 4 ? "Heavy DOMS / fatigue" : "Moderate tension"}
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 650, marginBottom: 4 }}>
                Mental & Academic Stress: <strong>{mentalStress}/5</strong>
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setMentalStress(lvl)}
                    className={`btn small ${mentalStress === lvl ? "needs" : "ghost"}`}
                    style={{ flex: 1, padding: "4px 0", fontSize: 11 }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <span className="muted" style={{ fontSize: 11, display: "block", marginTop: 2 }}>
                {mentalStress <= 2 ? "Calm & locked in" : mentalStress >= 4 ? "Exams / high pressure" : "Manageable pressure"}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 650, marginBottom: 4 }}>
              Optional Notes (Injury tweaks, nutrition notes, energy):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Left hamstring felt a bit tight after sprints; hydrated 3L yesterday"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                fontSize: 13,
                color: "var(--text)",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Visible to your linked strength coach, athletic trainer, and manager.
            </span>
            <button type="submit" className="btn small">
              Save Daily Readiness Log
            </button>
          </div>
        </form>
      )}

      {submitted && !isExpanded && (
        <p className="ok" style={{ margin: "10px 0 0", fontSize: 12 }}>
          ✓ Today's wellness check-in saved. Score: <strong>{readinessScore}%</strong>. Team alert status clear.
        </p>
      )}
    </div>
  );
}
