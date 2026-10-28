import { describe, it, expect } from "vitest";
import { analyzeContractRisk } from "./contract-risk-analyzer";

describe("Initiative 2: AI Contract Risk Analyzer & Predatory Clause Detector", () => {
  it("should detect perpetual likeness buyout and assign CRITICAL risk", () => {
    const predatoryContract = `
      Section 4: Athlete grants Sponsor the irrevocable right to use Athlete's Name, Image, and Likeness in perpetuity throughout the universe across all media.
    `;

    const report = analyzeContractRisk(predatoryContract);
    expect(report.overallRiskTier).toBe("MODERATE_CONCERN");
    expect(report.predatoryRiskScore).toBeGreaterThanOrEqual(35);
    expect(report.safeToSign).toBe(false);

    const perpetualFlag = report.flaggedClauses.find((c) => c.category === "perpetual_rights");
    expect(perpetualFlag).toBeDefined();
    expect(perpetualFlag?.severity).toBe("CRITICAL");
    expect(perpetualFlag?.recommendedCounterClause).toContain("Term-Limited License");
  });

  it("should detect compound predatory contracts and score as CRITICAL_PREDATORY_RISK", () => {
    const toxicContract = `
      1. Rights Grant: Athlete grants Sponsor right to likeness forever.
      2. Exclusivity: Athlete shall not endorse any other commercial brand during the term.
      3. Termination: Sponsor may terminate at any time without notice or liability.
      4. Morals: Sponsor may cancel in the sole opinion of Sponsor if athlete behaves poorly.
      5. Work Made for Hire: All created content shall be considered work made for hire.
    `;

    const report = analyzeContractRisk(toxicContract);
    expect(report.overallRiskTier).toBe("CRITICAL_PREDATORY_RISK");
    expect(report.predatoryRiskScore).toBeGreaterThanOrEqual(70);
    expect(report.flaggedClauses.length).toBeGreaterThanOrEqual(4);
    expect(report.safeToSign).toBe(false);
  });

  it("should score standard balanced contracts as SAFE with zero predatory flags", () => {
    const balancedContract = `
      Agreement Term: 6 months from execution.
      License Scope: Sponsor is granted a non-exclusive license to use deliverables during the 6-month term.
      Deliverables: 2 social media posts adhering to FTC 16 CFR Part 255 guidelines.
      Payment: $1,500 payable within 14 days of deliverable completion via escrow.
      Mutual Termination: Either party may terminate with 30 days written notice.
      Governing Law: Mutual agreement under athlete's state of athletic competition.
    `;

    const report = analyzeContractRisk(balancedContract);
    expect(report.overallRiskTier).toBe("SAFE");
    expect(report.predatoryRiskScore).toBe(0);
    expect(report.safeToSign).toBe(true);
    expect(report.flaggedClauses.length).toBe(0);
  });
});
