"use client";

import { useState } from "react";
import {
  calculateEngagementMetrics,
  scanFtcCompliance,
  type SocialPlatform,
  type SocialChannelMetrics,
} from "@/lib/social-ftc-scanner";

export function SocialFtcAuditor() {
  // Channel stats
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [handle, setHandle] = useState<string>("@devon_brooks_qb");
  const [followers, setFollowers] = useState<number>(45000);
  const [avgLikes, setAvgLikes] = useState<number>(2200);
  const [avgComments, setAvgComments] = useState<number>(180);
  const [avgShares, setAvgShares] = useState<number>(60);
  const [avgViews, setAvgViews] = useState<number>(35000);

  // Caption scanner
  const [brandName, setBrandName] = useState<string>("Under Armour");
  const [caption, setCaption] = useState<string>(
    "Hyped for this amazing #collab with Under Armour! Best cleats I've worn this season. Locked in for championship week. #football #athlete #grind"
  );
  const [copiedRemediation, setCopiedRemediation] = useState<boolean>(false);

  const metrics: SocialChannelMetrics = {
    platform,
    handle,
    followers,
    averageLikes: avgLikes,
    averageComments: avgComments,
    averageShares: avgShares,
    averageViews: avgViews,
  };

  const report = calculateEngagementMetrics(metrics);
  const ftcResult = scanFtcCompliance(caption, brandName);

  const handleApplyRemediation = () => {
    setCaption(ftcResult.remediatedCaption);
    setCopiedRemediation(true);
    setTimeout(() => setCopiedRemediation(false), 2500);
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
            <span style={{ fontSize: 22 }}>📱</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Social Analytics & Automated FTC Compliance AI Scanner</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background:
                  ftcResult.status === "COMPLIANT"
                    ? "rgba(34, 197, 94, 0.12)"
                    : ftcResult.status === "AMBIGUOUS_RISK"
                    ? "rgba(234, 179, 8, 0.12)"
                    : "rgba(239, 68, 68, 0.12)",
                color:
                  ftcResult.status === "COMPLIANT"
                    ? "var(--ok, #22c55e)"
                    : ftcResult.status === "AMBIGUOUS_RISK"
                    ? "#eab308"
                    : "var(--danger, #ef4444)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              FTC Status: {ftcResult.status} ({ftcResult.score}/100)
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Multi-platform Fair Market Value estimator (TikTok, IG, YouTube, X) and real-time 16 CFR § 255 endorsement scanner.
          </p>
        </div>

        {ftcResult.status !== "COMPLIANT" && (
          <button
            type="button"
            className="btn small"
            onClick={handleApplyRemediation}
            style={{ fontSize: 12 }}
          >
            {copiedRemediation ? "✓ Auto-Remediated!" : "✨ 1-Click Fix FTC Compliance"}
          </button>
        )}
      </div>

      {/* Top Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Engagement Rate</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: report.engagementHealth === "exceptional" ? "var(--ok, #22c55e)" : "var(--text)" }}>
            {report.engagementRatePercent}%
          </div>
          <div className="muted" style={{ fontSize: 11, textTransform: "capitalize" }}>Health: {report.engagementHealth}</div>
        </div>

        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Follower Tier</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{report.tier}</div>
          <div className="muted" style={{ fontSize: 11 }}>{followers.toLocaleString()} Audience</div>
        </div>

        <div style={{ background: "rgba(34, 197, 94, 0.08)", padding: 12, borderRadius: 6, border: "1px solid rgba(34, 197, 94, 0.25)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--ok, #22c55e)", fontWeight: 700 }}>Est. Fair Market Value</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: "var(--ok, #22c55e)" }}>
            ${report.estimatedFairMarketValuePerPostDollars.toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>Per sponsored post benchmark</div>
        </div>

        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>FTC Safety Score</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{ftcResult.score} / 100</div>
          <div className="muted" style={{ fontSize: 11 }}>16 CFR § 255 Conspicuousness</div>
        </div>
      </div>

      {/* Two Column Section: Channel Tuning vs Caption AI Scanner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
        {/* Left: Channel Performance Tuning */}
        <div style={{ background: "var(--panel-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
          <strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>Social Channel Configuration</strong>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 12 }}>
              Platform
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="x">X / Twitter</option>
              </select>
            </label>

            <label style={{ fontSize: 12 }}>
              Handle
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              >
              </input>
            </label>

            <label style={{ fontSize: 12 }}>
              Followers
              <input
                type="number"
                step={1000}
                value={followers}
                onChange={(e) => setFollowers(Number(e.target.value) || 0)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              Avg Likes
              <input
                type="number"
                step={100}
                value={avgLikes}
                onChange={(e) => setAvgLikes(Number(e.target.value) || 0)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              Avg Comments
              <input
                type="number"
                step={25}
                value={avgComments}
                onChange={(e) => setAvgComments(Number(e.target.value) || 0)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              />
            </label>

            <label style={{ fontSize: 12 }}>
              Avg Shares / Reposts
              <input
                type="number"
                step={10}
                value={avgShares}
                onChange={(e) => setAvgShares(Number(e.target.value) || 0)}
                style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
              />
            </label>
          </div>
        </div>

        {/* Right: Real-time FTC Caption Scanner */}
        <div style={{ background: "var(--panel-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
          <strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>Automated FTC Caption Scanner</strong>
          
          <label style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
            Sponsor Brand
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
            />
          </label>

          <label style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
            Post Caption / Script
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: "6px 8px", fontSize: 12, fontFamily: "inherit" }}
            />
          </label>

          {ftcResult.issues.length > 0 ? (
            <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 6, padding: 8, fontSize: 11 }}>
              <div style={{ color: "var(--danger, #ef4444)", fontWeight: 700, marginBottom: 4 }}>
                ⚠️ FTC Compliance Warnings:
              </div>
              <ul style={{ margin: "0 0 0 14px", padding: 0 }}>
                {ftcResult.issues.map((iss, idx) => (
                  <li key={idx} style={{ marginBottom: 2 }}>{iss}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: 6, padding: 8, fontSize: 11, color: "var(--ok, #22c55e)" }}>
              ✓ Conspicuous disclosure verified. Complies with FTC Guidelines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
