/** Pure admin rules. What an admin may do to whom, and what a reason must look like. */
import { ageFromBirthDate } from "./crypto";

export const MIN_REASON = 10;
export const MAX_REASON = 300;
export type UserAction = "suspend" | "unsuspend" | "unlock" | "set_birth_date" | "resend_verification";
export type AdminAction = "news_source_add" | "news_source_fetch" | "news_source_enable" | "news_source_disable" | "news_editorial" | "news_hide" | "news_unhide" | "resolve_report" | "view_report" | "view_attachment" | "suspend" | "unsuspend" | "unlock" | "set_birth_date" | "resend_verification" | "retry_payment";
export const ACTION_LABEL: Record<AdminAction, string> = {
  news_source_add: "Added a news source", news_source_fetch: "Fetched a news source", news_source_enable: "Enabled a news source", news_source_disable: "Disabled a news source", news_editorial: "Posted editorial news", news_hide: "Hid a news story", news_unhide: "Restored a news story",
  resolve_report: "Resolved a report", view_report: "Viewed a report", view_attachment: "Downloaded a reported attachment",
  suspend: "Suspend account", unsuspend: "Restore account", unlock: "Clear lockout", set_birth_date: "Correct birth date",
  resend_verification: "Resend verification email", retry_payment: "Retry payment processing",
};

export const validateReason = (r: string): string | null => {
  const t = r.trim();
  if (t.length < MIN_REASON) return `Give a reason (at least ${MIN_REASON} characters). It is saved in the audit log.`;
  if (t.length > MAX_REASON) return `Keep the reason under ${MAX_REASON} characters.`;
  return null;
};

export type Target = { id: string; isAdmin: boolean; deleted: boolean; suspended: boolean; verified: boolean; role: string; liveDeals: number; moneyInFlight: number };
export type Check = { ok: true } | { ok: false; error: string };
const no = (error: string): Check => ({ ok: false, error });

/** Admins can't act on themselves or on other admins (admin rights are managed with scripts/make-admin.mjs), or on deleted accounts. */
export function canActOnUser(adminId: string, t: Target, action: UserAction, newBirth?: string): Check {
  if (t.deleted) return no("This account has been deleted.");
  if (action === "suspend" || action === "unsuspend" || action === "set_birth_date") {
    if (t.id === adminId) return no("You can't do that to your own account.");
    if (t.isAdmin) return no("Admin accounts can't be changed from the panel.");
  }
  switch (action) {
    case "suspend": return t.suspended ? no("Already suspended.") : { ok: true };
    case "unsuspend": return t.suspended ? { ok: true } : no("This account isn't suspended.");
    case "unlock": return { ok: true };
    case "resend_verification": return t.verified ? no("This email is already verified.") : { ok: true };
    case "set_birth_date": {
      if (t.role !== "athlete") return no("Only athletes have a birth date.");
      const age = ageFromBirthDate(newBirth ?? "");
      if (age === null || age < 5 || age > 100) return no("Enter a valid birth date.");
      if (t.liveDeals > 0 || t.moneyInFlight > 0) return no("This athlete has open deals or money in flight. Changing their age now could change who must approve them — resolve those first.");
      return { ok: true };
    }
  }
}
