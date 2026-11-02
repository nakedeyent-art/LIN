import { describe, expect, it } from "vitest";
import {
  buildMinimumContextCaseView,
  classifyModerationSla,
  redactMinimumContextSnippet,
  validateAppealAdjudication,
  type ScopedModerationCase,
} from "./scoped-moderation";

describe("Scoped Moderation, Minimum-Context Triage & Appeals Engine", () => {
  const sampleCase: ScopedModerationCase = {
    id: "case-100",
    channel: "deal_message",
    reason: "off_platform_contact",
    involvesMinorAthlete: true,
    rawSnippet: "Text me at (404) 555-0188 or email agent@example.org to bypass guardian review.",
    senderDisplay: "External Contact",
    reporterDisplay: "Athlete (Minor)",
    createdAt: "2026-11-01T12:00:00Z",
    assignedScope: "minor_protection_specialist",
    initialModeratorId: "mod-1",
    initialOutcome: "suspend",
    appealStatus: "appeal_submitted",
    appealReason: "Requesting secondary review of suspension.",
  };

  it("redacts emails, phone numbers, and financial IDs for minimum-context review", () => {
    const res = redactMinimumContextSnippet(sampleCase.rawSnippet);
    expect(res.redactedCount).toBe(2);
    expect(res.redactedText).toContain("[REDACTED_PHONE]");
    expect(res.redactedText).toContain("[REDACTED_EMAIL]");
    expect(res.redactedText).not.toContain("555-0188");
  });

  it("assigns P0_CRITICAL_15M SLA to minor safety and minor off-platform solicitation", () => {
    expect(classifyModerationSla("safety_minor", false)).toBe("P0_CRITICAL_15M");
    expect(classifyModerationSla("off_platform_contact", true)).toBe("P0_CRITICAL_15M");
    expect(classifyModerationSla("spam", false)).toBe("P3_ROUTINE_24H");
  });

  it("restricts routine trust_safety_reviewer from suspending accounts on minor cases and never exposes financial records", () => {
    const view = buildMinimumContextCaseView(sampleCase, "trust_safety_reviewer");
    expect(view.canExecuteSuspension).toBe(false);
    expect(view.canAccessFinancialOrTaxRecords).toBe(false);
    expect(view.requiresMinorSpecialistEscalation).toBe(true);
  });

  it("enforces independent dual-control moderator check on appeals", () => {
    const sameModResult = validateAppealAdjudication({
      caseItem: sampleCase,
      reviewerModeratorId: "mod-1",
      reviewerScope: "minor_protection_specialist",
      decision: "upheld_by_second_reviewer",
      rationale: "Confirmed solicitation of a minor outside parental escrow.",
    });
    expect(sameModResult.allowed).toBe(false);
    expect(sameModResult.error).toContain("Dual-control violation");

    const independentModResult = validateAppealAdjudication({
      caseItem: sampleCase,
      reviewerModeratorId: "mod-2",
      reviewerScope: "minor_protection_specialist",
      decision: "upheld_by_second_reviewer",
      rationale: "Confirmed solicitation of a minor outside parental escrow.",
    });
    expect(independentModResult.allowed).toBe(true);
  });
});

