"use server";
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { db } from '@/lib/db';
import { familyAuthority } from '@/lib/signing';
import { validId } from '@/lib/operations';
import { EVENT_KINDS,accessibleEvent } from '@/lib/sports-operations';
export async function addSportsEvent(form:FormData) {
 const s=await requireUser(),athlete=String(form.get('athlete_id')??''),name=String(form.get('name')??'').trim(),kind=String(form.get('kind')??''),start=String(form.get('starts_at')??''),end=String(form.get('ends_at')??'');
 const back=`/dashboard/schedule?athlete=${encodeURIComponent(athlete)}`;
 if(!validId(athlete)||!await familyAuthority(s.userId,athlete))redirect(`${back}&error=Access+denied`);
 if(!name||name.length>160||!EVENT_KINDS.some(k=>k===kind)||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start))redirect(`${back}&error=Enter+a+name+and+valid+start+and+end+times`);
 const season=String(form.get('season_id')??'');
 const seasonRecord=validId(season)?(await db().query('SELECT * FROM sports_seasons WHERE id=$1 AND (created_by=$2 OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=sports_seasons.organization_id AND m.user_id=$2))',[season,s.userId])).rows[0]:null;
 if(season&&!seasonRecord)redirect(`${back}&error=Season+access+denied`);
 if(seasonRecord&&(start.slice(0,10)<new Date(seasonRecord.starts_on).toISOString().slice(0,10)||end.slice(0,10)>new Date(seasonRecord.ends_on).toISOString().slice(0,10)))redirect(`${back}&error=Event+dates+must+fall+inside+the+season`);
 const {canManageTeam}=await import('@/lib/access');
 const recruitingVisible=form.get('recruiting_visible')==='on'&&await canManageTeam(s,athlete);
 const lat=String(form.get('latitude')??''),lon=String(form.get('longitude')??'');
 if((lat||lon)&&(!lat||!lon||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))||Math.abs(Number(lat))>90||Math.abs(Number(lon))>180))redirect(`${back}&error=Enter+valid+latitude+and+longitude`);
 const c=await db().connect();
 try {await c.query('BEGIN');
  const venueName=String(form.get('venue')??'').trim().slice(0,160),address=String(form.get('address')??'').trim().slice(0,300);
  const reuse=String(form.get('venue_id')??''),reused=validId(reuse)?(await c.query('SELECT id FROM sports_venues WHERE id=$1 AND created_by=$2',[reuse,s.userId])).rows[0]?.id:null;
  const venue=reused??(venueName?(await c.query('INSERT INTO sports_venues(created_by,name,address,latitude,longitude) VALUES($1,$2,$3,$4,$5) RETURNING id',[s.userId,venueName,address,lat?Number(lat):null,lon?Number(lon):null])).rows[0].id:null);
  const event=(await c.query("INSERT INTO events(organizer_id,name,starts_on,status) VALUES($1,$2,$3,'published') RETURNING id",[s.userId,name,start.slice(0,10)])).rows[0].id;
  await c.query('INSERT INTO sports_event_details(event_id,kind,starts_at,ends_at,venue_id,season_id,organization_id,recruiting_visible) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[event,kind,`${start}Z`,`${end}Z`,venue,seasonRecord?.id??null,seasonRecord?.organization_id??null,recruitingVisible]);
  await c.query('INSERT INTO sports_attendees(event_id,athlete_id) VALUES($1,$2)',[event,athlete]);
  await c.query("INSERT INTO operations_activity(athlete_id,actor_id,event_id,action) VALUES($1,$2,$3,'event.created')",[athlete,s.userId,event]);
  await c.query('COMMIT');
 }catch{await c.query('ROLLBACK');redirect(`${back}&error=Could+not+save+event`);}finally{c.release();}
 redirect(back);
}
export async function updateAttendance(form:FormData) {
 const s=await requireUser(),athlete=String(form.get('athlete_id')??''),event=String(form.get('event_id')??''),availability=String(form.get('availability')??''),attendance=String(form.get('attendance')??'');
 if(!validId(athlete)||!validId(event)||!await familyAuthority(s.userId,athlete)||!await accessibleEvent(s,event))redirect('/dashboard/schedule');
 if(!['unknown','available','unavailable','tentative'].includes(availability)||!['expected','attended','absent'].includes(attendance))redirect('/dashboard/schedule');
 await db().query('UPDATE sports_attendees SET availability=$3,attendance=$4 WHERE event_id=$1 AND athlete_id=$2',[event,athlete,availability,attendance]);
 const consent=String(form.get('consent')??'');
 if(consent==='give'||consent==='revoke'){
  const {setGuardianConsent}=await import('@/lib/sports-events');
  const r=await setGuardianConsent(s.userId,athlete,event,consent==='give');
  if(!r.ok)redirect(`/dashboard/schedule?athlete=${athlete}&error=${encodeURIComponent(r.error)}`);
 }
 redirect(`/dashboard/schedule?athlete=${athlete}`);
}
export async function updateSportsEvent(form:FormData) {
 const s=await requireUser(),athlete=String(form.get('athlete_id')??''),event=String(form.get('event_id')??''),g=(k:string)=>String(form.get(k)??'');
 const {updateEvent}=await import('@/lib/sports-events');
 const r=await updateEvent(s,event,{name:g('name'),kind:g('kind'),startsAt:g('starts_at'),endsAt:g('ends_at'),venue:g('venue'),address:g('address'),latitude:g('latitude'),longitude:g('longitude'),notes:g('notes'),recruitingVisible:form.get('recruiting_visible')==='on'});
 redirect(`/dashboard/schedule?athlete=${encodeURIComponent(athlete)}&${r.ok?'msg':'error'}=${encodeURIComponent(r.ok?r.message??'Saved.':r.error)}`);
}
export async function cancelSportsEvent(form:FormData) {
 const s=await requireUser(),athlete=String(form.get('athlete_id')??''),event=String(form.get('event_id')??'');
 const {cancelEvent}=await import('@/lib/sports-events');
 const r=await cancelEvent(s,event);
 redirect(`/dashboard/schedule?athlete=${encodeURIComponent(athlete)}&${r.ok?'msg':'error'}=${encodeURIComponent(r.ok?r.message??'Cancelled.':r.error)}`);
}

