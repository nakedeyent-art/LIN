export interface UniversitySponsorConflict {
  category: "apparel" | "beverage" | "nutrition" | "telecom" | "gaming" | "banking" | "other";
  schoolPartner: string;
  conflictingBrands: string[];
}

export interface UniversityProfile {
  schoolId: string;
  schoolName: string;
  conference: string;
  primaryApparelPartner: "Nike" | "Adidas" | "Under Armour" | "Jordan" | "Other";
  officialSponsors: UniversitySponsorConflict[];
  advanceDisclosureNoticeDays: number;
  prohibitSchoolMarksWithoutLicense: boolean;
  complianceEmail: string;
}

export const NCAA_FBS_PROFILES: UniversityProfile[] = [
  {
    schoolId: "miami",
    schoolName: "University of Miami (Hurricanes)",
    conference: "ACC",
    primaryApparelPartner: "Adidas",
    officialSponsors: [
      { category: "apparel", schoolPartner: "Adidas", conflictingBrands: ["Nike", "Under Armour", "Puma", "New Balance", "Jordan", "Lululemon"] },
      { category: "beverage", schoolPartner: "Gatorade", conflictingBrands: ["Powerade", "BodyArmor", "Prime Hydration"] },
      { category: "nutrition", schoolPartner: "Muscle Milk", conflictingBrands: ["Optimum Nutrition", "Ghost", "Fairlife"] },
    ],
    advanceDisclosureNoticeDays: 7,
    prohibitSchoolMarksWithoutLicense: true,
    complianceEmail: "athletics-compliance@miami.edu",
  },
  {
    schoolId: "florida",
    schoolName: "University of Florida (Gators)",
    conference: "SEC",
    primaryApparelPartner: "Jordan",
    officialSponsors: [
      { category: "apparel", schoolPartner: "Jordan / Nike", conflictingBrands: ["Adidas", "Under Armour", "Puma", "Reebok", "New Balance"] },
      { category: "beverage", schoolPartner: "Gatorade", conflictingBrands: ["Powerade", "BodyArmor", "Prime Hydration"] },
    ],
    advanceDisclosureNoticeDays: 7,
    prohibitSchoolMarksWithoutLicense: true,
    complianceEmail: "compliance@gators.ufl.edu",
  },
  {
    schoolId: "texas",
    schoolName: "University of Texas (Longhorns)",
    conference: "SEC",
    primaryApparelPartner: "Nike",
    officialSponsors: [
      { category: "apparel", schoolPartner: "Nike", conflictingBrands: ["Adidas", "Under Armour", "Puma", "New Balance"] },
      { category: "beverage", schoolPartner: "Coca-Cola / Powerade", conflictingBrands: ["Pepsi", "Gatorade", "Prime Hydration"] },
    ],
    advanceDisclosureNoticeDays: 7,
    prohibitSchoolMarksWithoutLicense: true,
    complianceEmail: "compliance@athletics.utexas.edu",
  },
  {
    schoolId: "usc",
    schoolName: "University of Southern California (Trojans)",
    conference: "Big Ten",
    primaryApparelPartner: "Nike",
    officialSponsors: [
      { category: "apparel", schoolPartner: "Nike", conflictingBrands: ["Adidas", "Under Armour", "Puma"] },
    ],
    advanceDisclosureNoticeDays: 5,
    prohibitSchoolMarksWithoutLicense: true,
    complianceEmail: "trojans-compliance@usc.edu",
  },
  {
    schoolId: "notre_dame",
    schoolName: "University of Notre Dame (Fighting Irish)",
    conference: "Independent / ACC",
    primaryApparelPartner: "Under Armour",
    officialSponsors: [
      { category: "apparel", schoolPartner: "Under Armour", conflictingBrands: ["Nike", "Adidas", "Jordan", "Puma"] },
    ],
    advanceDisclosureNoticeDays: 7,
    prohibitSchoolMarksWithoutLicense: true,
    complianceEmail: "compliance@nd.edu",
  },
];

export interface NILDealForDisclosure {
  dealId: string;
  athleteName: string;
  athleteId: string;
  athleteSport: string;
  schoolId: string;
  counterpartyBrand: string;
  category: "apparel" | "beverage" | "nutrition" | "telecom" | "gaming" | "banking" | "other";
  totalCompensationDollars: number;
  startDate: string;
  endDate: string;
  usesSchoolTrademarks: boolean;
  schoolTrademarkPermissionGranted: boolean;
  agentName?: string;
  agentFeePercentage?: number;
  privateBankRoutingNumber?: string;
  privateBankAccountNumber?: string;
  privateHomeAddress?: string;
  descriptionOfActivities: string;
}

export interface UniversityConflictReport {
  hasApparelConflict: boolean;
  hasSponsorConflict: boolean;
  hasTrademarkViolation: boolean;
  conflictingDetails: string[];
  recommendedAction: string;
}

