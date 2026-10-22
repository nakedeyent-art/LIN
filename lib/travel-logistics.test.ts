import { describe, expect, it } from "vitest";
import {
  assignRoommates,
  calculatePerDiemTotals,
  checkChaperoneCompliance,
  type Chaperone,
  type PerDiemRecord,
} from "./travel-logistics";

describe("Team & Athlete Travel Logistics", () => {
  describe("Roommate Allocation Engine", () => {
    it("assigns athletes evenly across rooms based on capacity", () => {
      const athletes = ["Marcus Johnson", "Jordan Bell", "Tyrese Maxey", "Jalen Green", "Cam Whitmore"];
      const rooms = assignRoommates(athletes, 2, 301);

      // 5 athletes with 2 per room = 3 rooms
      expect(rooms.length).toBe(3);
      expect(rooms[0].roomNumber).toBe("301");
      expect(rooms[0].occupants).toEqual(["Marcus Johnson", "Jordan Bell"]);
      expect(rooms[1].roomNumber).toBe("302");
      expect(rooms[1].occupants).toEqual(["Tyrese Maxey", "Jalen Green"]);
      expect(rooms[2].roomNumber).toBe("303");
      expect(rooms[2].occupants).toEqual(["Cam Whitmore"]);
    });

    it("handles empty roster gracefully", () => {
      const rooms = assignRoommates([], 2);
      expect(rooms.length).toBe(0);
    });
  });

  describe("Per Diem & Meal Stipends", () => {
    it("computes total team budget, disbursement, and reconciliation rate", () => {
      const records: PerDiemRecord[] = [
        {
          athleteId: "a1",
          athleteName: "Marcus Johnson",
          dailyRate: 50,
          days: 3,
          totalBudget: 150,
          amountDisbursed: 150,
          receiptsCount: 3,
          status: "reconciled",
        },
        {
          athleteId: "a2",
          athleteName: "Jordan Bell",
          dailyRate: 50,
          days: 3,
          totalBudget: 150,
          amountDisbursed: 150,
          receiptsCount: 1,
          status: "disbursed",
        },
      ];

      const totals = calculatePerDiemTotals(records);
      expect(totals.totalBudget).toBe(300);
      expect(totals.totalDisbursed).toBe(300);
      // 1 of 2 reconciled = 50%
      expect(totals.reconciliationRate).toBe(50);
    });
  });

  describe("Parent Chaperone Safety Compliance", () => {
    it("flags non-compliant when a chaperone lacks background check verification", () => {
      const chaperones: Chaperone[] = [
        {
          id: "c1",
          fullName: "David Johnson",
          phone: "555-0199",
          email: "david@example.com",
          relationship: "Parent of Marcus Johnson",
          backgroundChecked: true,
          assignedAthletes: ["Marcus Johnson", "Jordan Bell"],
          checkedIn: true,
        },
        {
          id: "c2",
          fullName: "Sarah Bell",
          phone: "555-0288",
          email: "sarah@example.com",
          relationship: "Parent of Jordan Bell",
          backgroundChecked: false, // unverified!
          assignedAthletes: ["Tyrese Maxey"],
          checkedIn: true,
        },
      ];

      const res = checkChaperoneCompliance(chaperones);
      expect(res.compliant).toBe(false);
      expect(res.unverifiedCount).toBe(1);
      expect(res.checkedInCount).toBe(2);
    });

    it("confirms compliant when all chaperones are verified and checked in", () => {
      const chaperones: Chaperone[] = [
        {
          id: "c1",
          fullName: "David Johnson",
          phone: "555-0199",
          email: "david@example.com",
          relationship: "Parent of Marcus Johnson",
          backgroundChecked: true,
          assignedAthletes: ["Marcus Johnson"],
          checkedIn: true,
        },
      ];

      const res = checkChaperoneCompliance(chaperones);
      expect(res.compliant).toBe(true);
      expect(res.unverifiedCount).toBe(0);
    });
  });
});
