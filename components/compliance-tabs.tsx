"use client";

import { useState } from "react";
import { StateEligibilityChecker } from "@/components/state-eligibility-checker";
import { TaxEscrowCenter } from "@/components/tax-escrow-center";
import { InstitutionalDisclosureHub } from "@/components/institutional-disclosure-hub";
import { HouseRevSharingPortal } from "@/components/house-rev-sharing-portal";
import { SocialFtcAuditor } from "@/components/social-ftc-auditor";
import { VisaSafeHarborCard } from "@/components/visa-safe-harbor-card";
import { CollectiveAuditSuite } from "@/components/collective-audit";
import { TaxEstimator } from "@/components/tax-estimator";
import { ContractRiskScanner } from "@/components/contract-risk-scanner";

export type ComplianceTabKey =
  | "nfhs"
  | "contract_risk"
  | "tax"
  | "institutional"
  | "rev_share"
  | "ftc"
  | "visa"
  | "collective";

interface ComplianceTabDef {
  key: ComplianceTabKey;
  label: string;
  icon: string;
  badge: string;
  badgeColor?: string;
  description: string;
}

const COMPLIANCE_TABS: ComplianceTabDef[] = [
  {
    key: "nfhs",
    label: "50-State NFHS",
    icon: "🗺️",
    badge: "Prep & High School",
    description: "State-by-state high school amateurism rules, prohibited industries & uniform bans.",
  },
  {
    key: "contract_risk",
    label: "Contract Risk AI",
    icon: "🔍",
    badge: "Predatory Redlines",
    badgeColor: "rgba(239, 68, 68, 0.2)",
    description: "Automated contract redline scanner detecting perpetual likeness traps and unpaid exclusivity.",
  },
  {
    key: "tax",
    label: "Tax Escrow & 1099",
    icon: "💰",
    badge: "15.3% FICA Safe-Harbor",
    badgeColor: "rgba(34, 197, 94, 0.2)",
    description: "Automated tax reserve withholding, Schedule C deductions & Form 1099-NEC export.",
  },
  {
    key: "institutional",
    label: "University Disclosures",
    icon: "🏛️",
    badge: "NCAA Compliance",
    description: "Automated conflict checker for university apparel contracts and trademark co-licensing.",
  },
  {
    key: "rev_share",
    label: "House Rev-Share",
    icon: "⚖️",
    badge: "$22M Cap & Roster",
    badgeColor: "rgba(59, 130, 246, 0.2)",
    description: "Post-House v. NCAA revenue distribution, Title IX balance, and hard varsity roster limits.",
  },
  {
    key: "ftc",
    label: "FTC AI Scanner",
    icon: "📱",
    badge: "16 CFR § 255",
    description: "Automated caption scanner for conspicuous #ad disclosures and multi-platform FMV.",
  },
  {
    key: "visa",
    label: "Visa Safe Harbor",
    icon: "🛂",
    badge: "F-1 / P-1A Protection",
    badgeColor: "rgba(168, 85, 247, 0.2)",
    description: "Passive IP licensing vs active labor engine and offshore travel attestation for DSOs.",
  },
  {
    key: "collective",
    label: "Collective Audit",
    icon: "🤝",
    badge: "Booster Governance",
    description: "501(c)(3) public charity compliance, donor tax receipts, and quid pro quo verification.",
  },
];

export function ComplianceExecutiveTabs({ initialGrants = [] }: { initialGrants?: any[] }) {
  const [activeTab, setActiveTab] = useState<ComplianceTabKey>("nfhs");

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Tab Navigation Ribbon */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: 16,
          borderBottom: "1px solid var(--line)",
          scrollbarWidth: "thin",
        }}
      >
        {COMPLIANCE_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 8,
                border: isActive ? "1px solid var(--primary)" : "1px solid var(--line)",
                background: isActive ? "var(--panel)" : "transparent",
                color: isActive ? "var(--text)" : "var(--muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                transition: "all 0.15s ease",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: tab.badgeColor || "var(--panel-2)",
                  color: "var(--text)",
                  border: "1px solid var(--line)",
                }}
              >
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Description Header */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {COMPLIANCE_TABS.find((t) => t.key === activeTab)?.description}
        </p>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          Tab {COMPLIANCE_TABS.findIndex((t) => t.key === activeTab) + 1} of {COMPLIANCE_TABS.length}
        </span>
      </div>

      {/* Tab Content Display */}
      <div>
        {activeTab === "nfhs" && <StateEligibilityChecker />}
        {activeTab === "contract_risk" && <ContractRiskScanner />}
        {activeTab === "tax" && (
          <>
            <TaxEscrowCenter />
            <TaxEstimator />
          </>
        )}
        {activeTab === "institutional" && <InstitutionalDisclosureHub />}
        {activeTab === "rev_share" && <HouseRevSharingPortal />}
        {activeTab === "ftc" && <SocialFtcAuditor />}
        {activeTab === "visa" && <VisaSafeHarborCard />}
        {activeTab === "collective" && <CollectiveAuditSuite initialGrants={initialGrants} />}
      </div>
    </div>
  );
}
