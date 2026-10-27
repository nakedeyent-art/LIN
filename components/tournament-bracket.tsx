"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type TournamentBracket as BracketType,
  type Team,
  type Match,
} from "@/lib/brackets";
import {
  createOrResetBracketAction,
  recordScoreAction,
  deleteBracketAction,
} from "@/app/dashboard/events/actions";

export type EventSummary = {
  id: string;
  name: string;
  sport: string;
  location?: string | null;
  day: string;
  status: string;
};

const DEFAULT_SEEDS_8: Array<{ seed: number; name: string; city: string }> = [
  { seed: 1, name: "Metro Hawks Elite", city: "Atlanta" },
  { seed: 2, name: "Bay Area Titans", city: "Oakland" },
  { seed: 3, name: "Windy City United", city: "Chicago" },
  { seed: 4, name: "Lone Star Rebels", city: "Dallas" },
  { seed: 5, name: "Philly Express", city: "Philadelphia" },
  { seed: 6, name: "Miami Surge", city: "Miami" },
  { seed: 7, name: "Seattle Cascade", city: "Seattle" },
  { seed: 8, name: "Denver Summit", city: "Denver" },
];

const DEFAULT_SEEDS_4: Array<{ seed: number; name: string; city: string }> = [
  { seed: 1, name: "Metro Hawks Elite", city: "Atlanta" },
  { seed: 2, name: "Bay Area Titans", city: "Oakland" },
  { seed: 3, name: "Windy City United", city: "Chicago" },
  { seed: 4, name: "Lone Star Rebels", city: "Dallas" },
];

