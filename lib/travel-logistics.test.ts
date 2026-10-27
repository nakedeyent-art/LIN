import { describe, expect, it } from "vitest";
import {
  assignRoommates,
  calculatePerDiemTotals,
  checkChaperoneCompliance,
  generateTravelCalendarIcs,
  generateItinerarySummaryText,
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

  describe("Itinerary & Calendar Exports", () => {
    const sampleTrip = {
      tripId: "trip-99",
      tripName: "National Showcase Tour",
      destination: "Atlanta, GA",
      startDate: "2026-11-10",
      endDate: "2026-11-13",
      flights: [
        {
          id: "f1",
          airline: "Delta Air Lines",
          flightNumber: "DL 1482",
          departureAirport: "JFK",
          arrivalAirport: "ATL",
          departureTime: "2026-11-10T08:00:00Z",
          arrivalTime: "2026-11-10T10:45:00Z",
          confirmationCode: "DL-982X1A",
          terminal: "4",
          gate: "B22",
        },
      ],
      hotelBlock: {
        hotelName: "Omni Atlanta Hotel",
        address: "100 CNN Center NW, Atlanta, GA",
        phone: "(404) 659-0000",
        checkInDate: "2026-11-10",
        checkOutDate: "2026-11-13",
        confirmationNumber: "HTL-OMNI-774",
        rooms: [
          {
            roomNumber: "201",
            roomType: "Double Queen" as const,
            occupants: ["Marcus Johnson", "Jordan Bell"],
            capacity: 2,
          },
        ],
      },
      chaperones: [
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
      ],
      perDiems: [],
    };

    it("generates valid RFC 5545 iCalendar content", () => {
      const ics = generateTravelCalendarIcs(sampleTrip);
      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("VERSION:2.0");
      expect(ics).toContain("SUMMARY:Delta Air Lines DL 1482: JFK → ATL");
      expect(ics).toContain("LOCATION:JFK Airport");
      expect(ics).toContain("SUMMARY:Hotel Check-In: Omni Atlanta Hotel");
      expect(ics).toContain("END:VCALENDAR");
    });

    it("generates clean formatted text itinerary for printable travel packets", () => {
      const text = generateItinerarySummaryText(sampleTrip);
      expect(text).toContain("TEAM TRAVEL ITINERARY: NATIONAL SHOWCASE TOUR");
      expect(text).toContain("Delta Air Lines DL 1482 (JFK → ATL)");
      expect(text).toContain("Hotel: Omni Atlanta Hotel");
      expect(text).toContain("Room 201 (Double Queen): Marcus Johnson, Jordan Bell");
      expect(text).toContain("David Johnson (Parent of Marcus Johnson)");
    });
  });
});

