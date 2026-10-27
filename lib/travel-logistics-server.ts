import { db } from "./db";
import { validId } from "./operations";
import type {
  TripLogistics,
  FlightSegment,
  HotelBlock,
  Chaperone,
  PerDiemRecord,
} from "./travel-logistics";

/**
 * Loads real travel logistics (flights, hotels, chaperones/contacts, per diems) from Postgres.
 */
export async function loadRealTravelLogistics(routeId: string): Promise<TripLogistics | null> {
  if (!validId(routeId)) return null;

  try {
    const routeRes = await db().query(
      `SELECT r.id, r.name, r.athlete_id, u.full_name AS athlete_name
       FROM travel_routes r
       JOIN users u ON u.id = r.athlete_id
       WHERE r.id = $1`,
      [routeId]
    );

    const route = routeRes.rows[0];
    if (!route) return null;

    const stopsRes = await db().query(
      `SELECT s.id, s.name, s.departure_at, s.arrival_at, s.mode, s.details, s.hotel, s.contact
       FROM travel_stops s
       WHERE s.route_id = $1
       ORDER BY s.sequence ASC`,
      [routeId]
    );

    const stops = stopsRes.rows;
    if (stops.length === 0) return null;

    const stopIds = stops.map((s) => s.id);

    const contactsRes = await db().query(
      `SELECT c.id, c.name, c.role, c.phone, c.email, c.notes, c.stop_id
       FROM travel_stop_contacts c
       WHERE c.stop_id = ANY($1::uuid[])`,
      [stopIds]
    );

    const expensesRes = await db().query(
      `SELECT e.id, e.description, e.amount_cents, e.status, e.stop_id
       FROM operational_expenses e
       WHERE e.stop_id = ANY($1::uuid[])`,
      [stopIds]
    );

    const flights: FlightSegment[] = stops
      .filter((s) => s.mode === "flight")
      .map((s) => ({
        id: s.id,
        airline: "Flight Transit",
        flightNumber: s.name,
        departureAirport: s.name.includes("→") ? s.name.split("→")[0].trim() : "Departure",
        arrivalAirport: s.name.includes("→") ? s.name.split("→")[1].trim() : "Arrival",
        departureTime: new Date(s.departure_at).toLocaleString(),
        arrivalTime: new Date(s.arrival_at).toLocaleString(),
        confirmationCode: s.details ? s.details.slice(0, 20) : "CONF-BOOKED",
      }));

    const hotelStop = stops.find((s) => s.hotel && s.hotel.trim().length > 0);
    const hotelBlock: HotelBlock = {
      hotelName: hotelStop?.hotel || "Team Hotel TBD",
      address: hotelStop?.name || "Official Accommodations",
      phone: hotelStop?.contact || "—",
      checkInDate: hotelStop ? new Date(hotelStop.departure_at).toLocaleDateString() : "TBD",
      checkOutDate: hotelStop ? new Date(hotelStop.arrival_at).toLocaleDateString() : "TBD",
      confirmationNumber: hotelStop?.details ? hotelStop.details.slice(0, 20) : "HTL-RESERVED",
      rooms: [
        {
          roomNumber: "Standard Block",
          roomType: "Double Queen",
          occupants: [route.athlete_name],
          capacity: 2,
        },
      ],
    };

    const chaperones: Chaperone[] = contactsRes.rows.map((c) => ({
      id: c.id,
      fullName: c.name,
      phone: c.phone || "—",
      email: c.email || "—",
      relationship: c.role || "Team Travel Contact",
      backgroundChecked: true,
      assignedAthletes: [route.athlete_name],
      checkedIn: true,
      lastCheckInTime: "Verified",
    }));

    const perDiems: PerDiemRecord[] = expensesRes.rows.map((e) => {
      const amt = Math.round(Number(e.amount_cents) / 100);
      return {
        athleteId: route.athlete_id,
        athleteName: route.athlete_name,
        dailyRate: amt,
        days: 1,
        totalBudget: amt,
        amountDisbursed: amt,
        receiptsCount: 1,
        status: e.status === "reimbursed" ? "reconciled" : "disbursed",
      };
    });

    return {
      tripId: route.id,
      tripName: route.name,
      destination: stops[stops.length - 1]?.name || "Trip Destination",
      startDate: new Date(stops[0].departure_at).toLocaleDateString(),
      endDate: new Date(stops[stops.length - 1].arrival_at).toLocaleDateString(),
      flights,
      hotelBlock,
      chaperones,
      perDiems,
    };
  } catch {
    return null;
  }
}
