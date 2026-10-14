import type { PoolClient } from 'pg';
import { db } from './db';
import { validId } from './operations';
import { familyAuthority } from './signing';
import { canManageTeam } from './access';
import { EVENT_KINDS } from './sports-operations';
import { zonedToUtc, isValidTimeZone } from './timezones';

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
type Actor = { userId: string; role: Parameters<typeof canManageTeam>[0]['role'] };

export type EventEdit = {
  name: string; kind: string; startsAt: string; endsAt: string; timezone: string; venue: string; address: string;
  latitude: string; longitude: string; notes: string; recruitingVisible: boolean;
};

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await db().connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

/** Athletes attending an event, each with the people who must hear about changes: the athlete and their CURRENT guardians. */
async function audience(c: PoolClient, eventId: string) {
  const attendees = (await c.query('SELECT athlete_id FROM sports_attendees WHERE event_id=$1', [eventId])).rows.map((r) => r.athlete_id as string);
  const people = new Set<string>(attendees);
  for (const a of attendees) (await c.query('SELECT member_id FROM guardian_links WHERE athlete_id=$1', [a])).rows.forEach((r) => people.add(r.member_id));
  return { attendees, people: [...people] };
}

/**
 * Who may change an event: its organizer only. Edits, cancellation and the attendee list are the organizer's calls, not those of the
 * families attending; families keep attendance and consent for their own athlete. A deleted or suspended organizer leaves the event frozen.
 */
async function mayManage(c: PoolClient, userId: string, eventId: string): Promise<boolean> {
  return !!(await c.query('SELECT 1 FROM events e JOIN users u ON u.id=e.organizer_id WHERE e.id=$1 AND e.organizer_id=$2 AND u.deleted_at IS NULL AND u.suspended_at IS NULL', [eventId, userId])).rowCount;
}

export async function updateEvent(actor: Actor, eventId: string, edit: EventEdit): Promise<Result> {
  if (!validId(eventId)) return fail('Unknown event.');
  const name = edit.name.trim();
  if (!isValidTimeZone(edit.timezone)) return fail('Choose a valid time zone.');
  const start = zonedToUtc(edit.startsAt, edit.timezone), end = zonedToUtc(edit.endsAt, edit.timezone);   // wall-clock at the venue → instant
  if (!name || name.length > 160 || !(EVENT_KINDS as readonly string[]).includes(edit.kind) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return fail('Enter a name and a valid start and end time.');
  const lat = edit.latitude.trim(), lon = edit.longitude.trim();
  if ((lat || lon) && (!lat || !lon || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lon)) > 180))
    return fail('Enter a valid latitude and longitude.');
  return tx(async (c) => {
    const ev = (await c.query("SELECT e.id,e.status,d.starts_at,d.ends_at,d.venue_id,d.season_id,d.recruiting_visible,v.name AS venue_name,v.address AS venue_address FROM events e JOIN sports_event_details d ON d.event_id=e.id LEFT JOIN sports_venues v ON v.id=d.venue_id WHERE e.id=$1 FOR UPDATE OF e", [eventId])).rows[0];
    if (!ev || !(await mayManage(c, actor.userId, eventId))) return fail('You can’t change this event.');
    if (ev.status === 'cancelled') return fail('This event was cancelled. Create a new one instead.');
    if (ev.season_id) {
      const season = (await c.query('SELECT starts_on::text AS s, ends_on::text AS e FROM sports_seasons WHERE id=$1', [ev.season_id])).rows[0];
      if (season && (new Date(start).toISOString().slice(0, 10) < season.s || new Date(end).toISOString().slice(0, 10) > season.e)) return fail('Event dates must fall inside the season.');
    }
    const venueName = edit.venue.trim().slice(0, 160), address = edit.address.trim().slice(0, 300);
    const venueChanged = venueName !== (ev.venue_name ?? '') || address !== (ev.venue_address ?? '');
    let venueId = ev.venue_id as string | null;
    if (venueChanged || lat || lon) {
      venueId = venueName ? (await c.query('INSERT INTO sports_venues(created_by,name,address,latitude,longitude) VALUES($1,$2,$3,$4,$5) RETURNING id', [actor.userId, venueName, address, lat ? Number(lat) : null, lon ? Number(lon) : null])).rows[0].id : null;
    }
    const { attendees, people } = await audience(c, eventId);
    let recruiting = ev.recruiting_visible as boolean;
    if (edit.recruitingVisible !== recruiting) {
      // Sharing with recruiters needs the adult athlete or a guardian of EVERY attendee; withdrawing it never does.
      let allowed = !edit.recruitingVisible;
      if (!allowed) { allowed = attendees.length > 0; for (const a of attendees) if (!(await canManageTeam(actor, a))) allowed = false; }
      if (!allowed) return fail('Only the adult athlete or a guardian can share an event with recruiters.');
      recruiting = edit.recruitingVisible;
    }
    const material = new Date(ev.starts_at).getTime() !== start || new Date(ev.ends_at).getTime() !== end || venueChanged;
    await c.query('UPDATE events SET name=$2,starts_on=$3 WHERE id=$1', [eventId, name, new Date(start).toISOString().slice(0, 10)]);
    await c.query('UPDATE sports_event_details SET kind=$2,starts_at=$3,ends_at=$4,venue_id=$5,notes=$6,recruiting_visible=$7,timezone=$8 WHERE event_id=$1', [eventId, edit.kind, new Date(start), new Date(end), venueId, edit.notes.trim().slice(0, 2000), recruiting, edit.timezone]);
    if (material) {
      // A guardian agreed to the event as it WAS. A new time or place needs a fresh yes.
      await c.query('UPDATE sports_attendees SET guardian_consent_by=NULL,guardian_consent_at=NULL WHERE event_id=$1', [eventId]);
    }
    for (const a of attendees) await c.query("INSERT INTO operations_activity(athlete_id,actor_id,event_id,action) VALUES($1,$2,$3,$4)", [a, actor.userId, eventId, material ? 'event.rescheduled' : 'event.updated']);
    for (const u of people) if (u !== actor.userId) await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account',$2,'/dashboard/schedule')", [u, material ? 'An event on the schedule changed. Check the details and consent again' : 'An event on the schedule was updated']);
    return { ok: true as const, message: material ? 'Saved. Guardian consent was cleared because the time or place changed.' : 'Saved.' };
  });
}

