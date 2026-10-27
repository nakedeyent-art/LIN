/**
 * Athlete Tax Withholding Escrow & 1099-NEC Compliance Engine
 * Calculates self-employment taxes (FICA 15.3%), federal & state tax reserves,
 * deductible athlete business expenses, and generates 1099-NEC tax packets.
 */

export type TaxWithholdingConfig = {
  stateCode: string;
  grossCents: number;
  withholdingRatePercent?: number; // default recommended 28%
};

export type TaxWithholdingBreakdown = {
  grossDollars: number;
  selfEmploymentTaxDollars: number; // 15.3% FICA
  estimatedFederalIncomeTaxDollars: number; // ~10-12%
  estimatedStateTaxDollars: number; // 0% in TX/FL, ~3-7% other
  recommendedReserveDollars: number;
  recommendedReservePercent: number;
  netPayoutDollars: number;
  quarterlyEstimatedFilingDates: string[];
};

export type DeductibleExpense = {
  id: string;
  category: "agent_fee" | "athletic_gear" | "content_production" | "travel_lodging" | "training_facility";
  description: string;
  amountDollars: number;
  date: string;
  hasReceipt: boolean;
};

export type Form1099NecSummary = {
  taxYear: number;
  recipientName: string;
  recipientTIN: string; // masked
  box1NonemployeeCompensation: number;
  box4FederalTaxWithheld: number;
  box5StateTaxWithheld: number;
  stateCode: string;
  totalDeductibleExpenses: number;
  netTaxableIncome: number;
  auditReadyPacketUrl?: string;
};

const NO_INCOME_TAX_STATES = new Set(["TX", "FL", "NV", "TN", "WA", "WY", "SD", "AK", "NH"]);

export function getEstimatedStateTaxRate(stateCode: string): number {
  const code = (stateCode || "").trim().toUpperCase();
  if (NO_INCOME_TAX_STATES.has(code)) return 0.0;
  if (code === "CA") return 0.06;
  if (code === "NY") return 0.055;
  if (code === "NJ") return 0.05;
  return 0.04; // standard national state average
}

export function calculateTaxWithholding(config: TaxWithholdingConfig): TaxWithholdingBreakdown {
  const grossDollars = Math.round(config.grossCents / 100);
  if (grossDollars <= 0) {
    return {
      grossDollars: 0,
      selfEmploymentTaxDollars: 0,
      estimatedFederalIncomeTaxDollars: 0,
      estimatedStateTaxDollars: 0,
      recommendedReserveDollars: 0,
      recommendedReservePercent: 28,
      netPayoutDollars: 0,
      quarterlyEstimatedFilingDates: ["Apr 15", "Jun 15", "Sep 15", "Jan 15"],
    };
  }

  // 15.3% Self-Employment Tax (Social Security 12.4% + Medicare 2.9%)
  const seTax = Math.round(grossDollars * 0.153);

  // Federal income tax estimate (approx 10-12% effective for standard NIL brackets)
  const federalTax = Math.round(grossDollars * 0.10);

  // State income tax estimate
  const stateRate = getEstimatedStateTaxRate(config.stateCode);
  const stateTax = Math.round(grossDollars * stateRate);

  const defaultTotalReserve = seTax + federalTax + stateTax;
  const recommendedReserveDollars = config.withholdingRatePercent !== undefined
    ? Math.round(grossDollars * (config.withholdingRatePercent / 100))
    : defaultTotalReserve;
  const recommendedReservePercent = Math.round((recommendedReserveDollars / grossDollars) * 100);
  const netPayoutDollars = Math.max(0, grossDollars - recommendedReserveDollars);

  return {
    grossDollars,
    selfEmploymentTaxDollars: seTax,
    estimatedFederalIncomeTaxDollars: federalTax,
    estimatedStateTaxDollars: stateTax,
    recommendedReserveDollars,
    recommendedReservePercent,
    netPayoutDollars,
    quarterlyEstimatedFilingDates: ["Apr 15", "Jun 15", "Sep 15", "Jan 15"],
  };
}

export function calculateNetTaxableNIL(
  grossEarningsDollars: number,
  expenses: DeductibleExpense[]
): {
  grossEarnings: number;
  totalDeductions: number;
  netScheduleCIncome: number;
  deductionSavingsDollars: number;
} {
  const totalDeductions = expenses
    .filter((e) => e.hasReceipt)
    .reduce((sum, e) => sum + e.amountDollars, 0);

  const netScheduleCIncome = Math.max(0, grossEarningsDollars - totalDeductions);
  // Estimated tax savings at ~28% self-employment + federal bracket
  const deductionSavingsDollars = Math.round(totalDeductions * 0.28);

  return {
    grossEarnings: grossEarningsDollars,
    totalDeductions,
    netScheduleCIncome,
    deductionSavingsDollars,
  };
}

export function generate1099NecSummary(
  taxYear: number,
  recipientName: string,
  grossEarningsDollars: number,
  withheldTaxesDollars: number,
  stateCode: string,
  expenses: DeductibleExpense[] = []
): Form1099NecSummary {
  const { totalDeductions, netScheduleCIncome } = calculateNetTaxableNIL(grossEarningsDollars, expenses);
  const stateTaxRate = getEstimatedStateTaxRate(stateCode);
  const stateWithheld = Math.round(withheldTaxesDollars * (stateTaxRate > 0 ? 0.25 : 0));
  const federalWithheld = Math.max(0, withheldTaxesDollars - stateWithheld);

  return {
    taxYear,
    recipientName,
    recipientTIN: "XXX-XX-1099",
    box1NonemployeeCompensation: grossEarningsDollars,
    box4FederalTaxWithheld: federalWithheld,
    box5StateTaxWithheld: stateWithheld,
    stateCode: stateCode.toUpperCase(),
    totalDeductibleExpenses: totalDeductions,
    netTaxableIncome: netScheduleCIncome,
    auditReadyPacketUrl: `/dashboard/compliance/tax-packet-${taxYear}.pdf`,
  };
}
