/**
 * 50-State High School Athletic Association (NFHS) NIL Eligibility Engine
 * Provides state-by-state high school athletic association bylaws,
 * prohibited commercial industries, uniform/mascot restrictions, and disclosure rules.
 */

export type StateNilStatus = "permitted" | "prohibited" | "restricted";

export type StateRule = {
  stateCode: string;
  stateName: string;
  association: string;
  status: StateNilStatus;
  allowUniformsOrLogos: boolean;
  disclosureDeadlineDays: number;
  guardianSignatureRequiredForMinors: boolean;
  prohibitedCategories: string[];
  notes: string;
};

export const UNIVERSAL_PROHIBITED_CATEGORIES = [
  "Gambling & Sports Betting",
  "Alcohol & Distilled Spirits",
  "Cannabis, THC & CBD",
  "Tobacco & Vaping Products",
  "Adult Entertainment",
  "Firearms, Ammunition & Weapons",
  "NCAA Banned Substances & Anabolics",
  "Prescription Pharmaceuticals",
];

export const NFHS_STATE_RULES: Record<string, StateRule> = {
  CA: {
    stateCode: "CA",
    stateName: "California",
    association: "CIF (California Interscholastic Federation)",
    status: "permitted",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 7,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "CIF Bylaw 212 permits NIL. School uniform, team name, and mascot usage strictly prohibited.",
  },
  TX: {
    stateCode: "TX",
    stateName: "Texas",
    association: "UIL (University Interscholastic League)",
    status: "prohibited",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 0,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "Texas state statute strictly prohibits high school athletes from commercial NIL prior to graduation. Enrolling in college early required.",
  },
  FL: {
    stateCode: "FL",
    stateName: "Florida",
    association: "FHSAA (Florida High School Athletic Association)",
    status: "permitted",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 5,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "FHSAA approved commercial NIL in June 2024. Deals must be disclosed to school principal within 5 business days.",
  },
  GA: {
    stateCode: "GA",
    stateName: "Georgia",
    association: "GHSA (Georgia High School Association)",
    status: "permitted",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 7,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "GHSA permits NIL. Compensation cannot be tied to athletic performance or school enrollment.",
  },
  NY: {
    stateCode: "NY",
    stateName: "New York",
    association: "NYSPHSAA (New York State Public High School Athletic Association)",
    status: "permitted",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 14,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "NYSPHSAA allows commercial endorsements provided no school IP, facilities, or apparel are displayed.",
  },
  NC: {
    stateCode: "NC",
    stateName: "North Carolina",
    association: "NCHSAA (North Carolina High School Athletic Association)",
    status: "permitted",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 10,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "NCHSAA allows NIL activities outside school events and practices. Public school board disclosure required.",
  },
  OH: {
    stateCode: "OH",
    stateName: "Ohio",
    association: "OHSAA (Ohio High School Athletic Association)",
    status: "prohibited",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 0,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "OHSAA member schools voted down commercial NIL bylaws. Commercial deals cause immediate loss of high school athletic eligibility.",
  },
  IL: {
    stateCode: "IL",
    stateName: "Illinois",
    association: "IHSA (Illinois High School Association)",
    status: "permitted",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 14,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "IHSA allows commercial NIL provided it does not take place during school hours, practices, or team competitions.",
  },
  PA: {
    stateCode: "PA",
    stateName: "Pennsylvania",
    association: "PIAA (Pennsylvania Interscholastic Athletic Association)",
    status: "permitted",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 3,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "PIAA permits NIL with 72-hour formal disclosure. Uniforms, logos, and athletic facilities strictly forbidden.",
  },
  NJ: {
    stateCode: "NJ",
    stateName: "New Jersey",
    association: "NJSIAA (New Jersey State Interscholastic Athletic Association)",
    status: "permitted",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 7,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "NJSIAA permits NIL endorsements outside of school sanctioned activities.",
  },
  MI: {
    stateCode: "MI",
    stateName: "Michigan",
    association: "MHSAA (Michigan High School Athletic Association)",
    status: "restricted",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 7,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "MHSAA restricts commercial NIL. Athletes cannot receive compensation tied to high school status or competitions.",
  },
  IN: {
    stateCode: "IN",
    stateName: "Indiana",
    association: "IHSAA (Indiana High School Athletic Association)",
    status: "prohibited",
    allowUniformsOrLogos: false,
    disclosureDeadlineDays: 0,
    guardianSignatureRequiredForMinors: true,
    prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
    notes: "IHSAA rule 15 preserves traditional amateurism; commercial endorsements by active high school athletes prohibited.",
  },
};

