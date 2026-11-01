import crypto from "crypto";

export type NegotiationStatus =
  | "initial_offer"
  | "countered_by_athlete"
  | "countered_by_sponsor"
  | "pending_guardian_ratification"
  | "terms_locked"
  | "rejected";

export type ExclusivityScope = "none" | "category_only" | "full_sector";

export interface DealTermVersion {
  versionNumber: number; // e.g., 1, 2, 3
  versionLabel: string; // e.g., "v1.0", "v1.1", "v2.0"
  proposedByRole: "sponsor" | "athlete" | "guardian" | "manager";
  proposedByName: string;
  createdAt: string;
  amountCents: number;
  deliverablesSummary: string;
  deliverableCount: number;
  usageRightsDays: number;
  exclusivityScope: ExclusivityScope;
  includesAcademicSafeHarbor: boolean;
  notes?: string;
  termsHash: string;
}

export interface TermRedlineDiff {
  field: string;
  previousValue: string;
  proposedValue: string;
  deltaSummary: string;
  impactTone: "positive" | "neutral" | "caution";
}

export interface CounterofferValidationResult {
  valid: boolean;
  requiresGuardianRatification: boolean;
  payForPlayViolation: boolean;
  violations: string[];
  warnings: string[];
  effectiveHourlyRateCents: number;
}

const PAY_FOR_PLAY_PATTERNS = [
  /\b(per|every)\s+(touchdown|goal|point|win|sack|home run|basket|assist)\b/i,
  /\b(win|winning|championship|playoff|starter|starting lineup)\s+bonus\b/i,
  /\benroll(ment)?\s+at\b/i,
  /\btransfer\s+portal\s+incentive\b/i,
];

