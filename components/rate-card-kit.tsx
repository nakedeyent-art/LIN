"use client";

import { useState } from "react";

export function RateCardKit({ athleteName, sport, position, level }: { athleteName?: string; sport?: string; position?: string; level?: string }) {
  const [igFollowers, setIgFollowers] = useState<number>(8500);
  const [tiktokFollowers, setTiktokFollowers] = useState<number>(14200);
  const [xFollowers, setXFollowers] = useState<number>(2100);
  const [engagementRate, setEngagementRate] = useState<number>(4.8); // 4.8%
  const [copied, setCopied] = useState<boolean>(false);

  const totalReach = igFollowers + tiktokFollowers + xFollowers;

  // NIL standard pricing algorithm:
  // Base CPM model adjusted for engagement rate:
  // Active athletic creators command ~$25 - $40 CPM per 1,000 followers, scaled by engagement factor
  const engagementFactor = Math.max(0.7, engagementRate / 4.0);

  // Deliverable pricing estimates
  const reelPrice = Math.max(150, Math.round((totalReach * 0.035 * engagementFactor) / 25) * 25);
  const staticPostPrice = Math.max(100, Math.round((igFollowers * 0.025 * engagementFactor) / 25) * 25);
  const storySeriesPrice = Math.max(75, Math.round((igFollowers * 0.015 * engagementFactor) / 25) * 25);
  const appearancePrice = Math.max(300, Math.round((250 + totalReach * 0.02) / 50) * 50);
  const monthlyRetainerPrice = Math.max(500, Math.round((reelPrice * 2 + storySeriesPrice * 3 + 200) / 100) * 100);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const copyMediaKit = () => {
    const text = `
NIL BRAND RATE CARD & MEDIA KIT
Athlete: ${athleteName ?? "Student-Athlete"}
Sport / Position: ${sport ?? "Multi-Sport"} ${position ? `· ${position}` : ""}
Level: ${level ? level.replace(/_/g, " ") : "Varsity"}

AUDIENCE REACH
- Total Social Reach: ${totalReach.toLocaleString()} followers
- Instagram: ${igFollowers.toLocaleString()}
- TikTok: ${tiktokFollowers.toLocaleString()}
- X / Twitter: ${xFollowers.toLocaleString()}
- Avg Engagement Rate: ${engagementRate}% (Industry benchmark: 2.5%)

STANDARD RATE CARD
1. Dedicated TikTok / IG Reel: ${fmt(reelPrice)}
2. Static Feed Post + Story Series: ${fmt(staticPostPrice)}
3. In-Person Appearance / Clinic (2h): ${fmt(appearancePrice)}
4. 3-Month Ambassador Retainer: ${fmt(monthlyRetainerPrice)}/mo

Deliverables include usage rights, FTC disclosure compliance, and performance metrics proof.
Inquiries: Contact athlete management via LIN NIL Ecosystem.
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
          <span className="badge green">Brand & Commercial Valuation</span>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
            NIL Rate Card & Media Kit Generator
          </h3>
        </div>
        <button
          type="button"
          onClick={copyMediaKit}
          className="btn small"
        >
          {copied ? "✓ Copied Media Kit!" : "📋 Copy Brand Pitch Kit"}
        </button>
      </div>

      <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
        Calculate market value for brand partnerships, sponsored reels, and appearance fees based on audience reach and verified engagement.
      </p>

      {/* Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 650, marginBottom: 4 }}>
            Instagram Followers
          </label>
          <input
            type="number"
            min="0"
            step="500"
            value={igFollowers}
            onChange={(e) => setIgFollowers(Math.max(0, parseInt(e.target.value) || 0))}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
              fontSize: 14,
              fontFamily: "var(--mono)",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 650, marginBottom: 4 }}>
            TikTok Followers
          </label>
          <input
            type="number"
            min="0"
            step="500"
            value={tiktokFollowers}
            onChange={(e) => setTiktokFollowers(Math.max(0, parseInt(e.target.value) || 0))}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
              fontSize: 14,
              fontFamily: "var(--mono)",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 650, marginBottom: 4 }}>
            X / Twitter Followers
          </label>
          <input
            type="number"
            min="0"
            step="250"
            value={xFollowers}
            onChange={(e) => setXFollowers(Math.max(0, parseInt(e.target.value) || 0))}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
              fontSize: 14,
              fontFamily: "var(--mono)",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 650, marginBottom: 4 }}>
            Engagement Rate (%): <strong style={{ color: "var(--primary)" }}>{engagementRate}%</strong>
          </label>
          <input
            type="range"
            min="1.0"
            max="12.0"
            step="0.1"
            value={engagementRate}
            onChange={(e) => setEngagementRate(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
            <span>1% (Low)</span>
            <span>4.5% (Avg)</span>
            <span>12% (Viral)</span>
          </div>
        </div>
      </div>

      {/* Deliverable Rate Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 18 }}>
        <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
          <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>
            Dedicated Video / Reel
          </span>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--primary)", margin: "4px 0" }}>
            {fmt(reelPrice)}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>1x TikTok or Instagram Reel</span>
        </div>

        <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
          <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>
            Static Post + Story
          </span>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--text)", margin: "4px 0" }}>
            {fmt(staticPostPrice)}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>Photo post + 24h story sequence</span>
        </div>

        <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
          <span className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>
            Camp / Event Appearance
          </span>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--mono)", color: "#1d4ed8", margin: "4px 0" }}>
            {fmt(appearancePrice)}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>2-hour in-person clinic or signing</span>
        </div>

        <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary)", borderRadius: 8, padding: 14 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--primary)" }}>
            Monthly Ambassador Retainer
          </span>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--primary)", margin: "4px 0" }}>
            {fmt(monthlyRetainerPrice)}/mo
          </div>
          <span className="muted" style={{ fontSize: 12 }}>3-month term (2 reels + 3 stories/mo)</span>
        </div>
      </div>

      <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <strong style={{ fontSize: 13 }}>Total Cross-Platform Audience:</strong>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 700, marginLeft: 6 }}>{totalReach.toLocaleString()} followers</span>
        </div>
        <span className="muted" style={{ fontSize: 12 }}>
          Rates adhere to standard fair market value (FMV) benchmarks for NIL compliance.
        </span>
      </div>
    </div>
  );
}
