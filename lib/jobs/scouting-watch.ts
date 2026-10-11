import { createHash } from 'node:crypto';
import { db } from '../db';
import { visibleProspect } from '../scouting';
import type { Session } from '../session';
import type { JobResult } from './adult-transition';
export async function runScoutingWatch({dry}:{dry:boolean}):Promise<JobResult> {
 if(dry)return {processed:0,failed:0,skipped:0};
 const rows=(await db().query("SELECT b.athlete_id,u.id,u.full_name,u.email FROM recruiting_board b JOIN users u ON u.id=b.recruiter_id WHERE u.deleted_at IS NULL AND u.suspended_at IS NULL AND u.role='recruiter' ORDER BY b.updated_at DESC LIMIT 500")).rows;
 let processed=0,skipped=0;
 for(const r of rows){const s:Session={userId:r.id,name:r.full_name,email:r.email,role:'recruiter',emailVerified:true,isAdmin:false};const a=await visibleProspect(s,r.athlete_id);if(!a){skipped++;continue;}
  const events=(await db().query("SELECT e.id,e.name,d.starts_at FROM sports_attendees a JOIN events e ON e.id=a.event_id JOIN sports_event_details d ON d.event_id=e.id WHERE a.athlete_id=$1 AND d.recruiting_visible AND e.status='published' AND d.starts_at>now() ORDER BY e.id",[a.id])).rows;
  const digest=createHash('sha256').update(JSON.stringify({sport:a.sport,position:a.position,level:a.level,gradYear:a.grad_year,events})).digest('hex');
  const c=await db().connect();try{await c.query('BEGIN');await c.query('INSERT INTO scouting_watch_state(recruiter_id,athlete_id,profile_digest) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[s.userId,a.id,digest]);const previous=(await c.query('SELECT profile_digest FROM scouting_watch_state WHERE recruiter_id=$1 AND athlete_id=$2 FOR UPDATE',[s.userId,a.id])).rows[0];
   if(previous.profile_digest!==digest){await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account','A watched prospect updated their profile or shared an event',$2)",[s.userId,`/dashboard/scouting/${a.id}`]);await c.query('UPDATE scouting_watch_state SET profile_digest=$3,updated_at=now() WHERE recruiter_id=$1 AND athlete_id=$2',[s.userId,a.id,digest]);processed++;}await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 return {processed,skipped,failed:0};
}
