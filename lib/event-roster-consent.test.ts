import { describe, expect, it } from "vitest";
import {
  auditTimezoneTurnaroundConflict,
  evaluateRosterReadiness,
  type EventAttendeeRosterItem,
} from "./event-roster-consent";

describe("Event Multi-Athlete Roster & Guardian Consent Engine", () => {
  const sampleRoster: EventAttendeeRosterItem[] = [
    {
      athleteId: "ath-1",
      athleteName: "Marcus Vance",
      sport: "Basketball",
      isMinor: true,
      consentStatus: "granted",
      hasMedicalClearance: true,
    },
    {
      athleteId: "ath-2",
      athleteName: "Tyler Scott",
      sport: "Baseball",
      isMinor: true,
      consentStatus: "pending",
      hasMedicalClearance: true,
      travelConflictWarning: "Rest window violation",
    },
    {
      athleteId: "ath-3",
      athleteName: "Devon Brooks",
      sport: "Football",
      isMinor: false,
      consentStatus: "not_required_adult",
      hasMedicalClearance: true,
    },
  ];

  it("calculates accurate roster readiness and blocks departure if consent or conflicts remain", () => {
    const audit = evaluateRosterReadiness(sampleRoster);
    expect(audit.totalAthletes).toBe(3);
    expect(audit.minorCount).toBe(2);
    expect(audit.pendingConsentCount).toBe(1);
    expect(audit.unresolvedConflicts).toBe(1);
    expect(audit.readyForDeparture).toBe(false);
    expect(audit.readinessRatePercent).toBe(67);
  });

  it("marks roster fully ready when all minor consents are granted with zero conflicts", () => {
    const allReady: EventAttendeeRosterItem[] = [
      {
        athleteId: "ath-1",
        athleteName: "Marcus Vance",
        sport: "Basketball",
        isMinor: true,
        consentStatus: "granted",
        hasMedicalClearance: true,
      },
      {
        athleteId: "ath-3",
        athleteName: "Devon Brooks",
        sport: "Football",
        isMinor: false,
        consentStatus: "not_required_adult",
        hasMedicalClearance: true,
      },
    ];
    const audit = evaluateRosterReadiness(allReady);
    expect(audit.readyForDeparture).toBe(true);
    expect(audit.readinessRatePercent).toBe(100);
  });

  it("detects tight turnaround time conflicts across event timezones", () => {
    const conflict = auditTimezoneTurnaroundConflict(
      "2026-11-05T21:00:00Z",
      "2026-11-06T02:00:00Z",
      8
    );
    expect(conflict.hasConflict).toBe(true);
    expect(conflict.intervalHours).toBe(5);
    expect(conflict.message).toContain("Rest window violation");

    const valid = auditTimezoneTurnaroundConflict(
      "2026-11-05T18:00:00Z",
      "2026-11-06T08:00:00Z",
      8
    );
    expect(valid.hasConflict).toBe(false);
    expect(valid.intervalHours).toBe(14);
  });
});

