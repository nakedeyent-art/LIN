/**
 * Team & Athlete Travel Logistics Domain Engine
 * Handles flights, hotel room blocks, parent chaperone safety check-ins,
 * and per diem / meal stipend accounting for team road trips and showcase tournaments.
 */

export type FlightSegment = {
  id: string;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  confirmationCode: string;
  terminal?: string;
  gate?: string;
};

export type HotelRoom = {
  roomNumber: string;
  roomType: "Double Queen" | "King" | "Suite";
  occupants: string[];
  capacity: number;
};

export type HotelBlock = {
  hotelName: string;
  address: string;
  phone: string;
  checkInDate: string;
  checkOutDate: string;
  confirmationNumber: string;
  rooms: HotelRoom[];
};

export type Chaperone = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  relationship: string; // e.g. "Parent of Marcus Johnson"
  backgroundChecked: boolean;
  assignedAthletes: string[];
  checkedIn: boolean;
  lastCheckInTime?: string;
};

export type PerDiemRecord = {
  athleteId: string;
  athleteName: string;
  dailyRate: number; // e.g. 45 ($45/day)
  days: number;
  totalBudget: number;
  amountDisbursed: number;
  receiptsCount: number;
  status: "pending" | "disbursed" | "reconciled";
};

export type TripLogistics = {
  tripId: string;
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  flights: FlightSegment[];
  hotelBlock: HotelBlock;
  chaperones: Chaperone[];
  perDiems: PerDiemRecord[];
};

export function calculatePerDiemTotals(records: PerDiemRecord[]): {
  totalBudget: number;
  totalDisbursed: number;
  reconciliationRate: number; // percentage 0-100
} {
  const totalBudget = records.reduce((sum, r) => sum + r.dailyRate * r.days, 0);
  const totalDisbursed = records.reduce((sum, r) => sum + r.amountDisbursed, 0);
  const reconciledCount = records.filter((r) => r.status === "reconciled").length;
  const reconciliationRate = records.length > 0 ? Math.round((reconciledCount / records.length) * 100) : 100;

  return {
    totalBudget,
    totalDisbursed,
    reconciliationRate,
  };
}

export function assignRoommates(
  athleteNames: string[],
  roomCapacity: number = 2,
  startRoomNumber: number = 201
): HotelRoom[] {
  const rooms: HotelRoom[] = [];
  const totalRooms = Math.ceil(athleteNames.length / roomCapacity);

  for (let i = 0; i < totalRooms; i++) {
    const occupants = athleteNames.slice(i * roomCapacity, (i + 1) * roomCapacity);
    rooms.push({
      roomNumber: String(startRoomNumber + i),
      roomType: roomCapacity >= 2 ? "Double Queen" : "King",
      occupants,
      capacity: roomCapacity,
    });
  }

  return rooms;
}

export function checkChaperoneCompliance(chaperones: Chaperone[]): {
  compliant: boolean;
  totalChaperones: number;
  checkedInCount: number;
  unverifiedCount: number;
  unassignedAthletesAlert: boolean;
} {
  const totalChaperones = chaperones.length;
  const checkedInCount = chaperones.filter((c) => c.checkedIn).length;
  const unverifiedCount = chaperones.filter((c) => !c.backgroundChecked).length;
  const compliant = totalChaperones > 0 && unverifiedCount === 0 && checkedInCount === totalChaperones;

  return {
    compliant,
    totalChaperones,
    checkedInCount,
    unverifiedCount,
    unassignedAthletesAlert: chaperones.some((c) => c.assignedAthletes.length === 0),
  };
}

export function generateTravelCalendarIcs(trip: TripLogistics): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toIcsDate = (dateStr: string, fallbackOffsetHours = 0) => {
    const d = new Date(dateStr);
    const valid = !isNaN(d.getTime()) ? d : new Date(Date.now() + fallbackOffsetHours * 3600 * 1000);
    return `${valid.getUTCFullYear()}${pad(valid.getUTCMonth() + 1)}${pad(valid.getUTCDate())}T${pad(valid.getUTCHours())}${pad(valid.getUTCMinutes())}${pad(valid.getUTCSeconds())}Z`;
  };

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LIN NIL Travel Logistics Hub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${trip.tripName} Itinerary`,
  ];

  // Flight events
  trip.flights.forEach((f, idx) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:flight-${f.id || idx}-${trip.tripId}@lin-nil.com`);
    lines.push(`SUMMARY:${f.airline} ${f.flightNumber}: ${f.departureAirport} → ${f.arrivalAirport}`);
    lines.push(`LOCATION:${f.departureAirport} Airport`);
    lines.push(
      `DESCRIPTION:Confirmation: ${f.confirmationCode}\\nTerminal: ${f.terminal || "Main"}\\nGate: ${f.gate || "TBD"}`
    );
    lines.push(`DTSTART:${toIcsDate(f.departureTime, 0)}`);
    lines.push(`DTEND:${toIcsDate(f.arrivalTime, 3)}`);
    lines.push("END:VEVENT");
  });

  // Hotel block event
  if (trip.hotelBlock && trip.hotelBlock.hotelName) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:hotel-${trip.tripId}@lin-nil.com`);
    lines.push(`SUMMARY:Hotel Check-In: ${trip.hotelBlock.hotelName}`);
    lines.push(`LOCATION:${trip.hotelBlock.address}`);
    lines.push(
      `DESCRIPTION:Reservation: ${trip.hotelBlock.confirmationNumber}\\nPhone: ${trip.hotelBlock.phone}\\nRooms: ${trip.hotelBlock.rooms.length} blocks booked`
    );
    lines.push(`DTSTART:${toIcsDate(trip.hotelBlock.checkInDate, 15)}`);
    lines.push(`DTEND:${toIcsDate(trip.hotelBlock.checkOutDate, 39)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function generateItinerarySummaryText(trip: TripLogistics): string {
  const flightsText = trip.flights.length > 0
    ? trip.flights.map((f) => `  - ${f.airline} ${f.flightNumber} (${f.departureAirport} → ${f.arrivalAirport}) Conf: ${f.confirmationCode} Dept: ${f.departureTime}`).join("\n")
    : "  - Ground transportation / local travel";

  const roomsText = trip.hotelBlock?.rooms?.length > 0
    ? trip.hotelBlock.rooms.map((r) => `  - Room ${r.roomNumber} (${r.roomType}): ${r.occupants.join(", ") || "Unassigned"}`).join("\n")
    : "  - Standard team room block";

  const chaperonesText = trip.chaperones.length > 0
    ? trip.chaperones.map((c) => `  - ${c.fullName} (${c.relationship}) - Tel: ${c.phone} [${c.backgroundChecked ? "Verified" : "Pending"}]`).join("\n")
    : "  - Team coaching staff on site";

  return `
========================================
TEAM TRAVEL ITINERARY: ${trip.tripName.toUpperCase()}
Destination: ${trip.destination}
Dates: ${trip.startDate} - ${trip.endDate}
========================================

FLIGHT TRANSIT & SCHEDULE:
${flightsText}

ACCOMMODATIONS & ROOMING:
Hotel: ${trip.hotelBlock?.hotelName || "TBD"}
Address: ${trip.hotelBlock?.address || "TBD"} | Tel: ${trip.hotelBlock?.phone || "—"}
Confirmation #: ${trip.hotelBlock?.confirmationNumber || "TBD"}
Room Assignments:
${roomsText}

SAFETY CHAPERONES & CONTACTS:
${chaperonesText}

PER DIEM SUMMARY:
Total Athlete Records: ${trip.perDiems.length}
========================================
`.trim();
}

