export type OrgRole = "owner" | "member" | "compliance_officer";

export interface OrgGovernancePolicy {
  orgId: string;
  name: string;
  currentOwnersCount: number;
  totalMembersCount: number;
  isArchived: boolean;
  athleteDataAccessRestricted: boolean; // Membership alone NEVER grants access to athlete academic, medical, or tax data
  pendingTransferToUserId?: string;
}

export interface SoleOwnerDepartureCheck {
  canLeaveSafely: boolean;
  canArchiveSafely: boolean;
  canDeleteSafely: boolean;
  requiresSuccessionPlan: boolean;
  blockReason?: string;
}

export function evaluateSoleOwnerDeparture(
  policy: OrgGovernancePolicy,
  actorUserId: string,
  actorRole: OrgRole
): SoleOwnerDepartureCheck {
  const isOwner = actorRole === "owner";
  const isSoleOwner = isOwner && policy.currentOwnersCount <= 1;

  if (isSoleOwner) {
    return {
      canLeaveSafely: false,
      canArchiveSafely: true, // A sole owner can archive the organization instead of leaving it stranded
      canDeleteSafely: false, // Prevents stranding records until archived or successor appointed
      requiresSuccessionPlan: true,
      blockReason:
        "Stranded Organization Prevention: You are the sole owner. You must appoint a co-owner or archive the organization before departing.",
    };
  }

  return {
    canLeaveSafely: true,
    canArchiveSafely: isOwner,
    canDeleteSafely: isOwner && policy.isArchived,
    requiresSuccessionPlan: false,
  };
}

export function validateOrganizationTransfer(input: {
  policy: OrgGovernancePolicy;
  initiatingOwnerId: string;
  targetMemberId: string;
  targetMemberRole: OrgRole;
}): { allowed: boolean; error?: string } {
  if (input.policy.isArchived) {
    return {
      allowed: false,
      error: "Cannot transfer ownership of an archived organization. Restore it first.",
    };
  }

  if (input.initiatingOwnerId === input.targetMemberId) {
    return {
      allowed: false,
      error: "You already hold ownership of this organization.",
    };
  }

  return { allowed: true };
}

export const SAMPLE_ORG_POLICIES: OrgGovernancePolicy[] = [
  {
    orgId: "org-1",
    name: "Apex Elite Athletic Club",
    currentOwnersCount: 1,
    totalMembersCount: 8,
    isArchived: false,
    athleteDataAccessRestricted: true,
  },
  {
    orgId: "org-2",
    name: "Sunshine State Tournament Collective",
    currentOwnersCount: 2,
    totalMembersCount: 14,
    isArchived: false,
    athleteDataAccessRestricted: true,
  },
];

