import { describe, expect, it } from "vitest";
import {
  calculateCollectiveHealth,
  detectPayForPlayRisks,
  generateAuditCertificate,
  type DisbursementGrant,
} from "./collective-audit";

describe("Booster Collective Governance & Genuine Deliverables Audit", () => {
  describe("Risk Detection & Pay-for-Play Screening", () => {
    it("flags high risk when pay-for-play keywords (e.g. per touchdown) are detected", () => {
      const grant: Partial<DisbursementGrant> = {
        grantTitle: "$500 bonus per touchdown scored against rivals",
        deliverableType: "Public Service Announcement (Video)",
        proofVerified: true,
        proofUrl: "https://proof.example.com/123",
        nonContingencyAttested: true,
      };

      const flags = detectPayForPlayRisks(grant);
      expect(flags.some((f) => f.code === "PAY_FOR_PLAY_DETECTED")).toBe(true);
      expect(flags.some((f) => f.level === "high")).toBe(true);
    });

    it("flags medium risk when deliverable proof documentation is missing", () => {
      const grant: Partial<DisbursementGrant> = {
        grantTitle: "Youth Clinic Guest Instruction",
        deliverableType: "Youth Clinic Coaching",
        proofVerified: false,
        proofUrl: undefined,
        nonContingencyAttested: true,
      };

      const flags = detectPayForPlayRisks(grant);
      expect(flags.some((f) => f.code === "MISSING_PROOF_DOCUMENTATION")).toBe(true);
    });

    it("flags excessive FMV discrepancy (>2.5x estimated value)", () => {
      const grant: Partial<DisbursementGrant> = {
        grantTitle: "Autograph signing session",
        deliverableType: "Signed Memorabilia & Autograph Session",
        disbursedAmount: 10000,
        fairMarketValueEstimate: 2000, // 5x discrepancy!
        proofVerified: true,
        proofUrl: "https://proof.example.com/autograph",
        nonContingencyAttested: true,
      };

      const flags = detectPayForPlayRisks(grant);
      expect(flags.some((f) => f.code === "EXCESSIVE_FMV_DISCREPANCY")).toBe(true);
    });

    it("passes with 0 risk flags when fully compliant with verified proof and attestation", () => {
      const grant: Partial<DisbursementGrant> = {
        grantTitle: "Boys & Girls Club Youth Keynote",
        deliverableType: "Community Event Keynote",
        disbursedAmount: 1500,
        fairMarketValueEstimate: 1500,
        proofVerified: true,
        proofUrl: "https://proof.example.com/event",
        nonContingencyAttested: true,
      };

      const flags = detectPayForPlayRisks(grant);
      expect(flags.length).toBe(0);
    });
  });

  describe("Collective Health Summary & Audit Readiness", () => {
    it("reports 100% and 'NCAA Audit-Ready' when all grants are compliant", () => {
      const grants: DisbursementGrant[] = [
        {
          id: "g1",
          athleteId: "a1",
          athleteName: "Marcus Johnson",
          sport: "Basketball",
          grantTitle: "Food Drive Ambassador",
          disbursedAmount: 2000,
          fairMarketValueEstimate: 2000,
          deliverableType: "Charity Appearance (In-Person)",
          proofUrl: "https://proof.com/1",
          proofVerified: true,
          nonContingencyAttested: true,
          auditStatus: "compliant",
          riskFlags: [],
        },
      ];

      const health = calculateCollectiveHealth(grants);
      expect(health.complianceScorePercent).toBe(100);
      expect(health.auditReadiness).toBe("NCAA Audit-Ready");
      expect(health.totalCapitalDisbursed).toBe(2000);
    });

    it("flags 'Non-Compliant Risk' when any grant is flagged", () => {
      const grants: DisbursementGrant[] = [
        {
          id: "g1",
          athleteId: "a1",
          athleteName: "Marcus Johnson",
          sport: "Basketball",
          grantTitle: "Unverified Appearance",
          disbursedAmount: 5000,
          fairMarketValueEstimate: 1000,
          deliverableType: "Youth Clinic Coaching",
          proofVerified: false,
          nonContingencyAttested: false,
          auditStatus: "flagged",
          riskFlags: [],
        },
      ];

      const health = calculateCollectiveHealth(grants);
      expect(health.auditReadiness).toBe("Non-Compliant Risk");
      expect(health.flaggedCount).toBe(1);
    });
  });

  describe("Audit Certificate Generator", () => {
    it("generates formatted certificate with audit stats and attestation", () => {
      const summary = {
        totalGrantsCount: 12,
        totalCapitalDisbursed: 45000,
        compliantCount: 12,
        flaggedCount: 0,
        actionRequiredCount: 0,
        complianceScorePercent: 100,
        auditReadiness: "NCAA Audit-Ready" as const,
      };

      const cert = generateAuditCertificate("Champions NIL Collective", summary);
      expect(cert).toContain("Champions NIL Collective");
      expect(cert).toContain("$45,000");
      expect(cert).toContain("NCAA AUDIT-READY");
      expect(cert).toContain("COMPLIANCE ATTESTATION");
    });
  });
});
