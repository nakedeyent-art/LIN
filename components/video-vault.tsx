"use client";

import { useState } from "react";
import {
  createVideoClip,
  filterClipsBySkill,
  generateRecruiterShareToken,
  type HighlightReel,
  type VideoClip,
  type SkillCategory,
} from "@/lib/video-vault";

const SAMPLE_REELS: HighlightReel[] = [
  {
    id: "reel-1",
    athleteId: "ath-marcus",
    athleteName: "Marcus Johnson",
    sport: "Basketball",
    title: "Peach Jam Showcase - 28 PTS, 8 AST, 4 STL",
    gameOrEvent: "Nike EYBL Peach Jam · Augusta, GA",
    videoUrl: "https://example.com/film/marcus-peachjam.mp4",
    durationSeconds: 185,
    recordedDate: "Jul 15, 2026",
    verifiedGameFilm: true,
    clips: [
      {
        id: "c-1",
        timestamp: "00:24",
        seconds: 24,
        title: "Pick & Roll Pocket Pass",
        skillCategory: "Playmaking & Passing",
        description: "Patiently read hedging big, delivered tight bounce pass in stride for dunk.",
        rating: 5,
      },
      {
        id: "c-2",
        timestamp: "00:58",
        seconds: 58,
        title: "Contested Step-back 3PT",
        skillCategory: "Shooting & Shot Creation",
        description: "Right-to-left crossover into balanced step-back against length at top of the key.",
        rating: 5,
      },
      {
        id: "c-3",
        timestamp: "01:32",
        seconds: 92,
        title: "Transition Chase-down Block",
        skillCategory: "On-Ball Defense",
        description: "Sprint recovery from half-court; pinned transition layup off the backboard.",
        rating: 4,
      },
      {
        id: "c-4",
        timestamp: "02:15",
        seconds: 135,
        title: "Weakside Help & Turnover Read",
        skillCategory: "Basketball IQ & Read",
        description: "Anticipated skip pass, intercepted at high line and pushed fast break.",
        rating: 5,
      },
      {
        id: "c-5",
        timestamp: "02:45",
        seconds: 165,
        title: "Explosive Rim Attack & And-One",
        skillCategory: "Athleticism & Transition",
        description: "Absorbed heavy contact from secondary rim protector, finished with right hand.",
        rating: 4,
      },
    ],
  },
  {
    id: "reel-2",
    athleteId: "ath-marcus",
    athleteName: "Marcus Johnson",
    sport: "Basketball",
    title: "State Championship Finals Film (Clutch Plays)",
    gameOrEvent: "IHSA Class 4A State Finals · Champaign, IL",
    videoUrl: "https://example.com/film/marcus-state-finals.mp4",
    durationSeconds: 210,
    recordedDate: "Mar 18, 2026",
    verifiedGameFilm: true,
    clips: [
      {
        id: "c-201",
        timestamp: "00:35",
        seconds: 35,
        title: "Game-tying 3PT off Flare Screen",
        skillCategory: "Shooting & Shot Creation",
        description: "Quick release off catch-and-shoot flare action with 45 seconds remaining.",
        rating: 5,
      },
      {
        id: "c-202",
        timestamp: "01:45",
        seconds: 105,
        title: "Full-court Pressure Strip",
        skillCategory: "On-Ball Defense",
        description: "Active hands on inbounds press; poke-away steal leading to fast break.",
        rating: 4,
      },
    ],
  },
];

