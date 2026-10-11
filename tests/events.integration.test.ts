import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { db } from '../lib/db';
import { updateEvent, cancelEvent, setGuardianConsent, addAttendee, removeAttendee, reusableVenues, type EventEdit } from '../lib/sports-events';

type Actor = { userId: string; role: 'athlete' | 'parent' | 'coach' | 'recruiter' };
let athlete: Actor, guardian: Actor, stranger: Actor, coach: Actor, ev: string;
async function user(name: string, role: Actor['role']): Promise<Actor> {
  const id = (await db().query('INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now()) RETURNING id', [name.toLowerCase() + '@example.test', name, role, 'x'])).rows[0].id;
  return { userId: id, role };
}
const edit = (o: Partial<EventEdit> = {}): EventEdit => ({ name: 'Showcase', kind: 'showcase', startsAt: '2026-11-20T10:00', endsAt: '2026-11-20T14:00', timezone: 'UTC', venue: 'Main Field', address: '1 Park Rd', latitude: '', longitude: '', notes: '', recruitingVisible: false, ...o });
const row = async () => (await db().query(`SELECT e.name,e.status,e.starts_on::text AS starts_on,d.starts_at,d.ends_at,d.recruiting_visible,d.notes,v.name AS venue,a.guardian_consent_at FROM events e JOIN sports_event_details d ON d.event_id=e.id LEFT JOIN sports_venues v ON v.id=d.venue_id JOIN sports_attendees a ON a.event_id=e.id WHERE e.id=$1`, [ev])).rows[0];
const notes = async (uid: string) => (await db().query("SELECT title FROM notifications WHERE user_id=$1 ORDER BY id", [uid])).rows.map((r) => r.title as string);

beforeEach(async () => {
  await db().query('TRUNCATE users CASCADE');
  [athlete, guardian, stranger, coach] = [await user('Athlete', 'athlete'), await user('Guardian', 'parent'), await user('Stranger', 'coach'), await user('Coach', 'coach')];
  await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','high_school',CURRENT_DATE-INTERVAL '16 years')", [athlete.userId]);
  await db().query("INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved) VALUES($1,$2,'parent',true),($1,$3,'coach',false)", [athlete.userId, guardian.userId, coach.userId]);
  ev = (await db().query("INSERT INTO events(organizer_id,name,starts_on,status) VALUES($1,'Showcase','2026-11-20','published') RETURNING id", [guardian.userId])).rows[0].id;
  const venue = (await db().query("INSERT INTO sports_venues(created_by,name,address) VALUES($1,'Main Field','1 Park Rd') RETURNING id", [guardian.userId])).rows[0].id;
  await db().query("INSERT INTO sports_event_details(event_id,kind,starts_at,ends_at,venue_id) VALUES($1,'showcase','2026-11-20T10:00Z','2026-11-20T14:00Z',$2)", [ev, venue]);
  await db().query('INSERT INTO sports_attendees(event_id,athlete_id,guardian_consent_by,guardian_consent_at) VALUES($1,$2,$3,now())', [ev, athlete.userId, guardian.userId]);
});
afterAll(async () => { await db().end(); });