export function TournamentBracketManager({
  event,
  bracket,
  userRole,
  allEvents = [],
}: {
  event?: EventSummary | null;
  bracket?: BracketType | null;
  userRole?: string;
  allEvents?: EventSummary[];
}) {
  const [activeTab, setActiveTab] = useState<"bracket" | "schedule">("bracket");
  const [scoringMatch, setScoringMatch] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState<string>("");
  const [scoreB, setScoreB] = useState<string>("");
  const [isFinal, setIsFinal] = useState<boolean>(false);

  // Bracket creation state (when no bracket exists)
  const [createFormat, setCreateFormat] = useState<"single_elimination" | "double_elimination">("single_elimination");
  const [teamCount, setTeamCount] = useState<4 | 8>(8);
  const [setupTeams, setSetupTeams] = useState<Array<{ seed: number; name: string; city: string }>>(DEFAULT_SEEDS_8);

  const canManageScores = ["tournament_manager", "coach", "gym_owner", "manager", "admin"].includes(
    userRole ?? "tournament_manager"
  );

  const handleTeamCountChange = (count: 4 | 8) => {
    setTeamCount(count);
    setSetupTeams(count === 4 ? DEFAULT_SEEDS_4 : DEFAULT_SEEDS_8);
  };

  const handleTeamNameChange = (index: number, newName: string) => {
    const updated = [...setupTeams];
    updated[index].name = newName;
    setSetupTeams(updated);
  };

  const handleTeamCityChange = (index: number, newCity: string) => {
    const updated = [...setupTeams];
    updated[index].city = newCity;
    setSetupTeams(updated);
  };

  const openScoreModal = (match: Match) => {
    if (!canManageScores || !match.teamA || !match.teamB) return;
    setScoringMatch(match);
    setScoreA(match.scoreA !== undefined ? String(match.scoreA) : "");
    setScoreB(match.scoreB !== undefined ? String(match.scoreB) : "");
    setIsFinal(match.status === "final");
  };

  if (!event) {
    return (
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r)",
          padding: 24,
          marginBottom: 24,
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 32 }}>🏆</span>
        <h3 style={{ margin: "12px 0 6px" }}>No Tournament Selected</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Create an event using the form below to initialize a live tournament bracket and court schedule.
        </p>
      </div>
    );
  }

  // Extract all matches for court schedule
  const allMatches: Match[] = [];
  if (bracket) {
    for (const r of bracket.rounds) {
      for (const m of r.matches) {
        allMatches.push(m);
      }
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
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{event.name}</h2>
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
              {event.sport} · {bracket ? (bracket.format === "double_elimination" ? "Double Elimination" : "Single Elimination") : "No Bracket Generated"}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                background: event.status === "published" ? "rgba(34, 197, 94, 0.12)" : "var(--panel-2)",
                color: event.status === "published" ? "var(--ok)" : "var(--muted)",
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid var(--line)",
              }}
            >
              {event.status}
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {bracket
              ? (bracket.format === "double_elimination"
                  ? `Double Elimination Bracket · ${bracket.teams.length} Teams · Guaranteed 2+ Games · Persisted in PostgreSQL`
                  : `Single Elimination Tournament Bracket · ${bracket.teams.length} Registered Teams · Persisted in PostgreSQL`)
              : `Event Date: ${event.day}${event.location ? ` · ${event.location}` : ""} · Configure participating seeds below`}
          </div>
        </div>

        {/* Event selector & navigation */}
        {allEvents.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Switch Event:</span>
            <select
              defaultValue={event.id}
              onChange={(e) => {
                window.location.href = `/dashboard/events?event=${encodeURIComponent(e.target.value)}`;
              }}
              style={{
                padding: "4px 8px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--panel-2)",
                color: "var(--text)",
              }}
            >
              {allEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.sport})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* View Switcher and Actions */}
        {bracket && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
                Court Schedule ({allMatches.length})
              </button>
            </div>

            {canManageScores && (
              <form action={deleteBracketAction} style={{ display: "inline" }}>
                <input type="hidden" name="event_id" value={event.id} />
                <button
                  type="submit"
                  className="btn ghost small"
                  style={{ color: "var(--err)", borderColor: "var(--line)", fontSize: 11 }}
                  onClick={(e) => {
                    if (!confirm("Are you sure you want to delete this tournament bracket? All recorded scores and match seeds will be cleared.")) {
                      e.preventDefault();
                    }
                  }}
                >
                  Delete Bracket
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Bracket Creation Form (When No Bracket Exists for this Event) */}
      {!bracket && (
        <div style={{ padding: "8px 0" }}>
          <div
            style={{
              background: "var(--panel-2)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r)",
              padding: 20,
              maxWidth: 700,
              margin: "0 auto",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Initialize Official Tournament Bracket</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Configure the tournament format and participating teams for <strong>{event.name}</strong>.
              All seeded matchups and court assignments will be persisted directly to the database.
            </p>

            <form action={createOrResetBracketAction} style={{ display: "grid", gap: 16 }}>
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="format" value={createFormat} />
              <input type="hidden" name="teams_json" value={JSON.stringify(setupTeams)} />

              {/* Format selection */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                  TOURNAMENT FORMAT
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={`btn small ${createFormat === "single_elimination" ? "" : "ghost"}`}
                    onClick={() => setCreateFormat("single_elimination")}
                    style={{ flex: 1, padding: "8px 12px" }}
                  >
                    🏆 Single Elimination
                  </button>
                  <button
                    type="button"
                    className={`btn small ${createFormat === "double_elimination" ? "" : "ghost"}`}
                    onClick={() => setCreateFormat("double_elimination")}
                    style={{ flex: 1, padding: "8px 12px" }}
                  >
                    🔄 Double Elimination (Consolation)
                  </button>
                </div>
              </div>

              {/* Team count selection */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 6 }}>
                  BRACKET CAPACITY
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={`btn small ${teamCount === 4 ? "" : "ghost"}`}
                    onClick={() => handleTeamCountChange(4)}
                    style={{ flex: 1 }}
                  >
                    4 Teams (Semifinals + Final)
                  </button>
                  <button
                    type="button"
                    className={`btn small ${teamCount === 8 ? "" : "ghost"}`}
                    onClick={() => handleTeamCountChange(8)}
                    style={{ flex: 1 }}
                  >
                    8 Teams (Quarterfinals + Semis + Final)
                  </button>
                </div>
              </div>

              {/* Seeded Team Roster */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 8 }}>
                  SEEDED TEAMS & SEED NUMBERS
                </label>
                <div style={{ display: "grid", gap: 8 }}>
                  {setupTeams.map((team, idx) => (
                    <div
                      key={team.seed}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "50px 1fr 140px",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          textAlign: "center",
                          background: "var(--panel)",
                          padding: "6px 8px",
                          borderRadius: 4,
                          border: "1px solid var(--line)",
                        }}
                      >
                        #{team.seed}
                      </span>
                      <input
                        type="text"
                        value={team.name}
                        onChange={(e) => handleTeamNameChange(idx, e.target.value)}
                        placeholder={`Seed #${team.seed} Team Name`}
                        required
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--line)",
                          background: "var(--panel)",
                          color: "var(--text)",
                          fontSize: 13,
                        }}
                      />
                      <input
                        type="text"
                        value={team.city}
                        onChange={(e) => handleTeamCityChange(idx, e.target.value)}
                        placeholder="City / Region"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--line)",
                          background: "var(--panel)",
                          color: "var(--text)",
                          fontSize: 13,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn" style={{ padding: "10px 16px", marginTop: 4 }}>
                Generate & Save Official Tournament Bracket →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bracket Tree View */}
      {bracket && activeTab === "bracket" && (
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
      {bracket && activeTab === "schedule" && (
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

            <form action={recordScoreAction} style={{ display: "grid", gap: 14 }}>
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="match_key" value={scoringMatch.id} />

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
                  name="score_a"
                  min="0"
                  max="999"
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
                  name="score_b"
                  min="0"
                  max="999"
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
                  name="is_final"
                  checked={isFinal}
                  onChange={(e) => setIsFinal(e.target.checked)}
                />
                <span><strong>Game is Final</strong> (Winner automatically advances in database)</span>
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
