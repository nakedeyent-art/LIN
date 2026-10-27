import { describe, it, expect } from "vitest";
import {
  evaluateInternationalVisaDeal,
  generateDsoSafeHarborCertificate,
  type VisaDealEvaluationInput,
} from "./visa-safe-harbor";

describe("Phase 6: International Athlete F-1 / P-1A Visa Safe Harbor", () => {
  it("should permit passive group licensing royalties for F-1 student athletes", () => {
    const input: VisaDealEvaluationInput = {
      athleteId: "ath-intl-1",
      athleteName: "Lucas Da Silva",
      countryOfCitizenship: "Brazil",
      visaType: "F-1",
      dealId: "deal-ea-sports",
      brandName: "EA Sports College Football",
      activityType: "passive_group_licensing",
      totalCompensationDollars: 600,
      physicalLocationOfPerformance: "US_SOIL",
      countryOfPerformance: "United States",
      dsoNotified: true,
    };

    const result = evaluateInternationalVisaDeal(input);
    expect(result.isPermissible).toBe(true);
    expect(result.classification).toBe("PASSIVE_IP_ROYALTY");
    expect(result.riskLevel).toBe("LOW_ADVISORY");
    expect(result.dsoAttestationRequired).toBe(true);
  });

  it("should block active commercial shoots on US soil for F-1 student athletes", () => {
    const input: VisaDealEvaluationInput = {
      athleteId: "ath-intl-2",
      athleteName: "Amara Okonkwo",
      countryOfCitizenship: "Nigeria",
      visaType: "F-1",
      dealId: "deal-commercial-miami",
      brandName: "Local Fitness Gym",
      activityType: "active_commercial_shoot",
      totalCompensationDollars: 4000,
      physicalLocationOfPerformance: "US_SOIL",
      countryOfPerformance: "United States",
      dsoNotified: false,
    };

    const result = evaluateInternationalVisaDeal(input);
    expect(result.isPermissible).toBe(false);
    expect(result.classification).toBe("UNAUTHORIZED_US_EMPLOYMENT_VIOLATION");
    expect(result.riskLevel).toBe("CRITICAL_IMMIGRATION_BREACH");
    expect(result.summary).toContain("PROHIBITED");
  });

  it("should permit active commercial work executed offshore with travel proof", () => {
    const input: VisaDealEvaluationInput = {
      athleteId: "ath-intl-3",
      athleteName: "Amara Okonkwo",
      countryOfCitizenship: "Nigeria",
      visaType: "F-1",
      dealId: "deal-offshore-shoot",
      brandName: "Global Energy Drink",
      activityType: "active_commercial_shoot",
      totalCompensationDollars: 8500,
      physicalLocationOfPerformance: "OFFSHORE_INTERNATIONAL",
      countryOfPerformance: "Bahamas",
      travelProofReference: "Delta Air Lines Flight DL1482 Boarding Pass (Nassau) & Atlantis Hotel Folio",
      dsoNotified: true,
    };

    const result = evaluateInternationalVisaDeal(input);
    expect(result.isPermissible).toBe(true);
    expect(result.classification).toBe("OFFSHORE_COMMERCIAL_SAFE_HARBOR");
    expect(result.riskLevel).toBe("NONE");
    expect(result.reasons[1]).toContain("Delta Air Lines");
  });

  it("should permit P-1A athletic visa holders to engage in approved commercial work", () => {
    const input: VisaDealEvaluationInput = {
      athleteId: "ath-intl-4",
      athleteName: "Sven Lindqvist",
      countryOfCitizenship: "Sweden",
      visaType: "P-1A",
      dealId: "deal-p1a-gear",
      brandName: "Nordic Hockey Co",
      activityType: "active_social_media",
      totalCompensationDollars: 12000,
      physicalLocationOfPerformance: "US_SOIL",
      countryOfPerformance: "United States",
      dsoNotified: false,
    };

    const result = evaluateInternationalVisaDeal(input);
    expect(result.isPermissible).toBe(true);
    expect(result.classification).toBe("APPROVED_P1A_WORK");
    expect(result.riskLevel).toBe("NONE");
  });

  it("should generate a complete DSO Safe Harbor Attestation certificate", () => {
    const input: VisaDealEvaluationInput = {
      athleteId: "ath-intl-5",
      athleteName: "Liam O'Connor",
      countryOfCitizenship: "Ireland",
      visaType: "F-1",
      dealId: "deal-irish-beef",
      brandName: "Irish Food Export Board",
      activityType: "active_social_media",
      totalCompensationDollars: 3500,
      physicalLocationOfPerformance: "OFFSHORE_INTERNATIONAL",
      countryOfPerformance: "Ireland",
      travelProofReference: "Aer Lingus EI 104 Boarding Pass & Dublin Port Stamp",
      dsoNotified: true,
    };

    const certificate = generateDsoSafeHarborCertificate(input);
    expect(certificate.certificateId).toContain("SEVIS-SAFE");
    expect(certificate.athleteName).toBe("Liam O'Connor");
    expect(certificate.countryOfCitizenship).toBe("Ireland");
    expect(certificate.certificationText).toContain("FORMAL DSO NIL ATTESTATION");
    expect(certificate.certificationText).toContain("Aer Lingus");
  });
});
