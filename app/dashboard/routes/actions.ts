"use server";
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { db } from '@/lib/db';
import { familyAuthority } from '@/lib/signing';
import { validId } from '@/lib/operations';
import { athleteRoute,TRANSPORT_MODES } from '@/lib/sports-operations';
export async function createRoute(form:FormData) {
 const s=await requireUser(),athlete=String(form.get('athlete_id')??''),name=String(form.get('name')??'').trim();
 if(!validId(athlete)||!await familyAuthority(s.userId,athlete)||!name||name.length>120)redirect('/dashboard/routes?error=Choose+an+athlete+and+route+name');
 const row=(await db().query('INSERT INTO travel_routes(athlete_id,created_by,name) VALUES($1,$2,$3) RETURNING id',[athlete,s.userId,name])).rows[0];redirect(`/dashboard/routes/${row.id}`);
}
export async function addStop(form:FormData) {
 const s=await requireUser(),id=String(form.get('route_id')??''),data=await athleteRoute(s,id);
 if(!data)redirect('/dashboard/routes');
 const name=String(form.get('name')??'').trim(),depart=String(form.get('departure_at')??''),arrive=String(form.get('arrival_at')??''),mode=String(form.get('mode')??''),event=String(form.get('event_id')??'');
 const fail=(msg:string):never=>redirect(`/dashboard/routes/${id}?error=${encodeURIComponent(msg)}`);
 if(!name||name.length>160||!TRANSPORT_MODES.some(m=>m===mode)||!Number.isFinite(Date.parse(depart))||!Number.isFinite(Date.parse(arrive))||Date.parse(arrive)<Date.parse(depart))return fail('Enter valid times, transport and a stop name.');
 if(event&&(!validId(event)||!(await db().query('SELECT 1 FROM sports_attendees WHERE event_id=$1 AND athlete_id=$2',[event,data.route.athlete_id])).rowCount))return fail('Select an event on this athlete’s schedule.');
 const c=await db().connect();
 try{await c.query('BEGIN');await c.query('SELECT 1 FROM travel_routes WHERE id=$1 FOR UPDATE',[id]);
  await c.query(`INSERT INTO travel_stops(route_id,event_id,sequence,name,departure_at,arrival_at,mode,details,hotel,contact) SELECT $1,$2,COALESCE(MAX(sequence),0)+1,$3,$4,$5,$6,$7,$8,$9 FROM travel_stops WHERE route_id=$1`,[id,event||null,name,`${depart}Z`,`${arrive}Z`,mode,String(form.get('details')??'').slice(0,2000),String(form.get('hotel')??'').slice(0,500),String(form.get('contact')??'').slice(0,300)]);
  await c.query('COMMIT');
 }catch{await c.query('ROLLBACK');fail('The stop could not be saved.');}finally{c.release();}redirect(`/dashboard/routes/${id}`);
}
