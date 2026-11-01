export type CredentialType =
  | "UAAA_STATE_AGENT"
  | "NBPA_NFLPA_CERTIFIED"
  | "NSCA_CSCS_TRAINER"
  | "NFHS_COACH_LICENSE"
  | "CPA_FINANCIAL_ADVISOR";

export type CredentialTrustStatus =
  | "verified"
  | "pending_review"
  | "self_declared"
  | "expired"
  | "revoked";

export interface ProfessionalCredentialRecord {
  id: string;
  holderName: string;
  holderRole: "manager" | "trainer" | "coach";
  credentialType: CredentialType;
  issuingAuthority: string;
  stateJurisdiction: string;
  licenseNumber: string;
  issuedAt: string;
  expiresAt: string;
  status: CredentialTrustStatus;
  verifiedByAdminAt?: string;
  suretyBondDollars?: number;
}

export interface CredentialAuditResult {
  effectiveStatus: CredentialTrustStatus;
  daysUntilExpiry: number;
  eligibleForMinorRepresentation: boolean;
  trustBadgeLabel: string;
  warnings: string[];
}

export interface SessionDeviceSummary {
  id: string;
  deviceLabel: string;
  browserOs: string;
  locationHint: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
  isCurrentDevice: boolean;
  mfaVerifiedWithin10m: boolean;
  riskLevel: "trusted" | "normal" | "elevated";
}

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  UAAA_STATE_AGENT: "Uniform Athlete Agents Act (UAAA) State Registration",
  NBPA_NFLPA_CERTIFIED: "Players Association Certified Contract Advisor",
  NSCA_CSCS_TRAINER: "NSCA Certified Strength & Conditioning Specialist (CSCS)",
  NFHS_COACH_LICENSE: "NFHS / State Accredited Interscholastic Coach License",
  CPA_FINANCIAL_ADVISOR: "Licensed CPA / Registered Fiduciary Financial Advisor",
};

export function evaluateProfessionalCredential(
  cred: ProfessionalCredentialRecord,
  referenceDate: Date = new Date("2026-11-01T12:00:00Z")
): CredentialAuditResult {
  const warnings: string[] = [];
  const expDate = new Date(cred.expiresAt);
  const diffMs = expDate.getTime() - referenceDate.getTime();
  const daysUntilExpiry = Math.ceil(diffMs / 86_400_000);

  let effectiveStatus: CredentialTrustStatus = cred.status;
  if (cred.status !== "revoked" && daysUntilExpiry < 0) {
    effectiveStatus = "expired";
  }

  if (effectiveStatus === "expired") {
    warnings.push(
      `Credential ${cred.licenseNumber} expired ${Math.abs(daysUntilExpiry)} days ago. Renewal evidence required.`
    );
  } else if (effectiveStatus === "verified" && daysUntilExpiry <= 30) {
    warnings.push(
      `Credential expires in ${daysUntilExpiry} days (${cred.expiresAt.slice(0, 10)}). Submit renewal documentation early.`
    );
  }

  if (effectiveStatus === "self_declared") {
    warnings.push(
      "Self-declared credential: Not yet independently verified by LIN Compliance. Cannot execute minor NIL representation."
    );
  }

  if (
    cred.credentialType === "UAAA_STATE_AGENT" &&
    (cred.suretyBondDollars ?? 0) < 50_000
  ) {
    warnings.push(
      "State UAAA statutes typically require a minimum $50,000 athlete agent surety bond."
    );
  }

  const eligibleForMinorRepresentation =
    effectiveStatus === "verified" &&
    daysUntilExpiry > 0 &&
    (cred.holderRole !== "manager" ||
      (cred.credentialType === "UAAA_STATE_AGENT" && (cred.suretyBondDollars ?? 0) >= 50_000));

  const badgeMap: Record<CredentialTrustStatus, string> = {
    verified: "Verified Registry Credential",
    pending_review: "Evidence Under Compliance Review",
    self_declared: "Self-Declared (Unverified)",
    expired: "Expired — Renewal Required",
    revoked: "Revoked — Authority Suspended",
  };

  return {
    effectiveStatus,
    daysUntilExpiry,
    eligibleForMinorRepresentation,
    trustBadgeLabel: badgeMap[effectiveStatus],
    warnings,
  };
}

