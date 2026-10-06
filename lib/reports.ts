/** Pure report rules. */
export const REPORT_REASONS = ["harassment", "inappropriate", "off_platform_contact", "safety_minor", "spam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REASON_LABEL: Record<ReportReason, string> = {
  harassment: "Harassment or threats", inappropriate: "Inappropriate or sexual content", off_platform_contact: "Pushing me to contact or pay outside LIN",
  safety_minor: "Something that could put a young athlete at risk", spam: "Spam", other: "Something else",
};
export const MAX_NOTE = 500;
export const MAX_REPORTS_PER_DAY = 10;
export const isReason = (r: string): r is ReportReason => (REPORT_REASONS as readonly string[]).includes(r);
/** Safety-of-a-minor reports go to the top of the queue. */
export const isUrgent = (r: string) => r === "safety_minor";
export type ReportOutcome = "dismiss" | "hide" | "warn" | "suspend";
export const OUTCOME_LABEL: Record<ReportOutcome, string> = {
  dismiss: "Dismiss (no violation)", hide: "Hide the message", warn: "Hide the message and warn the sender", suspend: "Hide the message and suspend the sender",
};
export const isOutcome = (o: string): o is ReportOutcome => o in OUTCOME_LABEL;
