import Link from "next/link";
import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { Badge, Card, Disclaimer, Grid } from "@/components/ui";
import { EVENT_STATUSES } from "@/lib/events";
import { TournamentBracketManager, type EventSummary } from "@/components/tournament-bracket";
import { getTournamentBracketByEventId } from "@/lib/tournament-brackets";
import { createEvent, setEventStatus } from "./actions";

export default async function Events({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; error?: string; event?: string }>;
}) {
  const s = await requireAccess("/dashboard/events");
  const q = await searchParams;
  const events = (
    await db().query(
      "SELECT id, name, sport, location, starts_on::text AS day, status FROM events WHERE organizer_id=$1 ORDER BY starts_on DESC",
      [s.userId]
    )
  ).rows as EventSummary[];

  const selectedEvent = (q.event ? events.find((e) => e.id === q.event) : null) ?? events[0] ?? null;
  const bracket = selectedEvent ? await getTournamentBracketByEventId(selectedEvent.id) : null;

  return (
    <>
      <h1>Events & Tournaments</h1>
      <div className="tag">Create and manage your tournaments, brackets, and court schedules.</div>
      {q.msg && <p className="ok">{q.msg}</p>}
      {q.error && <p role="alert" className="error">{q.error}</p>}

      <TournamentBracketManager
        event={selectedEvent}
        bracket={bracket}
        userRole={s.role}
        allEvents={events}
      />

      <Grid>
        <Card title="Events" wide>
          {events.length === 0 ? (
            <p className="muted">No events yet. Create your first event using the form on the right.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    style={{
                      background: selectedEvent?.id === e.id ? "var(--panel-2)" : undefined,
                    }}
                  >
                    <td>
                      <Link
                        href={`/dashboard/events?event=${encodeURIComponent(e.id)}`}
                        style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}
                      >
                        {e.name}
                      </Link>
                      <div className="muted">{e.sport}{e.location ? ` · ${e.location}` : ""}</div>
                    </td>
                    <td>{e.day}</td>
                    <td>
                      <Badge tone={e.status === "published" ? "green" : e.status === "cancelled" ? "red" : "gray"}>
                        {e.status}
                      </Badge>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Link
                          href={`/dashboard/events?event=${encodeURIComponent(e.id)}`}
                          className={`btn small ${selectedEvent?.id === e.id ? "" : "ghost"}`}
                          style={{ padding: "4px 8px", fontSize: 12 }}
                        >
                          {selectedEvent?.id === e.id ? "Selected" : "Select"}
                        </Link>
                        <form action={setEventStatus} style={{ display: "flex", gap: 4 }}>
                          <input type="hidden" name="id" value={e.id} />
                          <select
                            name="status"
                            defaultValue={e.status}
                            style={{
                              padding: "4px 6px",
                              borderRadius: 6,
                              border: "1px solid var(--line)",
                              background: "var(--panel)",
                              color: "var(--text)",
                              fontSize: 12,
                            }}
                          >
                            {EVENT_STATUSES.map((x) => (
                              <option key={x} value={x}>
                                {x}
                              </option>
                            ))}
                          </select>
                          <button className="btn ghost small" type="submit" style={{ padding: "4px 8px", fontSize: 12 }}>
                            Update
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="New event">
          <form action={createEvent} style={{ display: "grid", gap: 8 }}>
            <input type="text" name="name" placeholder="Event name" required />
            <input type="text" name="sport" placeholder="Sport (e.g. Basketball)" required />
            <input type="text" name="location" placeholder="Location (optional)" />
            <input type="date" name="starts_on" required />
            <button className="btn" type="submit">Create draft</button>
          </form>
        </Card>
      </Grid>
      <Disclaimer>
        Tournament bracket management and live court scheduling are active. Authorized organizers and coaches can click any matchup to record live scores and advance teams to the championship round.
      </Disclaimer>
    </>
  );
}
