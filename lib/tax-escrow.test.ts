import { describe, expect, it } from "vitest";
import {
  calculateTaxWithholding,
  calculateNetTaxableNIL,
  generate1099NecSummary,
  getEstimatedStateTaxRate,
  type DeductibleExpense,
} from "./tax-escrow";

describe("Athlete Tax Withholding Escrow & 1099 Center", () => {
  describe("State Tax Rates", () => {
    it("recognizes no-income-tax states (TX, FL) as 0%", () => {
      expect(getEstimatedStateTaxRate("TX")).toBe(0.0);
      expect(getEstimatedStateTaxRate("FL")).toBe(0.0);
    });

    it("applies estimated state tax for states with state income tax (CA, NY)", () => {
      expect(getEstimatedStateTaxRate("CA")).toBe(0.06);
      expect(getEstimatedStateTaxRate("NY")).toBe(0.055);
    });
  });

  describe("calculateTaxWithholding", () => {
    it("computes FICA self-employment (15.3%), federal, and net payout on $10,000 deal", () => {
      const res = calculateTaxWithholding({
        stateCode: "FL", // 0% state tax
        grossCents: 1000000, // $10,000
      });

      expect(res.grossDollars).toBe(10000);
      expect(res.selfEmploymentTaxDollars).toBe(1530); // 15.3% of 10,000
      expect(res.estimatedFederalIncomeTaxDollars).toBe(1000); // 10%
      expect(res.estimatedStateTaxDollars).toBe(0);
      expect(res.recommendedReserveDollars).toBe(2530);
      expect(res.netPayoutDollars).toBe(7470);
    });

    it("includes state tax in California deals", () => {
      const res = calculateTaxWithholding({
        stateCode: "CA",
        grossCents: 1000000,
      });

      expect(res.estimatedStateTaxDollars).toBe(600); // 6%
      expect(res.recommendedReserveDollars).toBe(3130);
      expect(res.netPayoutDollars).toBe(6870);
    });

    it("handles zero or negative gross earnings gracefully", () => {
      const res = calculateTaxWithholding({
        stateCode: "TX",
        grossCents: 0,
      });

      expect(res.grossDollars).toBe(0);
      expect(res.recommendedReserveDollars).toBe(0);
      expect(res.netPayoutDollars).toBe(0);
    });
  });

  describe("Deductible Business Expenses (Schedule C)", () => {
    it("subtracts verified receipt expenses and estimates tax savings", () => {
      const expenses: DeductibleExpense[] = [
        {
          id: "exp-1",
          category: "agent_fee",
          description: "Marketing agent 15% commission",
          amountDollars: 1500,
          date: "2026-06-15",
          hasReceipt: true,
        },
        {
          id: "exp-2",
          category: "content_production",
          description: "Sony camera lens for brand shoots",
          amountDollars: 600,
          date: "2026-07-20",
          hasReceipt: true,
        },
        {
          id: "exp-3",
          category: "travel_lodging",
          description: "Unverified Uber ride",
          amountDollars: 45,
          date: "2026-08-01",
          hasReceipt: false, // Ignored without receipt
        },
      ];

      const res = calculateNetTaxableNIL(10000, expenses);
      expect(res.grossEarnings).toBe(10000);
      expect(res.totalDeductions).toBe(2100); // 1500 + 600
      expect(res.netScheduleCIncome).toBe(7900);
      expect(res.deductionSavingsDollars).toBe(Math.round(2100 * 0.28));
    });
  });

  describe("Form 1099-NEC Generation", () => {
    it("generates correct 1099-NEC annual summary boxes", () => {
      const form = generate1099NecSummary(
        2026,
        "Marcus Johnson",
        25000,
        6250,
        "GA",
        [
          {
            id: "e1",
            category: "training_facility",
            description: "Elite Training Gym Membership",
            amountDollars: 1200,
            date: "2026-02-01",
            hasReceipt: true,
          },
        ]
      );

      expect(form.taxYear).toBe(2026);
      expect(form.recipientName).toBe("Marcus Johnson");
      expect(form.box1NonemployeeCompensation).toBe(25000);
      expect(form.stateCode).toBe("GA");
      expect(form.totalDeductibleExpenses).toBe(1200);
      expect(form.netTaxableIncome).toBe(23800);
      expect(form.auditReadyPacketUrl).toContain("2026.pdf");
    });
  });
});
