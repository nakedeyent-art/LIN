import { describe, it, expect } from "vitest";
import {
  generateVerifiableNilCredential,
  generateAppleWalletPass,
  type AthleteNilCredentialInput,
} from "./digital-nil-pass";

describe("Initiative 4: Digital Athlete NIL Credential & Verified Rate Card Pass", () => {
  const collegeAthlete: AthleteNilCredentialInput = {
    athleteId: "ath-devon-001",
    athleteName: "Devon Brooks",
    sport: "Football",
    position: "Quarterback",
    institutionOrSchool: "University of Miami",
    stateCode: "FL",
    level: "Collegiate (NCAA)",
    isMinor: false,
    guardianVerified: true,
    representationStatus: "SPARTA Registered Agent",
    agentName: "Elite Sports Management",
    rateCard: {
      socialMediaPostDollars: 1250,
      inPersonAppearanceDollars: 2000,
      skillsClinicDollars: 1500,
      brandCommercialDollars: 5000,
    },
  };

  it("should generate verifiable credential with unique ID and SHA-256 signature", () => {
    const cred = generateVerifiableNilCredential(collegeAthlete);
    expect(cred.credentialId).toContain("NIL-PASS");
    expect(cred.athlete.athleteName).toBe("Devon Brooks");
    expect(cred.badges.amateurismEligibility).toBe("NCAA_COMPLIANT");
    expect(cred.badges.representationType).toBe("SPARTA Registered Agent");
    expect(cred.digitalSignatureSha256).toHaveLength(64); // SHA-256 is 64 hex characters
    expect(cred.verificationUrl).toContain("/verify?cid=");
  });

  it("should format Apple Wallet pass JSON compliant with PKPass specification", () => {
    const cred = generateVerifiableNilCredential(collegeAthlete);
    const pass = generateAppleWalletPass(cred);

    expect(pass.formatVersion).toBe(1);
    expect(pass.passTypeIdentifier).toBe("pass.com.linnil.credential");
    expect(pass.barcode.format).toBe("PKBarcodeFormatQR");
    expect(pass.barcode.message).toBe(cred.verificationUrl);
    expect(pass.generic.primaryFields[0].value).toBe("Devon Brooks");
    expect(pass.generic.secondaryFields[0].value).toContain("Football");
    expect(pass.generic.auxiliaryFields.length).toBeGreaterThanOrEqual(3);
    expect(pass.generic.backFields[0].value).toBe(cred.digitalSignatureSha256);
  });

  it("should correctly configure High School NFHS amateurism badge", () => {
    const hsAthlete: AthleteNilCredentialInput = {
      ...collegeAthlete,
      athleteName: "Marcus Hill",
      institutionOrSchool: "Mater Dei High School",
      level: "High School (NFHS)",
      isMinor: true,
      guardianVerified: true,
    };

    const cred = generateVerifiableNilCredential(hsAthlete);
    expect(cred.badges.amateurismEligibility).toBe("NFHS_COMPLIANT");
    expect(cred.badges.minorGuardianConsentVerified).toBe(true);

    const pass = generateAppleWalletPass(cred);
    const eligibilityField = pass.generic.secondaryFields.find((f) => f.key === "eligibility");
    expect(eligibilityField?.value).toBe("NFHS Prep Compliant");
  });
});
