"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type EmancipationCountdown,
  type FamilySafetyAuditResult,
  calculateEmancipationCountdown,
  evaluateFamilySafetyScore,
} from "@/lib/family-safety";

export interface GuardianSafetyAthleteData {
  id: string;
  name: string;
  sport: string;
  level: string;
  birthDate: string;
  isMinor: boolean;
  isDiscoverable: boolean;
  guardians: Array<{ name: string; email: string }>;
  pendingDeals: Array<{
    id: string;
    title: string;
    sponsorName: string;
    amountCents: number;
    deliverables: string;
    status: string;
  }>;
  teamMembers: Array<{
    id: string;
    name: string;
    relationship: string;
    canViewAcademics: boolean;
    canViewHealth: boolean;
    isVerifiedAgent?: boolean;
  }>;
}

interface GuardianSafetyCenterProps {
  athlete: GuardianSafetyAthleteData;
  viewerRole: string;
  isParent: boolean;
}

export function GuardianSafetyCenter({
  athlete,
  viewerRole,
  isParent,
}: GuardianSafetyCenterProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "emancipation" | "deals" | "team_access" | "privacy">("overview");
  const [discoverable, setDiscoverable] = useState<boolean>(athlete.isDiscoverable);
  const [emergencyFreeze, setEmergencyFreeze] = useState<boolean>(false);
  const [revokedMemberIds, setRevokedMemberIds] = useState<string[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const countdown: EmancipationCountdown = calculateEmancipationCountdown(athlete.birthDate);

  const totalExposureCents = athlete.pendingDeals.reduce((sum, d) => sum + d.amountCents, 0);

  const safetyAudit: FamilySafetyAuditResult = evaluateFamilySafetyScore({
    isMinor: athlete.isMinor,
    guardiansLinkedCount: athlete.guardians.length,
    isDiscoverable: discoverable && !emergencyFreeze,
    openDealsCount: athlete.pendingDeals.length,
    pendingGuardianReviewCount: athlete.pendingDeals.length,
    totalDealExposureCents: totalExposureCents,
    hasUnverifiedAgents: athlete.teamMembers.some((m) => m.relationship === "manager" && !m.isVerifiedAgent),
  });

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleToggleFreeze = () => {
    const nextState = !emergencyFreeze;
    setEmergencyFreeze(nextState);
    showNotice(nextState ? "⚠️ Emergency Commercial Freeze ACTIVATED. All incoming offers paused." : "✓ Commercial Freeze deactivated.");
  };

  const handleToggleDiscoverability = () => {
    const nextState = !discoverable;
    setDiscoverable(nextState);
    showNotice(nextState ? "Public marketplace listing enabled." : "Athlete profile set to Private Shield mode.");
  };

  const handleRevokeMember = (memberId: string, memberName: string) => {
    setRevokedMemberIds((prev) => [...prev, memberId]);
    showNotice(`Revoked third-party access for ${memberName}.`);
  };

  return (
    <div style={{ marginTop: 14 }}>
      {/* Notice Banner */}
      {actionNotice && (
        <div
          style={{
            background: "rgba(59, 130, 246, 0.15)",
            border: "1px solid #3b82f6",
            borderRadius: "var(--r)",
            padding: "10px 14px",
            color: "#60a5fa",
            fontSize: 13,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>ℹ️</span> {actionNotice}
        </div>
      )}

      {/* Main Legal Guardian Protection Banner */}
      <div
        style={{
          background: emergencyFreeze
            ? "rgba(239, 68, 68, 0.12)"
            : "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.95))",
          border: emergencyFreeze ? "1px solid #ef4444" : "1px solid var(--line)",
          borderRadius: "var(--r)",
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: emergencyFreeze ? "#f87171" : "#14b8a6",
                  background: emergencyFreeze ? "rgba(239, 68, 68, 0.2)" : "rgba(20, 184, 166, 0.15)",
                  padding: "3px 8px",
                  borderRadius: 99,
                }}
              >
                {emergencyFreeze ? "🚨 Commercial Freeze Active" : "🛡️ Family Legal Protection Active"}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Athlete: <strong>{athlete.name}</strong> ({athlete.sport} · {athlete.level.replace("_", " ")})
              </span>
            </div>

            <h2 style={{ margin: "6px 0 2px", fontSize: 20, color: "var(--text)" }}>
              Guardian Safety &amp; Family Protection Center
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", maxWidth: 640 }}>
              {athlete.isMinor
                ? "Statutory minor safeguards are enforced. No commercial agreement or payout can execute without verified parental co-signature and custodial escrow."
                : "Adult student-athlete autonomy is active. Guardian access is governed by athlete-granted view-only sharing."}
            </p>
          </div>

          {/* Safety Score Meter */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "10px 16px",
              textAlign: "right",
              minWidth: 150,
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Safety Protection Index</div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: safetyAudit.tier === "OPTIMAL_PROTECTION" ? "#22c55e" : safetyAudit.tier === "NEEDS_ATTENTION" ? "#eab308" : "#ef4444",
                marginTop: 2,
              }}
            >
              {safetyAudit.safetyScore}/100
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {safetyAudit.tier === "OPTIMAL_PROTECTION" ? "● Optimal Protection" : safetyAudit.tier === "NEEDS_ATTENTION" ? "▲ Review Suggested" : "⚠️ Attention Required"}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
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
          onClick={() => setActiveTab("overview")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "overview" ? "2px solid #14b8a6" : "2px solid transparent",
            color: activeTab === "overview" ? "var(--text)" : "var(--text-muted)",
            fontWeight: activeTab === "overview" ? 600 : 400,
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>📊</span> Safety Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("emancipation")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "emancipation" ? "2px solid #14b8a6" : "2px solid transparent",
            color: activeTab === "emancipation" ? "var(--text)" : "var(--text-muted)",
            fontWeight: activeTab === "emancipation" ? 600 : 400,
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>🎂</span> Age-18 Emancipation Roadmap
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("deals")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "deals" ? "2px solid #14b8a6" : "2px solid transparent",
            color: activeTab === "deals" ? "var(--text)" : "var(--text-muted)",
            fontWeight: activeTab === "deals" ? 600 : 400,
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>✍️</span> Deal Approval &amp; Escrow ({athlete.pendingDeals.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("team_access")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "team_access" ? "2px solid #14b8a6" : "2px solid transparent",
            color: activeTab === "team_access" ? "var(--text)" : "var(--text-muted)",
            fontWeight: activeTab === "team_access" ? 600 : 400,
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>👥</span> Agent &amp; Team Oversight
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("privacy")}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: activeTab === "privacy" ? "2px solid #14b8a6" : "2px solid transparent",
            color: activeTab === "privacy" ? "var(--text)" : "var(--text-muted)",
            fontWeight: activeTab === "privacy" ? 600 : 400,
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>🔒</span> Privacy &amp; Freeze Controls
        </button>
      </div>

      {/* Tab 1: Safety Overview */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Active Alerts */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r)",
              padding: 18,
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--text)" }}>
              Guardian Safety Audit &amp; Status
            </h3>
            <div style={{ display: "grid", gap: 8 }}>
              {safetyAudit.alerts.map((alert, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 6,
                    background: alert.severity === "red"
                      ? "rgba(239, 68, 68, 0.08)"
                      : alert.severity === "yellow"
                      ? "rgba(234, 179, 8, 0.08)"
                      : "rgba(34, 197, 94, 0.08)",
                    border: `1px solid ${
                      alert.severity === "red"
                        ? "rgba(239, 68, 68, 0.2)"
                        : alert.severity === "yellow"
                        ? "rgba(234, 179, 8, 0.2)"
                        : "rgba(34, 197, 94, 0.2)"
                    }`,
                  }}
                >
                  <span style={{ fontSize: 16 }}>
                    {alert.severity === "red" ? "🚨" : alert.severity === "yellow" ? "⚠️" : "✓"}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: alert.severity === "red" ? "#f87171" : alert.severity === "yellow" ? "#facc15" : "#4ade80",
                      }}
                    >
                      {alert.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {alert.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: 16 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Minor Legal Status</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
                {athlete.isMinor ? `Minor (${countdown.currentAge} yrs)` : "Adult (18+)"}
              </div>
              <div style={{ fontSize: 12, color: athlete.isMinor ? "#14b8a6" : "var(--text-muted)", marginTop: 2 }}>
                {athlete.isMinor ? `${countdown.daysUntil18} days to age 18` : "Fully emancipated"}
              </div>
            </div>

            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: 16 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Linked Guardians</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
                {athlete.guardians.length} Guardian{athlete.guardians.length === 1 ? "" : "s"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {athlete.guardians.map((g) => g.name).join(", ") || "None linked"}
              </div>
            </div>

            <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "var(--r)", padding: 16 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Pending Deal Escrow</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#22c55e", marginTop: 4 }}>
                ${(totalExposureCents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {athlete.pendingDeals.length} deal{athlete.pendingDeals.length === 1 ? "" : "s"} awaiting approval
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Age-18 Emancipation Roadmap */}
      {activeTab === "emancipation" && (
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <span className="badge teal">Legal Transition Roadmap</span>
              <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
                Age-18 Emancipation &amp; Authority Transfer Timeline
              </h3>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                Under state law and NCAA rules, student-athletes legally transition from parental custodial oversight
                to full independent contracting authority on their 18th birthday.
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>18th Birthday:</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                {countdown.emancipationDateFormatted}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
              <span>Current Stage: <strong>{countdown.transitionStage.replaceAll("_", " ")}</strong></span>
              <span><strong>{athlete.isMinor ? `${countdown.daysUntil18} days remaining (${countdown.monthsUntil18} months)` : "100% Emancipated"}</strong></span>
            </div>
            <div style={{ height: 8, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: athlete.isMinor ? `${Math.min(100, Math.max(10, ((18 * 365 - countdown.daysUntil18) / (18 * 365)) * 100))}%` : "100%",
                  background: athlete.isMinor ? "#14b8a6" : "#22c55e",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>

          {/* Transition Action Items */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--text)" }}>
              Recommended Legal &amp; Financial Action Items:
            </h4>
            <div style={{ display: "grid", gap: 8 }}>
              {countdown.actionItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "#14b8a6", fontWeight: 700 }}>●</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Deal Approval & Escrow */}
      {activeTab === "deals" && (
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <span className="badge green">Financial Protection</span>
              <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
                Commercial Deal Approval &amp; Custodial Escrow
              </h3>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                All commercial agreements for minors require parental consent. Funds are pre-funded into escrow
                before work begins and deposited into designated custodial accounts.
              </p>
            </div>
          </div>

          {athlete.pendingDeals.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>✓</div>
              <p style={{ margin: 0, fontWeight: 500, color: "var(--text)" }}>No deals pending parental approval.</p>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>All active contracts are approved and secured in escrow.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {athlete.pendingDeals.map((deal) => (
                <div
                  key={deal.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{deal.title}</span>
                      <span className="badge yellow">Awaiting Guardian Co-Signature</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 3 }}>
                      Sponsor: <strong>{deal.sponsorName}</strong> · Deliverables: {deal.deliverables}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Total Contract Value</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>
                        ${(deal.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}
                      </div>
                    </div>

                    <Link
                      href={`/dashboard/deals/${deal.id}`}
                      className="btn small"
                      style={{ textDecoration: "none" }}
                    >
                      ✍️ Review &amp; Co-Sign
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Agent & Team Oversight */}
      {activeTab === "team_access" && (
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <span className="badge blue">Third-Party Permissions</span>
              <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
                Agent, Coach &amp; Trainer Access Management
              </h3>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                Review and revoke data access permissions granted to athletic representatives, strength trainers,
                and agency managers.
              </p>
            </div>
            <Link href="/dashboard/team" className="btn ghost small" style={{ textDecoration: "none" }}>
              + Invite Team Member
            </Link>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {athlete.teamMembers
              .filter((m) => !revokedMemberIds.includes(m.id))
              .map((member) => (
                <div
                  key={member.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{member.name}</span>
                      <span className="badge">{member.relationship.replace("_", " ")}</span>
                      {member.isVerifiedAgent && <span className="badge green">✓ SPARTA Verified Agent</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Permissions: {[member.canViewAcademics && "Academics", member.canViewHealth && "Health & Training"].filter(Boolean).join(", ") || "Basic Directory"}
                    </div>
                  </div>

                  {isParent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeMember(member.id, member.name)}
                      className="btn ghost small"
                      style={{ color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)", fontSize: 12 }}
                    >
                      Revoke Access
                    </button>
                  )}
                </div>
              ))}

            {athlete.teamMembers.length === 0 && (
              <p className="muted" style={{ margin: 0, textAlign: "center", padding: 24 }}>
                No third-party coaches or agents are currently linked to this student-athlete.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Privacy & Freeze Controls */}
      {activeTab === "privacy" && (
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r)",
            padding: 20,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <span className="badge red">Guardian Emergency Controls</span>
            <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
              Contact Shield &amp; Emergency Commercial Freeze
            </h3>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
              Protect your child&apos;s privacy and varsity athletic eligibility with instant platform-wide controls.
            </p>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {/* Contact Shield info */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <strong style={{ color: "var(--text)" }}>Minor Contact Shield</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                  Personal phone number, physical residence, and primary personal email are permanently masked from sponsors and recruiters.
                </p>
              </div>
              <span className="badge green">● Shield Always Enforced</span>
            </div>

            {/* Public Discoverability Toggle */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <strong style={{ color: "var(--text)" }}>Marketplace Discoverability</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                  {discoverable
                    ? "Athlete appears in directory for verified sponsors to propose commercial deals."
                    : "Athlete is hidden from the public directory. Only invited coaches and recruiters can view."}
                </p>
              </div>

              {isParent ? (
                <button
                  type="button"
                  onClick={handleToggleDiscoverability}
                  className={`btn small ${discoverable ? "ghost" : ""}`}
                >
                  {discoverable ? "Hide from Directory" : "Enable Discoverability"}
                </button>
              ) : (
                <span className="muted">{discoverable ? "Listed" : "Private"}</span>
              )}
            </div>

            {/* Emergency Freeze Toggle */}
            <div
              style={{
                background: emergencyFreeze ? "rgba(239, 68, 68, 0.08)" : "rgba(255, 255, 255, 0.02)",
                border: emergencyFreeze ? "1px solid #ef4444" : "1px solid var(--line)",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <strong style={{ color: emergencyFreeze ? "#f87171" : "var(--text)" }}>
                  Emergency Commercial Freeze (&quot;Kill Switch&quot;)
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                  Instantly block all incoming deals and pause pending negotiations if high-school varsity eligibility
                  or school academic standing requires immediate focus.
                </p>
              </div>

              {isParent ? (
                <button
                  type="button"
                  onClick={handleToggleFreeze}
                  className={`btn small ${emergencyFreeze ? "" : "ghost"}`}
                  style={{
                    color: emergencyFreeze ? "#fff" : "#f87171",
                    background: emergencyFreeze ? "#ef4444" : "transparent",
                    borderColor: "#ef4444",
                  }}
                >
                  {emergencyFreeze ? "Deactivate Freeze" : "Activate Emergency Freeze"}
                </button>
              ) : (
                <span className="muted">Guardian Controlled</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
