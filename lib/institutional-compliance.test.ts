import { describe, it, expect } from "vitest";
import {
  detectUniversityConflicts,
  generateUniversityDisclosurePacket,
  NCAA_FBS_PROFILES,
  type NILDealForDisclosure,
} from "./institutional-compliance";

describe("Phase 3: Institutional Compliance & University Disclosure Engine", () => {
  const miamiProfile = NCAA_FBS_PROFILES.find((s) => s.schoolId === "miami")!;
  const floridaProfile = NCAA_FBS_PROFILES.find((s) => s.schoolId === "florida")!;

  it("should detect apparel conflict when an Adidas school athlete signs with Nike", () => {
    const deal: NILDealForDisclosure = {
      dealId: "deal-101",
      athleteName: "Jordan Davis",
      athleteId: "ath-1",
      athleteSport: "Football",
      schoolId: "miami",
      counterpartyBrand: "Nike",
      category: "apparel",
      totalCompensationDollars: 15000,
      startDate: "2026-09-01",
      endDate: "2026-12-31",
      usesSchoolTrademarks: false,
      schoolTrademarkPermissionGranted: false,
      descriptionOfActivities: "Social media endorsement of Nike cleats",
    };

    const report = detectUniversityConflicts(deal, miamiProfile);
    expect(report.hasApparelConflict).toBe(true);
    expect(report.hasTrademarkViolation).toBe(false);
    expect(report.conflictingDetails.length).toBeGreaterThan(0);
    expect(report.conflictingDetails[0]).toContain("Adidas");
  });

  it("should flag trademark violations when athlete uses school marks without license", () => {
    const deal: NILDealForDisclosure = {
      dealId: "deal-102",
      athleteName: "Marcus Hill",
      athleteId: "ath-2",
      athleteSport: "Basketball",
      schoolId: "florida",
      counterpartyBrand: "Local Auto Dealership",
      category: "other",
      totalCompensationDollars: 5000,
      startDate: "2026-10-01",
      endDate: "2026-11-01",
      usesSchoolTrademarks: true,
      schoolTrademarkPermissionGranted: false,
      descriptionOfActivities: "Billboard wearing official Florida Gators jersey",
    };

    const report = detectUniversityConflicts(deal, floridaProfile);
    expect(report.hasTrademarkViolation).toBe(true);
    expect(report.recommendedAction).toContain("co-licensing");
  });

  it("should approve deal with zero conflicts and redact private financial info", () => {
    const deal: NILDealForDisclosure = {
      dealId: "deal-103",
      athleteName: "Chloe Reynolds",
      athleteId: "ath-3",
      athleteSport: "Volleyball",
      schoolId: "florida",
      counterpartyBrand: "Gymshark",
      category: "apparel",
      totalCompensationDollars: 8000,
      startDate: "2026-08-01",
      endDate: "2026-12-01",
      usesSchoolTrademarks: false,
      schoolTrademarkPermissionGranted: false,
      agentName: "Elite Sports Agency",
      agentFeePercentage: 15,
      privateBankRoutingNumber: "021000021",
      privateBankAccountNumber: "9876543210",
      privateHomeAddress: "123 Stadium Way, Gainesville, FL",
      descriptionOfActivities: "Gym workout video series wearing non-team apparel",
    };

    const packet = generateUniversityDisclosurePacket(deal, floridaProfile);
    expect(packet.submissionStatus).toBe("APPROVED");
    expect(packet.conflictReport.hasApparelConflict).toBe(false);
    expect(packet.conflictReport.hasTrademarkViolation).toBe(false);
    expect(packet.redactedDeal.agentFeeDollars).toBe(1200);
    expect(packet.redactedDeal.confidentialFinancialsRedacted).toBe(true);

    // Verify sensitive fields are not in the generated redacted output
    const rawJson = JSON.stringify(packet);
    expect(rawJson).not.toContain("021000021");
    expect(rawJson).not.toContain("9876543210");
    expect(rawJson).not.toContain("123 Stadium Way");
  });

  it("should detect beverage sponsor exclusivity conflicts", () => {
    const deal: NILDealForDisclosure = {
      dealId: "deal-104",
      athleteName: "Tyler Scott",
      athleteId: "ath-4",
      athleteSport: "Baseball",
      schoolId: "miami",
      counterpartyBrand: "Powerade",
      category: "beverage",
      totalCompensationDollars: 4500,
      startDate: "2026-07-01",
      endDate: "2026-08-01",
      usesSchoolTrademarks: false,
      schoolTrademarkPermissionGranted: false,
      descriptionOfActivities: "Hydration drink social posts",
    };

    const report = detectUniversityConflicts(deal, miamiProfile);
    expect(report.hasSponsorConflict).toBe(true);
    expect(report.conflictingDetails[0]).toContain("Gatorade");
  });
});
