import { calculateDeliverablesPricing } from "./nil-valuation";
import { generateVerifiableNilCredential, type VerifiableNilCredential } from "./digital-nil-pass";

export type AthleteLevel = "high_school" | "college" | "pro_amateur";

export interface AthleteDirectoryItem {
  id: string;
  fullName: string;
  sport: string;
  position?: string;
  level: AthleteLevel;
  state: string;
  gradYear?: number;
  isMinor: boolean;
  hasGuardianLinked: boolean;
  representationStatus: "Self-Represented" | "SPARTA Registered Agent";
  agentName?: string;
  schoolOrInstitution: string;
  followers: number;
  engagementRate: number; // e.g. 4.8 (%)
  fairMarketValueDollars: number;
  rateCard: {
    socialMediaPostDollars: number;
    inPersonAppearanceDollars: number;
    skillsClinicDollars: number;
    brandCommercialDollars: number;
  };
  complianceStatus: "NCAA_COMPLIANT" | "NFHS_COMPLIANT" | "PRO_ELIGIBLE";
  digitalPassVerified: boolean;
  verificationHash?: string;
}

export interface AthleteFilterCriteria {
  searchQuery?: string;
  sport?: string;
  level?: "all" | AthleteLevel;
  state?: string;
  minorStatus?: "all" | "minor_only" | "adult_only";
  minValuation?: number;
  maxValuation?: number;
  sortBy?: "name" | "valuation_desc" | "followers_desc" | "grad_year";
}