export async function createSeason(form:FormData) {
 const s=await requireUser(),name=String(form.get('name')??'').trim(),start=String(form.get('starts_on')??''),end=String(form.get('ends_on')??''),organization=String(form.get('organization_id')??'');
 const {organizationFor}=await import('@/lib/organizations');
 if(!name||name.length>120||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||end<start||(organization&&!await organizationFor(s.userId,organization)))redirect('/dashboard/schedule?error=Enter+valid+season+details');
 await db().query('INSERT INTO sports_seasons(created_by,name,starts_on,ends_on,organization_id) VALUES($1,$2,$3,$4,$5)',[s.userId,name,start,end,organization||null]);redirect('/dashboard/schedule');
}

export async function addEventAttendee(form:FormData) {
 const s=await requireUser(),athlete=String(form.get('athlete_id')??''),event=String(form.get('event_id')??''),other=String(form.get('other_athlete_id')??'');
 const {addAttendee}=await import('@/lib/sports-events');
 const r=await addAttendee(s,event,other);
 redirect(`/dashboard/schedule?athlete=${encodeURIComponent(athlete)}&${r.ok?'msg':'error'}=${encodeURIComponent(r.ok?r.message??'Added.':r.error)}`);
}
export async function removeEventAttendee(form:FormData) {
 const s=await requireUser(),athlete=String(form.get('athlete_id')??''),event=String(form.get('event_id')??'');
 const {removeAttendee}=await import('@/lib/sports-events');
 const r=await removeAttendee(s,event,athlete);
 redirect(`/dashboard/schedule?athlete=${encodeURIComponent(athlete)}&${r.ok?'msg':'error'}=${encodeURIComponent(r.ok?r.message??'Removed.':r.error)}`);
}
