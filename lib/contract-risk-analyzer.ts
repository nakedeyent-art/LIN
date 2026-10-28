export type RiskTier = "SAFE" | "MODERATE_CONCERN" | "CRITICAL_PREDATORY_RISK";

export type PredatoryPatternCategory =
  | "perpetual_rights"
  | "overbroad_exclusivity"
  | "unilateral_cancellation"
  | "subjective_morals_trap"
  | "unindemnified_ftc_liability"
  | "hostile_arbitration_venue"
  | "work_for_hire_ip_grab";

export interface FlaggedRiskClause {
  category: PredatoryPatternCategory;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  title: string;
  matchedSnippet: string;
  riskExplanation: string;
  recommendedCounterClause: string;
}

export interface ContractRiskReport {
  overallRiskTier: RiskTier;
  predatoryRiskScore: number; // 0 to 100 (higher = more predatory)
  flaggedClauses: FlaggedRiskClause[];
  passedTests: string[];
  safeToSign: boolean;
  executiveSummary: string;
}

const PREDATORY_RULES: Array<{
  category: PredatoryPatternCategory;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  title: string;
  regex: RegExp;
  riskWeight: number;
  explanation: string;
  counterClause: string;
}> = [
  {
    category: "perpetual_rights",
    severity: "CRITICAL",
    title: "Perpetual Likeness / In-Perpetuity IP Buyout",
    regex: /(in perpetuity|perpetual|throughout the universe|forever|irrevocable license to athlete'?s? name)/i,
    riskWeight: 35,
    explanation:
      "CRITICAL: The sponsor claims ownership or usage of your Name, Image, and Likeness forever without expiration. Even after college or signing in pro leagues, the sponsor could exploit your image for free.",
    counterClause:
      "Term-Limited License: 'Athlete grants Sponsor a non-exclusive license to utilize deliverable materials solely during the Term of this Agreement (not to exceed 12 months from execution). Upon termination, all rights revert immediately to Athlete.'",
  },
  {
    category: "overbroad_exclusivity",
    severity: "HIGH",
    title: "Overbroad / Uncompensated Exclusivity Trap",
    regex: /(shall not endorse any other|exclusive in all categories|exclusive across all athletic|exclusive right to athlete'?s? endorsement)/i,
    riskWeight: 25,
    explanation:
      "HIGH RISK: Broad exclusivity stops you from signing other lucrative NIL deals without paying an appropriate exclusivity premium (typically 2x–5x standard fee).",
    counterClause:
      "Carve-Out Exclusivity: 'Exclusivity shall apply strictly to the specific product category defined herein during active campaign dates. All other categories and school team sponsor obligations are expressly carved out and permitted.'",
  },
  {
    category: "unilateral_cancellation",
    severity: "HIGH",
    title: "Unilateral Cancellation Without Kill Fee",
    regex: /(terminate at any time without notice|terminate in its sole discretion without liability|no further compensation shall be due upon termination)/i,
    riskWeight: 20,
    explanation:
      "HIGH RISK: The sponsor can cancel the contract at will after you have reserved dates or produced content without paying a pro-rata or kill fee.",
    counterClause:
      "Kill Fee & Mutual Notice: 'Either party may terminate upon thirty (30) days written notice. In the event Sponsor cancels without athlete breach, Sponsor shall pay a fifty percent (50%) kill fee for completed or scheduled milestones.'",
  },
  {
    category: "subjective_morals_trap",
    severity: "MEDIUM",
    title: "Subjective Morals Clause Trap",
    regex: /(in the sole opinion of sponsor|any act sponsor deems objectionable|sole and absolute discretion of sponsor|brings sponsor into disrepute)/i,
    riskWeight: 15,
    explanation:
      "MEDIUM RISK: Sponsor can declare subjective offense to social posts or opinions to terminate the contract and withhold earned payments.",
    counterClause:
      "Objective Morals Standard: 'Morals clause termination shall apply exclusively upon conviction of a felony crime or formal suspension by the athletic governing body, not subjective corporate opinion.'",
  },
  {
    category: "unindemnified_ftc_liability",
    severity: "MEDIUM",
    title: "Missing Brand FTC & Product Liability Indemnification",
    regex: /(athlete shall indemnify sponsor for all claims|athlete bears sole liability for product claims|sponsor bears no liability)/i,
    riskWeight: 15,
    explanation:
      "MEDIUM RISK: Forces the student-athlete to legally defend and pay for lawsuits if the sponsor's product is defective or mislabeled.",
    counterClause:
      "Mutual Indemnification: 'Sponsor agrees to indemnify, defend, and hold harmless Athlete from any claims or damages arising from Sponsor's product safety, marketing claims, or regulatory actions.'",
  },
  {
    category: "work_for_hire_ip_grab",
    severity: "HIGH",
    title: "Work-Made-For-Hire Copyright Grab",
    regex: /(work made for hire|all intellectual property shall vest exclusively in sponsor|assigns all right title and interest)/i,
    riskWeight: 20,
    explanation:
      "HIGH RISK: Declares your content a 'work made for hire', stripping you of your underlying copyright in your own athletic training and personal content.",
    counterClause:
      "License Rather Than Assignment: 'Athlete retains full and sole ownership of all copyright and underlying intellectual property in created media, granting Sponsor a limited marketing license.'",
  },
];

export function analyzeContractRisk(contractText: string): ContractRiskReport {
  const trimmed = contractText.trim();
  const flaggedClauses: FlaggedRiskClause[] = [];
  const passedTests: string[] = [];

  let accumulatedRisk = 0;

  for (const rule of PREDATORY_RULES) {
    const match = trimmed.match(rule.regex);
    if (match) {
      accumulatedRisk += rule.riskWeight;
      // Extract snippet with surrounding context
      const matchIndex = match.index || 0;
      const start = Math.max(0, matchIndex - 40);
      const end = Math.min(trimmed.length, matchIndex + match[0].length + 40);
      const snippet = `"...${trimmed.slice(start, end).replace(/\s+/g, " ")}..."`;

      flaggedClauses.push({
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        matchedSnippet: snippet,
        riskExplanation: rule.explanation,
        recommendedCounterClause: rule.counterClause,
      });
    } else {
      passedTests.push(`Passed: No ${rule.title} detected.`);
    }
  }

  const predatoryRiskScore = Math.min(100, accumulatedRisk);

  let overallRiskTier: RiskTier = "SAFE";
  let safeToSign = true;

  if (predatoryRiskScore >= 50) {
    overallRiskTier = "CRITICAL_PREDATORY_RISK";
    safeToSign = false;
  } else if (predatoryRiskScore > 15) {
    overallRiskTier = "MODERATE_CONCERN";
    safeToSign = false;
  }

  let executiveSummary = "Contract is balanced. No predatory likeness traps or uncompensated exclusivity detected.";
  if (overallRiskTier === "CRITICAL_PREDATORY_RISK") {
    executiveSummary = `DANGER: Contract contains ${flaggedClauses.length} severe predatory clauses. Do not sign without counter-amendments.`;
  } else if (overallRiskTier === "MODERATE_CONCERN") {
    executiveSummary = `ADVISORY: Contract contains ${flaggedClauses.length} moderate legal traps. Recommended to request counter-clauses before executing.`;
  }

  return {
    overallRiskTier,
    predatoryRiskScore,
    flaggedClauses,
    passedTests,
    safeToSign,
    executiveSummary,
  };
}
