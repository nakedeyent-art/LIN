import { describe, expect, it } from "vitest";
import {
  buildContractTerms,
  CLAUSE_PRESETS,
  EXCLUSIVITY_DESCRIPTIONS,
  validateContractLength,
} from "./contract-clauses";

describe("NIL Contract Clause & Term Sheet Generator", () => {
  it("includes all defined presets in CLAUSE_PRESETS", () => {
    expect(CLAUSE_PRESETS).toHaveProperty("social_ambassador");
    expect(CLAUSE_PRESETS).toHaveProperty("in_person_clinic");
    expect(CLAUSE_PRESETS).toHaveProperty("product_review");
    expect(CLAUSE_PRESETS).toHaveProperty("collective_grant");
  });

  it("builds standard contract terms with FTC, school IP, morals, and proof clauses", () => {
    const terms = buildContractTerms({
      preset: "social_ambassador",
      isMinor: false,
    });

    expect(terms).toContain("SCOPE OF DELIVERABLES:");
    expect(terms).toContain("FTC DISCLOSURE COMPLIANCE");
    expect(terms).toContain("16 CFR Part 255");
    expect(terms).toContain("INSTITUTIONAL IP PROTECTION");
    expect(terms).toContain("MUTUAL MORALS CLAUSE");
    expect(terms).toContain("PERFORMANCE VERIFICATION");
    expect(terms).toContain("AMATEURISM ATTESTATION");
    // Adult should not have guardian clause
    expect(terms).not.toContain("GUARDIAN CONSENT");

    // Fits comfortably within 2000 character validation limit
    const val = validateContractLength(terms);
    expect(val.valid).toBe(true);
    expect(val.charCount).toBeGreaterThan(100);
    expect(val.charCount).toBeLessThan(2000);
  });

  it("appends Guardian Consent clause automatically when athlete is a minor", () => {
    const minorTerms = buildContractTerms({
      preset: "in_person_clinic",
      isMinor: true,
    });

    expect(minorTerms).toContain("GUARDIAN CONSENT");
    expect(minorTerms).toContain("contingent upon written consent and execution by the athlete's legal parent or guardian");
  });

  it("adds category exclusivity scope when requested", () => {
    const apparelTerms = buildContractTerms({
      preset: "social_ambassador",
      exclusivity: "apparel_footwear",
      campaignDurationDays: 60,
    });

    expect(apparelTerms).toContain("EXCLUSIVITY SCOPE");
    expect(apparelTerms).toContain(EXCLUSIVITY_DESCRIPTIONS["apparel_footwear"]);
    expect(apparelTerms).toContain("Duration: 60 days");
  });

  it("omits exclusivity clause when set to non_exclusive", () => {
    const nonExclTerms = buildContractTerms({
      preset: "social_ambassador",
      exclusivity: "non_exclusive",
    });

    expect(nonExclTerms).not.toContain("EXCLUSIVITY SCOPE");
  });

  it("allows overriding with custom specific deliverables", () => {
    const custom = "Host 1 livestream Q&A on Twitch and 3 posts on TikTok highlighting game shoes.";
    const terms = buildContractTerms({
      preset: "social_ambassador",
      specificDeliverables: custom,
    });

    expect(terms).toContain(custom);
  });

  describe("Validation", () => {
    it("flags error if terms are too short (< 20 chars)", () => {
      const res = validateContractLength("too short");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("too short");
    });

    it("flags error if terms exceed 2000 characters", () => {
      const longText = "a".repeat(2005);
      const res = validateContractLength(longText);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("exceed maximum length");
    });
  });
});