export async function cancelEvent(actor: Actor, eventId: string): Promise<Result> {
  if (!validId(eventId)) return fail('Unknown event.');
  return tx(async (c) => {
    const ev = (await c.query('SELECT status FROM events WHERE id=$1 FOR UPDATE', [eventId])).rows[0];
    if (!ev || !(await mayManage(c, actor.userId, eventId))) return fail('You can’t cancel this event.');
    if (ev.status === 'cancelled') return { ok: true as const };
    await c.query("UPDATE events SET status='cancelled' WHERE id=$1", [eventId]);
    await c.query('UPDATE sports_event_details SET recruiting_visible=false WHERE event_id=$1', [eventId]);     // a cancelled event is never shown to recruiters
    await c.query('UPDATE sports_attendees SET guardian_consent_by=NULL,guardian_consent_at=NULL WHERE event_id=$1', [eventId]);
    const { attendees, people } = await audience(c, eventId);
    for (const a of attendees) await c.query("INSERT INTO operations_activity(athlete_id,actor_id,event_id,action) VALUES($1,$2,$3,'event.cancelled')", [a, actor.userId, eventId]);
    for (const u of people) if (u !== actor.userId) await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account','An event on the schedule was cancelled','/dashboard/schedule')", [u]);
    return { ok: true as const, message: 'Event cancelled. Linked tasks and expenses were kept.' };
  });
}

/** A guardian's consent for one athlete and event: given explicitly, and revocable at any time. Only a current guardian can do either. */
export async function setGuardianConsent(guardianId: string, athleteId: string, eventId: string, give: boolean): Promise<Result> {
  if (!validId(athleteId) || !validId(eventId)) return fail('Unknown event.');
  return tx(async (c) => {
    const ev = (await c.query('SELECT status FROM events WHERE id=$1 FOR UPDATE', [eventId])).rows[0];
    const guardian = (await c.query('SELECT 1 FROM guardian_links WHERE athlete_id=$1 AND member_id=$2 FOR SHARE', [athleteId, guardianId])).rowCount;
    if (!ev || !guardian) return fail('Only a current guardian can record consent.');
    if (give && ev.status === 'cancelled') return fail('This event was cancelled.');
    const r = await c.query(give
      ? 'UPDATE sports_attendees SET guardian_consent_by=$3,guardian_consent_at=now() WHERE event_id=$1 AND athlete_id=$2'
      : 'UPDATE sports_attendees SET guardian_consent_by=NULL,guardian_consent_at=NULL WHERE event_id=$1 AND athlete_id=$2', give ? [eventId, athleteId, guardianId] : [eventId, athleteId]);
    if (!r.rowCount) return fail('That athlete is not attending this event.');
    await c.query("INSERT INTO operations_activity(athlete_id,actor_id,event_id,action) VALUES($1,$2,$3,$4)", [athleteId, guardianId, eventId, give ? 'event.consent_given' : 'event.consent_revoked']);
    return { ok: true as const };
  });
}

