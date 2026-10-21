"use client";

import { useState, useEffect, useRef } from "react";
import type { Exercise } from "@/lib/training";
import { PHASE_LABEL } from "@/lib/training";

export type WorkoutPlayerProps = {
  workoutId: string;
  workoutTitle: string;
  focusArea: string | null;
  exercises: Exercise[];
  completeAction: (formData: FormData) => void;
};

export function WorkoutPlayer({ workoutId, workoutTitle, focusArea, exercises, completeAction }: WorkoutPlayerProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [completedExercises, setCompletedExercises] = useState<Record<number, boolean>>({});
  const [setLogs, setSetLogs] = useState<Record<number, { weight: string; reps: string }[]>>({});
  const [formVideoUrls, setFormVideoUrls] = useState<Record<number, string>>({});
  const [athleteNotes, setAthleteNotes] = useState("");

  // Rest Timer state
  const [restSeconds, setRestSeconds] = useState(0);
  const [restInitial, setRestInitial] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Tempo Pacer state
  const [tempoActive, setTempoActive] = useState(false);
  const [tempoPhase, setTempoPhase] = useState<"Eccentric" | "Isometric Bottom" | "Concentric" | "Isometric Top">("Eccentric");
  const [tempoCount, setTempoCount] = useState(0);
  const tempoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentEx = exercises[activeIdx] || exercises[0];

  // Initialize set logs for current exercise if not present
  useEffect(() => {
    if (!setLogs[activeIdx] && currentEx) {
      setSetLogs((prev) => ({
        ...prev,
        [activeIdx]: Array.from({ length: currentEx.sets }, () => ({
          weight: "",
          reps: String(currentEx.reps),
        })),
      }));
    }
  }, [activeIdx, currentEx, setLogs]);

  // Rest timer tick
  useEffect(() => {
    if (isResting && restSeconds > 0) {
      timerRef.current = setTimeout(() => {
        setRestSeconds((s) => s - 1);
      }, 1000);
    } else if (isResting && restSeconds === 0) {
      setIsResting(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isResting, restSeconds]);

  const startRest = (sec: number) => {
    setRestInitial(sec);
    setRestSeconds(sec);
    setIsResting(true);
  };

  const stopRest = () => {
    setIsResting(false);
    setRestSeconds(0);
  };

  // Tempo guide logic (e.g. "3-1-X-1" -> 3s down, 1s hold, explosive up, 1s top)
  const parseTempo = (tempo?: string) => {
    if (!tempo) return null;
    const parts = tempo.split("-").map((p) => p.trim());
    if (parts.length < 4) return null;
    return {
      down: parseInt(parts[0], 10) || 2,
      holdBottom: parseInt(parts[1], 10) || 0,
      up: parts[2].toUpperCase() === "X" ? 1 : parseInt(parts[2], 10) || 1,
      holdTop: parseInt(parts[3], 10) || 0,
    };
  };

  const parsedTempo = parseTempo(currentEx?.tempo);

  const toggleTempoPacer = () => {
    if (tempoActive) {
      setTempoActive(false);
      if (tempoIntervalRef.current) clearInterval(tempoIntervalRef.current);
    } else {
      setTempoActive(true);
      setTempoPhase("Eccentric");
      setTempoCount(parsedTempo ? parsedTempo.down : 3);
    }
  };

  const handleSetChange = (setIdx: number, field: "weight" | "reps", val: string) => {
    setSetLogs((prev) => {
      const currentSets = prev[activeIdx] ? [...prev[activeIdx]] : [];
      currentSets[setIdx] = { ...currentSets[setIdx], [field]: val };
      return { ...prev, [activeIdx]: currentSets };
    });
  };

  const toggleExerciseDone = (idx: number) => {
    setCompletedExercises((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const allCompletedCount = Object.values(completedExercises).filter(Boolean).length;
  const adherencePercent = Math.round((allCompletedCount / exercises.length) * 100);

  return (
    <div className="workout-player-container" style={{ display: "grid", gap: 16 }}>
      {/* Top Banner & Progress */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <span className="badge green" style={{ marginBottom: 4 }}>Guided Player</span>
            <h2 style={{ margin: "4px 0", fontSize: 20 }}>{workoutTitle}</h2>
            {focusArea && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Focus: {focusArea}</p>}
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)" }}>{adherencePercent}%</span>
            <div className="muted" style={{ fontSize: 12 }}>{allCompletedCount} of {exercises.length} Exercises Done</div>
          </div>
        </div>

        {/* Exercise Step Pills */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 14, paddingBottom: 6 }}>
          {exercises.map((e, idx) => {
            const isDone = !!completedExercises[idx];
            const isCurrent = idx === activeIdx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIdx(idx)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 99,
                  border: isCurrent ? "2px solid var(--primary)" : "1px solid var(--line)",
                  background: isDone ? "var(--ok-soft)" : isCurrent ? "var(--primary-soft)" : "var(--panel-2)",
                  color: isDone ? "var(--ok)" : isCurrent ? "var(--primary)" : "var(--muted)",
                  fontSize: 12,
                  fontWeight: 650,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>{isDone ? "✓" : idx + 1}</span>
                <span>{e.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Guided Exercise Card */}
      {currentEx && (
        <div className="card" style={{ borderTop: "3px solid var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
            <div>
              <span className="badge gray" style={{ fontSize: 11 }}>{PHASE_LABEL[currentEx.phase]}</span>
              <h3 style={{ fontSize: 22, margin: "6px 0 2px", textTransform: "none", color: "var(--text)" }}>{currentEx.name}</h3>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "var(--primary)" }}>
                Target: {currentEx.sets} Sets × {currentEx.reps} Reps
                {currentEx.intensity && ` @ ${currentEx.intensity}`}
                {currentEx.tempo && ` (Tempo: ${currentEx.tempo})`}
              </p>
            </div>
            <button
              type="button"
              className={`btn ${completedExercises[activeIdx] ? "ghost" : "needs"}`}
              onClick={() => toggleExerciseDone(activeIdx)}
            >
              {completedExercises[activeIdx] ? "✓ Completed" : "Mark Exercise Complete"}
            </button>
          </div>

          {/* Form Coaching Cue & Checklist */}
          {currentEx.cue && (
            <div style={{ padding: "12px 14px", background: "var(--primary-soft)", borderLeft: "4px solid var(--primary)", borderRadius: 6, margin: "10px 0" }}>
              <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--primary)" }}>
                Coaching Cues &amp; Mechanics
              </div>
              <div style={{ fontSize: 14, marginTop: 4, color: "var(--text)" }}>&ldquo;{currentEx.cue}&rdquo;</div>
            </div>
          )}

          {/* Tempo & Rest Timers Control Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, margin: "16px 0" }}>
            {/* Rest Timer Module */}
            <div style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>Rest Countdown</span>
                {isResting && <span className="badge green" style={{ animation: "pulse 1.5s infinite" }}>Active</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--mono)", color: restSeconds <= 10 && restSeconds > 0 ? "var(--needs)" : "var(--text)" }}>
                  {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, "0")}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {isResting ? (
                    <button type="button" className="btn ghost small" onClick={stopRest}>Stop</button>
                  ) : (
                    <>
                      <button type="button" className="btn small" onClick={() => startRest(currentEx.restSec || 90)}>
                        Start ({currentEx.restSec || 90}s)
                      </button>
                      <button type="button" className="btn ghost small" onClick={() => startRest(60)}>60s</button>
                      <button type="button" className="btn ghost small" onClick={() => startRest(120)}>120s</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Tempo Cadence Metronome */}
            {currentEx.tempo && (
              <div style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>Tempo Pacer ({currentEx.tempo})</span>
                  <button type="button" className="btn ghost small" onClick={toggleTempoPacer}>
                    {tempoActive ? "Stop Pacer" : "Start Cadence"}
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                  {tempoActive ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="badge yellow">{tempoPhase}</span>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>Pulse: {tempoCount}s</span>
                    </div>
                  ) : (
                    "Cadence guide helps control eccentric breakdown and explosive power."
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Set Logger Table */}
          <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, textTransform: "uppercase", color: "var(--muted)" }}>
              Log Sets &amp; Resistance
            </h4>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Set</th>
                    <th>Weight (lbs / kg)</th>
                    <th>Reps Completed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(setLogs[activeIdx] || []).map((sLog, sIdx) => (
                    <tr key={sIdx}>
                      <td style={{ fontWeight: 700 }}>#{sIdx + 1}</td>
                      <td>
                        <input
                          type="text"
                          placeholder="e.g. 185"
                          value={sLog.weight}
                          onChange={(e) => handleSetChange(sIdx, "weight", e.target.value)}
                          style={{ padding: "4px 8px", width: 100, fontSize: 13 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={sLog.reps}
                          onChange={(e) => handleSetChange(sIdx, "reps", e.target.value)}
                          style={{ padding: "4px 8px", width: 80, fontSize: 13 }}
                        />
                      </td>
                      <td>
                        <span className="badge green">Logged</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Video Upload / Link */}
          <div style={{ marginTop: 16, padding: 12, background: "var(--panel-2)", borderRadius: 8, border: "1px dashed var(--line)" }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Form Video / Feedback URL (Optional)
            </label>
            <input
              type="url"
              placeholder="Paste video clip URL for coach mechanics check"
              value={formVideoUrls[activeIdx] || ""}
              onChange={(e) => setFormVideoUrls((prev) => ({ ...prev, [activeIdx]: e.target.value }))}
              style={{ fontSize: 13, width: "100%", padding: "6px 10px" }}
            />
          </div>

          {/* Stepper Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <button
              type="button"
              className="btn ghost"
              disabled={activeIdx === 0}
              onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
            >
              ← Previous Exercise
            </button>
            <button
              type="button"
              className="btn"
              disabled={activeIdx === exercises.length - 1}
              onClick={() => setActiveIdx((i) => Math.min(exercises.length - 1, i + 1))}
            >
              Next Exercise →
            </button>
          </div>
        </div>
      )}

      {/* Completion & Final Submit Form */}
      <form action={completeAction} style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 18 }}>
        <input type="hidden" name="id" value={workoutId} />
        {/* Hidden inputs to bridge completed check states into the server action */}
        {exercises.map((_, idx) => (
          <input
            key={idx}
            type="checkbox"
            name={`done_${idx}`}
            checked={!!completedExercises[idx]}
            readOnly
            style={{ display: "none" }}
          />
        ))}

        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Finish &amp; Submit Workout</h3>
        <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
          {allCompletedCount} of {exercises.length} exercises checked. Logging logs your consistency score and alerts your trainer.
        </p>

        <textarea
          name="notes"
          rows={3}
          placeholder="Athlete notes: Overall RPE (Rate of Perceived Exertion), soreness, bar speed, or recovery notes..."
          value={athleteNotes}
          onChange={(e) => setAthleteNotes(e.target.value)}
          style={{ width: "100%", marginBottom: 12, fontSize: 13 }}
        />

        <button type="submit" className="btn needs" disabled={allCompletedCount === 0} style={{ width: "100%", padding: "12px 20px", fontSize: 16 }}>
          Complete Workout &amp; Record Adherence ({adherencePercent}%)
        </button>
      </form>
    </div>
  );
}
