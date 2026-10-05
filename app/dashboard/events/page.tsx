import { requireAccess } from "@/lib/session";
import { db } from "@/lib/db";
import { Badge, Card, Disclaimer, Grid } from "@/components/ui";
import { EVENT_STATUSES } from "@/lib/events";
import { createEvent, setEventStatus } from "./actions";

export default async function Events({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const s = await requireAccess("/dashboard/events");
  const q = await searchParams;
  const events = (await db().query("SELECT id, name, sport, location, starts_on::text AS day, status FROM events WHERE organizer_id=$1 ORDER BY starts_on DESC", [s.userId])).rows;
  return (
    <>
      <h1>My Events</h1>
      <div className="tag">Create and manage your tournaments and showcases.</div>
      {q.msg && <p className="ok">{q.msg}</p>}{q.error && <p role="alert" className="error">{q.error}</p>}
      <Grid>
        <Card title="Events" wide>
          {events.length === 0 ? <p className="muted">No events yet.</p> : (
            <table><thead><tr><th>Event</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>
              {events.map((e) => <tr key={e.id}><td>{e.name}<div className="muted">{e.sport}{e.location ? ` · ${e.location}` : ""}</div></td><td>{e.day}</td>
                <td><Badge tone={e.status === "published" ? "green" : e.status === "cancelled" ? "red" : "gray"}>{e.status}</Badge></td>
                <td><form action={setEventStatus} style={{ display: "flex", gap: 6 }}><input type="hidden" name="id" value={e.id} />
                  <select name="status" defaultValue={e.status} style={{ padding: 6, borderRadius: 8, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--text)" }}>
                    {EVENT_STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}</select><button className="btn ghost" type="submit">Update</button></form></td></tr>)}
            </tbody></table>)}
        </Card>
        <Card title="New event">
          <form action={createEvent} style={{ display: "grid", gap: 8 }}>
            <input type="text" name="name" placeholder="Event name" required /><input type="text" name="sport" placeholder="Sport" required />
            <input type="text" name="location" placeholder="Location (optional)" /><input type="date" name="starts_on" required />
            <button className="btn" type="submit">Create draft</button></form>
        </Card>
      </Grid>
      <Disclaimer>Team registration, brackets and sponsor placement aren&apos;t built yet — this page manages your event listings.</Disclaimer>
    </>
  );
}