export const SAMPLE_ATHLETE_DIRECTORY: AthleteDirectoryItem[] = [
  {
    id: "ath-101",
    fullName: "Devon Brooks",
    sport: "Football",
    position: "Quarterback",
    level: "college",
    state: "FL",
    gradYear: 2027,
    isMinor: false,
    hasGuardianLinked: true,
    representationStatus: "SPARTA Registered Agent",
    agentName: "Elite Sports Agency",
    schoolOrInstitution: "University of Miami",
    followers: 48000,
    engagementRate: 5.4,
    fairMarketValueDollars: 1450,
    rateCard: {
      socialMediaPostDollars: 1200,
      inPersonAppearanceDollars: 1800,
      skillsClinicDollars: 1500,
      brandCommercialDollars: 4500,
    },
    complianceStatus: "NCAA_COMPLIANT",
    digitalPassVerified: true,
    verificationHash: "f6e8a712c9389bd5f39e8020d1c81ef407a1c8d0b2847d0e82c8b74f35e021a9",
  },
  {
    id: "ath-102",
    fullName: "Marcus Hill",
    sport: "Basketball",
    position: "Point Guard",
    level: "high_school",
    state: "CA",
    gradYear: 2026,
    isMinor: true,
    hasGuardianLinked: true,
    representationStatus: "Self-Represented",
    schoolOrInstitution: "Sierra Canyon Prep",
    followers: 32000,
    engagementRate: 6.2,
    fairMarketValueDollars: 950,
    rateCard: {
      socialMediaPostDollars: 850,
      inPersonAppearanceDollars: 1200,
      skillsClinicDollars: 1100,
      brandCommercialDollars: 3200,
    },
    complianceStatus: "NFHS_COMPLIANT",
    digitalPassVerified: true,
    verificationHash: "8b7a4216e093d5f812cb04e76a91d374fb1c0a82e4693b890a5f71e89b32c610",
  },
  {
    id: "ath-103",
    fullName: "Chloe Reynolds",
    sport: "Volleyball",
    position: "Outside Hitter",
    level: "high_school",
    state: "TX",
    gradYear: 2026,
    isMinor: true,
    hasGuardianLinked: true,
    representationStatus: "Self-Represented",
    schoolOrInstitution: "Westlake High School",
    followers: 19500,
    engagementRate: 6.8,
    fairMarketValueDollars: 650,
    rateCard: {
      socialMediaPostDollars: 600,
      inPersonAppearanceDollars: 900,
      skillsClinicDollars: 800,
      brandCommercialDollars: 2400,
    },
    complianceStatus: "NFHS_COMPLIANT",
    digitalPassVerified: true,
    verificationHash: "45f90a21b38e7c10d9a620e74b5c91f083d2a74c10e69b51829e34b12c801e74",
  },
  {
    id: "ath-104",
    fullName: "Elena Rostova",
    sport: "Track & Field",
    position: "Sprinter (100m/200m)",
    level: "college",
    state: "FL",
    gradYear: 2028,
    isMinor: false,
    hasGuardianLinked: true,
    representationStatus: "SPARTA Registered Agent",
    agentName: "Velocity Global Sports",
    schoolOrInstitution: "Florida State University",
    followers: 65000,
    engagementRate: 5.9,
    fairMarketValueDollars: 1850,
    rateCard: {
      socialMediaPostDollars: 1600,
      inPersonAppearanceDollars: 2200,
      skillsClinicDollars: 1800,
      brandCommercialDollars: 5200,
    },
    complianceStatus: "NCAA_COMPLIANT",
    digitalPassVerified: true,
    verificationHash: "9a01f782c3e41b9d08e67a54b2c1f930e84b72a19c50e41b83d97f21a603c485",
  },
  {
    id: "ath-105",
    fullName: "Zion Vance",
    sport: "Basketball",
    position: "Small Forward",
    level: "college",
    state: "NY",
    gradYear: 2027,
    isMinor: false,
    hasGuardianLinked: true,
    representationStatus: "SPARTA Registered Agent",
    agentName: "Empire Management Group",
    schoolOrInstitution: "St. John's University",
    followers: 41000,
    engagementRate: 4.7,
    fairMarketValueDollars: 1250,
    rateCard: {
      socialMediaPostDollars: 1100,
      inPersonAppearanceDollars: 1600,
      skillsClinicDollars: 1400,
      brandCommercialDollars: 4000,
    },
    complianceStatus: "NCAA_COMPLIANT",
    digitalPassVerified: true,
    verificationHash: "17cb49a203f8e561d904b7c12a89f30e64b28d71a095e34b81c62f90a45e7301",
  },
  {
    id: "ath-106",
    fullName: "Tyler Scott",
    sport: "Baseball",
    position: "Pitcher",
    level: "high_school",
    state: "GA",
    gradYear: 2027,
    isMinor: true,
    hasGuardianLinked: true,
    representationStatus: "Self-Represented",
    schoolOrInstitution: "North Gwinnett High",
    followers: 14000,
    engagementRate: 4.2,
    fairMarketValueDollars: 500,
    rateCard: {
      socialMediaPostDollars: 450,
      inPersonAppearanceDollars: 750,
      skillsClinicDollars: 700,
      brandCommercialDollars: 1900,
    },
    complianceStatus: "NFHS_COMPLIANT",
    digitalPassVerified: true,
    verificationHash: "32d80f91a4b6c70e28f19a43e75b8109d4c72a08f519b34c620e71a9b405d682",
  },
  {
    id: "ath-107",
    fullName: "Jordan Reed",
    sport: "Soccer",
    position: "Midfielder",
    level: "college",
    state: "NC",
    gradYear: 2026,
    isMinor: false,
    hasGuardianLinked: true,
    representationStatus: "Self-Represented",
    schoolOrInstitution: "UNC Chapel Hill",
    followers: 24500,
    engagementRate: 5.1,
    fairMarketValueDollars: 780,
    rateCard: {
      socialMediaPostDollars: 700,
      inPersonAppearanceDollars: 1100,
      skillsClinicDollars: 1000,
      brandCommercialDollars: 2800,
    },
    complianceStatus: "NCAA_COMPLIANT",
    digitalPassVerified: true,
    verificationHash: "e45a9018b32c7f60d19a4e72b850c319f4d80a71b269e34c901f82a7b634c091",
  },
  {
    id: "ath-108",
    fullName: "Aaliyah Washington",
    sport: "Gymnastics",
    position: "All-Around",
    level: "college",
    state: "CA",
    gradYear: 2027,
    isMinor: false,
    hasGuardianLinked: true,
    representationStatus: "SPARTA Registered Agent",
    agentName: "Ascent Talent Partners",
    schoolOrInstitution: "UCLA",
    followers: 58000,
    engagementRate: 7.4,
    fairMarketValueDollars: 2100,
    rateCard: {
      socialMediaPostDollars: 1800,
      inPersonAppearanceDollars: 2600,
      skillsClinicDollars: 2200,
      brandCommercialDollars: 6500,
    },
    complianceStatus: "NCAA_COMPLIANT",
    digitalPassVerified: true,
    verificationHash: "7b10fa29c48e561d093b7a12e84c903f62d18a09b450e71c93a82f10a56e7293",
  },
];

