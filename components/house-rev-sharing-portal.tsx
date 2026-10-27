"use client";

import { useState } from "react";
import {
  NCAA_HOUSE_ROSTER_CAPS,
  ANNUAL_REV_SHARE_CAP_2026,
  validateRosterCaps,
  evaluateTitleIxAndRevShareCap,
  generateAthleteStipendSchedule,
  type SportAllocationInput,
} from "@/lib/house-rev-sharing";

const INITIAL_ALLOCATIONS: SportAllocationInput[] = [
  { sportKey: "football", currentRosterCount: 105, allocatedRevShareDollars: 14000000 },
  { sportKey: "m_basketball", currentRosterCount: 15, allocatedRevShareDollars: 3000000 },
  { sportKey: "w_basketball", currentRosterCount: 15, allocatedRevShareDollars: 2500000 },
  { sportKey: "baseball", currentRosterCount: 34, allocatedRevShareDollars: 1000000 },
  { sportKey: "softball", currentRosterCount: 25, allocatedRevShareDollars: 750000 },
  { sportKey: "w_volleyball", currentRosterCount: 18, allocatedRevShareDollars: 750000 },
];

export function HouseRevSharingPortal() {
  const [allocations, setAllocations] = useState<SportAllocationInput[]>(INITIAL_ALLOCATIONS);
  const [sampleAthleteName, setSampleAthleteName] = useState<string>("Jaylen Carter");
  const [sampleSport, setSampleSport] = useState<string>("football");
  const [sampleAnnualStipend, setSampleAnnualStipend] = useState<number>(75000);
  const [disbursementFrequency, setDisbursementFrequency] = useState<"monthly_10" | "monthly_12">("monthly_12");
  const [downloadedSchedule, setDownloadedSchedule] = useState<boolean>(false);

  const rosterValidations = validateRosterCaps(allocations);
  const titleIxAudit = evaluateTitleIxAndRevShareCap(allocations, ANNUAL_REV_SHARE_CAP_2026);
  const stipendSchedule = generateAthleteStipendSchedule(
    "ath-preview",
    sampleAthleteName,
    sampleSport,
    sampleAnnualStipend,
    disbursementFrequency
  );

  const handleUpdateAllocation = (sportKey: string, field: "roster" | "dollars", val: number) => {
    setAllocations((prev) =>
      prev.map((item) => {
        if (item.sportKey !== sportKey) return item;
        return {
          ...item,
          currentRosterCount: field === "roster" ? val : item.currentRosterCount,
          allocatedRevShareDollars: field === "dollars" ? val : item.allocatedRevShareDollars,
        };
      })
    );
  };

  const handleExportSchedule = () => {
    const lines = [
      `INSTITUTIONAL REVENUE-SHARING STIPEND AGREEMENT (HOUSE V. NCAA SETTLEMENT)`,
      `Athlete: ${stipendSchedule.athleteName}`,
      `Sport: ${stipendSchedule.sportName}`,
      `Annual Stipend Amount: $${stipendSchedule.annualRevShareAmount.toLocaleString()}`,
      `Disbursement Schedule: ${stipendSchedule.disbursementFrequency === "monthly_12" ? "12 Monthly Payments" : "10 Academic Month Payments"}`,
      `Monthly Installment: $${stipendSchedule.monthlyDisbursementAmount.toLocaleString()}`,
      ``,
      `DISBURSEMENT SCHEDULE:`,
      ...stipendSchedule.installments.map(
        (inst) =>
          `Installment #${inst.installmentIndex} | Date: ${inst.disbursementDate} | Amount: $${inst.amountDollars.toLocaleString()} | Status: ${inst.status}`
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `House_NIL_Stipend_Schedule_${sampleAthleteName.replaceAll(" ", "_")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadedSchedule(true);
    setTimeout(() => setDownloadedSchedule(false), 3000);
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
            <span style={{ fontSize: 22 }}>⚖️</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Post-House v. NCAA Rev-Sharing & Roster Cap Hub</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: titleIxAudit.isOverCap ? "rgba(239, 68, 68, 0.12)" : "rgba(34, 197, 94, 0.12)",
                color: titleIxAudit.isOverCap ? "var(--danger, #ef4444)" : "var(--ok, #22c55e)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {titleIxAudit.isOverCap ? "OVER $22M COURT CAP" : "COMPLIANT WITH COURT CAP"}
            </span>
          </div>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Direct school-to-athlete revenue-sharing allocation, Title IX distribution audit, and hard scholarship roster cap tracker.
          </p>
        </div>

        <button
          type="button"
          className="btn small"
          onClick={handleExportSchedule}
          style={{ fontSize: 12 }}
        >
          {downloadedSchedule ? "✓ Stipend Agreement Exported!" : "📥 Export Athlete Stipend Agreement"}
        </button>
      </div>

      {/* Top Cap Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Annual Rev-Share Cap</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>${(ANNUAL_REV_SHARE_CAP_2026 / 1000000).toFixed(1)}M</div>
          <div className="muted" style={{ fontSize: 11 }}>Court-Approved Ceiling</div>
        </div>

        <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
          <div className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Allocated Pool</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
            ${(titleIxAudit.totalAllocatedDollars / 1000000).toFixed(2)}M
          </div>
          <div className="muted" style={{ fontSize: 11 }}>{titleIxAudit.capUtilizationPercent}% Cap Utilized</div>
        </div>

        <div style={{ background: "rgba(59, 130, 246, 0.08)", padding: 12, borderRadius: 6, border: "1px solid rgba(59, 130, 246, 0.25)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#3b82f6", fontWeight: 700 }}>Men&apos;s Sports Share</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: "#3b82f6" }}>
            ${(titleIxAudit.menTotalRevShareDollars / 1000000).toFixed(2)}M ({titleIxAudit.menSharePercent}%)
          </div>
          <div className="muted" style={{ fontSize: 11 }}>Football & Men&apos;s Olympic</div>
        </div>

        <div style={{ background: "rgba(236, 72, 153, 0.08)", padding: 12, borderRadius: 6, border: "1px solid rgba(236, 72, 153, 0.25)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#ec4899", fontWeight: 700 }}>Women&apos;s Sports Share</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: "#ec4899" }}>
            ${(titleIxAudit.womenTotalRevShareDollars / 1000000).toFixed(2)}M ({titleIxAudit.womenSharePercent}%)
          </div>
          <div className="muted" style={{ fontSize: 11 }}>Basketball, Volleyball, Softball</div>
        </div>
      </div>

      {/* Title IX Advisory Notification */}
      {titleIxAudit.notes.length > 0 && (
        <div
          style={{
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            background: "rgba(234, 179, 8, 0.08)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 700, color: "#eab308", marginBottom: 4 }}>📋 Compliance & Title IX Advisories:</div>
          <ul style={{ margin: "0 0 0 16px", padding: 0 }}>
            {titleIxAudit.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Roster Caps & Allocations Table */}
      <div style={{ background: "var(--panel-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)", marginBottom: 16 }}>
        <strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>
          Varsity Sport Roster Caps & Rev-Share Allocations
        </strong>
        <table style={{ width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Sport</th>
              <th style={{ textAlign: "center" }}>Current Roster</th>
              <th style={{ textAlign: "center" }}>Hard Roster Cap</th>
              <th style={{ textAlign: "center" }}>Status</th>
              <th style={{ textAlign: "right" }}>Rev-Share Allocation ($)</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((alloc) => {
              const capInfo = rosterValidations.find((r) => r.sportKey === alloc.sportKey)!;
              return (
                <tr key={alloc.sportKey}>
                  <td><strong>{capInfo.sportName}</strong></td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="number"
                      value={alloc.currentRosterCount}
                      onChange={(e) => handleUpdateAllocation(alloc.sportKey, "roster", Number(e.target.value) || 0)}
                      style={{ width: 60, textAlign: "center", padding: "2px 4px" }}
                    />
                  </td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{capInfo.maxCap}</td>
                  <td style={{ textAlign: "center" }}>
                    {capInfo.isExceeded ? (
                      <span style={{ color: "var(--danger, #ef4444)", fontWeight: 700 }}>
                        ⚠️ Over Cap by {alloc.currentRosterCount - capInfo.maxCap}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ok, #22c55e)" }}>
                        ✓ {capInfo.availableSpots} spots open
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <input
                      type="number"
                      step={50000}
                      value={alloc.allocatedRevShareDollars}
                      onChange={(e) => handleUpdateAllocation(alloc.sportKey, "dollars", Number(e.target.value) || 0)}
                      style={{ width: 120, textAlign: "right", padding: "2px 4px" }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Individual Athlete Stipend Disbursement Simulator */}
      <div style={{ background: "var(--panel-2)", padding: 14, borderRadius: 8, border: "1px solid var(--line)" }}>
        <strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
          Direct School-to-Athlete Monthly Stipend Agreement Generator
        </strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 12 }}>
          <label style={{ fontSize: 12 }}>
            Athlete Name
            <input
              type="text"
              value={sampleAthleteName}
              onChange={(e) => setSampleAthleteName(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            Sport
            <select
              value={sampleSport}
              onChange={(e) => setSampleSport(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
            >
              {NCAA_HOUSE_ROSTER_CAPS.map((s) => (
                <option key={s.sportKey} value={s.sportKey}>{s.sportName}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12 }}>
            Annual Rev-Share Stipend ($)
            <input
              type="number"
              step={5000}
              value={sampleAnnualStipend}
              onChange={(e) => setSampleAnnualStipend(Number(e.target.value) || 0)}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            Disbursement Cadence
            <select
              value={disbursementFrequency}
              onChange={(e) => setDisbursementFrequency(e.target.value as any)}
              style={{ width: "100%", marginTop: 4, padding: "4px 8px" }}
            >
              <option value="monthly_12">12 Months (Calendar Year)</option>
              <option value="monthly_10">10 Months (Academic Year)</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--panel)", borderRadius: 6, fontSize: 12 }}>
          <span>
            Monthly Direct Deposit: <strong>${stipendSchedule.monthlyDisbursementAmount.toLocaleString()} / month</strong>
          </span>
          <span className="muted">
            {stipendSchedule.installments.length} total installments starting August 1, 2026
          </span>
        </div>
      </div>
    </div>
  );
}
