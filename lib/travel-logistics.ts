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
