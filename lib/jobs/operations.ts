import { db } from '../db';
import { deliverSigningNotices } from '../signing';
import type { JobResult } from './adult-transition';
/** Idempotent reminders use durable unique delivery records; no sensitive details in notifications. */
export async function runOperationsReminders({dry}:{dry:boolean}):Promise<JobResult> {
 if(dry)return {processed:0,skipped:0,failed:0};
 let processed=0;
 const envelopes=(await db().query("SELECT id,expires_at FROM signing_envelopes WHERE status IN ('sent','viewed','partially_signed') ORDER BY expires_at LIMIT 200")).rows;
 for(const e of envelopes){
  const expired=new Date(e.expires_at)<=new Date();
  if(expired){const c=await db().connect();try{await c.query('BEGIN');const changed=await c.query("UPDATE signing_envelopes SET status='expired' WHERE id=$1 AND status IN ('sent','viewed','partially_signed') RETURNING id",[e.id]);if(changed.rowCount)await c.query("INSERT INTO signing_events(envelope_id,action) VALUES($1,'envelope.expired')",[e.id]);await c.query('COMMIT');}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}
  await deliverSigningNotices(e.id,expired?'expired':'reminder');processed++;
 }
 const reminders=(await db().query(`SELECT 'task' AS kind,t.id::text AS id,t.assigned_to AS user_id,'An operational task is due' AS title,'/dashboard/tasks?athlete='||t.athlete_id AS href FROM operational_tasks t WHERE t.status='open' AND t.due_at<=now()+INTERVAL '1 day' AND (t.assigned_to=t.athlete_id OR EXISTS(SELECT 1 FROM guardian_links g WHERE g.athlete_id=t.athlete_id AND g.member_id=t.assigned_to))
 UNION ALL SELECT 'document',d.id::text,d.athlete_id,'An athlete document expires soon','/dashboard/documents/'||d.id FROM athlete_documents d WHERE d.status='active' AND expires_on<=CURRENT_DATE+7
 UNION ALL SELECT 'scouting',f.id::text,f.owner_id,'A scouting follow-up is due','/dashboard/scouting' FROM scouting_followups f WHERE NOT done AND due_on<=CURRENT_DATE+1 LIMIT 500`)).rows;
 for(const n of reminders){const c=await db().connect();try{await c.query('BEGIN');const r=await c.query('INSERT INTO operations_reminders(resource_type,resource_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING resource_id',[n.kind,n.id,n.user_id]);if(r.rowCount){await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account',$2,$3)",[n.user_id,n.title,n.href]);processed++;}await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 return {processed,skipped:0,failed:0};
}
