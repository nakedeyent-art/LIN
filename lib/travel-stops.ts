import type { PoolClient } from 'pg';
import { db } from './db';
import { validId } from './operations';
import { familyAuthority } from './signing';

export type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await db().connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

/** The stop's athlete, if the actor has family authority over them; stops are never reachable through anyone else. */
async function ownedStop(c: PoolClient, userId: string, stopId: string): Promise<{ athleteId: string; routeId: string } | null> {
  if (!validId(stopId)) return null;
  const r = (await c.query('SELECT r.athlete_id,r.id AS route_id FROM travel_stops s JOIN travel_routes r ON r.id=s.route_id WHERE s.id=$1 FOR UPDATE OF s', [stopId])).rows[0];
  if (!r || !(await familyAuthority(userId, r.athlete_id, c))) return null;
  return { athleteId: r.athlete_id, routeId: r.route_id };
}

export type ContactInput = { name: string; role: string; phone: string; email: string; notes: string };

export async function addStopContact(actor: { userId: string }, stopId: string, input: ContactInput): Promise<Result> {
  const name = input.name.trim(), email = input.email.trim();
  if (!name || name.length > 120) return fail('Enter a contact name up to 120 characters.');
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return fail('Enter a valid email address or leave it blank.');
  return tx(async (c) => {
    const stop = await ownedStop(c, actor.userId, stopId);
    if (!stop) return fail('You can’t change this stop.');
    if (Number((await c.query('SELECT count(*) AS n FROM travel_stop_contacts WHERE stop_id=$1', [stopId])).rows[0].n) >= 20) return fail('A stop holds up to 20 contacts.');
    await c.query('INSERT INTO travel_stop_contacts(stop_id,name,role,phone,email,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [stopId, name, input.role.trim().slice(0, 60), input.phone.trim().slice(0, 40), email, input.notes.trim().slice(0, 500), actor.userId]);
    await c.query("INSERT INTO operations_activity(athlete_id,actor_id,action) VALUES($1,$2,'stop.contact_added')", [stop.athleteId, actor.userId]);
    return { ok: true as const, message: 'Contact added to the stop.' };
  });
}

export async function removeStopContact(actor: { userId: string }, stopId: string, contactId: string): Promise<Result> {
  if (!validId(contactId)) return fail('Unknown contact.');
  return tx(async (c) => {
    const stop = await ownedStop(c, actor.userId, stopId);
    if (!stop) return fail('You can’t change this stop.');
    const r = await c.query('DELETE FROM travel_stop_contacts WHERE id=$1 AND stop_id=$2', [contactId, stopId]);
    return r.rowCount ? { ok: true as const, message: 'Contact removed.' } : fail('That contact is not on this stop.');
  });
}

/** Links a document to a stop. The document must belong to the same athlete; identity and tax papers are never attached to travel. */
export async function linkStopDocument(actor: { userId: string }, stopId: string, documentId: string, link: boolean): Promise<Result> {
  if (!validId(documentId)) return fail('Unknown document.');
  return tx(async (c) => {
    const stop = await ownedStop(c, actor.userId, stopId);
    if (!stop) return fail('You can’t change this stop.');
    if (!link) {
      const r = await c.query('DELETE FROM travel_stop_documents WHERE stop_id=$1 AND document_id=$2', [stopId, documentId]);
      return r.rowCount ? { ok: true as const, message: 'Document unlinked.' } : fail('That document is not linked to this stop.');
    }
    const d = (await c.query("SELECT category,status FROM athlete_documents WHERE id=$1 AND athlete_id=$2", [documentId, stop.athleteId])).rows[0];
    if (!d) return fail('Choose one of this athlete’s documents.');
    if (['identity', 'tax'].includes(d.category)) return fail('Identity and tax documents stay in the document center; they are not attached to travel.');
    if (d.status === 'archived') return fail('Archived documents can’t be attached.');
    if (Number((await c.query('SELECT count(*) AS n FROM travel_stop_documents WHERE stop_id=$1', [stopId])).rows[0].n) >= 30) return fail('A stop holds up to 30 documents.');
    await c.query('INSERT INTO travel_stop_documents(stop_id,document_id,linked_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [stopId, documentId, actor.userId]);
    await c.query("INSERT INTO operations_activity(athlete_id,actor_id,document_id,action) VALUES($1,$2,$3,'stop.document_linked')", [stop.athleteId, actor.userId, documentId]);
    return { ok: true as const, message: 'Document attached to the stop.' };
  });
}

/** Everything hanging off a route's stops, for the route page. Caller has already established authority over the route. */
export async function stopLinks(stopIds: string[]) {
  if (!stopIds.length) return { contacts: [], documents: [], tasks: [], expenses: [] };
  const [contacts, documents, tasks, expenses] = await Promise.all([
    db().query('SELECT * FROM travel_stop_contacts WHERE stop_id=ANY($1::uuid[]) ORDER BY created_at', [stopIds]),
    db().query('SELECT l.stop_id,d.id,d.title,d.category,d.status FROM travel_stop_documents l JOIN athlete_documents d ON d.id=l.document_id WHERE l.stop_id=ANY($1::uuid[]) ORDER BY d.title', [stopIds]),
    db().query('SELECT t.id,t.stop_id,t.title,t.due_at,t.status,u.full_name AS assignee FROM operational_tasks t JOIN users u ON u.id=t.assigned_to WHERE t.stop_id=ANY($1::uuid[]) ORDER BY t.due_at', [stopIds]),
    db().query('SELECT id,stop_id,description,amount_cents,status FROM operational_expenses WHERE stop_id=ANY($1::uuid[]) ORDER BY created_at', [stopIds]),
  ]);
  return { contacts: contacts.rows, documents: documents.rows, tasks: tasks.rows, expenses: expenses.rows };
}
