import { describe, expect, it } from "vitest";
import {
  auditDataExportSanity,
  generateExportManifest,
  type DataExportCategory,
} from "./data-export-audit";

describe("Data Export Integrity & Retention Audit Engine", () => {
  const sampleCounts: Record<DataExportCategory, number> = {
    account_identity: 1,
    athlete_profile_athletics: 1,
    academic_and_grades: 12,
    nutrition_and_fitness: 45,
    deals_and_contracts: 3,
    team_and_family_sharing: 2,
    documents_and_forg3_signing: 4,
    sports_travel_and_events: 5,
    scouting_and_recruiting: 0,
    communications_and_social: 14,
    security_mfa_and_passkeys: 2,
    organizations_and_audit: 1,
  };

  it("generates GDPR/CCPA compliant export manifest with statutory retention rules", () => {
    const manifest = generateExportManifest("usr-test-1", sampleCounts, true);
    expect(manifest.userId).toBe("usr-test-1");
    expect(manifest.exportFormatVersion).toContain("GDPR-CCPA-COMPLIANT");
    expect(manifest.containsImmutableSignedAgreements).toBe(true);
    expect(manifest.retentionRules.dealAuditRetentionYears).toBe(7);
    expect(manifest.recordCounts.academic_and_grades).toBe(12);
  });

  it("passes sanity audit when no prohibited security secrets or raw credentials leak", () => {
    const safePayload = {
      account: { email: "athlete@example.com", name: "Jordan Smith" },
      deals: [{ title: "Shoe Sponsorship", amountCents: 50000 }],
      passkeys: [{ name: "MacBook Touch ID", device_type: "platform" }],
    };
    const audit = auditDataExportSanity(safePayload);
    expect(audit.isValid).toBe(true);
    expect(audit.leakedSensitiveFields).toHaveLength(0);
    expect(audit.totalRecordsIncluded).toBeGreaterThan(0);
  });

  it("detects and rejects any accidental leakage of password hashes or TOTP seeds", () => {
    const leakingPayload = {
      account: {
        email: "athlete@example.com",
        password_hash: "argon2id$v=19$m=65536,t=3,p=4$...",
      },
      mfa: {
        authenticator_secret: "JBSWY3DPEHPK3PXP",
      },
    };
    const audit = auditDataExportSanity(leakingPayload);
    expect(audit.isValid).toBe(false);
    expect(audit.leakedSensitiveFields).toContain("root.account.password_hash");
    expect(audit.leakedSensitiveFields).toContain("root.mfa.authenticator_secret");
  });
});
