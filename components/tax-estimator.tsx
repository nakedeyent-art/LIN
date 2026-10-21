"use client";

import { useState } from "react";
import { STATE_RATES, calculateTaxBreakdown } from "@/lib/nil-valuation";

export function TaxEstimator({ initialGross }: { initialGross?: number }) {
  const [grossInput, setGrossInput] = useState<string>(initialGross ? String(initialGross) : "10000");
  const [selectedStateCode, setSelectedStateCode] = useState<string>("FL");
  const [agencyFeePct, setAgencyFeePct] = useState<number>(15);

  const gross = Math.max(0, parseFloat(grossInput) || 0);
  const selectedState = STATE_RATES.find((s) => s.code === selectedStateCode) ?? STATE_RATES[0];

  const {
    agentFee,
    netBeforeTax,
    seTax,
    fedTax,
    stateTax,
    totalTaxes,
    netTakeHome,
    recommendedReservePct,
    quarterlyEstimatedTax,
  } = calculateTaxBreakdown(gross, selectedStateCode, agencyFeePct);


  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r)",
        padding: 22,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <span className="badge yellow">Financial Escrow & Tax Engine</span>
          <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "var(--text)" }}>
            NIL 1099 Self-Employment Tax & Take-Home Calculator
          </h3>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13, maxWidth: 440 }}>
          NIL deals are treated as 1099 Independent Contractor income. Athletes are responsible for self-employment tax.
        </p>
      </div>

      {/* Input Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 6 }}>
            Annual NIL Gross Earnings ($)
          </label>
          <input
            type="number"
            min="0"
            step="500"
            value={grossInput}
            onChange={(e) => setGrossInput(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
              color: "var(--text)",
              fontFamily: "var(--mono)",
              fontSize: 16,
              fontWeight: 700,
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 6 }}>
            Athlete Home State (Tax Rate)
          </label>
          <select
            value={selectedStateCode}
            onChange={(e) => setSelectedStateCode(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
              color: "var(--text)",
              fontSize: 14,
            }}
          >
            {STATE_RATES.map((st) => (
              <option key={st.code} value={st.code}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 650, marginBottom: 6 }}>
            Agent / Representation Fee
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 10, 15, 20].map((fee) => (
              <button
                key={fee}
                type="button"
                onClick={() => setAgencyFeePct(fee)}
                className={`btn small ${agencyFeePct === fee ? "" : "ghost"}`}
                style={{ flex: 1, padding: "8px 0" }}
              >
                {fee}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Matrix Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
          <span className="muted" style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700 }}>
            Gross NIL Contract
          </span>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--mono)", margin: "4px 0" }}>{fmt(gross)}</div>
          <span className="muted" style={{ fontSize: 12 }}>Pre-deduction earnings</span>
        </div>

        <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
          <span className="muted" style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700 }}>
            Agent Fee ({agencyFeePct}%)
          </span>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--mono)", color: "#b91c1c", margin: "4px 0" }}>
            -{fmt(agentFee)}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>Representation deduction</span>
        </div>

        <div style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
          <span className="muted" style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700 }}>
            Estimated Tax Reserve
          </span>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--mono)", color: "#c2410c", margin: "4px 0" }}>
            -{fmt(totalTaxes)}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>~{recommendedReservePct}% holdback recommended</span>
        </div>

        <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary)", borderRadius: 8, padding: 14 }}>
          <span style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--primary)" }}>
            Net Take-Home Pay
          </span>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--primary)", margin: "4px 0" }}>
            {fmt(netTakeHome)}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>Athlete net cash flow</span>
        </div>
      </div>

      {/* Tax Breakdown Table */}
      <div style={{ overflowX: "auto", marginBottom: 18 }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Tax Item</th>
              <th style={{ textAlign: "left" }}>Rate / Basis</th>
              <th style={{ textAlign: "right" }}>Estimated Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Self-Employment Tax (FICA)</td>
              <td className="muted">15.3% (Social Security 12.4% + Medicare 2.9%)</td>
              <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 650 }}>{fmt(seTax)}</td>
            </tr>
            <tr>
              <td>Federal Income Tax</td>
              <td className="muted">Effective bracket estimate after 1/2 SE deduction</td>
              <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 650 }}>{fmt(fedTax)}</td>
            </tr>
            <tr>
              <td>State Income Tax ({selectedState.code})</td>
              <td className="muted">{selectedState.name} ({Math.round(selectedState.rate * 100)}%)</td>
              <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 650 }}>{fmt(stateTax)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Quarterly Deadlines Callout */}
      <div style={{ background: "var(--warn-soft)", border: "1px solid #f1e2b6", borderRadius: 8, padding: 14 }}>
        <strong style={{ color: "#5c4306", fontSize: 14 }}>📅 IRS Safe Harbor Quarterly Payment Deadlines:</strong>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#5c4306" }}>
          If you expect to owe &gt; $1,000 in taxes, make estimated payments quarterly to avoid penalties:
          {" "}<strong>Q1: Apr 15</strong> · <strong>Q2: Jun 15</strong> · <strong>Q3: Sep 15</strong> · <strong>Q4: Jan 15</strong>.
        </p>
      </div>
    </div>
  );
}
