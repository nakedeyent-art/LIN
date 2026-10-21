"use client";

import { useState } from "react";
import {
  generateSingleEliminationBracket,
  generateDoubleEliminationBracket,
  updateMatchScore,
  type TournamentBracket as BracketType,
  type Team,
  type Match,
} from "@/lib/brackets";

const SAMPLE_TEAMS_8: Team[] = [
  { id: "tm-1", name: "Metro Hawks Elite", seed: 1, city: "Atlanta", record: "18-2" },
  { id: "tm-2", name: "Bay Area Titans", seed: 2, city: "Oakland", record: "16-4" },
  { id: "tm-3", name: "Windy City United", seed: 3, city: "Chicago", record: "15-5" },
  { id: "tm-4", name: "Lone Star Rebels", seed: 4, city: "Dallas", record: "14-6" },
  { id: "tm-5", name: "Philly Express", seed: 5, city: "Philadelphia", record: "13-7" },
  { id: "tm-6", name: "Miami Surge", seed: 6, city: "Miami", record: "12-8" },
  { id: "tm-7", name: "Seattle Cascade", seed: 7, city: "Seattle", record: "11-9" },
  { id: "tm-8", name: "Denver Summit", seed: 8, city: "Denver", record: "10-10" },
];

export function TournamentBracketManager({
  initialEventName = "Midwest Summer Invitational",
  initialSport = "Basketball",
  userRole,
}: {
  initialEventName?: string;
  initialSport?: string;
  userRole?: string;
}) {
  const [format, setFormat] = useState<"single_elimination" | "double_elimination">("single_elimination");
  const [bracket, setBracket] = useState<BracketType>(() =>
    generateSingleEliminationBracket(initialEventName, initialSport, SAMPLE_TEAMS_8)
  );
  const [activeTab, setActiveTab] = useState<"bracket" | "schedule">("bracket");
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState<string>("");
  const [scoreB, setScoreB] = useState<string>("");
  const [isFinal, setIsFinal] = useState<boolean>(false);

  const canManageScores = ["tournament_manager", "coach", "gym_owner", "manager", "admin"].includes(
    userRole ?? "tournament_manager"
  );

  const handleFormatChange = (newFormat: "single_elimination" | "double_elimination") => {
    setFormat(newFormat);
    if (newFormat === "double_elimination") {
      setBracket(generateDoubleEliminationBracket(initialEventName, initialSport, SAMPLE_TEAMS_8));
    } else {
      setBracket(generateSingleEliminationBracket(initialEventName, initialSport, SAMPLE_TEAMS_8));
    }
  };

  const openScoreModal = (match: Match) => {
    if (!canManageScores || !match.teamA || !match.teamB) return;
    setScoringMatch(match);
    setScoreA(match.scoreA !== undefined ? String(match.scoreA) : "");
    setScoreB(match.scoreB !== undefined ? String(match.scoreB) : "");
    setIsFinal(match.status === "final");
  };

  const handleSaveScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoringMatch) return;

    const sA = parseInt(scoreA, 10) || 0;
    const sB = parseInt(scoreB, 10) || 0;

    const updated = updateMatchScore(bracket, scoringMatch.id, sA, sB, isFinal);
    setBracket(updated);
    setScoringMatch(null);
  };

  // Extract all matches for court schedule
  const allMatches: Match[] = [];
  for (const r of bracket.rounds) {
    for (const m of r.matches) {
      allMatches.push(m);
    }
  }

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
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{bracket.name}</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: "var(--panel-2)",
                border: "1px solid var(--line)",
                padding: "2px 8px",
                borderRadius: 4,
                color: "var(--primary)",
              }}
            >
              {bracket.sport} · {format === "double_elimination" ? "Double Elimination" : "Single Elimination"}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {format === "double_elimination"
              ? "Winners & Losers Consolidation Engine · Teams: 8 · Guaranteed 2+ Games"
              : `Single Elimination Tournament Engine · Registered Teams: ${bracket.teams.length}`}
          </div>
        </div>

        {/* Format & View Switcher */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, background: "var(--panel-2)", padding: 3, borderRadius: 6, border: "1px solid var(--line)" }}>
            <button
              type="button"
              className={`btn small ${format === "single_elimination" ? "" : "ghost"}`}
              onClick={() => handleFormatChange("single_elimination")}
              style={{ fontSize: 11, padding: "3px 8px" }}
            >
              Single Elim
            </button>
            <button
              type="button"
              className={`btn small ${format === "double_elimination" ? "" : "ghost"}`}
              onClick={() => handleFormatChange("double_elimination")}
              style={{ fontSize: 11, padding: "3px 8px" }}
            >
              Double Elim
            </button>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className={`btn small ${activeTab === "bracket" ? "" : "ghost"}`}
              onClick={() => setActiveTab("bracket")}
            >
              Bracket Tree
            </button>
            <button
              type="button"
              className={`btn small ${activeTab === "schedule" ? "" : "ghost"}`}
              onClick={() => setActiveTab("schedule")}
            >
              Court Schedule
            </button>
          </div>
        </div>
      </div>


      {/* Bracket Tree View */}
      {activeTab === "bracket" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${bracket.rounds.length}, minmax(260px, 1fr))`,
            gap: 20,
            overflowX: "auto",
            paddingBottom: 12,
          }}
        >
          {bracket.rounds.map((round) => (
            <div key={round.round} style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "var(--muted)",
                  padding: "6px 8px",
                  background: "var(--panel-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                {round.roundName} ({round.matches.length} {round.matches.length === 1 ? "Game" : "Games"})
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-around",
                  flexGrow: 1,
                  gap: 16,
                }}
              >
                {round.matches.map((match) => {
                  const isReady = match.teamA && match.teamB;
                  const winnerA = match.status === "final" && match.winnerId === match.teamA?.id;
                  const winnerB = match.status === "final" && match.winnerId === match.teamB?.id;

                  return (
                    <div
                      key={match.id}
                      onClick={() => isReady && canManageScores && openScoreModal(match)}
                      style={{
                        background: "var(--panel-2)",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: 12,
                        cursor: isReady && canManageScores ? "pointer" : "default",
                        transition: "border-color 0.15s, transform 0.1s",
                        position: "relative",
                      }}
                      title={isReady && canManageScores ? "Click to update score & mark final" : undefined}
                    >
                      {/* Match metadata bar */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 11,
                          color: "var(--muted)",
                          marginBottom: 8,
                          borderBottom: "1px solid var(--line)",
                          paddingBottom: 4,
                        }}
                      >
                        <span>
                          {match.court} · {match.scheduledTime}
                        </span>
                        <span>
                          {match.status === "final" && (
                            <span style={{ color: "var(--primary)", fontWeight: 700 }}>FINAL</span>
                          )}
                          {match.status === "live" && (
                            <span style={{ color: "var(--ok)", fontWeight: 700 }}>● LIVE</span>
                          )}
                          {match.status === "scheduled" && <span>Upcoming</span>}
                        </span>
                      </div>

                      {/* Team A row */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 8px",
                          borderRadius: 4,
                          background: winnerA ? "rgba(20, 184, 166, 0.12)" : "transparent",
                          fontWeight: winnerA ? 700 : 500,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          {match.teamA?.seed && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "var(--muted)",
                                background: "var(--panel)",
                                padding: "1px 4px",
                                borderRadius: 3,
                              }}
                            >
                              #{match.teamA.seed}
                            </span>
                          )}
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 13,
                              color: match.teamA ? "var(--text)" : "var(--muted)",
                            }}
                          >
                            {match.teamA ? match.teamA.name : "TBD"}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 14,
                            fontWeight: 700,
                            color: winnerA ? "var(--primary)" : "var(--text)",
                          }}
                        >
                          {match.scoreA !== undefined ? match.scoreA : "—"}
                        </span>
                      </div>

                      {/* Team B row */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 8px",
                          borderRadius: 4,
                          background: winnerB ? "rgba(20, 184, 166, 0.12)" : "transparent",
                          fontWeight: winnerB ? 700 : 500,
                          marginTop: 2,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          {match.teamB?.seed && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "var(--muted)",
                                background: "var(--panel)",
                                padding: "1px 4px",
                                borderRadius: 3,
                              }}
                            >
                              #{match.teamB.seed}
                            </span>
                          )}
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 13,
                              color: match.teamB ? "var(--text)" : "var(--muted)",
                            }}
                          >
                            {match.teamB ? match.teamB.name : "TBD"}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: "var(--mono)",
                            fontSize: 14,
                            fontWeight: 700,
                            color: winnerB ? "var(--primary)" : "var(--text)",
                          }}
                        >
                          {match.scoreB !== undefined ? match.scoreB : "—"}
                        </span>
                      </div>

                      {isReady && canManageScores && (
                        <div
                          className="muted"
                          style={{
                            fontSize: 10,
                            textAlign: "right",
                            marginTop: 4,
                            opacity: 0.7,
                          }}
                        >
                          Click to enter score ✎
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Court Schedule View */}
      {activeTab === "schedule" && (
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "8px 6px" }}>Round</th>
                <th style={{ padding: "8px 6px" }}>Time</th>
                <th style={{ padding: "8px 6px" }}>Court</th>
                <th style={{ padding: "8px 6px" }}>Matchup</th>
                <th style={{ padding: "8px 6px" }}>Score</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {allMatches.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 6px", fontWeight: 600 }}>{m.roundName}</td>
                  <td style={{ padding: "10px 6px", fontFamily: "var(--mono)", color: "var(--muted)" }}>
                    {m.scheduledTime}
                  </td>
                  <td style={{ padding: "10px 6px" }}>{m.court}</td>
                  <td style={{ padding: "10px 6px" }}>
                    {m.teamA?.name ?? "TBD"} vs {m.teamB?.name ?? "TBD"}
                  </td>
                  <td style={{ padding: "10px 6px", fontFamily: "var(--mono)", fontWeight: 700 }}>
                    {m.scoreA !== undefined && m.scoreB !== undefined ? `${m.scoreA} - ${m.scoreB}` : "—"}
                  </td>
                  <td style={{ padding: "10px 6px" }}>
                    {m.status === "final" && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--primary)",
                          background: "rgba(20, 184, 166, 0.12)",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        Final
                      </span>
                    )}
                    {m.status === "live" && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--ok)",
                          background: "rgba(34, 197, 94, 0.12)",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        Live
                      </span>
                    )}
                    {m.status === "scheduled" && <span className="muted" style={{ fontSize: 12 }}>Scheduled</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Score input modal */}
      {scoringMatch && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r)",
              padding: 24,
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                Scorekeeper: {scoringMatch.roundName}
              </h3>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setScoringMatch(null)}
                style={{ padding: "2px 8px" }}
              >
                ✕
              </button>
            </div>

            <div className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
              {scoringMatch.court} · {scoringMatch.scheduledTime}
            </div>

            <form onSubmit={handleSaveScore} style={{ display: "grid", gap: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
                    #{scoringMatch.teamA?.seed} SEED
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{scoringMatch.teamA?.name}</div>
                </div>
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  placeholder="0"
                  style={{
                    padding: "8px 10px",
                    fontFamily: "var(--mono)",
                    fontSize: 18,
                    fontWeight: 700,
                    textAlign: "center",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--panel-2)",
                    color: "var(--text)",
                  }}
                  required
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 80px",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>
                    #{scoringMatch.teamB?.seed} SEED
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{scoringMatch.teamB?.name}</div>
                </div>
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  placeholder="0"
                  style={{
                    padding: "8px 10px",
                    fontFamily: "var(--mono)",
                    fontSize: 18,
                    fontWeight: 700,
                    textAlign: "center",
                    borderRadius: 6,
                    border: "1px solid var(--line)",
                    background: "var(--panel-2)",
                    color: "var(--text)",
                  }}
                  required
                />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 4, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isFinal}
                  onChange={(e) => setIsFinal(e.target.checked)}
                />
                <span><strong>Game is Final</strong> (Winner automatically advances to next round)</span>
              </label>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="submit" className="btn" style={{ flex: 1 }}>
                  Save & Update Bracket
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setScoringMatch(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
