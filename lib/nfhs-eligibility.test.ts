import { describe, expect, it } from "vitest";
import {
  getStateRule,
  validateHighSchoolNilDeal,
  UNIVERSAL_PROHIBITED_CATEGORIES,
} from "./nfhs-eligibility";

describe("50-State High School (NFHS) Eligibility Engine", () => {
  describe("State Rule Retrieval", () => {
    it("returns California CIF rule with permitted status and logo bans", () => {
      const rule = getStateRule("CA");
      expect(rule.status).toBe("permitted");
      expect(rule.allowUniformsOrLogos).toBe(false);
      expect(rule.association).toContain("CIF");
      expect(rule.disclosureDeadlineDays).toBe(7);
    });

    it("returns Texas UIL rule with prohibited status", () => {
      const rule = getStateRule("TX");
      expect(rule.status).toBe("prohibited");
      expect(rule.association).toContain("UIL");
    });

    it("returns default fallback rule for unknown state codes", () => {
      const rule = getStateRule("XX");
      expect(rule.association).toContain("NFHS General Model Guidance");
      expect(rule.status).toBe("restricted");
    });
  });

  describe("validateHighSchoolNilDeal", () => {
    it("approves valid compliant California high school deal with guardian consent", () => {
      const res = validateHighSchoolNilDeal({
        stateCode: "CA",
        isHighSchool: true,
        industryCategory: "Athletic Apparel & Footwear",
        usesSchoolUniformOrMascot: false,
        hasGuardianConsent: true,
        isContingentOnAthleticPerformance: false,
      });

      expect(res.eligible).toBe(true);
      expect(res.violations.length).toBe(0);
      expect(res.requiredActions.some((a) => a.includes("athletic director"))).toBe(true);
    });

    it("blocks deal in prohibited state (Texas)", () => {
      const res = validateHighSchoolNilDeal({
        stateCode: "TX",
        isHighSchool: true,
        hasGuardianConsent: true,
      });

      expect(res.eligible).toBe(false);
      expect(res.violations.some((v) => v.includes("UIL"))).toBe(true);
    });

    it("blocks deal when school uniform or mascot is used", () => {
      const res = validateHighSchoolNilDeal({
        stateCode: "FL",
        isHighSchool: true,
        usesSchoolUniformOrMascot: true, // violation!
        hasGuardianConsent: true,
      });

      expect(res.eligible).toBe(false);
      expect(res.violations.some((v) => v.includes("uniforms"))).toBe(true);
    });

    it("blocks deal in blacklisted industry categories (sports betting, cannabis, alcohol)", () => {
      const res = validateHighSchoolNilDeal({
        stateCode: "GA",
        isHighSchool: true,
        industryCategory: "Sports Betting", // prohibited!
        hasGuardianConsent: true,
      });

      expect(res.eligible).toBe(false);
      expect(res.violations.some((v) => v.includes("blacklisted"))).toBe(true);
    });

    it("blocks pay-for-play performance contingencies", () => {
      const res = validateHighSchoolNilDeal({
        stateCode: "NY",
        isHighSchool: true,
        isContingentOnAthleticPerformance: true,
        hasGuardianConsent: true,
      });

      expect(res.eligible).toBe(false);
      expect(res.violations.some((v) => v.includes("Pay-for-play"))).toBe(true);
    });

    it("requires guardian consent for high school minor athletes", () => {
      const res = validateHighSchoolNilDeal({
        stateCode: "CA",
        isHighSchool: true,
        hasGuardianConsent: false, // missing!
      });

      expect(res.eligible).toBe(false);
      expect(res.violations.some((v) => v.includes("guardian"))).toBe(true);
    });

    it("bypasses high school association restrictions for collegiate athletes", () => {
      const res = validateHighSchoolNilDeal({
        stateCode: "TX", // Even in TX, college athletes can monetize
        isHighSchool: false,
        hasGuardianConsent: true,
      });

      expect(res.eligible).toBe(true);
      expect(res.violations.length).toBe(0);
    });
  });
});
