/**
 * Pure domain logic for Guardian Safety & Family Protection Center
 * Supports minor student-athlete oversight, age-18 emancipation transitions,
 * commercial exposure limits, and privacy guardrails.
 */

export interface EmancipationCountdown {
  birthDate: string;
  currentAge: number;
  isMinor: boolean;
  daysUntil18: number;
  monthsUntil18: number;
  emancipationDateFormatted: string;
  transitionStage: "UNDER_16_RESTRICTED" | "PREP_PROSPECT_16_17" | "TRANSITIONING_SOON" | "EMANCIPATED_ADULT";
  legalStatusDescription: string;
  actionItems: string[];
}

export function calculateEmancipationCountdown(birthDateStr: string, referenceDateStr?: string): EmancipationCountdown {
  const birth = new Date(birthDateStr);
  const now = referenceDateStr ? new Date(referenceDateStr) : new Date();

  // Calculate 18th birthday
  const eighteenthBirthday = new Date(birth);
  eighteenthBirthday.setFullYear(birth.getFullYear() + 18);

  const diffMs = eighteenthBirthday.getTime() - now.getTime();
  const daysUntil18 = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const monthsUntil18 = Math.max(0, Math.ceil(daysUntil18 / 30.4375));

  // Age calculation
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  const isMinor = daysUntil18 > 0;

  let transitionStage: EmancipationCountdown["transitionStage"] = "EMANCIPATED_ADULT";
  let legalStatusDescription = "Legal adult. Full individual signing authority and personal financial control.";
  let actionItems: string[] = [
    "Verify individual direct-deposit bank account",
    "Review independent tax filing / Form 1099-NEC profile",
    "Optionally grant parents view-only academic / training access",
  ];

  if (isMinor) {
    if (daysUntil18 <= 90) {
      transitionStage = "TRANSITIONING_SOON";
      legalStatusDescription = "Imminent age-18 transition within 90 days. Dual authority transition recommended.";
      actionItems = [
        "Schedule bank account ownership transition (UGMA/UTMA custodial to individual)",
        "Review ongoing multi-year NIL commitments crossing 18th birthday",
        "Prepare independent signature credential for athlete",
      ];
    } else if (age >= 16) {
      transitionStage = "PREP_PROSPECT_16_17";
      legalStatusDescription = "Scholastic minor. Guardian co-signature legally required on all contracts.";
      actionItems = [
        "Guardian verification active on all commercial offers",
        "High school athletic association (NFHS) amateurism compliance active",
        "Custodial escrow account linked for payments",
      ];
    } else {
      transitionStage = "UNDER_16_RESTRICTED";
      legalStatusDescription = "Youth athlete under 16. Enhanced privacy protection and parental control strictly enforced.";
      actionItems = [
        "Direct contact shield active — brands must message guardian",
        "No public disclosure of academic or medical records",
        "All commercial activities held in guardian trust",
      ];
    }
  }

  const emancipationDateFormatted = eighteenthBirthday.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return {
    birthDate: birthDateStr,
    currentAge: age,
    isMinor,
    daysUntil18,
    monthsUntil18,
    emancipationDateFormatted,
    transitionStage,
    legalStatusDescription,
    actionItems,
  };
}

export interface FamilySafetyAuditInput {
  isMinor: boolean;
  guardiansLinkedCount: number;
  isDiscoverable: boolean;
  openDealsCount: number;
  pendingGuardianReviewCount: number;
  totalDealExposureCents: number;
  hasUnverifiedAgents: boolean;
  hasStateBanConflict?: boolean;
}

export interface FamilySafetyAuditResult {
  safetyScore: number; // 0 to 100
  tier: "OPTIMAL_PROTECTION" | "NEEDS_ATTENTION" | "AT_RISK";
  alerts: Array<{
    severity: "red" | "yellow" | "green";
    title: string;
    description: string;
  }>;
}

export function evaluateFamilySafetyScore(input: FamilySafetyAuditInput): FamilySafetyAuditResult {
  let score = 100;
  const alerts: FamilySafetyAuditResult["alerts"] = [];

  if (input.isMinor) {
    if (input.guardiansLinkedCount === 0) {
      score -= 50;
      alerts.push({
        severity: "red",
        title: "No Guardian Linked",
        description: "Minor athletes cannot execute legal contracts or receive payments without a linked guardian.",
      });
    }

    if (input.pendingGuardianReviewCount > 0) {
      score -= 10;
      alerts.push({
        severity: "yellow",
        title: `${input.pendingGuardianReviewCount} Deal${input.pendingGuardianReviewCount > 1 ? "s" : ""} Pending Parental Review`,
        description: "Commercial offers are held in escrow pending your explicit digital signature.",
      });
    }

    if (input.hasStateBanConflict) {
      score -= 30;
      alerts.push({
        severity: "red",
        title: "State Association Amateurism Violation Detected",
        description: "State high school athletic association rules prohibit NIL commercialization in this jurisdiction.",
      });
    }

    if (input.hasUnverifiedAgents) {
      score -= 20;
      alerts.push({
        severity: "yellow",
        title: "Unverified Agent Representation",
        description: "An affiliated representative has not declared SPARTA registration or state licensing.",
      });
    }

    if (input.isDiscoverable && input.guardiansLinkedCount > 0) {
      alerts.push({
        severity: "green",
        title: "Public Listing Shield Active",
        description: "Discoverability is active with personal contact information shielded from public view.",
      });
    }
  } else {
    alerts.push({
      severity: "green",
      title: "Adult Autonomy Active",
      description: "Athlete has full legal capacity. Parents retain view-only sharing if consented.",
    });
  }

  score = Math.max(0, Math.min(100, score));

  let tier: FamilySafetyAuditResult["tier"] = "OPTIMAL_PROTECTION";
  if (score < 60) {
    tier = "AT_RISK";
  } else if (score < 85) {
    tier = "NEEDS_ATTENTION";
  }

  return {
    safetyScore: score,
    tier,
    alerts,
  };
}
