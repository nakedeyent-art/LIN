export type DigestCadence = "instant" | "daily_morning_7am" | "weekly_sunday_rollup";

export interface SavedDiscoveryFilter {
  id: string;
  label: string;
  targetRoute: string;
  criteriaSummary: string;
  respectsMinorPrivacyGate: boolean;
  alertOnNewMatches: boolean;
}

export interface NotificationDigestPolicy {
  cadence: DigestCadence;
  enforceStudentAthleteQuietHours: boolean; // 10:00 PM – 6:30 AM local
  stripSensitiveAmountsAndText: boolean; // Always true per security rules
  urgentSecurityAndSigningBypassQuietHours: boolean;
}

export function evaluateNotificationDeliveryWindow(
  policy: NotificationDigestPolicy,
  eventCategory: "security_mfa" | "contract_signing" | "deal_offer" | "recruiter_view" | "social_comment",
  localHour24: number
): {
  deliverImmediately: boolean;
  deliveryChannel: "instant_push_email" | "queued_for_morning_digest" | "queued_for_weekly_rollup";
  redactedPreviewSafe: boolean;
} {
  // Security & MFA alerts always bypass quiet hours and digests
  if (
    eventCategory === "security_mfa" ||
    (eventCategory === "contract_signing" && policy.urgentSecurityAndSigningBypassQuietHours)
  ) {
    return {
      deliverImmediately: true,
      deliveryChannel: "instant_push_email",
      redactedPreviewSafe: true,
    };
  }

  const inQuietHours = localHour24 >= 22 || localHour24 < 7;
  if (policy.enforceStudentAthleteQuietHours && inQuietHours) {
    return {
      deliverImmediately: false,
      deliveryChannel: "queued_for_morning_digest",
      redactedPreviewSafe: true,
    };
  }

  if (policy.cadence === "daily_morning_7am") {
    return {
      deliverImmediately: false,
      deliveryChannel: "queued_for_morning_digest",
      redactedPreviewSafe: true,
    };
  }

  if (policy.cadence === "weekly_sunday_rollup") {
    return {
      deliverImmediately: false,
      deliveryChannel: "queued_for_weekly_rollup",
      redactedPreviewSafe: true,
    };
  }

  return {
    deliverImmediately: true,
    deliveryChannel: "instant_push_email",
    redactedPreviewSafe: true,
  };
}

export const SAMPLE_SAVED_FILTERS: SavedDiscoveryFilter[] = [
  {
    id: "flt-1",
    label: "Florida & Texas D1 / High School Football & Track Prospects",
    targetRoute: "/dashboard/athletes?sport=Football&state=FL",
    criteriaSummary: "Sport: Football · States: FL, TX · Verified Digital NIL Pass · Guardian Linked",
    respectsMinorPrivacyGate: true,
    alertOnNewMatches: true,
  },
  {
    id: "flt-2",
    label: "NFHS-Safe Regional Hydration & Apparel Campaigns ($500+)",
    targetRoute: "/dashboard/deals",
    criteriaSummary: "Category: Hydration / Apparel · Min FMV: $500 · Zero Prohibited Industry Flags",
    respectsMinorPrivacyGate: true,
    alertOnNewMatches: true,
  },
];
