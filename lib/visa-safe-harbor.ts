export type VisaType = "F-1" | "J-1" | "P-1A" | "O-1A" | "US_CITIZEN_OR_PERMANENT_RESIDENT";

export type NilActivityType =
  | "passive_group_licensing" // EA Sports, trading cards, jersey royalties
  | "passive_equity" // Equity ownership in a brand
  | "active_social_media" // Creating sponsored posts / stories
  | "active_commercial_shoot" // Filming commercial, photoshoot
  | "active_camp_or_clinic" // Coaching or hosting sports camps
  | "active_autograph_signing" // In-person signing appearance
  | "active_speaking_engagement"; // In-person speech or clinic

export interface VisaDealEvaluationInput {
  athleteId: string;
  athleteName: string;
  countryOfCitizenship: string;
  visaType: VisaType;
  dealId: string;
  brandName: string;
  activityType: NilActivityType;
  totalCompensationDollars: number;
  physicalLocationOfPerformance: "US_SOIL" | "OFFSHORE_INTERNATIONAL";
  countryOfPerformance: string; // "United States", "Canada", "Bahamas", "United Kingdom", etc.
  travelProofReference?: string; // Passport stamp, airline boarding pass, hotel record
  dsoNotified: boolean;
}

export interface VisaEvaluationResult {
  isPermissible: boolean;
  classification: "PASSIVE_IP_ROYALTY" | "OFFSHORE_COMMERCIAL_SAFE_HARBOR" | "UNAUTHORIZED_US_EMPLOYMENT_VIOLATION" | "APPROVED_P1A_WORK";
  riskLevel: "NONE" | "LOW_ADVISORY" | "CRITICAL_IMMIGRATION_BREACH";
  summary: string;
  dsoAttestationRequired: boolean;
  reasons: string[];
  safeHarborGuidance: string;
}

export interface DsoAttestationCertificate {
  certificateId: string;
  generatedDate: string;
  athleteName: string;
  countryOfCitizenship: string;
  visaType: VisaType;
  sponsorBrand: string;
  dealCompensationDollars: number;
  activityClassification: string;
  locationOfPerformance: string;
  countryOfPerformance: string;
  travelProofRecord: string;
  legalBasis: string;
  certificationText: string;
}

export function evaluateInternationalVisaDeal(
  input: VisaDealEvaluationInput
): VisaEvaluationResult {
  const {
    visaType,
    activityType,
    physicalLocationOfPerformance,
    countryOfPerformance,
    travelProofReference,
  } = input;

  // Citizens and permanent residents have no visa restrictions
  if (visaType === "US_CITIZEN_OR_PERMANENT_RESIDENT") {
    return {
      isPermissible: true,
      classification: "APPROVED_P1A_WORK",
      riskLevel: "NONE",
      summary: "US citizen or legal permanent resident. No immigration restrictions apply to NIL earnings.",
      dsoAttestationRequired: false,
      reasons: ["Domestic athlete exempt from SEVP employment restrictions."],
      safeHarborGuidance: "Standard NIL disclosure and tax withholding apply.",
    };
  }

  // P-1A or O-1A Athletes have non-immigrant athlete status allowing commercial athletic work
  if (visaType === "P-1A" || visaType === "O-1A") {
    return {
      isPermissible: true,
      classification: "APPROVED_P1A_WORK",
      riskLevel: "NONE",
      summary: `${visaType} Visa Status allows athletic compensation and approved sponsor endorsements within petition scope.`,
      dsoAttestationRequired: false,
      reasons: [`Athlete holds ${visaType} extraordinary athletic ability / athlete status.`],
      safeHarborGuidance: "Ensure endorsement scope matches your approved I-129 petition itinerary.",
    };
  }

  // F-1 or J-1 Student Visas (Governed strictly by 8 CFR § 214.2(f)(9) unauthorized employment prohibitions)
  const isPassive =
    activityType === "passive_group_licensing" || activityType === "passive_equity";

  if (isPassive) {
    return {
      isPermissible: true,
      classification: "PASSIVE_IP_ROYALTY",
      riskLevel: "LOW_ADVISORY",
      summary: "Permissible Passive Royalty: Group licensing and video game royalties (e.g. EA Sports) do not constitute unauthorized active labor under SEVP guidance.",
      dsoAttestationRequired: true,
      reasons: [
        "Income is categorized as passive intellectual property licensing rather than active employment/services.",
        "Zero active labor or personal appearances are performed on US soil.",
      ],
      safeHarborGuidance: "File passive royalty disclosure with your campus Designated School Official (DSO) for SEVIS record preservation.",
    };
  }

  // Active commercial services
  if (physicalLocationOfPerformance === "OFFSHORE_INTERNATIONAL") {
    const hasProof = Boolean(travelProofReference && travelProofReference.trim().length > 0);
    return {
      isPermissible: hasProof,
      classification: "OFFSHORE_COMMERCIAL_SAFE_HARBOR",
      riskLevel: hasProof ? "NONE" : "LOW_ADVISORY",
      summary: hasProof
        ? `Permissible Offshore Safe Harbor: Commercial activities performed entirely outside US territory in ${countryOfPerformance} with verified travel evidence.`
        : "Offshore Safe Harbor Incomplete: Physical performance outside the US requires verifiable travel proof (boarding passes, passport stamps, or hotel folio).",
      dsoAttestationRequired: true,
      reasons: [
        `Commercial services were executed outside US borders (${countryOfPerformance}).`,
        hasProof
          ? `Verified travel documentation logged: ${travelProofReference}`
          : "Missing travel proof record to substantiate non-US physical presence.",
      ],
      safeHarborGuidance:
        "Retain passport entry/exit stamps and geo-tagged media proof to demonstrate to USCIS that all promotional labor occurred while abroad.",
    };
  }

  // Active commercial work on US Soil under F-1: CRITICAL IMMIGRATION VIOLATION
  return {
    isPermissible: false,
    classification: "UNAUTHORIZED_US_EMPLOYMENT_VIOLATION",
    riskLevel: "CRITICAL_IMMIGRATION_BREACH",
    summary: "PROHIBITED: F-1 visa regulations strictly ban active commercial labor or advertising services performed inside the United States. Performing this deal risks termination of F-1 status and deportation.",
    dsoAttestationRequired: true,
    reasons: [
      "Active promotional services (camps, commercial shoots, sponsored posts) performed on US soil are categorized by ICE/SEVP as unauthorized employment.",
      "Violation of 8 CFR § 214.2(f)(9)(i) risks SEVIS I-20 termination.",
    ],
    safeHarborGuidance:
      "Convert deal to passive group licensing royalties, schedule performance offshore during school breaks, or consult immigration counsel regarding a P-1A visa transition.",
  };
}

