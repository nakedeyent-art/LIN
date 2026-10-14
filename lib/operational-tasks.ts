import { db } from './db';
import type { Session } from './session';
import type { PoolClient } from 'pg';
import { familyAuthority } from './signing';
import { validId } from './operations';
export async function validateRecordLinks(athlete:string,links:{deal?:string;event?:string;stop?:string;document?:string},c:Pick<PoolClient,'query'>=db()) {
 const checks:[string|undefined,string][]=[
  [links.deal,'SELECT 1 FROM deals WHERE id=$1 AND athlete_id=$2'],
  [links.event,'SELECT 1 FROM sports_attendees WHERE event_id=$1 AND athlete_id=$2'],
  [links.stop,'SELECT 1 FROM travel_stops s JOIN travel_routes r ON r.id=s.route_id WHERE s.id=$1 AND r.athlete_id=$2'],
  [links.document,'SELECT 1 FROM athlete_documents WHERE id=$1 AND athlete_id=$2'],
 ];
 for(const [id,query] of checks)if(id&&(!validId(id)||!(await c.query(query,[id,athlete])).rowCount))throw new Error('A linked record does not belong to this athlete.');
}
export async function operationalRecords(s:Session,athlete:string) {
 if(!validId(athlete)||!await familyAuthority(s.userId,athlete))return null;
 const [tasks,expenses]=await Promise.all([db().query('SELECT t.*,u.full_name AS assignee FROM operational_tasks t JOIN users u ON u.id=t.assigned_to WHERE athlete_id=$1 ORDER BY due_at LIMIT 200',[athlete]),db().query('SELECT * FROM operational_expenses WHERE athlete_id=$1 ORDER BY created_at DESC LIMIT 200',[athlete])]);
 return {tasks:tasks.rows,expenses:expenses.rows};
}
