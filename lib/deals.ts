/** Pure deal rules: state machine, offer eligibility, money parsing, minor-safe display names. */
import type { Role } from "./roles";

export type DealStatus = "offered" | "guardian_review" | "active" | "completed" | "declined" | "withdrawn";
export type DealAction = "accept" | "decline" | "approve" | "reject" | "withdraw" | "complete";
export type Capacity = "counterparty" | "athlete" | "guardian";

export const OFFER_ROLES: Role[] = ["sponsor", "booster", "gym_owner"];
export const OFFER_TTL_DAYS = 14;
export const MAX_OPEN_OFFERS_PER_PAIR = 3;
export const MAX_AMOUNT_CENTS = 100_000_000; // $1,000,000

export const STATUS_LABEL: Record<DealStatus, string> = {
  offered: "Offered", guardian_review: "Awaiting guardian", active: "Active",
  completed: "Completed", declined: "Declined", withdrawn: "Withdrawn",
};
export const ACTION_LABEL: Record<DealAction, string> = {
  accept: "Accept", decline: "Decline", approve: "Approve (guardian)", reject: "Reject (guardian)",
  withdraw: "Withdraw offer", complete: "Mark completed",
};
export const ALL_ACTIONS = Object.keys(ACTION_LABEL) as DealAction[];

export type DealContext = {
  status: DealStatus;
  expired: boolean;            // offered/guardian_review past expires_at
  athleteIsMinor: boolean;
  athleteHasGuardian: boolean;
};

export type Transition = { ok: true; status: DealStatus } | { ok: false; error: string };
const no = (error: string): Transition => ({ ok: false, error });

/**
 * The single source of truth for who may do what. Used by the server actions (authoritative)
 * and by the UI (to decide which buttons to show).
 */
export function applyAction(d: DealContext, who: Capacity, action: DealAction): Transition {
  const open = d.status === "offered" || d.status === "guardian_review";
  if (open && d.expired) return no("This offer has expired.");

  switch (action) {
    case "accept":
      if (who !== "athlete") return no("Only the athlete can accept an offer.");
      if (d.status !== "offered") return no("This offer can't be accepted now.");
      if (!d.athleteIsMinor) return { ok: true, status: "active" };
      if (!d.athleteHasGuardian) return no("A linked parent/guardian is required before accepting.");
      return { ok: true, status: "guardian_review" };
    case "decline":
      if (who !== "athlete") return no("Only the athlete can decline.");
      if (!open) return no("This deal can't be declined now.");
      return { ok: true, status: "declined" };
    case "approve":
      // Standing first, state second: someone with no standing gets the permission error whatever the deal's state.
      if (who === "counterparty") return no("Only a linked guardian can approve.");
      if (who === "athlete" && d.athleteIsMinor) return no("Only a linked guardian can approve.");
      if (who === "guardian" && !d.athleteIsMinor) return no("Guardian approval no longer applies: this athlete is now an adult.");
      if (d.status !== "guardian_review") return no("There is nothing to approve right now.");
      // Guardians decide for minors; if the athlete has since turned 18 the athlete decides.
      return { ok: true, status: "active" };
    case "reject":
      if (who !== "guardian") return no("Only a linked guardian can reject.");
      if (!open) return no("This deal can't be rejected now.");
      return { ok: true, status: "declined" };
    case "withdraw":
      if (who !== "counterparty") return no("Only the offering party can withdraw.");
      if (!open) return no("Only open offers can be withdrawn.");
      return { ok: true, status: "withdrawn" };
    case "complete":
      if (who !== "counterparty") return no("Only the offering party can mark a deal completed.");
      if (d.status !== "active") return no("Only active deals can be completed.");
      return { ok: true, status: "completed" };
  }
}

export function availableActions(d: DealContext, who: Capacity): DealAction[] {
  return ALL_ACTIONS.filter((a) => applyAction(d, who, a).ok);
}

export type Level = "high_school" | "college" | "pro_amateur";

/** Conservative default: boosters/collectives may not approach high-school athletes. Needs legal review per state. */
export function canOffer(role: Role, athleteLevel: Level): { ok: true } | { ok: false; error: string } {
  if (!OFFER_ROLES.includes(role)) return { ok: false, error: "Your role can't make offers." };
  if (role === "booster" && athleteLevel === "high_school")
    return { ok: false, error: "Boosters and collectives can't make offers to high-school athletes." };
  return { ok: true };
}

/** "25", "$1,250.50" -> cents; null if invalid, non-positive or over the cap. */
export function parseDollarsToCents(input: string): number | null {
  const t = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return null;
  const [d, c = ""] = t.split(".");
  const cents = parseInt(d, 10) * 100 + parseInt(c.padEnd(2, "0") || "0", 10);
  return cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

export const formatCents = (c: number) =>
  "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Third parties see minors as "First L." — full names are for the athlete and linked guardians. */
export function displayName(fullName: string, isMinor: boolean): string {
  if (!isMinor) return fullName;
  const parts = fullName.trim().split(/\s+/);
  return parts.length < 2 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