describe('editing an event', () => {
  it('lets the organizer or the family change it, and nobody else', async () => {
    expect((await updateEvent(guardian, ev, edit({ name: 'Renamed' }))).ok).toBe(true);
    expect((await row()).name).toBe('Renamed');
    for (const who of [stranger, coach]) expect((await updateEvent(who, ev, edit({ name: 'Hijack' }))).ok, who.role).toBe(false);
    expect((await row()).name).toBe('Renamed');
  });
  it('a guardian or athlete who is not the organizer cannot edit; a minor can never consent', async () => {
    await db().query('UPDATE events SET organizer_id=$2 WHERE id=$1', [ev, stranger.userId]);
    expect((await updateEvent(guardian, ev, edit({ name: 'By family' }))).ok).toBe(false);
    expect((await updateEvent(athlete, ev, edit({ name: 'By athlete' }))).ok).toBe(false);
    expect((await updateEvent(stranger, ev, edit({ name: 'By organizer' }))).ok).toBe(true);
    expect((await updateEvent(stranger, ev, edit({ name: 'x', recruitingVisible: true }))).ok).toBe(false);   // no authority over the attendee: cannot share
    expect((await setGuardianConsent(athlete.userId, athlete.userId, ev, true)).ok).toBe(false);
  });
  it('validates times, names, coordinates and the season window', async () => {
    for (const bad of [edit({ name: '  ' }), edit({ kind: 'party' }), edit({ endsAt: '2026-11-20T09:00' }), edit({ startsAt: 'soon' }), edit({ latitude: '99', longitude: '1' }), edit({ latitude: '5' })])
      expect((await updateEvent(guardian, ev, bad)).ok).toBe(false);
    const season = (await db().query("INSERT INTO sports_seasons(created_by,name,starts_on,ends_on) VALUES($1,'Fall','2026-09-01','2026-11-30') RETURNING id", [guardian.userId])).rows[0].id;
    await db().query('UPDATE sports_event_details SET season_id=$2 WHERE event_id=$1', [ev, season]);
    expect((await updateEvent(guardian, ev, edit({ startsAt: '2026-12-01T10:00', endsAt: '2026-12-01T12:00' }))).ok).toBe(false);
    expect((await updateEvent(guardian, ev, edit({ startsAt: '2026-11-25T10:00', endsAt: '2026-11-25T12:00' }))).ok).toBe(true);
    expect((await row()).starts_on).toBe('2026-11-25');
  });
  it('clears guardian consent when the time or place changes, and tells the family; harmless edits keep it', async () => {
    expect((await updateEvent(guardian, ev, edit({ notes: 'Bring water' }))).ok).toBe(true);
    expect((await row()).guardian_consent_at).not.toBeNull();
    const r = await updateEvent(guardian, ev, edit({ startsAt: '2026-11-20T11:00' }));
    expect(r.ok && r.message).toMatch(/consent was cleared/);
    expect((await row()).guardian_consent_at).toBeNull();
    expect(await notes(athlete.userId)).toContainEqual(expect.stringMatching(/changed/));
    expect(await notes(guardian.userId)).toEqual([]);                                // the person who made the change isn't pinged
    await setGuardianConsent(guardian.userId, athlete.userId, ev, true);
    await updateEvent(guardian, ev, edit({ venue: 'Other Field' }));
    expect((await row()).guardian_consent_at).toBeNull();
    expect((await row()).venue).toBe('Other Field');
  });
  it('shares with recruiters only on the say-so of someone with authority over every attendee, and withdrawing is always allowed', async () => {
    expect((await updateEvent(guardian, ev, edit({ recruitingVisible: true }))).ok).toBe(true);
    expect((await row()).recruiting_visible).toBe(true);
    await db().query('UPDATE events SET organizer_id=$2 WHERE id=$1', [ev, stranger.userId]);
    expect((await updateEvent(stranger, ev, edit({ recruitingVisible: false }))).ok).toBe(true);           // the organizer may always WITHDRAW sharing
    expect((await row()).recruiting_visible).toBe(false);
    expect((await updateEvent(stranger, ev, edit({ recruitingVisible: true }))).ok).toBe(false);           // but cannot turn it on without authority over every attendee
    await db().query('UPDATE events SET organizer_id=$2 WHERE id=$1', [ev, guardian.userId]);
    expect((await updateEvent(guardian, ev, edit({ recruitingVisible: true }))).ok).toBe(true);
    const other = await user('Other', 'athlete');
    await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','college',CURRENT_DATE-INTERVAL '20 years')", [other.userId]);
    await db().query('INSERT INTO sports_attendees(event_id,athlete_id) VALUES($1,$2)', [ev, other.userId]);
    expect((await updateEvent(guardian, ev, edit({ recruitingVisible: true, name: 'x' }))).ok).toBe(true);   // unchanged (already true): no new sharing decision
    await db().query('UPDATE sports_event_details SET recruiting_visible=false WHERE event_id=$1', [ev]);
    expect((await updateEvent(guardian, ev, edit({ recruitingVisible: true }))).ok).toBe(false);             // the guardian doesn't control the second attendee
  });
});

