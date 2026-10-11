import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { db } from '../lib/db';
import { addStopContact, removeStopContact, linkStopDocument, stopLinks } from '../lib/travel-stops';

let athlete: string, guardian: string, stranger: string, stop: string, waiver: string, passport: string;
const user = async (n: string, role: string) => (await db().query('INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now()) RETURNING id', [n + '@example.test', n, role, 'x'])).rows[0].id as string;
const contact = { name: 'Dana Host', role: 'Host family', phone: '555-0100', email: 'dana@example.test', notes: 'Pick-up at gate B' };
beforeEach(async () => {
  await db().query('TRUNCATE users CASCADE');
  [athlete, guardian, stranger] = [await user('athlete', 'athlete'), await user('guardian', 'parent'), await user('stranger', 'coach')];
  await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','high_school',CURRENT_DATE-INTERVAL '16 years')", [athlete]);
  await db().query("INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved) VALUES($1,$2,'parent',true)", [athlete, guardian]);
  const route = (await db().query("INSERT INTO travel_routes(athlete_id,created_by,name) VALUES($1,$2,'Showcase trip') RETURNING id", [athlete, guardian])).rows[0].id;
  stop = (await db().query("INSERT INTO travel_stops(route_id,sequence,name,departure_at,arrival_at,mode) VALUES($1,1,'Airport','2027-01-10T08:00Z','2027-01-10T10:00Z','flight') RETURNING id", [route])).rows[0].id;
  waiver = (await db().query("INSERT INTO athlete_documents(athlete_id,title,category,created_by) VALUES($1,'Camp waiver','travel',$1) RETURNING id", [athlete])).rows[0].id;
  passport = (await db().query("INSERT INTO athlete_documents(athlete_id,title,category,created_by) VALUES($1,'Passport','identity',$1) RETURNING id", [athlete])).rows[0].id;
});
afterAll(async () => { await db().end(); });

describe('travel stop links', () => {
  it('family adds and removes contacts; outsiders cannot; bad input is refused', async () => {
    expect((await addStopContact({ userId: stranger }, stop, contact)).ok).toBe(false);
    expect((await addStopContact({ userId: guardian }, stop, { ...contact, name: '' })).ok).toBe(false);
    expect((await addStopContact({ userId: guardian }, stop, { ...contact, email: 'not-an-email' })).ok).toBe(false);
    expect((await addStopContact({ userId: guardian }, stop, contact)).ok).toBe(true);
    expect((await addStopContact({ userId: athlete }, stop, { ...contact, name: 'Coach Lee', email: '' })).ok).toBe(true);
    const links = await stopLinks([stop]);
    expect(links.contacts.map((c) => c.name)).toEqual(['Dana Host', 'Coach Lee']);
    expect((await removeStopContact({ userId: stranger }, stop, links.contacts[0].id)).ok).toBe(false);
    expect((await removeStopContact({ userId: guardian }, stop, links.contacts[0].id)).ok).toBe(true);
    expect((await stopLinks([stop])).contacts.length).toBe(1);
    expect((await addStopContact({ userId: guardian }, 'nope', contact)).ok).toBe(false);
  });
  it('links the athlete’s travel documents but never identity or tax papers, and unlinks cleanly', async () => {
    expect((await linkStopDocument({ userId: guardian }, stop, waiver, true)).ok).toBe(true);
    expect((await linkStopDocument({ userId: guardian }, stop, waiver, true)).ok).toBe(true);    // idempotent
    expect((await linkStopDocument({ userId: guardian }, stop, passport, true)).ok).toBe(false);
    expect((await linkStopDocument({ userId: stranger }, stop, waiver, true)).ok).toBe(false);
    const other = (await db().query("INSERT INTO athlete_documents(athlete_id,title,category,created_by) VALUES($1,'Not mine','travel',$1) RETURNING id", [stranger])).rows[0].id;
    expect((await linkStopDocument({ userId: guardian }, stop, other, true)).ok).toBe(false);
    expect((await stopLinks([stop])).documents.map((d) => d.title)).toEqual(['Camp waiver']);
    expect((await linkStopDocument({ userId: guardian }, stop, waiver, false)).ok).toBe(true);
    expect((await linkStopDocument({ userId: guardian }, stop, waiver, false)).ok).toBe(false);
    expect((await stopLinks([stop])).documents).toEqual([]);
  });
  it('gathers the tasks and expenses already pointing at a stop', async () => {
    await db().query("INSERT INTO operational_tasks(athlete_id,stop_id,created_by,assigned_to,title,due_at) VALUES($1,$2,$3,$3,'Print boarding passes','2027-01-09T18:00Z')", [athlete, stop, guardian]);
    await db().query("INSERT INTO operational_expenses(athlete_id,stop_id,created_by,description,amount_cents) VALUES($1,$2,$3,'Parking',2500)", [athlete, stop, guardian]);
    const links = await stopLinks([stop]);
    expect(links.tasks.map((t) => t.title)).toEqual(['Print boarding passes']);
    expect(links.expenses.map((e) => Number(e.amount_cents))).toEqual([2500]);
    expect(await stopLinks([])).toEqual({ contacts: [], documents: [], tasks: [], expenses: [] });
  });
});
