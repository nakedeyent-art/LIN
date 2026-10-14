import { db } from './db';
import { subjectFor } from './access';
import { familyAuthority } from './signing';
import type { Session } from './session';
import type { PoolClient } from 'pg';
import { validId } from './operations';
export const EVENT_KINDS=['game','camp','combine','showcase','visit','tournament','practice'] as const;
export const TRANSPORT_MODES=['flight','bus','car','train','walk','other'] as const;
export async function athleteSchedule(s:Session,athleteId:string) {
 if(!validId(athleteId)||!await subjectFor(s,athleteId))return [];
 // Exact travel times are family-only. Sharing academics or health does not grant location access.
 if(!await familyAuthority(s.userId,athleteId))return [];
 return (await db().query(`SELECT e.id,e.name,e.status,e.organizer_id,d.*,v.name AS venue_name,v.address,a.availability,a.attendance,a.guardian_consent_at
 FROM sports_attendees a JOIN events e ON e.id=a.event_id JOIN sports_event_details d ON d.event_id=e.id LEFT JOIN sports_venues v ON v.id=d.venue_id
 WHERE a.athlete_id=$1 ORDER BY d.starts_at DESC LIMIT 200`,[athleteId])).rows;
}
export async function accessibleEvent(s:Session,id:string,c:Pick<PoolClient,'query'>=db()) {
 if(!validId(id))return null;
 const e=(await c.query(`SELECT e.*,d.starts_at,d.ends_at,d.kind,d.timezone,d.venue_id FROM events e JOIN sports_event_details d ON d.event_id=e.id WHERE e.id=$1 AND
 (EXISTS(SELECT 1 FROM sports_attendees a WHERE a.event_id=e.id AND (a.athlete_id=$2 OR EXISTS(SELECT 1 FROM guardian_links g WHERE g.athlete_id=a.athlete_id AND g.member_id=$2))))`,[id,s.userId])).rows[0];
 return e??null;
}
export async function athleteRoute(s:Session,id:string) {
 if(!validId(id))return null;
 const route=(await db().query('SELECT * FROM travel_routes WHERE id=$1',[id])).rows[0];
 if(!route||!await familyAuthority(s.userId,route.athlete_id))return null;
 const stops=(await db().query('SELECT s.*,e.name AS event_name,v.latitude,v.longitude FROM travel_stops s LEFT JOIN events e ON e.id=s.event_id LEFT JOIN sports_event_details d ON d.event_id=e.id LEFT JOIN sports_venues v ON v.id=COALESCE(s.venue_id,d.venue_id) WHERE route_id=$1 ORDER BY sequence',[id])).rows;
 return {route,stops};
}
export function turnaroundWarnings(stops:{name:string;departure_at:Date|string;arrival_at:Date|string}[]) {
 const warnings:string[]=[];
 for(let i=1;i<stops.length;i++) {
  const hours=(new Date(stops[i].departure_at).getTime()-new Date(stops[i-1].arrival_at).getTime())/3600000;
  if(hours<0)warnings.push(`${stops[i].name} departs before the previous stop arrives.`);
  else if(hours<8)warnings.push(`${stops[i].name} has only ${hours.toFixed(1)} hours of turnaround.`);
 }
 return warnings;
}