describe('cancelling an event', () => {
  it('cancels once, stops recruiter sharing, clears consent, keeps tasks, and notifies the family but not the actor', async () => {
    await db().query('UPDATE sports_event_details SET recruiting_visible=true WHERE event_id=$1', [ev]);
    await db().query("INSERT INTO operational_tasks(athlete_id,event_id,created_by,assigned_to,title,due_at) VALUES($1,$2,$3,$1,'Pack bag',now()+interval '1 day')", [athlete.userId, ev, guardian.userId]);
    expect((await cancelEvent(guardian, ev)).ok).toBe(true);
    const r = await row(); expect(r.status).toBe('cancelled'); expect(r.recruiting_visible).toBe(false); expect(r.guardian_consent_at).toBeNull();
    expect((await db().query("SELECT status FROM operational_tasks WHERE event_id=$1", [ev])).rows[0].status).toBe('open');
    expect(await notes(athlete.userId)).toEqual(['An event on the schedule was cancelled']);
    expect(await notes(guardian.userId)).toEqual([]);
    expect((await cancelEvent(guardian, ev)).ok).toBe(true);                                                  // idempotent
    expect(await notes(athlete.userId)).toHaveLength(1);
  });
  it('cannot be cancelled, edited or re-consented by outsiders; a cancelled event cannot be edited or consented', async () => {
    expect((await cancelEvent(stranger, ev)).ok).toBe(false);
    expect((await row()).status).toBe('published');
    await cancelEvent(guardian, ev);
    expect((await updateEvent(guardian, ev, edit())).ok).toBe(false);
    expect((await setGuardianConsent(guardian.userId, athlete.userId, ev, true)).ok).toBe(false);
  });
  it('edit and cancel racing leave a consistent event', async () => {
    const results = await Promise.all([cancelEvent(guardian, ev), updateEvent(guardian, ev, edit({ name: 'Racing' })), updateEvent(guardian, ev, edit({ name: 'Racing 2' }))]);
    expect(results.every((r) => typeof r.ok === 'boolean')).toBe(true);
    expect((await row()).status).toBe('cancelled');
  });
});

describe('guardian consent', () => {
  it('can be given and revoked by a current guardian only', async () => {
    await db().query('UPDATE sports_attendees SET guardian_consent_by=NULL,guardian_consent_at=NULL WHERE event_id=$1', [ev]);
    expect((await setGuardianConsent(stranger.userId, athlete.userId, ev, true)).ok).toBe(false);
    expect((await setGuardianConsent(coach.userId, athlete.userId, ev, true)).ok).toBe(false);
    expect((await setGuardianConsent(athlete.userId, athlete.userId, ev, true)).ok).toBe(false);              // a minor can't consent for themself
    expect((await setGuardianConsent(guardian.userId, athlete.userId, ev, true)).ok).toBe(true);
    expect((await row()).guardian_consent_at).not.toBeNull();
    expect((await setGuardianConsent(guardian.userId, athlete.userId, ev, false)).ok).toBe(true);
    expect((await row()).guardian_consent_at).toBeNull();
    expect((await db().query("SELECT action FROM operations_activity WHERE event_id=$1 ORDER BY id", [ev])).rows.map((r) => r.action)).toEqual(['event.consent_given', 'event.consent_revoked']);
  });
  it('refuses an athlete who is not attending, and a guardian whose authority ended at 18', async () => {
    const other = await user('Other', 'athlete');
    expect((await setGuardianConsent(guardian.userId, other.userId, ev, true)).ok).toBe(false);
    await db().query("UPDATE athlete_profiles SET birth_date=CURRENT_DATE-INTERVAL '19 years' WHERE user_id=$1", [athlete.userId]);
    expect((await setGuardianConsent(guardian.userId, athlete.userId, ev, true)).ok).toBe(false);
  });
});

