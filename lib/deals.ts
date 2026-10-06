/** Pure deal rules: state machine, offer eligibility, money parsing, minor-safe display names. */
import type { Role } from "./roles";

export type DealStatus =
  | "offered" | "guardian_review" | "awaiting_signature" | "active" | "completed" | "declined" | "withdrawn" | "cancelled";
export type DealAction =
  | "accept" | "decline" | "approve" | "reject" | "withdraw" | "complete"
  | "cancel" | "request_cancel" | "withdraw_cancel" | "agree_cancel";
export type Capacity = "counterparty" | "athlete" | "guardian";
/** The two sides of a deal. For a minor, the athlete's side is acted for by a linked guardian. */
export type Side = "buyer" | "athlete_side";

export const OFFER_ROLES: Role[] = ["sponsor", "booster", "gym_owner"];
export const OFFER_TTL_DAYS = 14;
export const MAX_OPEN_OFFERS_PER_PAIR = 3;
export const MAX_AMOUNT_CENTS = 100_000_000; // $1,000,000
/** Card payments have a processor minimum and tiny deals aren't worth the fees: require $1 when payments are on. */
export const MIN_AMOUNT_CENTS_WITH_PAYMENTS = 100;
export const amountError = (cents: number, paymentsOn: boolean): string | null =>
  paymentsOn && cents < MIN_AMOUNT_CENTS_WITH_PAYMENTS ? "With payments switched on, the minimum deal is $1.00." : null;

/** Still being negotiated / signed: can expire, be withdrawn or declined. */
export const OPEN_STATUSES = ["offered", "guardian_review", "awaiting_signature"] as const;
/** Not finished: blocks account deletion, counts as pipeline. */
export const LIVE_STATUSES = [...OPEN_STATUSES, "active"] as const;
export const sqlIn = (list: readonly string[]) => `(${list.map((x) => `'${x}'`).join(",")})`;
export const isOpen = (s: DealStatus) => (OPEN_STATUSES as readonly string[]).includes(s);

export const STATUS_LABEL: Record<DealStatus, string> = {
  offered: "Offered", guardian_review: "Awaiting guardian", awaiting_signature: "Awaiting signatures", active: "Active",
  completed: "Completed", declined: "Declined", withdrawn: "Withdrawn", cancelled: "Cancelled",
};
export const ACTION_LABEL: Record<DealAction, string> = {
  accept: "Accept", decline: "Decline", approve: "Approve (guardian)", reject: "Reject (guardian)",
  withdraw: "Withdraw offer", complete: "Mark completed & release payment",
  cancel: "Cancel deal", request_cancel: "Request cancellation & refund",
  withdraw_cancel: "Withdraw cancellation request", agree_cancel: "Agree to cancel & refund",
};
export const ALL_ACTIONS = Object.keys(ACTION_LABEL) as DealAction[];

export type DealContext = {
  status: DealStatus;
  expired: boolean;            // an open deal past expires_at
  athleteIsMinor: boolean;
  athleteHasGuardian: boolean;
  funded: boolean;             // money is held for this deal
  fundingRequired: boolean;    // payments are switched on for this installation
  cancelRequestSide: Side | null;
};

export type Transition = { ok: true; status: DealStatus } | { ok: false; error: string };
const no = (error: string): Transition => ({ ok: false, error });

export function sideOf(who: Capacity, athleteIsMinor: boolean): Side | null {
  if (who === "counterparty") return "buyer";
  if (who === "guardian") return athleteIsMinor ? "athlete_side" : null;   // guardian authority ends at 18
  return athleteIsMinor ? null : "athlete_side";                            // a minor can't contract or cancel
}

/**
 * The single source of truth for who may do what. Used by the server actions (authoritative)
 * and by the UI (to decide which buttons to show). Signing is separate (lib/contract.ts) — and note that NO action here
 * can make a deal "active": only a fully-signed contract does.
 */
export function applyAction(d: DealContext, who: Capacity, action: DealAction): Transition {
  const open = isOpen(d.status);
  if (open && d.expired) return no("This offer has expired.");
  const side = sideOf(who, d.athleteIsMinor);

  switch (action) {
    case "accept":
      if (who !== "athlete") return no("Only the athlete can accept an offer.");
      if (d.status !== "offered") return no("This offer can't be accepted now.");
      if (!d.athleteIsMinor) return { ok: true, status: "awaiting_signature" };
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
      return { ok: true, status: "awaiting_signature" };
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
      if (d.status !== "active") return no("Only signed, active deals can be completed.");
      if (d.fundingRequired && !d.funded) return no("Fund the deal first: the payment is released to the athlete when you mark it completed.");
      return { ok: true, status: "completed" };
    case "cancel":   // no money involved yet: either side may walk away
      if (side === null) return no("Only the parties to the deal can cancel it.");
      if (d.status !== "active") return no("Only an active deal can be cancelled.");
      if (d.funded) return no("This deal is funded: cancelling needs both sides to agree (request cancellation).");
      return { ok: true, status: "cancelled" };
    case "request_cancel":
      if (side === null) return no("Only the parties to the deal can request cancellation.");
      if (d.status !== "active" || !d.funded) return no("Cancellation with a refund applies to funded, active deals.");
      if (d.cancelRequestSide) return no("A cancellation request is already pending.");
      return { ok: true, status: d.status };
    case "withdraw_cancel":
      if (side === null || d.cancelRequestSide !== side) return no("Only the side that asked can withdraw the request.");
      return { ok: true, status: d.status };
    case "agree_cancel":
      if (side === null) return no("Only the parties to the deal can agree to cancel.");
      if (d.status !== "active" || !d.funded || !d.cancelRequestSide) return no("There is no cancellation request to agree to.");
      if (d.cancelRequestSide === side) return no("The other side has to agree to your request.");
      return { ok: true, status: "cancelled" };
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
