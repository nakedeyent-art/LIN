export type ScanVerdict = "clean" | "pending" | "infected" | "scan_error";

export type DocumentCategoryType =
  | "eligibility"
  | "identity"
  | "tax"
  | "medical"
  | "travel"
  | "contracts"
  | "media_release"
  | "school_compliance"
  | "academic";

export interface QuarantinedDocumentRecord {
  id: string;
  title: string;
  category: DocumentCategoryType;
  versionNumber: number;
  sizeBytes: number;
  sha256Digest: string;
  scanStatus: ScanVerdict;
  clamAvSignature?: string;
  expiresOn?: string;
  isImmutableAgreement: boolean;
  sharedWithRoles: string[];
}

export interface DocumentSecurityAudit {
  documentId: string;
  downloadAllowed: boolean;
  previewAllowed: boolean;
  signingAllowed: boolean;
  blockReason?: string;
  expirationState: "valid" | "expiring_soon" | "expired" | "no_expiry";
  daysUntilExpiry: number | null;
  privacyScope: "family_strictly_private" | "consented_medical_academic" | "operational_shared";
}

export function evaluateDocumentSecurity(
  doc: QuarantinedDocumentRecord,
  referenceDate: Date = new Date("2026-11-01T12:00:00Z")
): DocumentSecurityAudit {
  // Fail-closed rule: only "clean" files can ever be downloaded, previewed, or signed
  const isClean = doc.scanStatus === "clean";
  let blockReason: string | undefined;

  if (doc.scanStatus === "pending") {
    blockReason =
      "Quarantined: Awaiting asynchronous ClamAV INSTREAM malware scan verdict (fail-closed).";
  } else if (doc.scanStatus === "infected") {
    blockReason = `Blocked permanently: ClamAV detected signature (${
      doc.clamAvSignature ?? "Heuristics.PDF.Exploit"
    }). Family notified.`;
  } else if (doc.scanStatus === "scan_error") {
    blockReason =
      "Fail-closed: Malware scanner unreachable or timed out; file access denied until clean scan completes.";
  }

  let expirationState: DocumentSecurityAudit["expirationState"] = "no_expiry";
  let daysUntilExpiry: number | null = null;

  if (doc.expiresOn) {
    const exp = new Date(doc.expiresOn);
    daysUntilExpiry = Math.ceil((exp.getTime() - referenceDate.getTime()) / 86_400_000);
    if (daysUntilExpiry < 0) {
      expirationState = "expired";
    } else if (daysUntilExpiry <= 30) {
      expirationState = "expiring_soon";
    } else {
      expirationState = "valid";
    }
  }

  const privacyScope: DocumentSecurityAudit["privacyScope"] =
    doc.category === "identity" || doc.category === "tax"
      ? "family_strictly_private"
      : doc.category === "medical" || doc.category === "academic"
      ? "consented_medical_academic"
      : "operational_shared";

  return {
    documentId: doc.id,
    downloadAllowed: isClean,
    previewAllowed: isClean,
    signingAllowed: isClean && expirationState !== "expired",
    blockReason,
    expirationState,
    daysUntilExpiry,
    privacyScope,
  };
}

export const SAMPLE_QUARANTINE_DOCUMENTS: QuarantinedDocumentRecord[] = [
  {
    id: "doc-q1",
    title: "2026-2027 FHSAA EL2 Pre-Participation Physical Evaluation.pdf",
    category: "medical",
    versionNumber: 2,
    sizeBytes: 1_420_000,
    sha256Digest: "8f4b2e91c03a7d65e12b4908f17c3a92d4e6b801c239a745f618d209e3c4a112",
    scanStatus: "clean",
    expiresOn: "2026-11-19",
    isImmutableAgreement: false,
    sharedWithRoles: ["trainer", "coach"],
  },
  {
    id: "doc-q2",
    title: "IRS Form W-9 & Custodial UGMA Tin Verification.pdf",
    category: "tax",
    versionNumber: 1,
    sizeBytes: 640_000,
    sha256Digest: "3c91e7a4b520d81f6e39a012c47b8d90e1f2a3b4c5d6e7f8091a2b3c4d5e6f70",
    scanStatus: "clean",
    expiresOn: "2027-12-31",
    isImmutableAgreement: true,
    sharedWithRoles: [],
  },
  {
    id: "doc-q3",
    title: "Uploaded_Sponsor_Rider_Unverified_Macro.docx",
    category: "contracts",
    versionNumber: 1,
    sizeBytes: 890_000,
    sha256Digest: "deadbeef00112233445566778899aabbccddeeff00112233445566778899aabb",
    scanStatus: "pending",
    expiresOn: "2027-03-01",
    isImmutableAgreement: false,
    sharedWithRoles: [],
  },
];