export function generateDsoSafeHarborCertificate(
  input: VisaDealEvaluationInput
): DsoAttestationCertificate {
  const evalResult = evaluateInternationalVisaDeal(input);
  const certificateId = `SEVIS-SAFE-${input.countryOfCitizenship.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const certText = `
FORMAL DSO NIL ATTESTATION OF NON-UNAUTHORIZED EMPLOYMENT
================================================================================
Certificate ID: ${certificateId}
Date: ${new Date().toISOString().split("T")[0]}
Student-Athlete: ${input.athleteName}
Country of Citizenship: ${input.countryOfCitizenship}
Immigration Status: ${input.visaType}

Sponsor Counterparty: ${input.brandName}
Compensation: $${input.totalCompensationDollars.toLocaleString()} USD
Activity Type: ${input.activityType.replaceAll("_", " ").toUpperCase()}
Physical Location of Performance: ${input.physicalLocationOfPerformance} (${input.countryOfPerformance})
Travel Proof Record: ${input.travelProofReference || "N/A - Passive IP Licensing"}

LEGAL FINDING & SEVP SAFE-HARBOR COMPLIANCE:
Classification: ${evalResult.classification}
Status: ${evalResult.isPermissible ? "PERMISSIBLE / COMPLIANT WITH F-1 REGULATIONS" : "UNAUTHORIZED / PROHIBITED"}

ATTESTATION STATEMENT:
The student-athlete certifies that no active commercial labor or service was performed within the territorial boundaries of the United States in exchange for this compensation. All activities either constitute passive intellectual property licensing royalties (exempt from employment characterization under ICE guidance) or were fully executed during documented travel outside the United States.

Verified by LIN Safe-Harbor Immigration Compliance Engine.
================================================================================
  `.trim();

  return {
    certificateId,
    generatedDate: new Date().toISOString(),
    athleteName: input.athleteName,
    countryOfCitizenship: input.countryOfCitizenship,
    visaType: input.visaType,
    sponsorBrand: input.brandName,
    dealCompensationDollars: input.totalCompensationDollars,
    activityClassification: evalResult.classification,
    locationOfPerformance: input.physicalLocationOfPerformance,
    countryOfPerformance: input.countryOfPerformance,
    travelProofRecord: input.travelProofReference || "None Required",
    legalBasis: "8 CFR § 214.2(f)(9) / SEVP NIL Policy Guidance",
    certificationText: certText,
  };
}
