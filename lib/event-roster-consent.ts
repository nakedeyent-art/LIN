export type GuardianConsentStatus = "granted" | "pending" | "withdrawn" | "not_required_adult";

export interface EventAttendeeRosterItem {
  athleteId: string;
  athleteName: string;
  sport: string;
  position?: string;
  isMinor: boolean;
  guardianName?: string;
  consentStatus: GuardianConsentStatus;
  consentGrantedAt?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  hasMedicalClearance: boolean;
  travelConflictWarning?: string;
}

export interface MultiAthleteRosterAudit {
  totalAthletes: number;
  minorCount: number;
  readyForDeparture: boolean;
  pendingConsentCount: number;
  missingMedicalCount: number;
  unresolvedConflicts: number;
  readinessRatePercent: number;
}

export function evaluateRosterReadiness(
  attendees: EventAttendeeRosterItem[]
): MultiAthleteRosterAudit {
  const totalAthletes = attendees.length;
  const minorCount = attendees.filter((a) => a.isMinor).length;
  const pendingConsentCount = attendees.filter(
    (a) => a.isMinor && a.consentStatus !== "granted"
  ).length;
  const missingMedicalCount = attendees.filter((a) => !a.hasMedicalClearance).length;
  const unresolvedConflicts = attendees.filter((a) => Boolean(a.travelConflictWarning)).length;

  const readyAthletes = attendees.filter((a) => {
    const consentOk = !a.isMinor || a.consentStatus === "granted";
    const medicalOk = a.hasMedicalClearance;
    const conflictOk = !a.travelConflictWarning;
    return consentOk && medicalOk && conflictOk;
  }).length;

  const readinessRatePercent =
    totalAthletes > 0 ? Math.round((readyAthletes / totalAthletes) * 100) : 100;

  const readyForDeparture =
    totalAthletes > 0 &&
    pendingConsentCount === 0 &&
    missingMedicalCount === 0 &&
    unresolvedConflicts === 0;

  return {
    totalAthletes,
    minorCount,
    readyForDeparture,
    pendingConsentCount,
    missingMedicalCount,
    unresolvedConflicts,
    readinessRatePercent,
  };
}

export function auditTimezoneTurnaroundConflict(
  previousEventEndUtc: string,
  nextEventStartUtc: string,
  minTurnaroundHours: number = 8
): { hasConflict: boolean; intervalHours: number; message?: string } {
  const prevEnd = new Date(previousEventEndUtc).getTime();
  const nextStart = new Date(nextEventStartUtc).getTime();
  const diffMs = nextStart - prevEnd;
  const intervalHours = Math.round((diffMs / 3_600_000) * 10) / 10;

  if (diffMs < 0) {
    return {
      hasConflict: true,
      intervalHours,
      message: "Overlap detected: Next event starts before previous event concludes.",
    };
  }

  if (intervalHours < minTurnaroundHours) {
    return {
      hasConflict: true,
      intervalHours,
      message: `Rest window violation: ${intervalHours}h turnaround is less than mandatory ${minTurnaroundHours}h recovery/travel buffer.`,
    };
  }

  return {
    hasConflict: false,
    intervalHours,
  };
}

export const SAMPLE_EVENT_ROSTER: EventAttendeeRosterItem[] = [
  {
    athleteId: "ath-1",
    athleteName: "Marcus Vance",
    sport: "Basketball",
    position: "Point Guard",
    isMinor: true,
    guardianName: "Sandra Vance",
    consentStatus: "granted",
    consentGrantedAt: "2026-10-30 14:15 UTC",
    emergencyContactName: "Sandra Vance",
    emergencyContactPhone: "(305) 555-0199",
    hasMedicalClearance: true,
  },
  {
    athleteId: "ath-2",
    athleteName: "Tyler Scott",
    sport: "Baseball",
    position: "Pitcher",
    isMinor: true,
    guardianName: "Robert Scott",
    consentStatus: "pending",
    emergencyContactName: "Robert Scott",
    emergencyContactPhone: "(404) 555-0182",
    hasMedicalClearance: true,
    travelConflictWarning: "Rest window violation: 5.5h turnaround from Atlanta regional showcase.",
  },
  {
    athleteId: "ath-3",
    athleteName: "Devon Brooks",
    sport: "Football",
    position: "Wide Receiver",
    isMinor: false,
    consentStatus: "not_required_adult",
    emergencyContactName: "Self / Family Direct",
    emergencyContactPhone: "(813) 555-0144",
    hasMedicalClearance: true,
  },
];

