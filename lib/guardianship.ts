/** Pure guardianship rules. The database view `guardian_links` enforces the same age rule in SQL. */

export const MAX_GUARDIANS = 4;            // linked + pending per athlete
export type Powers = "guardian" | "viewer" | "none";

/**
 * What a linked parent can do for an athlete:
 *  - minor            → full guardian authority
 *  - adult + consent  → view-only, limited to what the athlete chose to share
 *  - adult, no consent → nothing (consent transferred to the athlete at 18)
 */
export function guardianPowers(athleteIsMinor: boolean, linked: boolean, adultConsent: boolean): Powers {
  if (!linked) return "none";
  if (athleteIsMinor) return "guardian";
  return adultConsent ? "viewer" : "none";
}

export type RemovalInput = {
  actorIsGuardian: boolean;      // actor holds authority for this (minor) athlete
  targetIsSelf: boolean;
  guardiansLinked: number;       // current linked guardians, including the actor
  openDeals: number;             // offered / guardian_review / active deals of the athlete
};

/** A guardian may remove another guardian or step down; the last guardian can't leave while deals are open. */
export function checkRemoval(i: RemovalInput): { ok: true; leavesNone: boolean } | { ok: false; error: string } {
  if (!i.actorIsGuardian) return { ok: false, error: "Only a linked parent/guardian of an athlete under 18 can do this." };
  const remaining = i.guardiansLinked - 1;
  if (remaining < 1 && i.openDeals > 0)
    return { ok: false, error: "This athlete has open deals that need a guardian. Resolve them (or add another guardian) first." };
  if (!i.targetIsSelf && remaining < 1) return { ok: false, error: "You can't remove the only guardian other than yourself." };
  return { ok: true, leavesNone: remaining < 1 };
}

export function canInviteGuardian(linked: number, pending: number): { ok: true } | { ok: false; error: string } {
  return linked + pending >= MAX_GUARDIANS ? { ok: false, error: `An athlete can have at most ${MAX_GUARDIANS} guardians (including pending invites).` } : { ok: true };
}
