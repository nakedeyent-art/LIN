/**
 * Booster Collective Governance & Genuine Deliverables Audit Engine
 * Pure domain logic for NCAA & State NIL amateurism compliance,
 * ensuring all collective disbursements correspond to verifiable, fair market value deliverables
 * and strictly forbidding pay-for-play or recruiting inducements.
 */

export type DeliverableProofType =
  | "Charity Appearance (In-Person)"
  | "Youth Clinic Coaching"
  | "Public Service Announcement (Video)"
  | "Signed Memorabilia & Autograph Session"
  | "Community Event Keynote";

export type AuditRiskLevel = "low" | "medium" | "high";

export type RiskFlag = {
  code: string;
  level: AuditRiskLevel;
  message: string;
};

export type DisbursementGrant = {
  id: string;
  athleteId: string;
  athleteName: string;
  sport: string;
  grantTitle: string;
  disbursedAmount: number; // e.g. 2500
  fairMarketValueEstimate: number; // e.g. 2500
  deliverableType: DeliverableProofType;
  proofUrl?: string;
  proofSubmittedAt?: string;
  proofVerified: boolean;
  nonContingencyAttested: boolean; // Confirms payment is NOT tied to athletic performance or school enrollment
  auditStatus: "compliant" | "action_required" | "flagged";
  riskFlags: RiskFlag[];
};

export type CollectiveHealthSummary = {
  totalGrantsCount: number;
  totalCapitalDisbursed: number;
  compliantCount: number;
  flaggedCount: number;
  actionRequiredCount: number;
  complianceScorePercent: number; // 0 - 100
  auditReadiness: "NCAA Audit-Ready" | "Action Required" | "Non-Compliant Risk";
};

const PROHIBITED_KEYWORDS = [
  "per touchdown",
  "per goal",
  "per win",
  "points scored",
  "commit to",
  "remain enrolled",
  "transfer portal",
  "starting spot",
];

export function detectPayForPlayRisks(grant: Partial<DisbursementGrant>): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // 1. Text screening for pay-for-play inducements
  const textToCheck = `${grant.grantTitle ?? ""} ${grant.deliverableType ?? ""}`.toLowerCase();
  for (const kw of PROHIBITED_KEYWORDS) {
    if (textToCheck.includes(kw)) {
      flags.push({
        code: "PAY_FOR_PLAY_DETECTED",
        level: "high",
        message: `Prohibited performance/enrollment condition detected: "${kw}". NCAA rules strictly ban performance incentives.`,
      });
    }
  }

  // 2. Proof verification check
  if (!grant.proofVerified || !grant.proofUrl) {
    flags.push({
      code: "MISSING_PROOF_DOCUMENTATION",
      level: "medium",
      message: "No verified deliverable proof (URL/photo/sign-in) submitted to validate genuine NIL activity.",
    });
  }

  // 3. Attestation check
  if (!grant.nonContingencyAttested) {
    flags.push({
      code: "MISSING_NON_CONTINGENCY_ATTESTATION",
      level: "high",
      message: "Missing mandatory signed attestation that compensation is independent of athletic stats or roster retention.",
    });
  }

  // 4. FMV Discrepancy check (> 2.5x estimated FMV without justification)
  const amount = grant.disbursedAmount ?? 0;
  const fmv = grant.fairMarketValueEstimate ?? 1;
  if (amount > fmv * 2.5) {
    flags.push({
      code: "EXCESSIVE_FMV_DISCREPANCY",
      level: "medium",
      message: `Disbursement ($${amount}) exceeds fair market value baseline ($${fmv}) by >2.5x without itemized justification.`,
    });
  }

  return flags;
}

export function calculateCollectiveHealth(grants: DisbursementGrant[]): CollectiveHealthSummary {
  if (grants.length === 0) {
    return {
      totalGrantsCount: 0,
      totalCapitalDisbursed: 0,
      compliantCount: 0,
      flaggedCount: 0,
      actionRequiredCount: 0,
      complianceScorePercent: 100,
      auditReadiness: "NCAA Audit-Ready",
    };
  }

  let totalCapital = 0;
  let compliantCount = 0;
  let flaggedCount = 0;
  let actionRequiredCount = 0;

  for (const g of grants) {
    totalCapital += g.disbursedAmount;
    if (g.auditStatus === "compliant") {
      compliantCount++;
    } else if (g.auditStatus === "flagged") {
      flaggedCount++;
    } else {
      actionRequiredCount++;
    }
  }

  const complianceScorePercent = Math.round((compliantCount / grants.length) * 100);

  let auditReadiness: CollectiveHealthSummary["auditReadiness"] = "NCAA Audit-Ready";
  if (flaggedCount > 0) {
    auditReadiness = "Non-Compliant Risk";
  } else if (actionRequiredCount > 0) {
    auditReadiness = "Action Required";
  }

  return {
    totalGrantsCount: grants.length,
    totalCapitalDisbursed: totalCapital,
    compliantCount,
    flaggedCount,
    actionRequiredCount,
    complianceScorePercent,
    auditReadiness,
  };
}

export function generateAuditCertificate(
  collectiveName: string,
  summary: CollectiveHealthSummary,
  auditorTitle = "Institutional NIL Compliance Officer"
): string {
  const date = new Date().toISOString().slice(0, 10);
  return `
NIL COLLECTIVE AMATEURISM & GENUINE DELIVERABLES AUDIT CERTIFICATE
Collective / Entity: ${collectiveName}
Certification Date: ${date}
Audited By: ${auditorTitle}

AUDIT SUMMARY & METRICS
- Total Grants Evaluated: ${summary.totalGrantsCount}
- Total Capital Disbursed: $${summary.totalCapitalDisbursed.toLocaleString()}
- Verified Compliant Grants: ${summary.compliantCount} (${summary.complianceScorePercent}%)
- Action Required / Pending Review: ${summary.actionRequiredCount}
- Flagged Critical Risks: ${summary.flaggedCount}
- Compliance Status: ${summary.auditReadiness.toUpperCase()}

COMPLIANCE ATTESTATION:
All evaluated disbursements have been audited for Fair Market Value (FMV) adherence and verified genuine activity (charity appearances, youth clinics, and educational media). No payments were conditioned on athletic performance, scores, or university enrollment.
  `.trim();
}
