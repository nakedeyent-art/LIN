"use client";

import { useState } from "react";
import {
  SAMPLE_CANDIDATE_ROSTER,
  matchAthletesToCampaign,
  dispatchBatchCampaignOffers,
  type CampaignTargetCriteria,
} from "@/lib/campaign-dispatcher";

export function CampaignDispatcherHub() {
  const [campaignName, setCampaignName] = useState<string>("National Hydration Tour 2026");
  const [sponsorName, setSponsorName] = useState<string>("Apex Performance");
  const [category, setCategory] = useState<CampaignTargetCriteria["category"]>("beverage");
  const [targetSport, setTargetSport] = useState<string>("All");
  const [minFollowers, setMinFollowers] = useState<number>(15000);
  const [minER, setMinER] = useState<number>(4.0);
  const [perAthleteBudget, setPerAthleteBudget] = useState<number>(1000);
  const [maxSlots, setMaxSlots] = useState<number>(4);
  const [deliverables, setDeliverables] = useState<string>(
    "2 TikTok Reels and 1 Instagram post wearing branded gear with #ad tag."
  );
  const [dispatched, setDispatched] = useState<boolean>(false);

  const criteria: CampaignTargetCriteria = {
    campaignName,
    sponsorName,
    category,
    targetSports: [targetSport],
    targetStates: ["ALL"],
    minFollowers,
    minEngagementRatePercent: minER,
    perAthleteBudgetDollars: perAthleteBudget,
    maxAthleteSlots: maxSlots,
    deliverablesDescription: deliverables,
  };

  const matches = matchAthletesToCampaign(criteria, SAMPLE_CANDIDATE_ROSTER);
  const eligibleCount = matches.filter((m) => m.isEligible).length;
  const dispatchSummary = dispatchBatchCampaignOffers(criteria, SAMPLE_CANDIDATE_ROSTER);

  const handleDispatch = () => {
    setDispatched(true);
    setTimeout(() => setDispatched(false), 4000);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🚀</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Brand Campaign Marketplace & Batch Deal Dispatcher</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: "rgba(59, 130, 246, 0.12)",
                color: "#3b82f6",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              Batch Contracting Engine
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Multi-athlete campaign matchmaking, automatic NFHS amateurism screening, and one-click Stripe escrow locking.
          </p>
        </div>

        <button
          type="button"
          className="btn"
          onClick={handleDispatch}
          disabled={eligibleCount === 0}
          style={{ fontSize: 13, background: "var(--primary)", color: "#fff" }}
        >
          {dispatched
            ? "✓ Offers Dispatched & Escrow Locked!"
            : `⚡ Dispatch ${dispatchSummary.selectedDispatchCount} Offers ($${dispatchSummary.totalEscrowDepositRequiredDollars.toLocaleString()})`}
        </button>
      </div>

      {/* Campaign Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 12 }}>
          Campaign Title
          <input
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Sponsor Brand
          <input
            type="text"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Target Sport
          <select
            value={targetSport}
            onChange={(e) => setTargetSport(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          >
            <option value="All">All Sports</option>
            <option value="Football">Football</option>
            <option value="Basketball">Basketball</option>
            <option value="Volleyball">Volleyball</option>
            <option value="Track & Field">Track & Field</option>
            <option value="Baseball">Baseball</option>
          </select>
        </label>

        <label style={{ fontSize: 12 }}>
          Min. Followers / ER
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input
              type="number"
              step={5000}
              value={minFollowers}
              onChange={(e) => setMinFollowers(Number(e.target.value) || 0)}
              style={{ width: "55%", padding: "6px 8px" }}
            />
            <input
              type="number"
              step={0.5}
              value={minER}
              onChange={(e) => setMinER(Number(e.target.value) || 0)}
              style={{ width: "45%", padding: "6px 8px" }}
            />
          </div>
        </label>

        <label style={{ fontSize: 12 }}>
          Per-Athlete Budget ($) / Slots
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input
              type="number"
              step={250}
              value={perAthleteBudget}
              onChange={(e) => setPerAthleteBudget(Number(e.target.value) || 0)}
              style={{ width: "60%", padding: "6px 8px" }}
            />
            <input
              type="number"
              min={1}
              max={20}
              value={maxSlots}
              onChange={(e) => setMaxSlots(Number(e.target.value) || 1)}
              style={{ width: "40%", padding: "6px 8px" }}
            />
          </div>
        </label>
      </div>

      {/* Escrow Financial Summary Banner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Qualified Athletes</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            {eligibleCount} of {matches.length}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>Matching NFHS & metrics</div>
        </div>

        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Gross Athlete Pool</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            ${dispatchSummary.grossAthletePoolDollars.toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>${perAthleteBudget} × {dispatchSummary.selectedDispatchCount} athletes</div>
        </div>

        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Platform Escrow Fee (5%)</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            ${dispatchSummary.platformFeeDollars.toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>Automated compliance & verification</div>
        </div>

        <div style={{ background: "rgba(34, 197, 94, 0.08)", padding: 12, borderRadius: 6, border: "1px solid rgba(34, 197, 94, 0.25)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--ok, #22c55e)", fontWeight: 700 }}>Total Escrow Required</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: "var(--ok, #22c55e)" }}>
            ${dispatchSummary.totalEscrowDepositRequiredDollars.toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>Locked in Stripe safe-harbor escrow</div>
        </div>
      </div>

      {/* Candidate Matching Table */}
      <div style={{ background: "var(--panel-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
        <strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
          Candidate Matchmaking Results ({matches.length} Screened Athletes)
        </strong>
        <table style={{ width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Athlete</th>
              <th style={{ textAlign: "left" }}>Sport / State</th>
              <th style={{ textAlign: "right" }}>Followers</th>
              <th style={{ textAlign: "center" }}>Eng. Rate</th>
              <th style={{ textAlign: "center" }}>Match Score</th>
              <th style={{ textAlign: "left" }}>Eligibility Status</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.athlete.athleteId}>
                <td>
                  <strong>{m.athlete.athleteName}</strong>
                  {m.athlete.isHighSchoolMinor && (
                    <span style={{ fontSize: 10, marginLeft: 6, color: "var(--muted)" }}>[Minor]</span>
                  )}
                </td>
                <td>{m.athlete.sport} ({m.athlete.stateCode})</td>
                <td style={{ textAlign: "right" }}>{m.athlete.followers.toLocaleString()}</td>
                <td style={{ textAlign: "center", fontWeight: 700 }}>{m.athlete.engagementRatePercent}%</td>
                <td style={{ textAlign: "center" }}>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontWeight: 700,
                      background: m.isEligible ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: m.isEligible ? "var(--ok, #22c55e)" : "var(--danger, #ef4444)",
                    }}
                  >
                    {m.matchScore}%
                  </span>
                </td>
                <td>
                  {m.isEligible ? (
                    <span style={{ color: "var(--ok, #22c55e)", fontWeight: 600 }}>✓ Eligible for Dispatch</span>
                  ) : (
                    <span style={{ color: "var(--danger, #ef4444)", fontSize: 11 }}>
                      ✕ {m.disqualificationReasons[0]}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
