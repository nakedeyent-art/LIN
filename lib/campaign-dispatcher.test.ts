import { describe, it, expect } from "vitest";
import {
  matchAthletesToCampaign,
  dispatchBatchCampaignOffers,
  type CampaignTargetCriteria,
} from "./campaign-dispatcher";

describe("Initiative 3: Brand Campaign Marketplace & Batch Deal Dispatcher", () => {
  const criteria: CampaignTargetCriteria = {
    campaignName: "Hydration Summer Showcase",
    sponsorName: "Apex Hydration Co.",
    category: "beverage",
    targetSports: ["Football", "Basketball", "Track & Field"],
    targetStates: ["FL", "CA", "TX"],
    minFollowers: 20000,
    minEngagementRatePercent: 4.0,
    perAthleteBudgetDollars: 1000,
    maxAthleteSlots: 5,
    deliverablesDescription: "2 TikTok Reels and 1 Instagram post wearing branded gear.",
  };

  it("should correctly evaluate candidates and disqualify Texas prep athletes under UIL bylaws", () => {
    const results = matchAthletesToCampaign(criteria);
    expect(results.length).toBe(6);

    // Chloe Reynolds is a high school minor in TX, where prep NIL is banned
    const chloe = results.find((r) => r.athlete.athleteName === "Chloe Reynolds")!;
    expect(chloe.isEligible).toBe(false);
    expect(chloe.disqualificationReasons.some((r) => r.includes("TX") || r.includes("UIL"))).toBe(true);

    // Devon Brooks is a collegiate football player in FL with 48k followers and 4.8% ER
    const devon = results.find((r) => r.athlete.athleteName === "Devon Brooks")!;
    expect(devon.isEligible).toBe(true);
    expect(devon.matchScore).toBe(100);
  });

  it("should calculate batch escrow deposit with 5% platform fee", () => {
    const summary = dispatchBatchCampaignOffers(criteria);
    expect(summary.campaignName).toBe("Hydration Summer Showcase");
    expect(summary.eligibleCandidatesCount).toBeGreaterThanOrEqual(3);
    expect(summary.selectedDispatchCount).toBeGreaterThanOrEqual(3);

    const expectedPool = summary.selectedDispatchCount * 1000;
    expect(summary.grossAthletePoolDollars).toBe(expectedPool);

    const expectedFee = Math.round(expectedPool * 0.05);
    expect(summary.platformFeeDollars).toBe(expectedFee);
    expect(summary.totalEscrowDepositRequiredDollars).toBe(expectedPool + expectedFee);

    expect(summary.dispatchedDealOffers.length).toBe(summary.selectedDispatchCount);
    expect(summary.dispatchedDealOffers[0].status).toBe("DISPATCHED_PENDING_ACCEPTANCE");
  });
});
