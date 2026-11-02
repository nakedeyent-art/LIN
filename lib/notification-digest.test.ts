import { describe, expect, it } from "vitest";
import {
  evaluateNotificationDeliveryWindow,
  type NotificationDigestPolicy,
} from "./notification-digest";

describe("Notification Digest & Student-Athlete Quiet Hours Engine", () => {
  const defaultPolicy: NotificationDigestPolicy = {
    cadence: "instant",
    enforceStudentAthleteQuietHours: true,
    stripSensitiveAmountsAndText: true,
    urgentSecurityAndSigningBypassQuietHours: true,
  };

  it("holds non-urgent commercial notifications during student-athlete school-night quiet hours (10pm-7am)", () => {
    const res = evaluateNotificationDeliveryWindow(defaultPolicy, "deal_offer", 23);
    expect(res.deliverImmediately).toBe(false);
    expect(res.deliveryChannel).toBe("queued_for_morning_digest");
  });

  it("delivers security and MFA notices immediately even during quiet hours", () => {
    const res = evaluateNotificationDeliveryWindow(defaultPolicy, "security_mfa", 2);
    expect(res.deliverImmediately).toBe(true);
    expect(res.deliveryChannel).toBe("instant_push_email");
  });

  it("routes routine events to weekly rollup when weekly_sunday_rollup is selected", () => {
    const res = evaluateNotificationDeliveryWindow(
      { ...defaultPolicy, cadence: "weekly_sunday_rollup" },
      "social_comment",
      14
    );
    expect(res.deliverImmediately).toBe(false);
    expect(res.deliveryChannel).toBe("queued_for_weekly_rollup");
  });
});