export function filterAthletes(
  athletes: AthleteDirectoryItem[],
  criteria: AthleteFilterCriteria
): AthleteDirectoryItem[] {
  let result = [...athletes];

  // 1. Search query
  if (criteria.searchQuery && criteria.searchQuery.trim().length > 0) {
    const q = criteria.searchQuery.trim().toLowerCase();
    result = result.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        a.sport.toLowerCase().includes(q) ||
        (a.position && a.position.toLowerCase().includes(q)) ||
        a.state.toLowerCase().includes(q) ||
        a.schoolOrInstitution.toLowerCase().includes(q) ||
        (a.agentName && a.agentName.toLowerCase().includes(q))
    );
  }

  // 2. Sport filter
  if (criteria.sport && criteria.sport !== "All" && criteria.sport !== "") {
    result = result.filter((a) => a.sport.toLowerCase() === criteria.sport!.toLowerCase());
  }

  // 3. Level filter
  if (criteria.level && criteria.level !== "all") {
    result = result.filter((a) => a.level === criteria.level);
  }

  // 4. State filter
  if (criteria.state && criteria.state !== "All" && criteria.state !== "") {
    result = result.filter((a) => a.state.toUpperCase() === criteria.state!.toUpperCase());
  }

  // 5. Minor status
  if (criteria.minorStatus === "minor_only") {
    result = result.filter((a) => a.isMinor);
  } else if (criteria.minorStatus === "adult_only") {
    result = result.filter((a) => !a.isMinor);
  }

  // 6. Valuation range
  if (criteria.minValuation != null && criteria.minValuation > 0) {
    result = result.filter((a) => a.fairMarketValueDollars >= criteria.minValuation!);
  }
  if (criteria.maxValuation != null && criteria.maxValuation > 0) {
    result = result.filter((a) => a.fairMarketValueDollars <= criteria.maxValuation!);
  }

  // 7. Sort
  if (criteria.sortBy === "valuation_desc") {
    result.sort((a, b) => b.fairMarketValueDollars - a.fairMarketValueDollars);
  } else if (criteria.sortBy === "followers_desc") {
    result.sort((a, b) => b.followers - a.followers);
  } else if (criteria.sortBy === "grad_year") {
    result.sort((a, b) => (a.gradYear ?? 9999) - (b.gradYear ?? 9999));
  } else {
    // Default by name ascending
    result.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  return result;
}

export function getAvailableSports(athletes: AthleteDirectoryItem[]): string[] {
  const sports = Array.from(new Set(athletes.map((a) => a.sport))).sort();
  return ["All", ...sports];
}

export function getAvailableStates(athletes: AthleteDirectoryItem[]): string[] {
  const states = Array.from(new Set(athletes.map((a) => a.state.toUpperCase()))).sort();
  return ["All", ...states];
}

export function getAthleteStats(athletes: AthleteDirectoryItem[]) {
  const total = athletes.length;
  const highSchoolCount = athletes.filter((a) => a.level === "high_school").length;
  const collegeCount = athletes.filter((a) => a.level === "college").length;
  const verifiedPassCount = athletes.filter((a) => a.digitalPassVerified).length;
  const minorCount = athletes.filter((a) => a.isMinor).length;

  const totalFollowers = athletes.reduce((sum, a) => sum + a.followers, 0);
  const avgFollowers = total > 0 ? Math.round(totalFollowers / total) : 0;

  const totalER = athletes.reduce((sum, a) => sum + a.engagementRate, 0);
  const avgER = total > 0 ? Number((totalER / total).toFixed(1)) : 0;

  return {
    total,
    highSchoolCount,
    collegeCount,
    verifiedPassCount,
    minorCount,
    avgFollowers,
    avgER,
  };
}

export function buildCredentialForDirectoryAthlete(athlete: AthleteDirectoryItem): VerifiableNilCredential {
  return generateVerifiableNilCredential({
    athleteId: athlete.id,
    athleteName: athlete.fullName,
    sport: athlete.sport,
    position: athlete.position,
    institutionOrSchool: athlete.schoolOrInstitution,
    stateCode: athlete.state,
    level: athlete.level === "high_school" ? "High School (NFHS)" : "Collegiate (NCAA)",
    isMinor: athlete.isMinor,
    guardianVerified: athlete.hasGuardianLinked,
    representationStatus: athlete.representationStatus,
    agentName: athlete.agentName,
    rateCard: athlete.rateCard,
  });
}