export function computeTermsHash(input: {
  dealId: string;
  versionNumber: number;
  amountCents: number;
  deliverablesSummary: string;
  deliverableCount: number;
  usageRightsDays: number;
  exclusivityScope: ExclusivityScope;
  includesAcademicSafeHarbor: boolean;
}): string {
  const canonical = JSON.stringify({
    dealId: input.dealId,
    v: input.versionNumber,
    amountCents: input.amountCents,
    deliverables: input.deliverablesSummary.trim(),
    deliverableCount: input.deliverableCount,
    usageRightsDays: input.usageRightsDays,
    exclusivityScope: input.exclusivityScope,
    includesAcademicSafeHarbor: input.includesAcademicSafeHarbor,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function validateCounterofferTerms(input: {
  amountCents: number;
  deliverablesSummary: string;
  deliverableCount: number;
  usageRightsDays: number;
  exclusivityScope: ExclusivityScope;
  includesAcademicSafeHarbor: boolean;
  isMinorAthlete: boolean;
  previousVersion?: DealTermVersion;
}): CounterofferValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  let payForPlayViolation = false;

  if (!Number.isFinite(input.amountCents) || input.amountCents < 2500) {
    violations.push("Minimum NIL deal compensation is $25.00 (2,500 cents).");
  }
  if (input.amountCents > 50_000_000) {
    violations.push("Counteroffer exceeds single-contract automated escrow threshold ($500,000).");
  }
  if (!input.deliverablesSummary || input.deliverablesSummary.trim().length < 10) {
    violations.push("Deliverables summary must clearly specify the NIL services to be performed (min 10 chars).");
  }
  if (input.deliverableCount < 1 || input.deliverableCount > 50) {
    violations.push("Deliverable count must be between 1 and 50 items.");
  }
  if (input.usageRightsDays < 7 || input.usageRightsDays > 730) {
    violations.push("Brand usage rights window must be between 7 and 730 days.");
  }

  for (const pattern of PAY_FOR_PLAY_PATTERNS) {
    if (pattern.test(input.deliverablesSummary)) {
      payForPlayViolation = true;
      violations.push(
        "NCAA / NFHS Pay-for-Play Violation: Compensation cannot be tied to athletic performance, stats, or enrollment."
      );
      break;
    }
  }

  if (input.exclusivityScope === "full_sector" && input.usageRightsDays > 180) {
    warnings.push(
      "Full-sector exclusivity over 180 days restricts future NIL earning potential; consider category-only exclusivity."
    );
  }
  if (input.isMinorAthlete && !input.includesAcademicSafeHarbor) {
    warnings.push(
      "Minor athlete deals strongly recommend the Academic & Official Team Activity Safe Harbor clause."
    );
  }

  // Estimate 2 hours per deliverable for effective hourly rate
  const estimatedHours = Math.max(1, input.deliverableCount * 2);
  const effectiveHourlyRateCents = Math.round(input.amountCents / estimatedHours);

  const termsChangedFromPrevious =
    !input.previousVersion ||
    input.previousVersion.amountCents !== input.amountCents ||
    input.previousVersion.deliverablesSummary.trim() !== input.deliverablesSummary.trim() ||
    input.previousVersion.deliverableCount !== input.deliverableCount ||
    input.previousVersion.usageRightsDays !== input.usageRightsDays ||
    input.previousVersion.exclusivityScope !== input.exclusivityScope;

  const requiresGuardianRatification = Boolean(input.isMinorAthlete && termsChangedFromPrevious);

  return {
    valid: violations.length === 0,
    requiresGuardianRatification,
    payForPlayViolation,
    violations,
    warnings,
    effectiveHourlyRateCents,
  };
}

export function computeRedlineDiffs(
  prev: DealTermVersion,
  next: DealTermVersion
): TermRedlineDiff[] {
  const diffs: TermRedlineDiff[] = [];

  if (prev.amountCents !== next.amountCents) {
    const delta = next.amountCents - prev.amountCents;
    const sign = delta > 0 ? "+" : "-";
    const pct = prev.amountCents > 0 ? Math.round((Math.abs(delta) / prev.amountCents) * 100) : 0;
    diffs.push({
      field: "Total Compensation",
      previousValue: `$${(prev.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      proposedValue: `$${(next.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      deltaSummary: `${sign}$${(Math.abs(delta) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} (${sign}${pct}%)`,
      impactTone: delta > 0 ? "positive" : "caution",
    });
  }

  if (prev.deliverableCount !== next.deliverableCount) {
    const delta = next.deliverableCount - prev.deliverableCount;
    diffs.push({
      field: "Deliverable Count",
      previousValue: `${prev.deliverableCount} deliverable${prev.deliverableCount === 1 ? "" : "s"}`,
      proposedValue: `${next.deliverableCount} deliverable${next.deliverableCount === 1 ? "" : "s"}`,
      deltaSummary: `${delta > 0 ? `+${delta} more` : `${delta} fewer`} deliverable items`,
      impactTone: delta < 0 ? "positive" : "neutral",
    });
  }

  if (prev.usageRightsDays !== next.usageRightsDays) {
    const delta = next.usageRightsDays - prev.usageRightsDays;
    diffs.push({
      field: "Brand Usage Licensing Window",
      previousValue: `${prev.usageRightsDays} days`,
      proposedValue: `${next.usageRightsDays} days`,
      deltaSummary: `${delta > 0 ? `+${delta}` : delta} days licensing duration`,
      impactTone: delta <= 0 ? "positive" : "caution",
    });
  }

  if (prev.exclusivityScope !== next.exclusivityScope) {
    const labels: Record<ExclusivityScope, string> = {
      none: "Non-Exclusive",
      category_only: "Category-Only Exclusivity",
      full_sector: "Full Sector Exclusivity",
    };
    diffs.push({
      field: "Exclusivity Scope",
      previousValue: labels[prev.exclusivityScope],
      proposedValue: labels[next.exclusivityScope],
      deltaSummary: `Changed from ${labels[prev.exclusivityScope]} to ${labels[next.exclusivityScope]}`,
      impactTone: next.exclusivityScope === "none" ? "positive" : next.exclusivityScope === "full_sector" ? "caution" : "neutral",
    });
  }

  if (prev.deliverablesSummary.trim() !== next.deliverablesSummary.trim()) {
    diffs.push({
      field: "Deliverable Scope & Clauses",
      previousValue: prev.deliverablesSummary,
      proposedValue: next.deliverablesSummary,
      deltaSummary: "Updated deliverable specification text",
      impactTone: "neutral",
    });
  }

  if (prev.includesAcademicSafeHarbor !== next.includesAcademicSafeHarbor) {
    diffs.push({
      field: "Academic & Team Conflict Safe Harbor",
      previousValue: prev.includesAcademicSafeHarbor ? "Included" : "Not Included",
      proposedValue: next.includesAcademicSafeHarbor ? "Included" : "Not Included",
      deltaSummary: next.includesAcademicSafeHarbor
        ? "Added mandatory academic/official practice priority protection"
        : "Removed academic priority clause",
      impactTone: next.includesAcademicSafeHarbor ? "positive" : "caution",
    });
  }

  return diffs;
}

export function transitionNegotiationStatus(
  currentStatus: NegotiationStatus,
  action: "counter" | "accept" | "guardian_ratify" | "reject",
  actorRole: "sponsor" | "athlete" | "guardian" | "manager",
  isMinorAthlete: boolean
): NegotiationStatus {
  if (action === "reject") return "rejected";

  if (action === "counter") {
    return actorRole === "sponsor" ? "countered_by_sponsor" : "countered_by_athlete";
  }

  if (action === "accept") {
    if (isMinorAthlete && actorRole !== "guardian") {
      return "pending_guardian_ratification";
    }
    return "terms_locked";
  }

  if (action === "guardian_ratify") {
    if (actorRole === "guardian" && currentStatus === "pending_guardian_ratification") {
      return "terms_locked";
    }
  }

  return currentStatus;
}

