import { NFHS_STATE_RULES } from "./nfhs-eligibility";

export interface CampaignTargetCriteria {
  campaignName: string;
  sponsorName: string;
  category: "apparel" | "beverage" | "nutrition" | "tech" | "local_business";
  targetSports: string[]; // e.g. ["Football", "Basketball", "Track"] or ["All"]
  targetStates: string[]; // e.g. ["FL", "CA", "GA", "TX"]
  minFollowers: number;
  minEngagementRatePercent: number;
  perAthleteBudgetDollars: number;
  maxAthleteSlots: number;
  deliverablesDescription: string;
  requiresHighSchoolEligibleOnly?: boolean;
}

export interface CandidateAthleteProfile {
  athleteId: string;
  athleteName: string;
  sport: string;
  stateCode: string;
  isHighSchoolMinor: boolean;
  followers: number;
  engagementRatePercent: number;
  fairMarketValueDollars: number;
  hasVerifiedGuardian: boolean;
}

export interface CandidateMatchResult {
  athlete: CandidateAthleteProfile;
  isEligible: boolean;
  matchScore: number; // 0 to 100
  disqualificationReasons: string[];
}

export interface BatchDispatchSummary {
  campaignName: string;
  sponsorName: string;
  totalCandidatesEvaluated: number;
  eligibleCandidatesCount: number;
  selectedDispatchCount: number;
  perAthleteAmountDollars: number;
  grossAthletePoolDollars: number;
  platformFeeDollars: number; // 5% platform escrow & compliance fee
  totalEscrowDepositRequiredDollars: number;
  dispatchedDealOffers: Array<{
    offerId: string;
    athleteId: string;
    athleteName: string;
    sport: string;
    stateCode: string;
    offerAmountDollars: number;
    deliverables: string;
    status: "DISPATCHED_PENDING_ACCEPTANCE";
    expiresInDays: number;
  }>;
}

export const SAMPLE_CANDIDATE_ROSTER: CandidateAthleteProfile[] = [
  {
    athleteId: "ath-1",
    athleteName: "Devon Brooks",
    sport: "Football",
    stateCode: "FL",
    isHighSchoolMinor: false,
    followers: 48000,
    engagementRatePercent: 4.8,
    fairMarketValueDollars: 1200,
    hasVerifiedGuardian: true,
  },
  {
    athleteId: "ath-2",
    athleteName: "Marcus Hill",
    sport: "Basketball",
    stateCode: "CA",
    isHighSchoolMinor: true,
    followers: 28000,
    engagementRatePercent: 5.2,
    fairMarketValueDollars: 850,
    hasVerifiedGuardian: true,
  },
  {
    athleteId: "ath-3",
    athleteName: "Chloe Reynolds",
    sport: "Volleyball",
    stateCode: "TX", // Note: Texas UIL bans high school NIL
    isHighSchoolMinor: true,
    followers: 19000,
    engagementRatePercent: 6.1,
    fairMarketValueDollars: 650,
    hasVerifiedGuardian: true,
  },
  {
    athleteId: "ath-4",
    athleteName: "Tyler Scott",
    sport: "Baseball",
    stateCode: "GA",
    isHighSchoolMinor: true,
    followers: 12000,
    engagementRatePercent: 3.9,
    fairMarketValueDollars: 450,
    hasVerifiedGuardian: false,
  },
  {
    athleteId: "ath-5",
    athleteName: "Elena Rostova",
    sport: "Track & Field",
    stateCode: "FL",
    isHighSchoolMinor: false,
    followers: 65000,
    engagementRatePercent: 5.7,
    fairMarketValueDollars: 1600,
    hasVerifiedGuardian: true,
  },
  {
    athleteId: "ath-6",
    athleteName: "Zion Vance",
    sport: "Basketball",
    stateCode: "NY",
    isHighSchoolMinor: false,
    followers: 34000,
    engagementRatePercent: 4.2,
    fairMarketValueDollars: 950,
    hasVerifiedGuardian: true,
  },
];

