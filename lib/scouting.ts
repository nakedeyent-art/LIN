import { db } from './db';
import type { Session } from './session';
import { BLOCKED_SQL } from './blocksdb';
import { validId } from './operations';
/** Directory privacy continues to apply after a prospect is added to a board. */
export async function visibleProspect(s:Session,id:string) {
 if(s.role!=='recruiter'||!validId(id))return null;
 return (await db().query(`SELECT u.id,u.full_name,ap.sport,ap.position,ap.level,ap.grad_year,ap.birth_date>CURRENT_DATE-INTERVAL '18 years' AS minor,b.stage,b.id AS board_id
 FROM recruiting_board b JOIN users u ON u.id=b.athlete_id JOIN athlete_profiles ap ON ap.user_id=u.id
 WHERE b.recruiter_id=$1 AND b.athlete_id=$2 AND ap.discoverable AND u.email_verified_at IS NOT NULL AND u.deleted_at IS NULL AND u.suspended_at IS NULL
 AND (ap.birth_date<=CURRENT_DATE-INTERVAL '18 years' OR EXISTS(SELECT 1 FROM guardian_links g WHERE g.athlete_id=u.id)) AND NOT ${BLOCKED_SQL('u.id','$1::uuid')}`,[s.userId,id])).rows[0]??null;
}
export async function privateReports(s:Session,athleteId?:string) {
 if(s.role!=='recruiter'||(athleteId&&!validId(athleteId)))return [];
 // Evaluations never enter shared athlete activity or document search.
 return (await db().query('SELECT r.*,u.full_name AS author_name FROM scouting_reports r JOIN users u ON u.id=r.author_id WHERE (r.author_id=$1 OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=r.organization_id AND m.user_id=$1)) AND ($2::uuid IS NULL OR r.athlete_id=$2) ORDER BY r.created_at DESC LIMIT 200',[s.userId,athleteId??null])).rows;
}