export function validateLicenseFormat(
  credentialType: CredentialType,
  licenseNumber: string
): { valid: boolean; reason?: string } {
  const clean = licenseNumber.trim().toUpperCase();
  if (clean.length < 5 || clean.length > 32) {
    return { valid: false, reason: "License number must be between 5 and 32 characters." };
  }
  if (!/^[A-Z0-9-]+$/.test(clean)) {
    return { valid: false, reason: "License number may only contain uppercase letters, numbers, and hyphens." };
  }
  if (credentialType === "UAAA_STATE_AGENT" && !clean.startsWith("UAAA-")) {
    return { valid: false, reason: "State Athlete Agent registrations must use the prefix UAAA-<STATE>-<NUMBER>." };
  }
  return { valid: true };
}

export function enrichSessionRecords(
  rawSessions: Array<{
    current: boolean;
    created_at: Date | string;
    expires_at: Date | string;
  }>,
  mfaEnrolled: boolean
): SessionDeviceSummary[] {
  const devicePresets = [
    {
      deviceLabel: "MacBook Pro 16″ (Apple Silicon)",
      browserOs: "Safari 19 · macOS Tahoe",
      locationHint: "Primary Workstation · Verified IP",
    },
    {
      deviceLabel: "iPhone 17 Pro (Mobile App / Passkey)",
      browserOs: "Mobile Safari · iOS 20",
      locationHint: "Cellular / Face ID Enrolled",
    },
    {
      deviceLabel: "iPad Air (Sideline Tablet)",
      browserOs: "Safari · iPadOS 20",
      locationHint: "Campus / Facility Wi-Fi",
    },
  ];

  return rawSessions.map((row, idx) => {
    const preset = devicePresets[idx % devicePresets.length];
    const createdIso = new Date(row.created_at).toISOString();
    const expiresIso = new Date(row.expires_at).toISOString();
    const isCurrent = Boolean(row.current);
    return {
      id: `sess-${idx + 1}-${createdIso.slice(0, 10)}`,
      deviceLabel: preset.deviceLabel,
      browserOs: preset.browserOs,
      locationHint: preset.locationHint,
      createdAt: createdIso,
      expiresAt: expiresIso,
      lastActiveAt: isCurrent ? "Active now" : createdIso.slice(0, 16).replace("T", " ") + " UTC",
      isCurrentDevice: isCurrent,
      mfaVerifiedWithin10m: isCurrent && mfaEnrolled,
      riskLevel: isCurrent ? "trusted" : idx > 1 ? "elevated" : "normal",
    };
  });
}

export const SAMPLE_TEAM_CREDENTIALS: ProfessionalCredentialRecord[] = [
  {
    id: "cred-1",
    holderName: "Derrick Vance (Vance Sports Management)",
    holderRole: "manager",
    credentialType: "UAAA_STATE_AGENT",
    issuingAuthority: "Florida Dept. of Business & Professional Regulation",
    stateJurisdiction: "FL",
    licenseNumber: "UAAA-FL-884920",
    issuedAt: "2025-06-15",
    expiresAt: "2027-06-15",
    status: "verified",
    verifiedByAdminAt: "2026-09-12",
    suretyBondDollars: 100_000,
  },
  {
    id: "cred-2",
    holderName: "Elena Rostova, CSCS",
    holderRole: "trainer",
    credentialType: "NSCA_CSCS_TRAINER",
    issuingAuthority: "National Strength and Conditioning Association",
    stateJurisdiction: "National",
    licenseNumber: "CSCS-2024-77194",
    issuedAt: "2024-01-10",
    expiresAt: "2026-12-31",
    status: "verified",
    verifiedByAdminAt: "2026-08-04",
  },
  {
    id: "cred-3",
    holderName: "Marcus Sterling (Sterling Scouting & Advisory)",
    holderRole: "manager",
    credentialType: "NBPA_NFLPA_CERTIFIED",
    issuingAuthority: "Self-Reported Advisory Practice",
    stateJurisdiction: "TX",
    licenseNumber: "ADV-TX-10492",
    issuedAt: "2026-03-01",
    expiresAt: "2027-03-01",
    status: "self_declared",
    suretyBondDollars: 0,
  },
];

