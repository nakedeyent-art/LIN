import { describe, expect, it } from "vitest";
import {
  evaluateDocumentSecurity,
  type QuarantinedDocumentRecord,
} from "./document-quarantine-audit";

describe("Document Quarantine, ClamAV Fail-Closed & Privacy Scope Engine", () => {
  const cleanTaxDoc: QuarantinedDocumentRecord = {
    id: "doc-1",
    title: "IRS W-9 Signed.pdf",
    category: "tax",
    versionNumber: 1,
    sizeBytes: 512000,
    sha256Digest: "abc1234567890",
    scanStatus: "clean",
    expiresOn: "2027-12-31",
    isImmutableAgreement: true,
    sharedWithRoles: [],
  };

  it("permits download/preview for clean documents and enforces family_strictly_private on tax/identity", () => {
    const res = evaluateDocumentSecurity(cleanTaxDoc, new Date("2026-11-01T12:00:00Z"));
    expect(res.downloadAllowed).toBe(true);
    expect(res.previewAllowed).toBe(true);
    expect(res.signingAllowed).toBe(true);
    expect(res.privacyScope).toBe("family_strictly_private");
  });

  it("fails closed when ClamAV scan is pending, infected, or scan_error", () => {
    const pendingRes = evaluateDocumentSecurity({ ...cleanTaxDoc, scanStatus: "pending" });
    expect(pendingRes.downloadAllowed).toBe(false);
    expect(pendingRes.previewAllowed).toBe(false);
    expect(pendingRes.signingAllowed).toBe(false);
    expect(pendingRes.blockReason).toContain("Quarantined");

    const infectedRes = evaluateDocumentSecurity({
      ...cleanTaxDoc,
      scanStatus: "infected",
      clamAvSignature: "Doc.Dropper.Macro-991",
    });
    expect(infectedRes.downloadAllowed).toBe(false);
    expect(infectedRes.blockReason).toContain("Doc.Dropper.Macro-991");
  });

  it("flags documents expiring within 30 days as expiring_soon and blocks signing on expired records", () => {
    const soonRes = evaluateDocumentSecurity(
      { ...cleanTaxDoc, category: "medical", expiresOn: "2026-11-15" },
      new Date("2026-11-01T12:00:00Z")
    );
    expect(soonRes.expirationState).toBe("expiring_soon");
    expect(soonRes.daysUntilExpiry).toBe(14);

    const expiredRes = evaluateDocumentSecurity(
      { ...cleanTaxDoc, category: "contracts", expiresOn: "2026-10-15" },
      new Date("2026-11-01T12:00:00Z")
    );
    expect(expiredRes.expirationState).toBe("expired");
    expect(expiredRes.signingAllowed).toBe(false);
  });
});
