import { scanFtcCompliance, type FtcScanResult } from "./social-ftc-scanner";

export type DeliverableProofType = "social_post_url" | "screenshot_image" | "attendance_signoff" | "video_clip";

export interface DeliverableProofInput {
  itemId: string;
  itemTitle: string;
  proofType: DeliverableProofType;
  proofUrlOrPath: string;
  postCaptionText?: string;
  sponsorBrand: string;
  submittedAt: string;
}

export interface DeliverableVerificationReport {
  itemId: string;
  itemTitle: string;
  verified: boolean;
  ftcScan?: FtcScanResult;
  status: "PROOF_VERIFIED_FTC_COMPLIANT" | "FTC_WARNING_REVISION_RECOMMENDED" | "PENDING_BUYER_APPROVAL";
  summary: string;
}

export interface EscrowReleaseSummary {
  dealId: string;
  dealTitle: string;
  totalWorkItemsCount: number;
  acceptedWorkItemsCount: number;
  allDeliverablesAccepted: boolean;
  canReleasePayment: boolean;
  grossAmountDollars: number;
  platformFeeDollars: number;
  estimatedTaxReserveDollars: number; // 15.3% self-employment safe harbor
  netPayeePayoutDollars: number;
  disbursementTarget: "ATHLETE_INDIVIDUAL" | "GUARDIAN_CUSTODIAL_UGMA";
  releaseState: "READY_FOR_RELEASE" | "AWAITING_DELIVERABLES" | "DISBURSED";
  blockReason?: string;
}

export function evaluateDeliverableSubmission(input: DeliverableProofInput): DeliverableVerificationReport {
  let ftcScan: FtcScanResult | undefined;

  if (input.postCaptionText && input.postCaptionText.trim().length > 0) {
    ftcScan = scanFtcCompliance(input.postCaptionText, input.sponsorBrand);
  }

  const isFtcCompliant = !ftcScan || ftcScan.status === "COMPLIANT";

  let status: DeliverableVerificationReport["status"] = "PENDING_BUYER_APPROVAL";
  let summary = "Deliverable proof submitted. Awaiting counterparty review.";

  if (ftcScan) {
    if (ftcScan.status === "COMPLIANT") {
      status = "PROOF_VERIFIED_FTC_COMPLIANT";
      summary = "FTC Safe-Harbor Passed: Conspicuous commercial disclosure (#ad) verified.";
    } else {
      status = "FTC_WARNING_REVISION_RECOMMENDED";
      summary = `FTC Warning: Post caption scored ${ftcScan.score}/100. Commercial endorsement disclosure may be missing or ambiguous.`;
    }
  }

  return {
    itemId: input.itemId,
    itemTitle: input.itemTitle,
    verified: isFtcCompliant,
    ftcScan,
    status,
    summary,
  };
}

export function evaluateEscrowReleaseEligibility(params: {
  dealId: string;
  dealTitle: string;
  dealAmountDollars: number;
  isMinorAthlete: boolean;
  workItems: Array<{ id: string; status: "pending" | "submitted" | "accepted" | "changes_requested" }>;
  escrowFunded: boolean;
  alreadyDisbursed?: boolean;
}): EscrowReleaseSummary {
  const { dealId, dealTitle, dealAmountDollars, isMinorAthlete, workItems, escrowFunded, alreadyDisbursed } = params;

  const totalCount = workItems.length;
  const acceptedCount = workItems.filter((w) => w.status === "accepted").length;
  const allAccepted = totalCount > 0 && acceptedCount === totalCount;

  const platformFee = Math.round(dealAmountDollars * 0.05 * 100) / 100; // 5% fee
  const estimatedTaxReserve = Math.round(dealAmountDollars * 0.153 * 100) / 100; // 15.3% FICA
  const netPayout = Math.round((dealAmountDollars - platformFee) * 100) / 100;

  const disbursementTarget = isMinorAthlete ? "GUARDIAN_CUSTODIAL_UGMA" : "ATHLETE_INDIVIDUAL";

  if (alreadyDisbursed) {
    return {
      dealId,
      dealTitle,
      totalWorkItemsCount: totalCount,
      acceptedWorkItemsCount: acceptedCount,
      allDeliverablesAccepted: true,
      canReleasePayment: false,
      grossAmountDollars: dealAmountDollars,
      platformFeeDollars: platformFee,
      estimatedTaxReserveDollars: estimatedTaxReserve,
      netPayeePayoutDollars: netPayout,
      disbursementTarget,
      releaseState: "DISBURSED",
      blockReason: "Funds already disbursed.",
    };
  }

  if (!escrowFunded) {
    return {
      dealId,
      dealTitle,
      totalWorkItemsCount: totalCount,
      acceptedWorkItemsCount: acceptedCount,
      allDeliverablesAccepted: allAccepted,
      canReleasePayment: false,
      grossAmountDollars: dealAmountDollars,
      platformFeeDollars: platformFee,
      estimatedTaxReserveDollars: estimatedTaxReserve,
      netPayeePayoutDollars: netPayout,
      disbursementTarget,
      releaseState: "AWAITING_DELIVERABLES",
      blockReason: "Escrow funds have not been deposited by the sponsor.",
    };
  }

  if (!allAccepted) {
    return {
      dealId,
      dealTitle,
      totalWorkItemsCount: totalCount,
      acceptedWorkItemsCount: acceptedCount,
      allDeliverablesAccepted: false,
      canReleasePayment: false,
      grossAmountDollars: dealAmountDollars,
      platformFeeDollars: platformFee,
      estimatedTaxReserveDollars: estimatedTaxReserve,
      netPayeePayoutDollars: netPayout,
      disbursementTarget,
      releaseState: "AWAITING_DELIVERABLES",
      blockReason: `${totalCount - acceptedCount} of ${totalCount} deliverable items pending completion/approval.`,
    };
  }

  return {
    dealId,
    dealTitle,
    totalWorkItemsCount: totalCount,
    acceptedWorkItemsCount: acceptedCount,
    allDeliverablesAccepted: true,
    canReleasePayment: true,
    grossAmountDollars: dealAmountDollars,
    platformFeeDollars: platformFee,
    estimatedTaxReserveDollars: estimatedTaxReserve,
    netPayeePayoutDollars: netPayout,
    disbursementTarget,
    releaseState: "READY_FOR_RELEASE",
  };
}
