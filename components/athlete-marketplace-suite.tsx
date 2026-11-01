"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type AthleteDirectoryItem,
  type AthleteFilterCriteria,
  filterAthletes,
  getAvailableSports,
  getAvailableStates,
  getAthleteStats,
  buildCredentialForDirectoryAthlete,
} from "@/lib/athlete-directory";
import { DigitalNilPassCard } from "@/components/digital-nil-pass-card";
import { CampaignDispatcherHub } from "@/components/campaign-dispatcher-hub";
import { RateCardKit } from "@/components/rate-card-kit";
import { trackAthlete } from "@/app/dashboard/athletes/actions";

interface AthleteMarketplaceSuiteProps {
  initialAthletes: AthleteDirectoryItem[];
  viewerRole: string;
  viewerUserId: string;
}

export function AthleteMarketplaceSuite({
  initialAthletes,
  viewerRole,
  viewerUserId,
}: AthleteMarketplaceSuiteProps) {
  const [activeTab, setActiveTab] = useState<"directory" | "pass_studio" | "campaign_dispatch" | "rate_calculator">("directory");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [selectedLevel, setSelectedLevel] = useState<"all" | "high_school" | "college">("all");
  const [selectedState, setSelectedState] = useState<string>("All");
  const [minorStatus, setMinorStatus] = useState<"all" | "minor_only" | "adult_only">("all");
  const [sortBy, setSortBy] = useState<"name" | "valuation_desc" | "followers_desc" | "grad_year">("valuation_desc");

  // Modal / Inspection state
  const [inspectingAthlete, setInspectingAthlete] = useState<AthleteDirectoryItem | null>(null);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  const filterCriteria: AthleteFilterCriteria = {
    searchQuery,
    sport: selectedSport,
    level: selectedLevel,
    state: selectedState,
    minorStatus,
    sortBy,
  };

  const filteredAthletes = filterAthletes(initialAthletes, filterCriteria);
  const availableSports = getAvailableSports(initialAthletes);
  const availableStates = getAvailableStates(initialAthletes);
  const stats = getAthleteStats(initialAthletes);

  const isRecruiter = viewerRole === "recruiter";
  const canMakeOffers = ["sponsor", "booster", "gym_owner"].includes(viewerRole);

  const inspectedCredential = inspectingAthlete ? buildCredentialForDirectoryAthlete(inspectingAthlete) : null;

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2500);
  };

  const handleDownloadWalletJson = (athlete: AthleteDirectoryItem) => {
    const cred = buildCredentialForDirectoryAthlete(athlete);
    const blob = new Blob([JSON.stringify(cred, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${athlete.fullName.toLowerCase().replace(/\s+/g, "-")}-nil-credential.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ marginTop: 14 }}>
      {/* Metrics Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: "12px 16px",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Discoverable
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {stats.total} Athletes
          </div>
          <div style={{ fontSize: 12, color: "#22c55e", marginTop: 2 }}>
            ● 100% Opted In &amp; Email Verified
          </div>
        </div>

        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: "12px 16px",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Verified NIL Passes
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#38bdf8", marginTop: 4 }}>
            {stats.verifiedPassCount} Passes
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            SHA-256 Cryptographic Hash
          </div>
        </div>

        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: "12px 16px",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Scholastic / Collegiate
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
            {stats.highSchoolCount} HS · {stats.collegeCount} NCAA
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            50-State NFHS Compliant
          </div>
        </div>

        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: "12px 16px",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Audience Engagement
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#a855f7", marginTop: 4 }}>
            {stats.avgER}% Avg ER
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            ~{(stats.avgFollowers / 1000).toFixed(0)}k Avg Reach / Athlete
          </div>
        </div>
      </div>

      {/* Suite Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          borderBottom: "1px solid var(--line)",
          marginBottom: 20,
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "directory" ? "2px solid var(--primary, #f97316)" : "2px solid transparent",
            color: activeTab === "directory" ? "var(--text)" : "var(--text-muted)",
            fontWeight: activeTab === "directory" ? 600 : 400,
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>📋</span> Athlete Directory ({filteredAthletes.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pass_studio")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "pass_studio" ? "2px solid var(--primary, #f97316)" : "2px solid transparent",
            color: activeTab === "pass_studio" ? "var(--text)" : "var(--text-muted)",
            fontWeight: activeTab === "pass_studio" ? 600 : 400,
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>🛡️</span> Digital NIL Pass &amp; Apple Wallet Studio
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("campaign_dispatch")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "campaign_dispatch" ? "2px solid var(--primary, #f97316)" : "2px solid transparent",
            color: activeTab === "campaign_dispatch" ? "var(--text)" : "var(--text-muted)",
            fontWeight: activeTab === "campaign_dispatch" ? 600 : 400,
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>🚀</span> Brand Campaign Dispatcher
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rate_calculator")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "rate_calculator" ? "2px solid var(--primary, #f97316)" : "2px solid transparent",
            color: activeTab === "rate_calculator" ? "var(--text)" : "var(--text-muted)",
            fontWeight: activeTab === "rate_calculator" ? 600 : 400,
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>📊</span> Rate Card &amp; FMV Calculator
        </button>
      </div>

      {/* Tab 1: Directory */}
      {activeTab === "directory" && (
        <div>
          {/* Controls & Filter Bar */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r)",
              padding: 16,
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Top row: search & view switcher */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <input
                  type="text"
                  placeholder="Search by athlete name, sport, position, school, or agent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", fontSize: 14 }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 13, color: "var(--text-muted)" }}>Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{ padding: "8px 12px", fontSize: 13 }}
                >
                  <option value="valuation_desc">Highest Valuation</option>
                  <option value="followers_desc">Most Followers</option>
                  <option value="grad_year">Graduation Year</option>
                  <option value="name">Name (A-Z)</option>
                </select>

                <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`btn small ${viewMode === "grid" ? "" : "ghost"}`}
                    style={{ borderRadius: 0, padding: "6px 10px" }}
                    title="Grid Card View"
                  >
                    🪟 Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`btn small ${viewMode === "table" ? "" : "ghost"}`}
                    style={{ borderRadius: 0, padding: "6px 10px" }}
                    title="Compact Table View"
                  >
                    📑 Table
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom row: faceted dropdowns */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sport:</span>
                <select
                  value={selectedSport}
                  onChange={(e) => setSelectedSport(e.target.value)}
                  style={{ padding: "6px 10px", fontSize: 13 }}
                >
                  {availableSports.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Level:</span>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value as any)}
                  style={{ padding: "6px 10px", fontSize: 13 }}
                >
                  <option value="all">All Levels</option>
                  <option value="college">Collegiate (NCAA)</option>
                  <option value="high_school">High School (NFHS)</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>State:</span>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  style={{ padding: "6px 10px", fontSize: 13 }}
                >
                  {availableStates.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Eligibility:</span>
                <select
                  value={minorStatus}
                  onChange={(e) => setMinorStatus(e.target.value as any)}
                  style={{ padding: "6px 10px", fontSize: 13 }}
                >
                  <option value="all">All Athletes</option>
                  <option value="adult_only">18+ Adults Only</option>
                  <option value="minor_only">Minors (Guardian Protected)</option>
                </select>
              </div>

              {(searchQuery || selectedSport !== "All" || selectedLevel !== "all" || selectedState !== "All" || minorStatus !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSport("All");
                    setSelectedLevel("all");
                    setSelectedState("All");
                    setMinorStatus("all");
                  }}
                  className="btn ghost small"
                  style={{ padding: "4px 8px", fontSize: 12 }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Results count & Quick Summary */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Showing {filteredAthletes.length} verified athlete{filteredAthletes.length === 1 ? "" : "s"}
            </span>
          </div>

          {filteredAthletes.length === 0 ? (
            <div
              style={{
                background: "var(--panel)",
                border: "1px dashed var(--line)",
                borderRadius: "var(--r)",
                padding: 40,
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "var(--text)" }}>
                No athletes match your current filter parameters.
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                Try clearing your search keyword or broadening state/sport criteria.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            /* Cards View */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {filteredAthletes.map((a) => (
                <div
                  key={a.id}
                  style={{
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r)",
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                  }}
                >
                  {/* Top Header */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <Link
                          href={`/dashboard/feed/u/${a.id}`}
                          style={{
                            fontSize: 17,
                            fontWeight: 700,
                            color: "var(--text)",
                            textDecoration: "none",
                          }}
                        >
                          {a.fullName}
                        </Link>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                          {a.sport} {a.position ? `· ${a.position}` : ""}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                          {a.schoolOrInstitution} ({a.state}){a.gradYear ? ` · Class of '${String(a.gradYear).slice(-2)}` : ""}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 99,
                          background: a.level === "college" ? "rgba(56, 189, 248, 0.15)" : "rgba(34, 197, 94, 0.15)",
                          color: a.level === "college" ? "#38bdf8" : "#22c55e",
                        }}
                      >
                        {a.level === "college" ? "NCAA Collegiate" : "NFHS High School"}
                      </span>
                    </div>

                    {/* Protection and Compliance Badges */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                      {a.digitalPassVerified && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "rgba(59, 130, 246, 0.12)",
                            color: "#60a5fa",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span>✓</span> Verified Pass
                        </span>
                      )}

                      {a.isMinor ? (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "rgba(234, 179, 8, 0.12)",
                            color: "#facc15",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span>🛡️</span> Guardian Linked
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "rgba(100, 116, 139, 0.12)",
                            color: "var(--text-muted)",
                          }}
                        >
                          18+ Adult
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 7px",
                          borderRadius: 4,
                          background: "rgba(168, 85, 247, 0.12)",
                          color: "#c084fc",
                        }}
                      >
                        {a.representationStatus === "SPARTA Registered Agent" ? `Agent: ${a.agentName ?? "Registered"}` : "Self-Rep"}
                      </span>
                    </div>

                    {/* Social Reach & Valuation Strip */}
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        padding: "10px 12px",
                        marginTop: 14,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Reach</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginTop: 1 }}>
                          {(a.followers / 1000).toFixed(1)}k <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({a.engagementRate}% ER)</span>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Est. Post Value</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e", marginTop: 1 }}>
                          ${a.fairMarketValueDollars}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setInspectingAthlete(a)}
                      className="btn ghost small"
                      style={{ flex: 1, minWidth: 110, fontSize: 12 }}
                    >
                      🔍 Inspect Pass
                    </button>

                    {isRecruiter ? (
                      <form action={trackAthlete} style={{ flex: 1, minWidth: 100 }}>
                        <input type="hidden" name="athlete_id" value={a.id} />
                        <button className="btn small" type="submit" style={{ width: "100%", fontSize: 12 }}>
                          📌 Track
                        </button>
                      </form>
                    ) : canMakeOffers ? (
                      <Link
                        className="btn small"
                        href={`/dashboard/deals/new?athlete=${a.id}`}
                        style={{ flex: 1, minWidth: 100, textAlign: "center", textDecoration: "none", fontSize: 12 }}
                      >
                        💼 Make Offer
                      </Link>
                    ) : (
                      <span className="muted" style={{ fontSize: 11 }}>Directory View</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Dense Table View */
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r)", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: 12, color: "var(--text-muted)" }}>
                    <th style={{ padding: "12px 14px" }}>Athlete</th>
                    <th style={{ padding: "12px 14px" }}>Sport &amp; Position</th>
                    <th style={{ padding: "12px 14px" }}>Level &amp; State</th>
                    <th style={{ padding: "12px 14px" }}>Reach &amp; ER</th>
                    <th style={{ padding: "12px 14px" }}>Est. Post FMV</th>
                    <th style={{ padding: "12px 14px" }}>Pass Status</th>
                    <th style={{ padding: "12px 14px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAthletes.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                      <td style={{ padding: "12px 14px" }}>
                        <Link href={`/dashboard/feed/u/${a.id}`} style={{ fontWeight: 600, color: "var(--text)", textDecoration: "underline" }}>
                          {a.fullName}
                        </Link>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.schoolOrInstitution}</div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {a.sport}
                        {a.position ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.position}</div> : null}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: a.level === "college" ? "rgba(56, 189, 248, 0.12)" : "rgba(34, 197, 94, 0.12)",
                            color: a.level === "college" ? "#38bdf8" : "#22c55e",
                          }}
                        >
                          {a.level === "college" ? "NCAA" : "NFHS"} ({a.state})
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {(a.followers / 1000).toFixed(1)}k
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>({a.engagementRate}%)</span>
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 600, color: "#22c55e" }}>
                        ${a.fairMarketValueDollars}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {a.digitalPassVerified ? (
                          <span style={{ fontSize: 11, color: "#60a5fa" }}>● Verified</span>
                        ) : (
                          <span className="muted" style={{ fontSize: 11 }}>Pending</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => setInspectingAthlete(a)}
                            className="btn ghost small"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                          >
                            Pass
                          </button>
                          {isRecruiter ? (
                            <form action={trackAthlete} style={{ display: "inline" }}>
                              <input type="hidden" name="athlete_id" value={a.id} />
                              <button className="btn small" type="submit" style={{ fontSize: 11, padding: "4px 8px" }}>
                                Track
                              </button>
                            </form>
                          ) : canMakeOffers ? (
                            <Link
                              className="btn small"
                              href={`/dashboard/deals/new?athlete=${a.id}`}
                              style={{ fontSize: 11, padding: "4px 8px", textDecoration: "none" }}
                            >
                              Offer
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Verifiable NIL Pass & Apple Wallet Studio */}
      {activeTab === "pass_studio" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <span className="badge green">Cryptographic Credentials</span>
            <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
              Digital Athlete NIL Credential &amp; Apple Wallet PKPass Studio
            </h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Generate, sign, and export standardized NIL digital passes with embedded SHA-256 integrity hashes,
              state amateurism badges, guardian authorization stamps, and official rate card limits.
            </p>
          </div>
          <DigitalNilPassCard />
        </div>
      )}

      {/* Tab 3: Brand Campaign & Batch Dispatcher */}
      {activeTab === "campaign_dispatch" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <span className="badge blue">Multi-Athlete Activation</span>
            <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
              Brand Campaign Marketplace &amp; Batch Deal Dispatcher
            </h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Define sponsor campaign parameters, automatically filter 50-state NFHS prohibitions, and dispatch
              simultaneous compliant offers with calculated Stripe escrow reserves and 5% compliance fees.
            </p>
          </div>
          <CampaignDispatcherHub />
        </div>
      )}

      {/* Tab 4: Rate Card & FMV Calculator */}
      {activeTab === "rate_calculator" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <span className="badge yellow">Fair Market Value</span>
            <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
              Deliverables Rate Card &amp; Media Kit Estimator
            </h3>
            <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Compute standard athletic creator CPMs across TikTok Reels, Instagram static posts, story series,
              and in-person appearances adjusted by engagement factor.
            </p>
          </div>
          <RateCardKit />
        </div>
      )}

      {/* Athlete Credential Inspection Modal */}
      {inspectingAthlete && inspectedCredential && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setInspectingAthlete(null)}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 14,
              maxWidth: 540,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
              color: "#f8fafc",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#38bdf8",
                    fontWeight: 700,
                  }}
                >
                  LIN Verified Sports Identity
                </span>
                <h3 style={{ margin: "4px 0 0", fontSize: 20, color: "#fff" }}>
                  {inspectingAthlete.fullName}
                </h3>
                <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
                  {inspectingAthlete.sport} · {inspectingAthlete.position ?? "Athlete"} · {inspectingAthlete.schoolOrInstitution}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectingAthlete(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: 20,
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Credential Card Body */}
            <div
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 10,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Level / League</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                    {inspectingAthlete.level === "college" ? "NCAA Collegiate" : "NFHS High School"}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Jurisdiction State</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                    {inspectingAthlete.state} (USA)
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Representation Status</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                    {inspectingAthlete.representationStatus}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Guardian Verification</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: inspectingAthlete.isMinor ? "#22c55e" : "#94a3b8" }}>
                    {inspectingAthlete.isMinor ? "✓ Linked & Verified" : "N/A (Age 18+)"}
                  </div>
                </div>
              </div>

              {/* Rate Card Grid */}
              <div style={{ borderTop: "1px solid #334155", paddingTop: 12, marginTop: 12 }}>
                <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Verified Rate Card Tiers
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div style={{ background: "#0f172a", padding: "8px 10px", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>Social Media Post</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>
                      ${inspectingAthlete.rateCard.socialMediaPostDollars}
                    </div>
                  </div>
                  <div style={{ background: "#0f172a", padding: "8px 10px", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>In-Person Appearance</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>
                      ${inspectingAthlete.rateCard.inPersonAppearanceDollars}
                    </div>
                  </div>
                  <div style={{ background: "#0f172a", padding: "8px 10px", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>Skills Clinic Host</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>
                      ${inspectingAthlete.rateCard.skillsClinicDollars}
                    </div>
                  </div>
                  <div style={{ background: "#0f172a", padding: "8px 10px", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>Commercial / Ad Spot</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>
                      ${inspectingAthlete.rateCard.brandCommercialDollars}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cryptographic SHA-256 Hash */}
              <div style={{ borderTop: "1px solid #334155", paddingTop: 12, marginTop: 12 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>SHA-256 Verification Hash</span>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: "#38bdf8",
                    background: "#090d16",
                    padding: "6px 8px",
                    borderRadius: 4,
                    marginTop: 4,
                    wordBreak: "break-all",
                  }}
                >
                  {inspectedCredential.digitalSignatureSha256}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleCopyHash(inspectedCredential.digitalSignatureSha256)}
                className="btn ghost small"
                style={{ fontSize: 12 }}
              >
                {copiedHash ? "✓ Hash Copied!" : "📋 Copy Hash"}
              </button>

              <button
                type="button"
                onClick={() => handleDownloadWalletJson(inspectingAthlete)}
                className="btn ghost small"
                style={{ fontSize: 12 }}
              >
                📥 Export JSON
              </button>

              {canMakeOffers && (
                <Link
                  className="btn small"
                  href={`/dashboard/deals/new?athlete=${inspectingAthlete.id}`}
                  style={{ textDecoration: "none", fontSize: 12 }}
                >
                  💼 Make Offer
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
