"use client";

import { useState, useEffect, useRef } from "react";

export type StudyTimerProps = {
  courses: string[];
  logAction: (formData: FormData) => void;
};

export function StudyTimer({ courses, logAction }: StudyTimerProps) {
  // Mode: "pomodoro" (25m), "block45" (45m), "block60" (60m), "open"
  const [mode, setMode] = useState<"pomodoro" | "block45" | "block60" | "open">("pomodoro");
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(courses[0] || "");
  const [deliverableProof, setDeliverableProof] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [isBreak, setIsBreak] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Switch modes
  const handleModeChange = (newMode: "pomodoro" | "block45" | "block60" | "open") => {
    setIsRunning(false);
    setElapsedSeconds(0);
    setIsBreak(false);
    setMode(newMode);
    if (newMode === "pomodoro") setTargetMinutes(25);
    else if (newMode === "block45") setTargetMinutes(45);
    else if (newMode === "block60") setTargetMinutes(60);
    else setTargetMinutes(0); // open
  };

  // Timer loop
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Check if countdown target reached
  const targetSeconds = targetMinutes * 60;
  const isTargetMet = targetSeconds > 0 && elapsedSeconds >= targetSeconds;

  const toggleRun = () => {
    if (!isRunning && isTargetMet) {
      setElapsedSeconds(0);
    }
    setIsRunning((r) => !r);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
  };

  // Format seconds into MM:SS or HH:MM:SS
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}:${String(remMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Calculate remaining or elapsed display
  const displayRemaining = targetSeconds > 0 ? Math.max(0, targetSeconds - elapsedSeconds) : elapsedSeconds;
  const loggedMinutes = Math.max(5, Math.min(480, Math.round(elapsedSeconds / 60)));

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <div>
          <span className="badge green">Study Focus Engine</span>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>Pomodoro &amp; Focus Timer</h3>
        </div>
        {/* Preset Mode Buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className={`btn small ${mode === "pomodoro" ? "needs" : "ghost"}`}
            onClick={() => handleModeChange("pomodoro")}
          >
            25m Pomodoro
          </button>
          <button
            type="button"
            className={`btn small ${mode === "block45" ? "needs" : "ghost"}`}
            onClick={() => handleModeChange("block45")}
          >
            45m Block
          </button>
          <button
            type="button"
            className={`btn small ${mode === "block60" ? "needs" : "ghost"}`}
            onClick={() => handleModeChange("block60")}
          >
            60m Study Hall
          </button>
          <button
            type="button"
            className={`btn small ${mode === "open" ? "needs" : "ghost"}`}
            onClick={() => handleModeChange("open")}
          >
            Stopwatch
          </button>
        </div>
      </div>

      {/* Timer Display Box */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          background: isTargetMet ? "var(--ok-soft)" : "var(--panel-2)",
          borderRadius: "var(--r)",
          border: isTargetMet ? "2px solid var(--ok)" : "1px solid var(--line)",
          textAlign: "center",
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 800, fontFamily: "var(--mono)", letterSpacing: "-.03em", color: isTargetMet ? "var(--ok)" : "var(--text)" }}>
          {formatTime(displayRemaining)}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {isTargetMet
            ? "🎉 Focus target completed! Ready to log your verified study time below."
            : isRunning
            ? `${formatTime(elapsedSeconds)} active focus time tracked`
            : "Press Start to begin your accountability block"}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            type="button"
            className={`btn ${isRunning ? "ghost" : "needs"}`}
            onClick={toggleRun}
            style={{ minWidth: 120, padding: "10px 20px" }}
          >
            {isRunning ? "Pause" : elapsedSeconds > 0 ? "Resume" : "Start Focus"}
          </button>
          {elapsedSeconds > 0 && (
            <button type="button" className="btn ghost" onClick={resetTimer}>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Auto-Logging Form for this session */}
      <form action={logAction} style={{ borderTop: "1px solid var(--line)", paddingTop: 16, display: "grid", gap: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14 }}>Log Verified Study Deliverable</h4>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Sessions over 5 minutes count toward the 90-minute weekly competition clearance gate once verified by a parent or manager.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
            Subject / Course
            <select
              name="subject"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              required
              style={{ padding: 8, borderRadius: 8, border: "1px solid var(--line-strong)", background: "var(--panel)", color: "var(--text)" }}
            >
              {courses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="General Study Hall">General Study Hall</option>
              <option value="Film Review & Playbook">Film Review &amp; Playbook</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
            Minutes to Log
            <input
              type="number"
              name="minutes"
              min={5}
              max={480}
              value={loggedMinutes}
              onChange={() => {}}
              required
              style={{ padding: 8, borderRadius: 8, border: "1px solid var(--line-strong)", background: "var(--panel)", color: "var(--text)" }}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 4, fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
          Deliverable Proof &amp; Verification Note
          <input
            type="text"
            name="note"
            placeholder="e.g., Attached photo of completed Chemistry lab report or Canvas submission link"
            value={deliverableProof}
            onChange={(e) => setDeliverableProof(e.target.value)}
            maxLength={300}
            style={{ padding: 8, borderRadius: 8, border: "1px solid var(--line-strong)", background: "var(--panel)", color: "var(--text)" }}
          />
        </label>

        <button
          type="submit"
          className="btn"
          disabled={elapsedSeconds < 60 && !deliverableProof}
          style={{ justifySelf: "start" }}
        >
          Submit Study Session ({loggedMinutes} mins)
        </button>
      </form>
    </div>
  );
}
