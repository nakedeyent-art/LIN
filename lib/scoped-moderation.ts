import type { ReportOutcome, ReportReason } from "./reports";

export type ModeratorScope =
  | "trust_safety_reviewer"
  | "minor_protection_specialist"
  | "full_admin";

export type SlaTier = "P0_CRITICAL_15M" | "P1_HIGH_2H" | "P2_STANDARD_6H" | "P3_ROUTINE_24H";

export type AppealStatus = "none" | "appeal_submitted" | "upheld_by_second_reviewer" | "overturned_restored";

export interface ScopedModerationCase {
  id: string;
  channel: "deal_message" | "social_post" | "comment";
  reason: ReportReason;
  involvesMinorAthlete: boolean;
  rawSnippet: string;
  senderDisplay: string;
  reporterDisplay: string;
  createdAt: string;
  assignedScope: ModeratorScope;
  initialModeratorId?: string;
  initialOutcome?: ReportOutcome;
  appealStatus: AppealStatus;
  appealReason?: string;
  appealReviewerId?: string;
}

export interface RedactedCaseView {
  caseId: string;
  slaTier: SlaTier;
  redactedSnippet: string;
  piiTokensRedacted: number;
  canExecuteSuspension: boolean;
  canAccessFinancialOrTaxRecords: boolean;
  requiresMinorSpecialistEscalation: boolean;
}

export function redactMinimumContextSnippet(rawText: string): {
  redactedText: string;
  redactedCount: number;
} {
  let count = 0;
  let text = rawText;

  // Redact email addresses
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, () => {
    count++;
    return "[REDACTED_EMAIL]";
  });

  // Redact phone numbers
  text = text.replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, () => {
    count++;
    return "[REDACTED_PHONE]";
  });

  // Redact SSN / routing / account numbers (9+ digits)
  text = text.replace(/\b\d{3}-\d{2}-\d{4}\b|\b\d{9,12}\b/g, () => {
    count++;
    return "[REDACTED_FINANCIAL_ID]";
  });

  return { redactedText: text, redactedCount: count };
}

export function classifyModerationSla(
  reason: ReportReason,
  involvesMinorAthlete: boolean
): SlaTier {
  if (reason === "safety_minor" || (involvesMinorAthlete && reason === "off_platform_contact")) {
    return "P0_CRITICAL_15M";
  }
  if (reason === "off_platform_contact" || reason === "inappropriate") {
    return "P1_HIGH_2H";
  }
  if (reason === "harassment") {
    return "P2_STANDARD_6H";
  }
  return "P3_ROUTINE_24H";
}

export function buildMinimumContextCaseView(
  item: ScopedModerationCase,
  viewerScope: ModeratorScope
): RedactedCaseView {
  const { redactedText, redactedCount } = redactMinimumContextSnippet(item.rawSnippet);
  const slaTier = classifyModerationSla(item.reason, item.involvesMinorAthlete);

  const canExecuteSuspension =
    viewerScope === "full_admin" ||
    (viewerScope === "minor_protection_specialist" && item.involvesMinorAthlete);

  const requiresMinorSpecialistEscalation =
    item.involvesMinorAthlete &&
    (item.reason === "safety_minor" || item.reason === "off_platform_contact") &&
    viewerScope === "trust_safety_reviewer";

  return {
    caseId: item.id,
    slaTier,
    redactedSnippet: redactedText,
    piiTokensRedacted: redactedCount,
    canExecuteSuspension,
    canAccessFinancialOrTaxRecords: false, // Never exposed in content moderation views
    requiresMinorSpecialistEscalation,
  };
}

export function validateAppealAdjudication(input: {
  caseItem: ScopedModerationCase;
  reviewerModeratorId: string;
  reviewerScope: ModeratorScope;
  decision: "upheld_by_second_reviewer" | "overturned_restored";
  rationale: string;
}): { allowed: boolean; error?: string } {
  if (input.caseItem.appealStatus !== "appeal_submitted") {
    return { allowed: false, error: "Case does not have an open appeal awaiting adjudication." };
  }
  if (
    input.caseItem.initialModeratorId &&
    input.caseItem.initialModeratorId === input.reviewerModeratorId
  ) {
    return {
      allowed: false,
      error:
        "Dual-control violation: An appeal must be adjudicated by an independent moderator who did not issue the original ruling.",
    };
  }
  if (input.reviewerScope === "trust_safety_reviewer" && input.caseItem.involvesMinorAthlete) {
    return {
      allowed: false,
      error: "Minor-safety appeals require a Minor Protection Specialist or Full Admin.",
    };
  }
  if (!input.rationale || input.rationale.trim().length < 15) {
    return {
      allowed: false,
      error: "Appeal adjudication requires an audited written rationale (minimum 15 characters).",
    };
  }
  return { allowed: true };
}

export const SAMPLE_SCOPED_CASES: ScopedModerationCase[] = [
  {
    id: "case-901",
    channel: "deal_message",
    reason: "off_platform_contact",
    involvesMinorAthlete: true,
    rawSnippet:
      "Skip the parental escrow check and text me directly at 305-555-0194 or email boostercash@example.com for a cash drop.",
    senderDisplay: "Unverified Collective Rep",
    reporterDisplay: "Marcus V. (Minor Athlete · 17yo)",
    createdAt: "2026-11-01 18:40 UTC",
    assignedScope: "minor_protection_specialist",
    initialModeratorId: "mod-alpha",
    appealStatus: "none",
  },
  {
    id: "case-902",
    channel: "social_post",
    reason: "spam",
    involvesMinorAthlete: false,
    rawSnippet:
      "Guaranteed 10x crypto return for college athletes! Wire routing 021000021 today.",
    senderDisplay: "PromoBot Account",
    reporterDisplay: "Devon Brooks",
    createdAt: "2026-11-01 17:15 UTC",
    assignedScope: "trust_safety_reviewer",
    initialModeratorId: "mod-alpha",
    initialOutcome: "warn",
    appealStatus: "appeal_submitted",
    appealReason:
      "Post was a financial literacy seminar announcement that triggered the automated keyword filter.",
  },
];

