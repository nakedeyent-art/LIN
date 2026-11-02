import { describe, expect, it } from "vitest";
import {
  evaluateSoleOwnerDeparture,
  validateOrganizationTransfer,
  type OrgGovernancePolicy,
} from "./org-lifecycle-governance";

describe("Organization Transfer, Co-Ownership & Governance Lifecycle Engine", () => {
  const soleOwnerPolicy: OrgGovernancePolicy = {
    orgId: "org-1",
    name: "Apex Elite Club",
    currentOwnersCount: 1,
    totalMembersCount: 5,
    isArchived: false,
    athleteDataAccessRestricted: true,
  };

  const multiOwnerPolicy: OrgGovernancePolicy = {
    orgId: "org-2",
    name: "Sunshine State Collective",
    currentOwnersCount: 2,
    totalMembersCount: 8,
    isArchived: false,
    athleteDataAccessRestricted: true,
  };

  it("prohibits sole owner from leaving without appointing successor, but permits archiving", () => {
    const check = evaluateSoleOwnerDeparture(soleOwnerPolicy, "owner-1", "owner");
    expect(check.canLeaveSafely).toBe(false);
    expect(check.requiresSuccessionPlan).toBe(true);
    expect(check.canArchiveSafely).toBe(true);
    expect(check.blockReason).toContain("Stranded Organization Prevention");
  });

  it("permits owner to leave safely when multiple owners exist", () => {
    const check = evaluateSoleOwnerDeparture(multiOwnerPolicy, "owner-1", "owner");
    expect(check.canLeaveSafely).toBe(true);
    expect(check.requiresSuccessionPlan).toBe(false);
  });

  it("validates ownership transfer to active organization members and prevents self-transfers", () => {
    const valid = validateOrganizationTransfer({
      policy: soleOwnerPolicy,
      initiatingOwnerId: "owner-1",
      targetMemberId: "member-2",
      targetMemberRole: "member",
    });
    expect(valid.allowed).toBe(true);

    const selfTransfer = validateOrganizationTransfer({
      policy: soleOwnerPolicy,
      initiatingOwnerId: "owner-1",
      targetMemberId: "owner-1",
      targetMemberRole: "owner",
    });
    expect(selfTransfer.allowed).toBe(false);
    expect(selfTransfer.error).toContain("already hold ownership");
  });
});

