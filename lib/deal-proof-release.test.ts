import { describe, expect, it } from "vitest";
import {
  evaluateDeliverableSubmission,
  evaluateEscrowReleaseEligibility,
} from "./deal-proof-release";

describe("deal-proof-release domain logic", () => {
  it("verifies FTC compliant deliverable submission", () => {
    const report = evaluateDeliverableSubmission({
      itemId: "item-1",
      itemTitle: "Instagram Reel Post",
      proofType: "social_post_url",
      proofUrlOrPath: "https://instagram.com/p/sample123",
      postCaptionText: "#ad Fueled up with @ApexNutrition before tournament game day! Check them out.",
      sponsorBrand: "Apex Nutrition",
      submittedAt: "2026-11-01T10:00:00Z",
    });

    expect(report.verified).toBe(true);
    expect(report.status).toBe("PROOF_VERIFIED_FTC_COMPLIANT");
    expect(report.ftcScan?.hasExplicitAdTag).toBe(true);
  });

  it("warns when deliverable submission lacks FTC endorsement tag", () => {
    const report = evaluateDeliverableSubmission({
      itemId: "item-2",
      itemTitle: "Instagram Story Series",
      proofType: "social_post_url",
      proofUrlOrPath: "https://instagram.com/stories/sample456",
      postCaptionText: "Great workout today! Love my new shoes.",
      sponsorBrand: "Apex Nutrition",
      submittedAt: "2026-11-01T10:00:00Z",
    });

    expect(report.verified).toBe(false);
    expect(report.status).toBe("FTC_WARNING_REVISION_RECOMMENDED");
    expect(report.ftcScan?.hasExplicitAdTag).toBe(false);
  });

  it("blocks escrow release when deliverables are unaccepted", () => {
    const res = evaluateEscrowReleaseEligibility({
      dealId: "deal-1",
      dealTitle: "Summer Ambassador Campaign",
      dealAmountDollars: 1000,
      isMinorAthlete: false,
      workItems: [
        { id: "w-1", status: "accepted" },
        { id: "w-2", status: "submitted" },
      ],
      escrowFunded: true,
    });

    expect(res.canReleasePayment).toBe(false);
    expect(res.allDeliverablesAccepted).toBe(false);
    expect(res.releaseState).toBe("AWAITING_DELIVERABLES");
    expect(res.blockReason).toContain("1 of 2 deliverable items pending");
  });

  it("permits escrow release when all deliverables are accepted and funded", () => {
    const res = evaluateEscrowReleaseEligibility({
      dealId: "deal-2",
      dealTitle: "Scholastic Clinic Lead",
      dealAmountDollars: 2000,
      isMinorAthlete: true,
      workItems: [
        { id: "w-1", status: "accepted" },
        { id: "w-2", status: "accepted" },
      ],
      escrowFunded: true,
    });

    expect(res.canReleasePayment).toBe(true);
    expect(res.allDeliverablesAccepted).toBe(true);
    expect(res.releaseState).toBe("READY_FOR_RELEASE");
    expect(res.disbursementTarget).toBe("GUARDIAN_CUSTODIAL_UGMA");
    expect(res.platformFeeDollars).toBe(100); // 5%
    expect(res.netPayeePayoutDollars).toBe(1900);
    expect(res.estimatedTaxReserveDollars).toBe(306); // 15.3%
  });
});
