"use client";

import { useState } from "react";
import {
  calculateTaxWithholding,
  calculateNetTaxableNIL,
  generate1099NecSummary,
  type DeductibleExpense,
} from "@/lib/tax-escrow";

const SAMPLE_EXPENSES: DeductibleExpense[] = [
  {
    id: "exp-1",
    category: "agent_fee",
    description: "Marketing representation fee (15%)",
    amountDollars: 1500,
    date: "2026-06-15",
    hasReceipt: true,
  },
  {
    id: "exp-2",
    category: "content_production",
    description: "4K camera & microphone for sponsored videos",
    amountDollars: 750,
    date: "2026-07-20",
    hasReceipt: true,
  },
  {
    id: "exp-3",
    category: "travel_lodging",
    description: "Commercial shoot flights & hotel",
    amountDollars: 840,
    date: "2026-08-10",
    hasReceipt: true,
  },
];

export function TaxEscrowCenter({
  initialEarningsDollars = 25000,
  athleteName = "Student-Athlete",
  athleteState = "FL",
}: {
  initialEarningsDollars?: number;
  athleteName?: string;
  athleteState?: string;
}) {
  const [dealAmount, setDealAmount] = useState<number>(initialEarningsDollars);
  const [stateCode, setStateCode] = useState<string>(athleteState);
  const [autoEscrowEnabled, setAutoEscrowEnabled] = useState<boolean>(true);
  const [expenses, setExpenses] = useState<DeductibleExpense[]>(SAMPLE_EXPENSES);
  const [downloadedPacket, setDownloadedPacket] = useState<boolean>(false);

  const withholding = calculateTaxWithholding({
    stateCode,
    grossCents: dealAmount * 100,
  });

  const deductions = calculateNetTaxableNIL(dealAmount, expenses);
  const form1099 = generate1099NecSummary(
    2026,
    athleteName,
    dealAmount,
    withholding.recommendedReserveDollars,
    stateCode,
    expenses
  );

  const handleDownloadPacket = () => {
    const content = `
=====================================================
FORM 1099-NEC & ATHLETE TAX SUMMARY (TAX YEAR 2026)
Prepared for: ${form1099.recipientName}
TIN: ${form1099.recipientTIN} | State: ${form1099.stateCode}
=====================================================

BOX 1: Nonemployee Compensation (Gross NIL): $${form1099.box1NonemployeeCompensation.toLocaleString()}
BOX 4: Federal Income Tax Reserve: $${form1099.box4FederalTaxWithheld.toLocaleString()}
BOX 5: State Tax Reserve: $${form1099.box5StateTaxWithheld.toLocaleString()}

SCHEDULE C DEDUCTIBLE EXPENSES:
${expenses.map((e) => `  - [${e.category}] ${e.description}: $${e.amountDollars} (Receipt: ${e.hasReceipt ? "VERIFIED" : "MISSING"})`).join("\n")}

TOTAL DEDUCTIBLE EXPENSES: $${deductions.totalDeductions.toLocaleString()}
NET TAXABLE SCHEDULE C INCOME: $${deductions.netScheduleCIncome.toLocaleString()}
ESTIMATED TAX SAVINGS FROM DEDUCTIONS: $${deductions.deductionSavingsDollars.toLocaleString()}

QUARTERLY ESTIMATED PAYMENT SCHEDULE:
  - Q1: April 15
  - Q2: June 15
  - Q3: September 15
  - Q4: January 15
=====================================================
    `.trim();

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `1099_NEC_Tax_Packet_${form1099.taxYear}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadedPacket(true);
    setTimeout(() => setDownloadedPacket(false), 3000);
  };

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 20,
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>💰</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Athlete Tax Withholding Escrow & 1099 Center</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: "rgba(34, 197, 94, 0.12)",
                color: "var(--ok, #22c55e)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(34, 197, 94, 0.3)",
              }}
            >
              Self-Employment FICA Safe-Harbor
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Automated tax reserve withholding on Stripe payouts, Schedule C deduction tracking, and annual 1099-NEC reporting.
          </p>
        </div>

        <button
          type="button"
          className="btn small"
          onClick={handleDownloadPacket}
          style={{ fontSize: 12 }}
        >
          {downloadedPacket ? "✓ 1099 Packet Exported!" : "📥 Export 1099-NEC Tax Packet"}
        </button>
      </div>

      {/* Simulator Inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 12 }}>
          Annual NIL Earnings ($)
          <input
            type="number"
            min={0}
            step={500}
            value={dealAmount}
            onChange={(e) => setDealAmount(Number(e.target.value) || 0)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          />
        </label>

        <label style={{ fontSize: 12 }}>
          Athlete Tax Residency State
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: "6px 8px" }}
          >
            <option value="FL">Florida (0% State Tax)</option>
            <option value="TX">Texas (0% State Tax)</option>
            <option value="CA">California (6% Est. State Tax)</option>
            <option value="NY">New York (5.5% Est. State Tax)</option>
            <option value="GA">Georgia (4% Est. State Tax)</option>
            <option value="IL">Illinois (4.95% Est. State Tax)</option>
            <option value="OH">Ohio (4% Est. State Tax)</option>
          </select>
        </label>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", marginTop: 16 }}>
            <input
              type="checkbox"
              checked={autoEscrowEnabled}
              onChange={(e) => setAutoEscrowEnabled(e.target.checked)}
            />
            <strong>Auto-Reserve Escrow Pocket ({withholding.recommendedReservePercent}%)</strong>
          </label>
        </div>
      </div>

      {/* Tax Breakdown Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Gross Earnings</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>${withholding.grossDollars.toLocaleString()}</div>
          <div className="muted" style={{ fontSize: 11 }}>100% Topline Compensation</div>
        </div>

        <div style={{ background: "rgba(239, 68, 68, 0.08)", padding: 12, borderRadius: 6, border: "1px solid rgba(239, 68, 68, 0.25)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--danger, #ef4444)", fontWeight: 700 }}>FICA Self-Employment</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: "var(--danger, #ef4444)" }}>
            -${withholding.selfEmploymentTaxDollars.toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>15.3% Social Security & Medicare</div>
        </div>

        <div style={{ background: "rgba(234, 179, 8, 0.08)", padding: 12, borderRadius: 6, border: "1px solid rgba(234, 179, 8, 0.25)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#eab308", fontWeight: 700 }}>Federal & State Reserve</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: "#eab308" }}>
            -${(withholding.estimatedFederalIncomeTaxDollars + withholding.estimatedStateTaxDollars).toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>
            Federal: ${withholding.estimatedFederalIncomeTaxDollars} | State: ${withholding.estimatedStateTaxDollars}
          </div>
        </div>

        <div style={{ background: "rgba(34, 197, 94, 0.08)", padding: 12, borderRadius: 6, border: "1px solid rgba(34, 197, 94, 0.25)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--ok, #22c55e)", fontWeight: 700 }}>Net Take-Home</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: "var(--ok, #22c55e)" }}>
            ${withholding.netPayoutDollars.toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 11 }}>After safe-harbor withholding</div>
        </div>
      </div>

      {/* Deductible Schedule C Expenses */}
      <div style={{ background: "var(--panel-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 13 }}>Schedule C Deductible Business Expenses ({expenses.length} Logged)</strong>
          <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>
            Tax Savings: ~${deductions.deductionSavingsDollars.toLocaleString()}
          </span>
        </div>

        <table style={{ width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Category</th>
              <th style={{ textAlign: "left" }}>Description</th>
              <th style={{ textAlign: "left" }}>Date</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "center" }}>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td style={{ textTransform: "capitalize" }}>{e.category.replaceAll("_", " ")}</td>
                <td>{e.description}</td>
                <td className="muted">{e.date}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>${e.amountDollars}</td>
                <td style={{ textAlign: "center" }}>{e.hasReceipt ? "✓ Verified" : "⚠️ Missing"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
