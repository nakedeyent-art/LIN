import { describe, expect, it } from "vitest";
import {
  computeRedlineDiffs,
  computeTermsHash,
  transitionNegotiationStatus,
  validateCounterofferTerms,
  type DealTermVersion,
} from "./deal-negotiation";

describe("Deal Counteroffer & Terms Version Negotiation Engine", () => {
  const baseVersion: DealTermVersion = {
    versionNumber: 1,
    versionLabel: "v1.0",
    proposedByRole: "sponsor",
    proposedByName: "Apex Hydration",
    createdAt: "2026-11-01T10:00:00Z",
    amountCents: 100000,
    deliverablesSummary: "2 Instagram Reels + 1 TikTok post featuring product with #ad",
    deliverableCount: 3,
    usageRightsDays: 180,
    exclusivityScope: "full_sector",
    includesAcademicSafeHarbor: false,
    termsHash: "hash-v1",
  };

  it("computes deterministic SHA-256 term version hashes", () => {
    const h1 = computeTermsHash({
      dealId: "deal-123",
      versionNumber: 1,
      amountCents: 100000,
      deliverablesSummary: "2 Instagram Reels",
      deliverableCount: 2,
      usageRightsDays: 90,
      exclusivityScope: "category_only",
      includesAcademicSafeHarbor: true,
    });
    const h2 = computeTermsHash({
      dealId: "deal-123",
      versionNumber: 1,
      amountCents: 100000,
      deliverablesSummary: "  2 Instagram Reels  ",
      deliverableCount: 2,
      usageRightsDays: 90,
      exclusivityScope: "category_only",
      includesAcademicSafeHarbor: true,
    });
    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
  });

  it("blocks NCAA/NFHS pay-for-play performance incentives in counteroffers", () => {
    const res = validateCounterofferTerms({
      amountCents: 150000,
      deliverablesSummary: "1 Instagram post plus $200 per touchdown scored on Friday",
      deliverableCount: 1,
      usageRightsDays: 30,
      exclusivityScope: "none",
      includesAcademicSafeHarbor: true,
      isMinorAthlete: true,
      previousVersion: baseVersion,
    });
    expect(res.valid).toBe(false);
    expect(res.payForPlayViolation).toBe(true);
    expect(res.violations.some((v) => v.includes("Pay-for-Play Violation"))).toBe(true);
  });

  it("flags guardian ratification requirement when minor athlete terms change", () => {
    const res = validateCounterofferTerms({
      amountCents: 135000,
      deliverablesSummary: "2 Instagram Reels with #ad disclosure",
      deliverableCount: 2,
      usageRightsDays: 90,
      exclusivityScope: "category_only",
      includesAcademicSafeHarbor: true,
      isMinorAthlete: true,
      previousVersion: baseVersion,
    });
    expect(res.valid).toBe(true);
    expect(res.requiresGuardianRatification).toBe(true);
  });

  it("generates accurate redline diffs between term versions", () => {
    const counterVersion: DealTermVersion = {
      ...baseVersion,
      versionNumber: 2,
      versionLabel: "v1.1",
      proposedByRole: "athlete",
      proposedByName: "Marcus Vance",
      amountCents: 135000,
      deliverableCount: 2,
      usageRightsDays: 90,
      exclusivityScope: "category_only",
      includesAcademicSafeHarbor: true,
    };

    const diffs = computeRedlineDiffs(baseVersion, counterVersion);
    expect(diffs.length).toBeGreaterThanOrEqual(4);
    expect(diffs.find((d) => d.field === "Total Compensation")?.deltaSummary).toContain("+$350.00 (+35%)");
    expect(diffs.find((d) => d.field === "Brand Usage Licensing Window")?.deltaSummary).toContain("-90 days");
    expect(diffs.find((d) => d.field === "Exclusivity Scope")?.proposedValue).toBe("Category-Only Exclusivity");
  });

  it("enforces guardian ratification transition before locking minor athlete terms", () => {
    const afterAthleteAccept = transitionNegotiationStatus(
      "countered_by_sponsor",
      "accept",
      "athlete",
      true
    );
    expect(afterAthleteAccept).toBe("pending_guardian_ratification");

    const afterGuardianRatify = transitionNegotiationStatus(
      afterAthleteAccept,
      "guardian_ratify",
      "guardian",
      true
    );
    expect(afterGuardianRatify).toBe("terms_locked");
  });
});