export function VideoVault({
  initialReels,
  athleteName = "Prospect Film",
  sport = "Basketball",
  userRole = "recruiter",
}: {
  initialReels?: HighlightReel[];
  athleteName?: string;
  sport?: string;
  userRole?: string;
}) {
  const hasLive = Boolean(initialReels && initialReels.length > 0);
  const [mode, setMode] = useState<"live" | "demo">(hasLive ? "live" : "live");
  const reels = mode === "demo" ? SAMPLE_REELS : initialReels ?? [];
  const [selectedReelId, setSelectedReelId] = useState<string>(reels[0]?.id ?? "");
  const [selectedSkill, setSelectedSkill] = useState<string>("All Skills");
  const [activeClipId, setActiveClipId] = useState<string>(reels[0]?.clips[0]?.id ?? "");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Recruiter custom clip markers
  const [extraClips, setExtraClips] = useState<Record<string, VideoClip[]>>({});
  const [showAddClip, setShowAddClip] = useState<boolean>(false);
  const [newTimestamp, setNewTimestamp] = useState<string>("01:30");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newCategory, setNewCategory] = useState<SkillCategory>("Shooting & Shot Creation");
  const [newDesc, setNewDesc] = useState<string>("");
  const [newRating, setNewRating] = useState<number>(4);

  const activeReel = reels.find((r) => r.id === selectedReelId) ?? reels[0];
  const allReelClips = activeReel ? [...activeReel.clips, ...(extraClips[activeReel.id] || [])] : [];
  const filteredClips = filterClipsBySkill(allReelClips, selectedSkill);
  const activeClip = allReelClips.find((c) => c.id === activeClipId) ?? allReelClips[0] ?? null;

  const handleAddClip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReel || !newTitle.trim()) return;
    const clip = createVideoClip({
      timestamp: newTimestamp,
      title: newTitle,
      skillCategory: newCategory,
      description: newDesc,
      rating: newRating,
    });
    setExtraClips((prev) => ({
      ...prev,
      [activeReel.id]: [...(prev[activeReel.id] || []), clip],
    }));
    setActiveClipId(clip.id);
    setNewTitle("");
    setNewDesc("");
    setShowAddClip(false);
  };

  const skillOptions: SkillCategory[] = [
    "All Skills",
    "Shooting & Shot Creation",
    "Playmaking & Passing",
    "On-Ball Defense",
    "Basketball IQ & Read",
    "Athleticism & Transition",
  ];

  const handleCopyRecruiterLink = () => {
    if (!activeReel) return;
    const token = generateRecruiterShareToken(activeReel.athleteId, activeReel.id, 30);
    const link = `https://lin-nil.com/scouting/vault?prospect=${activeReel.athleteId}&token=${token}${mode === "demo" ? "&demo=1" : ""}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🎬</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Film & Highlight Vault</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: "rgba(20, 184, 166, 0.1)",
                color: "var(--primary)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid var(--line)",
              }}
            >
              {sport} · {hasLive || mode === "demo" ? "Recruiter Reel Vault" : "No Film Uploaded"}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {mode === "demo"
              ? "Sandbox Film Simulation · 2 Highlight Reels · Skill Breakdowns & Recruiter Share Links"
              : hasLive
              ? "Verified Prospect Film Reels from Database"
              : "No highlight reels on your scouting board yet."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className={`btn small ${mode === "demo" ? "" : "ghost"}`}
            onClick={() => setMode((m) => (m === "live" ? "demo" : "live"))}
            style={{ fontSize: 12 }}
          >
            {mode === "demo" ? "← Back to Live Scouting" : "Sandbox Film Simulation"}
          </button>
          {activeReel && (
            <button
              type="button"
              className="btn small"
              onClick={handleCopyRecruiterLink}
            >
              {copiedLink ? "✓ Link Copied!" : "🔗 Share Reel with Recruiter"}
            </button>
          )}
        </div>
      </div>

      {mode === "demo" && (
        <div
          style={{
            background: "rgba(234, 179, 8, 0.12)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            borderRadius: 6,
            padding: "8px 12px",
            marginBottom: 16,
            fontSize: 12,
            color: "var(--text)",
          }}
        >
          <strong>⚠️ Sandbox Simulation (Sample Film Data):</strong> Displaying sample game film and skill breakdowns for recruiter evaluation testing.
        </div>
      )}

      {mode === "live" && !hasLive && (
        <div
          style={{
            textAlign: "center",
            padding: "36px 16px",
            background: "var(--panel-2)",
            borderRadius: 8,
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ fontSize: 32 }}>📹</span>
          <h3 style={{ margin: "10px 0 6px", fontSize: 16 }}>No Highlight Film Available</h3>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
            Add video attachments to prospect scouting evaluations to populate the recruiter highlight vault.
          </p>
          <button
            type="button"
            className="btn small ghost"
            onClick={() => setMode("demo")}
          >
            Explore Sandbox Highlight Vault (Demo Film) →
          </button>
        </div>
      )}

      {!(mode === "live" && !hasLive) && activeReel && (
        <>
        {/* Reel Selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {reels.map((r) => {
          const isSelected = r.id === activeReel.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setSelectedReelId(r.id);
                setActiveClipId(r.clips[0]?.id ?? "");
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: isSelected ? "1px solid var(--primary)" : "1px solid var(--line)",
                background: isSelected ? "rgba(20, 184, 166, 0.1)" : "var(--panel-2)",
                color: isSelected ? "var(--primary)" : "var(--text)",
                textAlign: "left",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontSize: 12,
                fontWeight: isSelected ? 700 : 500,
              }}
            >
              <div>{r.title}</div>
              <div className="muted" style={{ fontSize: 10 }}>{r.gameOrEvent}</div>
            </button>
          );
        })}
      </div>

      {/* Video Vault Main Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {/* Video Player & Active Clip Info */}
        <div>
          {/* Simulated Premium Video Player Screen */}
          <div
            style={{
              background: "#09090b",
              borderRadius: 8,
              border: "1px solid var(--line)",
              aspectRatio: "16 / 9",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 16,
              color: "#fff",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Top Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 2 }}>
              <span style={{ fontSize: 11, background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: 4 }}>
                {activeReel.gameOrEvent}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  background: "var(--primary)",
                  color: "#000",
                  fontWeight: 800,
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {activeClip ? activeClip.timestamp : "00:00"} / 03:05
              </span>
            </div>

            {/* Center Focus Badge */}
            <div style={{ textAlign: "center", zIndex: 2 }}>
              <div
                style={{
                  display: "inline-block",
                  background: "rgba(20, 184, 166, 0.25)",
                  border: "1px solid var(--primary)",
                  borderRadius: 8,
                  padding: "8px 16px",
                  backdropFilter: "blur(4px)",
                }}
              >
                <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--primary)" }}>
                  {activeClip?.skillCategory ?? "Live Clip"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{activeClip?.title ?? "Play Clip"}</div>
              </div>
            </div>

            {/* Bottom Scrubber */}
            <div style={{ zIndex: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a1a1aa", marginBottom: 4 }}>
                <span>▶ Playing Timestamped Play #{activeClip?.id.replace("c-", "")}</span>
                <span>HD 1080p · 60 FPS</span>
              </div>
              <div style={{ height: 4, background: "#27272a", borderRadius: 2, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${activeClip ? (activeClip.seconds / activeReel.durationSeconds) * 100 : 25}%`,
                    background: "var(--primary)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Active Clip Details */}
          {activeClip && (
            <div
              style={{
                marginTop: 12,
                background: "var(--panel-2)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {activeClip.timestamp} — {activeClip.title}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--primary)",
                    fontWeight: 700,
                  }}
                >
                  {"★".repeat(activeClip.rating ?? 5)} ({activeClip.rating}/5)
                </span>
              </div>
              <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.45 }}>
                {activeClip.description}
              </p>
            </div>
          )}
        </div>

        {/* Clip List & Skill Filters */}
        <div>
          {/* Skill Tag Filters */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
            {skillOptions.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => setSelectedSkill(skill)}
                className={`btn small ${selectedSkill === skill ? "" : "ghost"}`}
                style={{ fontSize: 11, padding: "3px 8px" }}
              >
                {skill}
              </button>
            ))}
          </div>

          {/* Clips List */}
          <div style={{ display: "grid", gap: 8, maxHeight: 340, overflowY: "auto" }}>
            {filteredClips.map((clip) => {
              const isClipActive = clip.id === activeClip?.id;
              return (
                <div
                  key={clip.id}
                  onClick={() => setActiveClipId(clip.id)}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    border: isClipActive ? "1px solid var(--primary)" : "1px solid var(--line)",
                    background: isClipActive ? "rgba(20, 184, 166, 0.1)" : "var(--panel-2)",
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          fontWeight: 800,
                          background: "var(--panel)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          color: "var(--primary)",
                        }}
                      >
                        {clip.timestamp}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{clip.title}</span>
                    </div>
                    <span className="muted" style={{ fontSize: 10 }}>
                      {clip.skillCategory.split(" ")[0]}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {clip.description}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recruiter Clip Marker Action */}
          <div style={{ marginTop: 10 }}>
            {!showAddClip ? (
              <button
                type="button"
                className="btn small ghost"
                onClick={() => setShowAddClip(true)}
                style={{ width: "100%", fontSize: 12, justifyContent: "center" }}
              >
                + Drop Timestamp Marker & Tag Skill
              </button>
            ) : (
              <form
                onSubmit={handleAddClip}
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--primary)",
                  borderRadius: 6,
                  padding: 12,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 12 }}>Tag Film Sequence</strong>
                  <button
                    type="button"
                    className="muted"
                    onClick={() => setShowAddClip(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                  <label style={{ fontSize: 11 }}>
                    Timestamp (mm:ss)
                    <input
                      type="text"
                      value={newTimestamp}
                      onChange={(e) => setNewTimestamp(e.target.value)}
                      placeholder="01:30"
                      required
                      style={{ width: "100%", marginTop: 2, padding: "4px 6px", fontSize: 12 }}
                    />
                  </label>
                  <label style={{ fontSize: 11 }}>
                    Clip Title
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Catch & Shoot 3PT"
                      required
                      style={{ width: "100%", marginTop: 2, padding: "4px 6px", fontSize: 12 }}
                    />
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                  <label style={{ fontSize: 11 }}>
                    Skill Category
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as SkillCategory)}
                      style={{ width: "100%", marginTop: 2, padding: "4px 6px", fontSize: 12 }}
                    >
                      {skillOptions.filter((s) => s !== "All Skills").map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontSize: 11 }}>
                    Scout Rating (1-5)
                    <select
                      value={newRating}
                      onChange={(e) => setNewRating(Number(e.target.value))}
                      style={{ width: "100%", marginTop: 2, padding: "4px 6px", fontSize: 12 }}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>{n} Stars</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label style={{ fontSize: 11 }}>
                  Observation & Evaluation Notes
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Scouting evaluation on footwork, mechanics, decision..."
                    style={{ width: "100%", marginTop: 2, padding: "4px 6px", fontSize: 12 }}
                  />
                </label>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button type="button" className="btn small ghost" onClick={() => setShowAddClip(false)} style={{ fontSize: 11 }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn small" style={{ fontSize: 11 }}>
                    Save Marker
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Recruiter Projection Box */}
          <div
            style={{
              marginTop: 14,
              background: "var(--panel-2)",
              border: "1px solid var(--line)",
              borderRadius: 6,
              padding: 10,
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 10, color: "var(--muted)" }}>
                Recruiter College Projection
              </span>
              <span style={{ color: "var(--ok)", fontWeight: 800, fontSize: 11 }}>
                NCAA Division I · High Major
              </span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              Elite decision-making out of high ball screens. Wingspan and lateral agility project as high-level perimeter defender.
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