/** Adds another athlete to an event. You may only add someone you have family authority over; consent for them starts empty. */
export async function addAttendee(actor: Actor, eventId: string, athleteId: string): Promise<Result> {
  if (!validId(eventId) || !validId(athleteId)) return fail('Unknown event or athlete.');
  return tx(async (c) => {
    const ev = (await c.query('SELECT status FROM events WHERE id=$1 FOR UPDATE', [eventId])).rows[0];
    if (!ev || !(await mayManage(c, actor.userId, eventId)) || !(await knownAthlete(c, actor.userId, athleteId))) return fail('You can’t add that athlete to this event.');
    if (ev.status === 'cancelled') return fail('This event was cancelled.');
    const r = await c.query('INSERT INTO sports_attendees(event_id,athlete_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [eventId, athleteId]);
    if (!r.rowCount) return { ok: true as const, message: 'Already attending.' };
    await c.query("INSERT INTO operations_activity(athlete_id,actor_id,event_id,action) VALUES($1,$2,$3,'event.attendee_added')", [athleteId, actor.userId, eventId]);
    return { ok: true as const, message: 'Athlete added. Guardian consent is needed for them.' };
  });
}

/** An athlete the organizer may put on an event: themselves, a minor they are a current guardian of, or someone whose approved relationship they hold. */
async function knownAthlete(c: PoolClient, userId: string, athleteId: string): Promise<boolean> {
  return !!(await c.query(`SELECT 1 WHERE $1::uuid=$2::uuid OR EXISTS(SELECT 1 FROM guardian_links WHERE athlete_id=$2::uuid AND member_id=$1::uuid)
    OR EXISTS(SELECT 1 FROM athlete_relationships WHERE athlete_id=$2::uuid AND member_id=$1::uuid AND guardian_approved)`, [userId, athleteId])).rowCount;
}

/** Removes an athlete from an event. The organizer or that athlete's own family can, and an event is never left with nobody (cancel it instead). */
export async function removeAttendee(actor: Actor, eventId: string, athleteId: string): Promise<Result> {
  if (!validId(eventId) || !validId(athleteId)) return fail('Unknown event or athlete.');
  return tx(async (c) => {
    const ev = (await c.query('SELECT status FROM events WHERE id=$1 FOR UPDATE', [eventId])).rows[0];
    if (!ev || !((await mayManage(c, actor.userId, eventId)) || (await familyAuthority(actor.userId, athleteId, c)))) return fail('You can’t remove that athlete.');
    const n = Number((await c.query('SELECT count(*) AS n FROM sports_attendees WHERE event_id=$1', [eventId])).rows[0].n);
    if (n <= 1) return fail('An event needs at least one athlete. Cancel the event instead.');
    const r = await c.query('DELETE FROM sports_attendees WHERE event_id=$1 AND athlete_id=$2', [eventId, athleteId]);
    if (!r.rowCount) return fail('That athlete is not attending this event.');
    await c.query("INSERT INTO operations_activity(athlete_id,actor_id,event_id,action) VALUES($1,$2,$3,'event.attendee_removed')", [athleteId, actor.userId, eventId]);
    return { ok: true as const, message: 'Athlete removed from the event.' };
  });
}

/** Venues this person already entered, so a recurring field or gym is chosen rather than retyped. */
export async function reusableVenues(userId: string) {
  return (await db().query('SELECT DISTINCT ON (lower(name),lower(address)) id,name,address FROM sports_venues WHERE created_by=$1 ORDER BY lower(name),lower(address),id LIMIT 100', [userId])).rows as { id: string; name: string; address: string }[];
}