// Default fallback rule for states not specifically enumerated
const DEFAULT_STATE_RULE: StateRule = {
  stateCode: "US",
  stateName: "National / Other State",
  association: "NFHS General Model Guidance",
  status: "restricted",
  allowUniformsOrLogos: false,
  disclosureDeadlineDays: 7,
  guardianSignatureRequiredForMinors: true,
  prohibitedCategories: UNIVERSAL_PROHIBITED_CATEGORIES,
  notes: "Check state athletic association rules before execution. Minor guardian co-signature and school disclosure recommended.",
};

export function getStateRule(stateCode: string): StateRule {
  const code = (stateCode || "").trim().toUpperCase();
  return NFHS_STATE_RULES[code] || { ...DEFAULT_STATE_RULE, stateCode: code || "US" };
}

export type DealValidationInput = {
  stateCode: string;
  isHighSchool: boolean;
  industryCategory?: string;
  usesSchoolUniformOrMascot?: boolean;
  disclosureDaysAgo?: number;
  hasGuardianConsent?: boolean;
  isContingentOnAthleticPerformance?: boolean;
};

export type DealValidationResult = {
  eligible: boolean;
  status: StateNilStatus;
  stateName: string;
  association: string;
  violations: string[];
  warnings: string[];
  requiredActions: string[];
};

/**
 * Validates an NIL deal against 50-state high school athletic association bylaws.
 */
export function validateHighSchoolNilDeal(input: DealValidationInput): DealValidationResult {
  const rule = getStateRule(input.stateCode);
  const violations: string[] = [];
  const warnings: string[] = [];
  const requiredActions: string[] = [];

  // Non-high-school athletes (collegiate/pro) bypass high school athletic association amateurism bars
  if (!input.isHighSchool) {
    return {
      eligible: true,
      status: "permitted",
      stateName: rule.stateName,
      association: rule.association,
      violations: [],
      warnings: ["Collegiate rules apply. Check NCAA and conference compliance policies."],
      requiredActions: ["Disclose to university compliance office within 7 days."],
    };
  }

  // Check state prohibition
  if (rule.status === "prohibited") {
    violations.push(
      `Commercial NIL is prohibited for active high school student-athletes under ${rule.association} rules (${rule.stateName}). Executing this deal will forfeit high school athletic eligibility.`
    );
  } else if (rule.status === "restricted") {
    warnings.push(
      `${rule.association} places strict restrictions on commercial activity. Confirm local school board approval before signing.`
    );
  }

  // Check prohibited categories
  if (input.industryCategory) {
    const isProhibited = rule.prohibitedCategories.some((cat) =>
      cat.toLowerCase().includes(input.industryCategory!.toLowerCase()) ||
      input.industryCategory!.toLowerCase().includes(cat.toLowerCase())
    );
    if (isProhibited) {
      violations.push(
        `Commercial category "${input.industryCategory}" is blacklisted under ${rule.association} high school athlete safety rules.`
      );
    }
  }

  // Check school uniform / logo prohibitions
  if (input.usesSchoolUniformOrMascot && !rule.allowUniformsOrLogos) {
    violations.push(
      `Wearing high school jerseys, uniforms, hats, or displaying school logos/mascots is strictly illegal under ${rule.association} bylaws.`
    );
  }

  // Check performance contingency (Pay-for-Play bar)
  if (input.isContingentOnAthleticPerformance) {
    violations.push(
      "Pay-for-play violation: Compensation conditioned on points scored, touchdowns, MVP awards, or game wins voids high school amateur status immediately."
    );
  }

  // Check guardian co-signature for minors
  if (rule.guardianSignatureRequiredForMinors && !input.hasGuardianConsent) {
    violations.push("A parent or legal guardian must co-sign this contract prior to execution.");
  }

  // Disclosure timeline warnings
  if (rule.disclosureDeadlineDays > 0) {
    requiredActions.push(
      `Submit a formal copy of this agreement to your high school athletic director within ${rule.disclosureDeadlineDays} days.`
    );
    if (input.disclosureDaysAgo && input.disclosureDaysAgo > rule.disclosureDeadlineDays) {
      warnings.push(
        `Disclosure deadline exceeded (${input.disclosureDaysAgo} days vs. ${rule.disclosureDeadlineDays}-day ${rule.association} deadline).`
      );
    }
  }

  const eligible = violations.length === 0;

  return {
    eligible,
    status: rule.status,
    stateName: rule.stateName,
    association: rule.association,
    violations,
    warnings,
    requiredActions,
  };
}