describe('multiple athletes and saved venues', () => {
  let sibling: Actor;
  beforeEach(async () => {
    sibling = await user('Sibling', 'athlete');
    await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','high_school',CURRENT_DATE-INTERVAL '14 years')", [sibling.userId]);
    await db().query("INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved) VALUES($1,$2,'parent',true)", [sibling.userId, guardian.userId]);
  });
  const count = async () => Number((await db().query('SELECT count(*) AS n FROM sports_attendees WHERE event_id=$1', [ev])).rows[0].n);
  it('adds an athlete only for someone with authority over them, with no consent carried over', async () => {
    expect((await addAttendee(stranger, ev, sibling.userId)).ok).toBe(false);    // not the organizer
    expect((await addAttendee(coach, ev, sibling.userId)).ok).toBe(false);
    await db().query('UPDATE events SET organizer_id=$2 WHERE id=$1', [ev, coach.userId]);
    expect((await addAttendee(coach, ev, sibling.userId)).ok).toBe(false);      // organizer, but no standing with that athlete
    await db().query('UPDATE events SET organizer_id=$2 WHERE id=$1', [ev, guardian.userId]);
    expect((await addAttendee(guardian, ev, sibling.userId)).ok).toBe(true);
    expect((await addAttendee(guardian, ev, sibling.userId)).ok).toBe(true);
    expect(await count()).toBe(2);
    expect((await db().query('SELECT guardian_consent_at FROM sports_attendees WHERE event_id=$1 AND athlete_id=$2', [ev, sibling.userId])).rows[0].guardian_consent_at).toBeNull();
  });
  it('cannot add to a cancelled event or with a bad id', async () => {
    await cancelEvent(guardian, ev);
    expect((await addAttendee(guardian, ev, sibling.userId)).ok).toBe(false);
    expect((await addAttendee(guardian, 'nope', sibling.userId)).ok).toBe(false);
  });
  it('removes an athlete only for their own family and never empties the event', async () => {
    await addAttendee(guardian, ev, sibling.userId);
    expect((await removeAttendee(stranger, ev, sibling.userId)).ok).toBe(false);
    expect((await removeAttendee(guardian, ev, sibling.userId)).ok).toBe(true);
    expect((await removeAttendee(guardian, ev, athlete.userId)).ok).toBe(false);
    expect(await count()).toBe(1);
  });
  it('lists each saved venue once, only the owner\'s', async () => {
    await db().query("INSERT INTO sports_venues(created_by,name,address) VALUES($1,'Main Field','1 Park Rd'),($2,'Other','x')", [guardian.userId, stranger.userId]);
    const v = await reusableVenues(guardian.userId);
    expect(v.map((x) => x.name)).toEqual(['Main Field']);
  });
});

describe('events shared for scouting', () => {
  it('lists only shared, uncancelled events the athlete attends', async () => {
    const { sharedEvents } = await import('../lib/scouting');
    expect(await sharedEvents(athlete.userId)).toEqual([]);
    await db().query('UPDATE sports_event_details SET recruiting_visible=true WHERE event_id=$1', [ev]);
    expect((await sharedEvents(athlete.userId)).map((e) => e.id)).toEqual([ev]);
    expect(await sharedEvents(stranger.userId)).toEqual([]);
    await cancelEvent(guardian, ev);
    expect(await sharedEvents(athlete.userId)).toEqual([]);
    expect(await sharedEvents('nope')).toEqual([]);
  });
});

describe('organizer without family authority', () => {
  it('keeps control of the event (organizer-based authority), but cannot share it with recruiters or add that athlete', async () => {
    await db().query('DELETE FROM athlete_relationships WHERE member_id=$1', [guardian.userId]);
    expect((await updateEvent(guardian, ev, edit({ name: 'Still mine' }))).ok).toBe(true);
    expect((await updateEvent(guardian, ev, edit({ name: 'Still mine', recruitingVisible: true }))).ok).toBe(false);
    expect((await cancelEvent(guardian, ev)).ok).toBe(true);
  });
});

describe('venue time zones', () => {
  it('stores the instant for the venue wall-clock time and keeps the zone', async () => {
    expect((await updateEvent(guardian, ev, edit({ startsAt: '2026-11-20T10:00', endsAt: '2026-11-20T14:00', timezone: 'America/Los_Angeles' }))).ok).toBe(true);
    const r = (await db().query('SELECT starts_at,timezone FROM sports_event_details WHERE event_id=$1', [ev])).rows[0];
    expect(new Date(r.starts_at).toISOString()).toBe('2026-11-20T18:00:00.000Z');
    expect(r.timezone).toBe('America/Los_Angeles');
    expect((await updateEvent(guardian, ev, edit({ timezone: 'Mars/Olympus' }))).ok).toBe(false);
  });
});
