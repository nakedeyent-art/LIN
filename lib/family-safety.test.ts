import { describe, expect, it } from "vitest";
import {
  calculateEmancipationCountdown,
  evaluateFamilySafetyScore,
} from "./family-safety";

describe("family-safety domain logic", () => {
  it("calculates countdown for a 16-year-old minor correctly", () => {
    // Reference date: 2026-11-01. Birth: 2010-05-15 (16 years old)
    const countdown = calculateEmancipationCountdown("2010-05-15", "2026-11-01");
    expect(countdown.isMinor).toBe(true);
    expect(countdown.currentAge).toBe(16);
    expect(countdown.daysUntil18).toBeGreaterThan(0);
    expect(countdown.transitionStage).toBe("PREP_PROSPECT_16_17");
    expect(countdown.actionItems.length).toBeGreaterThan(0);
  });

  it("identifies imminent transition within 90 days", () => {
    // Reference date: 2026-11-01. 18th birthday on 2026-12-15 (~44 days away)
    const countdown = calculateEmancipationCountdown("2008-12-15", "2026-11-01");
    expect(countdown.isMinor).toBe(true);
    expect(countdown.currentAge).toBe(17);
    expect(countdown.daysUntil18).toBeLessThanOrEqual(90);
    expect(countdown.transitionStage).toBe("TRANSITIONING_SOON");
  });

  it("identifies emancipated legal adults (18+)", () => {
    // Reference date: 2026-11-01. Birth: 2007-01-01 (19 years old)
    const countdown = calculateEmancipationCountdown("2007-01-01", "2026-11-01");
    expect(countdown.isMinor).toBe(false);
    expect(countdown.currentAge).toBe(19);
    expect(countdown.daysUntil18).toBe(0);
    expect(countdown.transitionStage).toBe("EMANCIPATED_ADULT");
  });

  it("evaluates safety score with full guardian protections", () => {
    const res = evaluateFamilySafetyScore({
      isMinor: true,
      guardiansLinkedCount: 2,
      isDiscoverable: true,
      openDealsCount: 2,
      pendingGuardianReviewCount: 0,
      totalDealExposureCents: 200000,
      hasUnverifiedAgents: false,
    });
    expect(res.safetyScore).toBe(100);
    expect(res.tier).toBe("OPTIMAL_PROTECTION");
    expect(res.alerts.some((a) => a.severity === "green")).toBe(true);
  });

  it("heavily penalizes unlinked minor athletes", () => {
    const res = evaluateFamilySafetyScore({
      isMinor: true,
      guardiansLinkedCount: 0,
      isDiscoverable: false,
      openDealsCount: 1,
      pendingGuardianReviewCount: 1,
      totalDealExposureCents: 50000,
      hasUnverifiedAgents: true,
    });
    expect(res.safetyScore).toBeLessThan(60);
    expect(res.tier).toBe("AT_RISK");
    expect(res.alerts.some((a) => a.title === "No Guardian Linked")).toBe(true);
  });
});