export function matchAthletesToCampaign(
  criteria: CampaignTargetCriteria,
  candidates: CandidateAthleteProfile[] = SAMPLE_CANDIDATE_ROSTER
): CandidateMatchResult[] {
  return candidates.map((athlete) => {
    const disqualificationReasons: string[] = [];
    let score = 100;

    // 1. Sport check
    if (!criteria.targetSports.includes("All") && !criteria.targetSports.includes(athlete.sport)) {
      disqualificationReasons.push(`Sport '${athlete.sport}' does not match campaign sports (${criteria.targetSports.join(", ")}).`);
    }

    // 2. State check
    if (criteria.targetStates.length > 0 && !criteria.targetStates.includes("ALL") && !criteria.targetStates.includes(athlete.stateCode)) {
      disqualificationReasons.push(`State '${athlete.stateCode}' not included in target states.`);
    }

    // 3. High school amateurism law check
    if (athlete.isHighSchoolMinor) {
      const stateRule = NFHS_STATE_RULES[athlete.stateCode];
      if (stateRule && stateRule.status === "prohibited") {
        disqualificationReasons.push(
          `High school NIL prohibited in ${athlete.stateCode} under ${stateRule.association} amateurism bylaws.`
        );
      }
      if (stateRule && stateRule.guardianSignatureRequiredForMinors && !athlete.hasVerifiedGuardian) {
        disqualificationReasons.push(`Guardian consent required under ${stateRule.association} but not verified.`);
      }
    }

    // 4. Followers check
    if (athlete.followers < criteria.minFollowers) {
      disqualificationReasons.push(`Followers (${athlete.followers.toLocaleString()}) below minimum threshold (${criteria.minFollowers.toLocaleString()}).`);
      score -= 30;
    }

    // 5. Engagement rate check
    if (athlete.engagementRatePercent < criteria.minEngagementRatePercent) {
      disqualificationReasons.push(`Engagement rate (${athlete.engagementRatePercent}%) below target (${criteria.minEngagementRatePercent}%).`);
      score -= 25;
    }

    const isEligible = disqualificationReasons.length === 0;
    if (!isEligible) {
      score = Math.max(0, score - 50);
    }

    return {
      athlete,
      isEligible,
      matchScore: isEligible ? score : Math.min(score, 30),
      disqualificationReasons,
    };
  });
}

export function dispatchBatchCampaignOffers(
  criteria: CampaignTargetCriteria,
  candidates: CandidateAthleteProfile[] = SAMPLE_CANDIDATE_ROSTER
): BatchDispatchSummary {
  const matches = matchAthletesToCampaign(criteria, candidates);
  const eligibleMatches = matches
    .filter((m) => m.isEligible)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, criteria.maxAthleteSlots);

  const selectedDispatchCount = eligibleMatches.length;
  const grossAthletePoolDollars = selectedDispatchCount * criteria.perAthleteBudgetDollars;
  const platformFeeDollars = Math.round(grossAthletePoolDollars * 0.05); // 5%
  const totalEscrowDepositRequiredDollars = grossAthletePoolDollars + platformFeeDollars;

  const dispatchedDealOffers = eligibleMatches.map((m, idx) => ({
    offerId: `OFFER-${Date.now().toString(36).toUpperCase()}-${idx + 1}`,
    athleteId: m.athlete.athleteId,
    athleteName: m.athlete.athleteName,
    sport: m.athlete.sport,
    stateCode: m.athlete.stateCode,
    offerAmountDollars: criteria.perAthleteBudgetDollars,
    deliverables: criteria.deliverablesDescription,
    status: "DISPATCHED_PENDING_ACCEPTANCE" as const,
    expiresInDays: 7,
  }));

  return {
    campaignName: criteria.campaignName,
    sponsorName: criteria.sponsorName,
    totalCandidatesEvaluated: candidates.length,
    eligibleCandidatesCount: matches.filter((m) => m.isEligible).length,
    selectedDispatchCount,
    perAthleteAmountDollars: criteria.perAthleteBudgetDollars,
    grossAthletePoolDollars,
    platformFeeDollars,
    totalEscrowDepositRequiredDollars,
    dispatchedDealOffers,
  };
}
