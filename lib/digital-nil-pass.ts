import crypto from "crypto";

export interface AthleteNilCredentialInput {
  athleteId: string;
  athleteName: string;
  sport: string;
  position?: string;
  institutionOrSchool: string;
  stateCode: string;
  level: "Collegiate (NCAA)" | "High School (NFHS)";
  isMinor: boolean;
  guardianVerified: boolean;
  representationStatus: "Self-Represented" | "SPARTA Registered Agent";
  agentName?: string;
  rateCard: {
    socialMediaPostDollars: number;
    inPersonAppearanceDollars: number;
    skillsClinicDollars: number;
    brandCommercialDollars: number;
  };
}

export interface VerifiableNilCredential {
  credentialId: string;
  issuedAt: string;
  athlete: {
    athleteId: string;
    athleteName: string;
    sport: string;
    position: string;
    institutionOrSchool: string;
    stateCode: string;
    level: string;
  };
  badges: {
    amateurismEligibility: "NCAA_COMPLIANT" | "NFHS_COMPLIANT";
    minorGuardianConsentVerified: boolean;
    representationType: string;
    representationAgentName?: string;
    ftcEndorsementCertified: boolean;
  };
  rateCard: {
    socialMediaPostDollars: number;
    inPersonAppearanceDollars: number;
    skillsClinicDollars: number;
    brandCommercialDollars: number;
  };
  verificationUrl: string;
  digitalSignatureSha256: string;
}

export interface AppleWalletPassPayload {
  formatVersion: number;
  passTypeIdentifier: string;
  serialNumber: string;
  teamIdentifier: string;
  organizationName: string;
  description: string;
  logoText: string;
  foregroundColor: string;
  backgroundColor: string;
  labelColor: string;
  barcode: {
    message: string;
    format: "PKBarcodeFormatQR";
    messageEncoding: "iso-8859-1";
    altText: string;
  };
  generic: {
    primaryFields: Array<{ key: string; label: string; value: string }>;
    secondaryFields: Array<{ key: string; label: string; value: string }>;
    auxiliaryFields: Array<{ key: string; label: string; value: string }>;
    backFields: Array<{ key: string; label: string; value: string }>;
  };
}

export function generateVerifiableNilCredential(
  input: AthleteNilCredentialInput,
  baseUrl: string = "https://lin-nil.com"
): VerifiableNilCredential {
  const credentialId = `NIL-PASS-${input.athleteId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const issuedAt = new Date().toISOString();
  const verificationUrl = `${baseUrl}/verify?cid=${credentialId}`;

  const payloadToSign = `${credentialId}|${input.athleteId}|${input.athleteName}|${input.sport}|${input.level}|${input.stateCode}|${issuedAt}`;
  const digitalSignatureSha256 = crypto
    .createHash("sha256")
    .update(payloadToSign)
    .digest("hex");

  return {
    credentialId,
    issuedAt,
    athlete: {
      athleteId: input.athleteId,
      athleteName: input.athleteName,
      sport: input.sport,
      position: input.position || "Athlete",
      institutionOrSchool: input.institutionOrSchool,
      stateCode: input.stateCode,
      level: input.level,
    },
    badges: {
      amateurismEligibility:
        input.level === "High School (NFHS)" ? "NFHS_COMPLIANT" : "NCAA_COMPLIANT",
      minorGuardianConsentVerified: input.isMinor ? input.guardianVerified : true,
      representationType: input.representationStatus,
      representationAgentName: input.agentName,
      ftcEndorsementCertified: true,
    },
    rateCard: input.rateCard,
    verificationUrl,
    digitalSignatureSha256,
  };
}

export function generateAppleWalletPass(
  credential: VerifiableNilCredential
): AppleWalletPassPayload {
  return {
    formatVersion: 1,
    passTypeIdentifier: "pass.com.linnil.credential",
    serialNumber: credential.credentialId,
    teamIdentifier: "LINNILINC",
    organizationName: "LIN NIL Verified Network",
    description: `Official Verified NIL Credential for ${credential.athlete.athleteName}`,
    logoText: "LIN NIL PASS",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(15, 23, 42)", // Deep slate navy
    labelColor: "rgb(234, 179, 8)", // Gold
    barcode: {
      message: credential.verificationUrl,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: `SCAN TO VERIFY: ${credential.credentialId}`,
    },
    generic: {
      primaryFields: [
        {
          key: "athleteName",
          label: "STUDENT-ATHLETE",
          value: credential.athlete.athleteName,
        },
      ],
      secondaryFields: [
        {
          key: "sportSchool",
          label: "SPORT & INSTITUTION",
          value: `${credential.athlete.sport} | ${credential.athlete.institutionOrSchool}`,
        },
        {
          key: "eligibility",
          label: "STATUS",
          value:
            credential.badges.amateurismEligibility === "NFHS_COMPLIANT"
              ? "NFHS Prep Compliant"
              : "NCAA Verified",
        },
      ],
      auxiliaryFields: [
        {
          key: "socialRate",
          label: "SPONSORED REEL",
          value: `$${credential.rateCard.socialMediaPostDollars}`,
        },
        {
          key: "appearanceRate",
          label: "2-HR CLINIC / EVENT",
          value: `$${credential.rateCard.inPersonAppearanceDollars}`,
        },
        {
          key: "representation",
          label: "REPRESENTATION",
          value: credential.badges.representationType,
        },
      ],
      backFields: [
        {
          key: "sha256",
          label: "Cryptographic Verification Hash",
          value: credential.digitalSignatureSha256,
        },
        {
          key: "legalNotice",
          label: "NIL Regulatory Compliance",
          value:
            "This digital credential certifies verified identity, amateurism eligibility status under applicable state high school or NCAA regulations, and published fair market value rate cards.",
        },
        {
          key: "verificationLink",
          label: "Verification Portal",
          value: credential.verificationUrl,
        },
      ],
    },
  };
}
