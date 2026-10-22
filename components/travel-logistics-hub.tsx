"use client";

import { useState } from "react";
import {
  calculatePerDiemTotals,
  checkChaperoneCompliance,
  type FlightSegment,
  type HotelBlock,
  type Chaperone,
  type PerDiemRecord,
} from "@/lib/travel-logistics";

const DEFAULT_FLIGHTS: FlightSegment[] = [
  {
    id: "fl-1",
    airline: "Delta Air Lines",
    flightNumber: "DL 1482",
    departureAirport: "ORD (Chicago)",
    arrivalAirport: "ATL (Atlanta)",
    departureTime: "Fri, Jul 18 · 7:30 AM",
    arrivalTime: "Fri, Jul 18 · 10:25 AM",
    confirmationCode: "H7KL9P",
    terminal: "Terminal 2",
    gate: "B14",
  },
  {
    id: "fl-2",
    airline: "Delta Air Lines",
    flightNumber: "DL 2109",
    departureAirport: "ATL (Atlanta)",
    arrivalAirport: "ORD (Chicago)",
    departureTime: "Sun, Jul 20 · 6:45 PM",
    arrivalTime: "Sun, Jul 20 · 7:55 PM",
    confirmationCode: "H7KL9P",
    terminal: "South Terminal",
    gate: "A22",
  },
];

const DEFAULT_HOTEL: HotelBlock = {
  hotelName: "Westin Peachtree Plaza Downtown",
  address: "210 Peachtree St NW, Atlanta, GA 30303",
  phone: "(404) 659-1400",
  checkInDate: "Jul 18, 2026 (3:00 PM)",
  checkOutDate: "Jul 20, 2026 (12:00 PM)",
  confirmationNumber: "WST-884219",
  rooms: [
    { roomNumber: "1402", roomType: "Double Queen", capacity: 2, occupants: ["Marcus Johnson", "Jordan Bell"] },
    { roomNumber: "1404", roomType: "Double Queen", capacity: 2, occupants: ["Tyrese Maxey", "Jalen Green"] },
    { roomNumber: "1406", roomType: "Double Queen", capacity: 2, occupants: ["Cam Whitmore", "Devin Carter"] },
    { roomNumber: "1408", roomType: "King", capacity: 1, occupants: ["Coach Robinson (Staff)"] },
    { roomNumber: "1410", roomType: "Double Queen", capacity: 2, occupants: ["David Johnson (Chaperone)", "Sarah Bell (Chaperone)"] },
  ],
};

const DEFAULT_CHAPERONES: Chaperone[] = [
  {
    id: "chap-1",
    fullName: "David Johnson",
    phone: "(312) 555-0199",
    email: "david.johnson@example.com",
    relationship: "Parent of Marcus Johnson",
    backgroundChecked: true,
    assignedAthletes: ["Marcus Johnson", "Jordan Bell"],
    checkedIn: true,
    lastCheckInTime: "Jul 18, 11:15 AM",
  },
  {
    id: "chap-2",
    fullName: "Sarah Bell",
    phone: "(312) 555-0288",
    email: "sarah.bell@example.com",
    relationship: "Parent of Jordan Bell",
    backgroundChecked: true,
    assignedAthletes: ["Tyrese Maxey", "Jalen Green"],
    checkedIn: true,
    lastCheckInTime: "Jul 18, 11:15 AM",
  },
  {
    id: "chap-3",
    fullName: "Robert Whitmore",
    phone: "(312) 555-0377",
    email: "robert.w@example.com",
    relationship: "Parent of Cam Whitmore",
    backgroundChecked: true,
    assignedAthletes: ["Cam Whitmore", "Devin Carter"],
    checkedIn: false,
  },
];

const DEFAULT_PER_DIEM: PerDiemRecord[] = [
  { athleteId: "a1", athleteName: "Marcus Johnson", dailyRate: 50, days: 3, totalBudget: 150, amountDisbursed: 150, receiptsCount: 3, status: "reconciled" },
  { athleteId: "a2", athleteName: "Jordan Bell", dailyRate: 50, days: 3, totalBudget: 150, amountDisbursed: 150, receiptsCount: 2, status: "disbursed" },
  { athleteId: "a3", athleteName: "Tyrese Maxey", dailyRate: 50, days: 3, totalBudget: 150, amountDisbursed: 150, receiptsCount: 3, status: "reconciled" },
  { athleteId: "a4", athleteName: "Jalen Green", dailyRate: 50, days: 3, totalBudget: 150, amountDisbursed: 150, receiptsCount: 1, status: "disbursed" },
  { athleteId: "a5", athleteName: "Cam Whitmore", dailyRate: 50, days: 3, totalBudget: 150, amountDisbursed: 150, receiptsCount: 2, status: "disbursed" },
  { athleteId: "a6", athleteName: "Devin Carter", dailyRate: 50, days: 3, totalBudget: 150, amountDisbursed: 150, receiptsCount: 0, status: "pending" },
];

