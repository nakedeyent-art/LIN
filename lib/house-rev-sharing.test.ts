import { describe, it, expect } from "vitest";
import {
  NCAA_HOUSE_ROSTER_CAPS,
  validateRosterCaps,
  evaluateTitleIxAndRevShareCap,
  generateAthleteStipendSchedule,
  type SportAllocationInput,
} from "./house-rev-sharing";

describe("Phase 4: Post-House v. NCAA Revenue-Sharing & Roster Cap Engine", () => {
  it("should have official House v. NCAA hard roster limits configured", () => {
    const football = NCAA_HOUSE_ROSTER_CAPS.find((s) => s.sportKey === "football")!;
    expect(football.hardRosterCap).toBe(105);

    const mBb = NCAA_HOUSE_ROSTER_CAPS.find((s) => s.sportKey === "m_basketball")!;
    expect(mBb.hardRosterCap).toBe(15);

    const baseball = NCAA_HOUSE_ROSTER_CAPS.find((s) => s.sportKey === "baseball")!;
    expect(baseball.hardRosterCap).toBe(34);

    const softball = NCAA_HOUSE_ROSTER_CAPS.find((s) => s.sportKey === "softball")!;
    expect(softball.hardRosterCap).toBe(25);
  });

  it("should detect when a sport exceeds the hard roster cap", () => {
    const allocations: SportAllocationInput[] = [
      { sportKey: "football", currentRosterCount: 112, allocatedRevShareDollars: 14000000 },
      { sportKey: "m_basketball", currentRosterCount: 15, allocatedRevShareDollars: 3000000 },
    ];

    const results = validateRosterCaps(allocations);
    expect(results[0].isExceeded).toBe(true);
    expect(results[0].availableSpots).toBe(0);

    expect(results[1].isExceeded).toBe(false);
    expect(results[1].availableSpots).toBe(0);
  });

  it("should calculate Title IX distribution ratio and alert on significant disparity", () => {
    const allocations: SportAllocationInput[] = [
      { sportKey: "football", currentRosterCount: 105, allocatedRevShareDollars: 15000000 },
      { sportKey: "m_basketball", currentRosterCount: 15, allocatedRevShareDollars: 3000000 },
      { sportKey: "w_basketball", currentRosterCount: 15, allocatedRevShareDollars: 1500000 },
      { sportKey: "w_volleyball", currentRosterCount: 18, allocatedRevShareDollars: 500000 },
    ];

    const audit = evaluateTitleIxAndRevShareCap(allocations, 22000000, 0.50);
    expect(audit.isOverCap).toBe(false);
    expect(audit.totalAllocatedDollars).toBe(20000000);
    expect(audit.capUtilizationPercent).toBe(90.9);
    expect(audit.menTotalRevShareDollars).toBe(18000000);
    expect(audit.womenTotalRevShareDollars).toBe(2000000);
    expect(audit.titleIxDisparityAlert).toBe(true);
    expect(audit.underrepresentedGender).toBe("women");
  });

  it("should flag when total allocation exceeds the $22M court ceiling", () => {
    const allocations: SportAllocationInput[] = [
      { sportKey: "football", currentRosterCount: 105, allocatedRevShareDollars: 18000000 },
      { sportKey: "m_basketball", currentRosterCount: 15, allocatedRevShareDollars: 5000000 },
    ];

    const audit = evaluateTitleIxAndRevShareCap(allocations, 22000000);
    expect(audit.isOverCap).toBe(true);
    expect(audit.notes[0]).toContain("Cap Exceeded");
  });

  it("should generate a 12-month stipend schedule summing exactly to annual total", () => {
    const schedule = generateAthleteStipendSchedule(
      "ath-001",
      "Xavier Ward",
      "football",
      120000,
      "monthly_12",
      "2026-08-01"
    );

    expect(schedule.installments.length).toBe(12);
    expect(schedule.monthlyDisbursementAmount).toBe(10000);

    const totalPaid = schedule.installments.reduce((acc, inst) => acc + inst.amountDollars, 0);
    expect(totalPaid).toBe(120000);
    expect(schedule.installments[0].disbursementDate).toBe("2026-08-01");
  });
});
