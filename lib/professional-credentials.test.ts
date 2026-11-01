import { describe, expect, it } from "vitest";
import {
  enrichSessionRecords,
  evaluateProfessionalCredential,
  validateLicenseFormat,
  type ProfessionalCredentialRecord,
} from "./professional-credentials";

describe("Verified Professional Status & Credential Registry", () => {
  const verifiedAgent: ProfessionalCredentialRecord = {
    id: "cred-test-1",
    holderName: "Derrick Vance",
    holderRole: "manager",
    credentialType: "UAAA_STATE_AGENT",
    issuingAuthority: "Florida DBPR",
    stateJurisdiction: "FL",
    licenseNumber: "UAAA-FL-884920",
    issuedAt: "2025-06-15",
    expiresAt: "2027-06-15",
    status: "verified",
    verifiedByAdminAt: "2026-09-12",
    suretyBondDollars: 100_000,
  };

  it("clears verified UAAA state agents with >=$50k surety bond for minor representation", () => {
    const res = evaluateProfessionalCredential(
      verifiedAgent,
      new Date("2026-11-01T12:00:00Z")
    );
    expect(res.effectiveStatus).toBe("verified");
    expect(res.eligibleForMinorRepresentation).toBe(true);
    expect(res.warnings).toHaveLength(0);
  });

  it("blocks self-declared credentials from minor representation and emits clear warning", () => {
    const res = evaluateProfessionalCredential(
      { ...verifiedAgent, status: "self_declared" },
      new Date("2026-11-01T12:00:00Z")
    );
    expect(res.effectiveStatus).toBe("self_declared");
    expect(res.eligibleForMinorRepresentation).toBe(false);
    expect(res.trustBadgeLabel).toBe("Self-Declared (Unverified)");
    expect(res.warnings.some((w) => w.includes("Self-declared credential"))).toBe(true);
  });

  it("automatically transitions past-due credentials to expired status", () => {
    const res = evaluateProfessionalCredential(
      { ...verifiedAgent, expiresAt: "2026-10-01" },
      new Date("2026-11-01T12:00:00Z")
    );
    expect(res.effectiveStatus).toBe("expired");
    expect(res.eligibleForMinorRepresentation).toBe(false);
    expect(res.daysUntilExpiry).toBeLessThan(0);
  });

  it("validates UAAA state agent license prefixes", () => {
    expect(validateLicenseFormat("UAAA_STATE_AGENT", "UAAA-TX-99201").valid).toBe(true);
    const bad = validateLicenseFormat("UAAA_STATE_AGENT", "AGENT-99201");
    expect(bad.valid).toBe(false);
    expect(bad.reason).toContain("UAAA-");
  });

  it("enriches session records with device labels, MFA freshness, and risk levels", () => {
    const summaries = enrichSessionRecords(
      [
        { current: true, created_at: "2026-11-01T11:00:00Z", expires_at: "2026-11-15T11:00:00Z" },
        { current: false, created_at: "2026-10-29T08:00:00Z", expires_at: "2026-11-12T08:00:00Z" },
      ],
      true
    );
    expect(summaries).toHaveLength(2);
    expect(summaries[0].isCurrentDevice).toBe(true);
    expect(summaries[0].mfaVerifiedWithin10m).toBe(true);
    expect(summaries[0].riskLevel).toBe("trusted");
    expect(summaries[1].isCurrentDevice).toBe(false);
  });
});

