"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DEFAULT_OPPORTUNITIES,
  filterOpportunities,
  type CampaignOpportunity,
} from "@/lib/campaigns";

export type { CampaignOpportunity };

export function CampaignMarketplace({ viewerRole }: { viewerRole: string }) {
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const [activePitchId, setActivePitchId] = useState<string | null>(null);
  const [pitchText, setPitchText] = useState<string>("");

  const sports = ["All", "Basketball", "Football", "Soccer", "All Sports"];
  const categories = ["All", "Social Media", "Appearance", "Ambassador", "Product Testing", "Clinic Lead"];

  const filtered = filterOpportunities(DEFAULT_OPPORTUNITIES, {
    sport: selectedSport === "All" ? undefined : selectedSport,
    category: selectedCategory === "All" ? undefined : selectedCategory,
  });


  const handleApply = (id: string) => {
    setAppliedIds((prev) => [...prev, id]);
    setActivePitchId(null);
    setPitchText("");
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 22,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <span className="badge green">NIL Marketplace</span>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
            Campaign Opportunities & Casting Calls
          </h3>
        </div>
        {["sponsor", "booster", "gym_owner"].includes(viewerRole) ? (
          <Link href="/dashboard/athletes" className="btn small" style={{ textDecoration: "none" }}>
            + Create Campaign / Offer
          </Link>
        ) : (
          <p className="muted" style={{ margin: 0, fontSize: 13, maxWidth: 420 }}>
            Verified brands, gym owners, and collectives seeking athlete partnerships with clear compensation and deliverables.
          </p>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Sport:</span>
          {sports.map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setSelectedSport(sp)}
              className={`btn small ${selectedSport === sp ? "" : "ghost"}`}
              style={{ fontSize: 12, padding: "3px 8px" }}
            >
              {sp}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Category:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`btn small ${selectedCategory === cat ? "" : "ghost"}`}
              style={{ fontSize: 12, padding: "3px 8px" }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunity Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map((opp) => {
          const isApplied = appliedIds.includes(opp.id);
          const isPitching = activePitchId === opp.id;

          return (
            <div
              key={opp.id}
              style={{
                background: "var(--panel-2)",
                border: `1px solid ${opp.featured ? "var(--primary)" : "var(--line)"}`,
                borderRadius: "var(--r)",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              {opp.featured && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 14,
                    background: "var(--primary)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "2px 8px",
                    borderRadius: 99,
                  }}
                >
                  Featured
                </div>
              )}

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                  <div>
                    <span className="muted" style={{ fontSize: 12 }}>{opp.sponsorName}</span>
                    <h4 style={{ margin: "2px 0 6px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                      {opp.title}
                    </h4>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontWeight: 800,
                      fontSize: 15,
                      color: "var(--primary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opp.compensation}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  <span className="badge gray">{opp.category}</span>
                  <span className="badge gray">{opp.sport}</span>
                  <span className="badge green">{opp.level}</span>
                  <span className="muted" style={{ fontSize: 11, alignSelf: "center" }}>
                    Closes in {opp.deadlineDays}d
                  </span>
                </div>

                <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text)", lineHeight: 1.45 }}>
                  <strong style={{ color: "var(--muted)" }}>Deliverables: </strong>
                  {opp.deliverables}
                </p>
              </div>

              {/* Action Area */}
              <div>
                {isPitching ? (
                  <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, padding: 10 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 650, marginBottom: 4 }}>
                      Short Pitch / Media Kit Note
                    </label>
                    <textarea
                      rows={2}
                      value={pitchText}
                      onChange={(e) => setPitchText(e.target.value)}
                      placeholder="Why you're a great fit (sport, class, engagement)..."
                      style={{
                        width: "100%",
                        fontSize: 12,
                        padding: 6,
                        borderRadius: 4,
                        border: "1px solid var(--line)",
                        marginBottom: 8,
                        background: "var(--panel-2)",
                        color: "var(--text)",
                      }}
                    />
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setActivePitchId(null)}
                        className="btn ghost small"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApply(opp.id)}
                        className="btn small"
                      >
                        Submit Application
                      </button>
                    </div>
                  </div>
                ) : isApplied ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="badge green">✓ Application Submitted</span>
                    <span className="muted" style={{ fontSize: 11 }}>Profile & media kit sent</span>
                  </div>
                ) : viewerRole === "athlete" ? (
                  <button
                    type="button"
                    onClick={() => setActivePitchId(opp.id)}
                    className="btn small"
                    style={{ width: "100%" }}
                  >
                    Apply with Profile & Media Kit →
                  </button>
                ) : (
                  <Link
                    href={`/dashboard/deals/new`}
                    className="btn ghost small"
                    style={{ width: "100%", textAlign: "center", textDecoration: "none" }}
                  >
                    View Details & Roster →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
