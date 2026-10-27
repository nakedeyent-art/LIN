import { describe, it, expect } from "vitest";
import {
  calculateEngagementMetrics,
  scanFtcCompliance,
  type SocialChannelMetrics,
} from "./social-ftc-scanner";

describe("Phase 5: Social Media Analytics & Automated FTC Compliance AI Scanner", () => {
  it("should calculate engagement rate and fair market value accurately", () => {
    const igMetrics: SocialChannelMetrics = {
      platform: "instagram",
      handle: "@jordan_nil",
      followers: 50000,
      averageLikes: 2500,
      averageComments: 200,
      averageShares: 50,
    };

    const report = calculateEngagementMetrics(igMetrics);
    expect(report.engagementRatePercent).toBe(5.5);
    expect(report.tier).toBe("Mid (50k-250k)");
    expect(report.engagementHealth).toBe("exceptional");
    expect(report.estimatedFairMarketValuePerPostDollars).toBeGreaterThan(1000);
  });

  it("should calculate TikTok engagement based on video views", () => {
    const ttMetrics: SocialChannelMetrics = {
      platform: "tiktok",
      handle: "@qb1_hops",
      followers: 100000,
      averageLikes: 8000,
      averageComments: 400,
      averageShares: 600,
      averageViews: 100000,
    };

    const report = calculateEngagementMetrics(ttMetrics);
    expect(report.engagementRatePercent).toBe(9.0);
    expect(report.engagementHealth).toBe("exceptional");
  });

  it("should pass fully compliant captions with #ad upfront", () => {
    const caption = "#ad Loving my new workout gear from Nike! Helps me stay explosive during two-a-days. #TeamNike";
    const result = scanFtcCompliance(caption, "Nike");

    expect(result.status).toBe("COMPLIANT");
    expect(result.hasExplicitAdTag).toBe(true);
    expect(result.score).toBe(100);
    expect(result.issues.length).toBe(0);
  });

  it("should flag ambiguous #collab as AMBIGUOUS_RISK and provide remediation", () => {
    const caption = "Excited for this amazing #collab with Gatorade! Fueling my season right.";
    const result = scanFtcCompliance(caption, "Gatorade");

    expect(result.status).toBe("NON_COMPLIANT");
    expect(result.hasAmbiguousTag).toBe(true);
    expect(result.hasExplicitAdTag).toBe(false);
    expect(result.issues[0]).toContain("Ambiguous Disclosure");
    expect(result.remediatedCaption).toContain("#ad | Sponsored by Gatorade");
  });

  it("should flag buried #ad deep in hashtag clusters", () => {
    const caption =
      "Game day ready! Can't wait for Saturday under the lights. #football #athlete #grind #workout #college #sec #gameday #beastmode #training #hardwork #ad";
    const result = scanFtcCompliance(caption, "BrandX");

    expect(result.status).toBe("AMBIGUOUS_RISK");
    expect(result.isBuriedInHashtags).toBe(true);
    expect(result.issues[0]).toContain("Buried Disclosure");
  });
});