export interface UniversityDisclosurePacket {
  packetId: string;
  generatedAt: string;
  submissionStatus: "PENDING_REVIEW" | "APPROVED" | "FLAGGED_FOR_CONFLICT";
  redactedDeal: {
    dealId: string;
    athleteName: string;
    athleteSport: string;
    schoolName: string;
    counterpartyBrand: string;
    category: string;
    totalCompensationDollars: number;
    startDate: string;
    endDate: string;
    usesSchoolTrademarks: boolean;
    schoolTrademarkPermissionGranted: boolean;
    agentName: string;
    agentFeePercentage: number;
    agentFeeDollars: number;
    descriptionOfActivities: string;
    confidentialFinancialsRedacted: boolean;
  };
  conflictReport: UniversityConflictReport;
  complianceNotice: string;
}

export function detectUniversityConflicts(
  deal: NILDealForDisclosure,
  school: UniversityProfile
): UniversityConflictReport {
  const conflictingDetails: string[] = [];
  let hasApparelConflict = false;
  let hasSponsorConflict = false;
  let hasTrademarkViolation = false;

  const brandLower = deal.counterpartyBrand.trim().toLowerCase();

  // 1. Check primary apparel conflict
  for (const sponsor of school.officialSponsors) {
    const isConflict = sponsor.conflictingBrands.some((cb) =>
      brandLower.includes(cb.toLowerCase()) || cb.toLowerCase().includes(brandLower)
    );

    if (isConflict) {
      if (sponsor.category === "apparel") {
        hasApparelConflict = true;
        conflictingDetails.push(
          `Apparel Conflict: ${school.schoolName} is exclusively partnered with ${sponsor.schoolPartner}. Deals with ${deal.counterpartyBrand} cannot require wearing competitive gear during team activities.`
        );
      } else {
        hasSponsorConflict = true;
        conflictingDetails.push(
          `${sponsor.category.toUpperCase()} Exclusive Conflict: School has an exclusive institutional contract with ${sponsor.schoolPartner}. Athlete may not endorse ${deal.counterpartyBrand} on campus or during official team activities.`
        );
      }
    }
  }

  // 2. Check school trademark / logo permissions
  if (deal.usesSchoolTrademarks && !deal.schoolTrademarkPermissionGranted) {
    hasTrademarkViolation = true;
    conflictingDetails.push(
      `Intellectual Property Violation: Deal specifies usage of ${school.schoolName} logos, jerseys, or campus marks without an approved co-licensing agreement with the athletic licensing department.`
    );
  }

  let recommendedAction = "Pass: All institutional checks clear. Ready for NCAA disclosure.";
  if (hasTrademarkViolation) {
    recommendedAction = "Action Required: Remove university trademarks or obtain formal co-licensing approval from CLC/Learfield before execution.";
  } else if (hasApparelConflict || hasSponsorConflict) {
    recommendedAction = "Advisory: Include a carve-out clause stating athlete will not wear or promote the competing brand during team activities or on campus.";
  }

  return {
    hasApparelConflict,
    hasSponsorConflict,
    hasTrademarkViolation,
    conflictingDetails,
    recommendedAction,
  };
}

export function generateUniversityDisclosurePacket(
  deal: NILDealForDisclosure,
  school: UniversityProfile
): UniversityDisclosurePacket {
  const conflictReport = detectUniversityConflicts(deal, school);

  const agentPct = deal.agentFeePercentage || 0;
  const agentFeeDollars = Math.round((deal.totalCompensationDollars * agentPct) / 100);

  const submissionStatus = conflictReport.hasTrademarkViolation
    ? "FLAGGED_FOR_CONFLICT"
    : conflictReport.hasApparelConflict || conflictReport.hasSponsorConflict
    ? "PENDING_REVIEW"
    : "APPROVED";

  const packetId = `DISC-${deal.schoolId.toUpperCase()}-${deal.dealId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const complianceNotice = `Notice under institutional policy: This disclosure has been filed in accordance with ${school.schoolName} NCAA NIL regulations (${school.advanceDisclosureNoticeDays}-day advance disclosure window). Private bank accounts and sensitive taxpayer identifiers have been automatically redacted in accordance with federal privacy law. Direct queries to ${school.complianceEmail}.`;

  return {
    packetId,
    generatedAt: new Date().toISOString(),
    submissionStatus,
    redactedDeal: {
      dealId: deal.dealId,
      athleteName: deal.athleteName,
      athleteSport: deal.athleteSport,
      schoolName: school.schoolName,
      counterpartyBrand: deal.counterpartyBrand,
      category: deal.category,
      totalCompensationDollars: deal.totalCompensationDollars,
      startDate: deal.startDate,
      endDate: deal.endDate,
      usesSchoolTrademarks: deal.usesSchoolTrademarks,
      schoolTrademarkPermissionGranted: deal.schoolTrademarkPermissionGranted,
      agentName: deal.agentName || "Self-Represented (None)",
      agentFeePercentage: agentPct,
      agentFeeDollars,
      descriptionOfActivities: deal.descriptionOfActivities,
      confidentialFinancialsRedacted: true,
    },
    conflictReport,
    complianceNotice,
  };
}