export function TravelLogisticsHub({
  tripName = "Atlanta National Showcase Road Trip",
  destination = "Atlanta, GA",
}: {
  tripName?: string;
  destination?: string;
}) {
  const [activeTab, setActiveTab] = useState<"flights" | "hotel" | "chaperones" | "per_diem">("flights");
  const [chaperones, setChaperones] = useState<Chaperone[]>(DEFAULT_CHAPERONES);
  const [perDiems, setPerDiems] = useState<PerDiemRecord[]>(DEFAULT_PER_DIEM);

  const compliance = checkChaperoneCompliance(chaperones);
  const perDiemTotals = calculatePerDiemTotals(perDiems);

  const toggleCheckIn = (chaperoneId: string) => {
    setChaperones((prev) =>
      prev.map((c) =>
        c.id === chaperoneId
          ? {
              ...c,
              checkedIn: !c.checkedIn,
              lastCheckInTime: !c.checkedIn
                ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : undefined,
            }
          : c
      )
    );
  };

  const handleDisburseAll = () => {
    setPerDiems((prev) =>
      prev.map((p) => ({
        ...p,
        amountDisbursed: p.totalBudget,
        status: p.status === "reconciled" ? "reconciled" : "disbursed",
      }))
    );
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
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>✈️</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{tripName}</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                background: "rgba(20, 184, 166, 0.1)",
                color: "var(--primary)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid var(--line)",
              }}
            >
              {destination} · Active Itinerary
            </span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Team road trip coordinator: flights, hotel blocks, chaperone safety gates, and per diem tracking.
          </div>
        </div>

        {/* Tab buttons */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn small ${activeTab === "flights" ? "" : "ghost"}`}
            onClick={() => setActiveTab("flights")}
          >
            🛫 Flights & Transit
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === "hotel" ? "" : "ghost"}`}
            onClick={() => setActiveTab("hotel")}
          >
            🏨 Hotel & Rooms
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === "chaperones" ? "" : "ghost"}`}
            onClick={() => setActiveTab("chaperones")}
          >
            🛡️ Chaperones ({compliance.checkedInCount}/{compliance.totalChaperones})
          </button>
          <button
            type="button"
            className={`btn small ${activeTab === "per_diem" ? "" : "ghost"}`}
            onClick={() => setActiveTab("per_diem")}
          >
            💵 Per Diem (${perDiemTotals.totalDisbursed})
          </button>
        </div>
      </div>

      {/* Tab 1: Flights & Transit */}
      {activeTab === "flights" && (
        <div style={{ display: "grid", gap: 14 }}>
          {DEFAULT_FLIGHTS.map((f, idx) => (
            <div
              key={f.id}
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                    {idx === 0 ? "Outbound Flight" : "Return Flight"} · {f.airline}
                  </span>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)" }}>{f.flightNumber}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="muted" style={{ fontSize: 11 }}>Confirmation Code</div>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14 }}>{f.confirmationCode}</div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  gap: 12,
                  alignItems: "center",
                  background: "var(--panel)",
                  padding: 12,
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                }}
              >
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{f.departureAirport}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{f.departureTime}</div>
                  {f.terminal && <div style={{ fontSize: 11, color: "var(--muted)" }}>{f.terminal} · Gate {f.gate}</div>}
                </div>
                <div style={{ fontSize: 20, color: "var(--muted)" }}>➔</div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{f.arrivalAirport}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{f.arrivalTime}</div>
                </div>
              </div>
            </div>
          ))}

          {/* Ground Charter Card */}
          <div
            style={{
              background: "var(--panel-2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                Ground Charter Bus
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Atlanta Sprinter Team Shuttles (28-Passenger)</div>
              <div className="muted" style={{ fontSize: 12 }}>Pickup at ATL Ground Transportation North Terminal · Driver: Tony R. (404-555-8812)</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ok)", background: "rgba(34, 197, 94, 0.12)", padding: "4px 8px", borderRadius: 4 }}>
              Confirmed
            </span>
          </div>
        </div>
      )}

      {/* Tab 2: Hotel & Rooms */}
      {activeTab === "hotel" && (
        <div>
          <div
            style={{
              background: "var(--panel-2)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: 14,
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{DEFAULT_HOTEL.hotelName}</div>
              <div className="muted" style={{ fontSize: 12 }}>{DEFAULT_HOTEL.address} · {DEFAULT_HOTEL.phone}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <strong>Check-In:</strong> {DEFAULT_HOTEL.checkInDate} | <strong>Check-Out:</strong> {DEFAULT_HOTEL.checkOutDate}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="muted" style={{ fontSize: 11 }}>Group Res #</div>
              <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14 }}>{DEFAULT_HOTEL.confirmationNumber}</div>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
            Room Block & Roommate Assignments ({DEFAULT_HOTEL.rooms.length} Rooms Reserved)
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {DEFAULT_HOTEL.rooms.map((room) => (
              <div
                key={room.roomNumber}
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: 14, color: "var(--primary)" }}>
                    Room {room.roomNumber}
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>{room.roomType}</span>
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  {room.occupants.map((occ, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: 12,
                        padding: "4px 6px",
                        background: "var(--panel)",
                        borderRadius: 4,
                        border: "1px solid var(--line)",
                      }}
                    >
                      👤 {occ}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Chaperones */}
      {activeTab === "chaperones" && (
        <div>
          <div
            style={{
              padding: 10,
              borderRadius: 6,
              background: compliance.compliant ? "rgba(34, 197, 94, 0.1)" : "rgba(249, 115, 22, 0.1)",
              border: compliance.compliant ? "1px solid var(--ok)" : "1px solid var(--needs)",
              marginBottom: 16,
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              {compliance.compliant
                ? "✓ All Parent Chaperones are background checked and checked in on-site."
                : `⚠️ Safety Notice: ${compliance.totalChaperones - compliance.checkedInCount} chaperone(s) pending on-site check-in.`}
            </span>
            <span style={{ fontWeight: 700, fontFamily: "var(--mono)" }}>
              {compliance.checkedInCount} / {compliance.totalChaperones} Verified
            </span>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {chaperones.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{c.fullName}</span>
                    <span className="muted" style={{ fontSize: 11 }}>({c.relationship})</span>
                    {c.backgroundChecked && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--primary)",
                          background: "rgba(20, 184, 166, 0.12)",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        Background Checked ✓
                      </span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    📞 {c.phone} · ✉️ {c.email}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <strong>Assigned Athletes:</strong> {c.assignedAthletes.join(", ")}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {c.checkedIn && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      Checked in: {c.lastCheckInTime}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleCheckIn(c.id)}
                    className={`btn small ${c.checkedIn ? "ghost" : ""}`}
                  >
                    {c.checkedIn ? "Checked In ✓" : "Check In Now →"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Per Diem */}
      {activeTab === "per_diem" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Total Meal Budget</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--primary)" }}>
                ${perDiemTotals.totalBudget}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>$50/day × 3 days × {perDiems.length} athletes</div>
            </div>

            <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Total Disbursed</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--mono)" }}>
                ${perDiemTotals.totalDisbursed}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>Via Direct Card / Venmo / Cash</div>
            </div>

            <div style={{ background: "var(--panel-2)", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
              <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>Receipt Reconciled</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--ok)" }}>
                {perDiemTotals.reconciliationRate}%
              </div>
              <div className="muted" style={{ fontSize: 11 }}>NCAA/High School compliance proof</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
              Athlete Meal Stipends
            </span>
            <button type="button" className="btn small ghost" onClick={handleDisburseAll}>
              Disburse Remaining Stipends
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                <th style={{ padding: "8px 6px" }}>Athlete</th>
                <th style={{ padding: "8px 6px" }}>Rate</th>
                <th style={{ padding: "8px 6px" }}>Total Budget</th>
                <th style={{ padding: "8px 6px" }}>Disbursed</th>
                <th style={{ padding: "8px 6px" }}>Receipts Uploaded</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {perDiems.map((p) => (
                <tr key={p.athleteId} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "10px 6px", fontWeight: 600 }}>{p.athleteName}</td>
                  <td style={{ padding: "10px 6px", fontFamily: "var(--mono)" }}>${p.dailyRate}/day</td>
                  <td style={{ padding: "10px 6px", fontFamily: "var(--mono)" }}>${p.totalBudget}</td>
                  <td style={{ padding: "10px 6px", fontFamily: "var(--mono)" }}>${p.amountDisbursed}</td>
                  <td style={{ padding: "10px 6px" }}>{p.receiptsCount} receipts ✓</td>
                  <td style={{ padding: "10px 6px" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background:
                          p.status === "reconciled"
                            ? "rgba(34, 197, 94, 0.12)"
                            : p.status === "disbursed"
                            ? "rgba(37, 99, 235, 0.12)"
                            : "rgba(249, 115, 22, 0.12)",
                        color:
                          p.status === "reconciled"
                            ? "var(--ok)"
                            : p.status === "disbursed"
                            ? "#2563eb"
                            : "var(--needs)",
                      }}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
