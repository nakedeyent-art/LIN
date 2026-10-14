import type { PoolClient } from 'pg';
import { departAllOrganizations } from './organizations';
import { deleteStoredObjects } from './file-store';
/** Caller has already anonymized users. Retain agreements with signature evidence; erase other private records. */
export async function eraseOperations(c:PoolClient,id:string) {
 await c.query("UPDATE signing_envelopes SET status='voided' WHERE athlete_id=$1 AND status IN ('draft','sent','viewed','partially_signed')",[id]);
 await c.query('DELETE FROM signing_sessions WHERE user_id=$1 OR envelope_id IN (SELECT id FROM signing_envelopes WHERE athlete_id=$1)',[id]);
 const stored=(await c.query("SELECT v.storage_key FROM document_versions v JOIN athlete_documents d ON d.id=v.document_id WHERE d.athlete_id=$1 AND d.status<>'completed' AND v.storage_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM signing_envelopes e JOIN signing_evidence se ON se.envelope_id=e.id WHERE e.document_id=d.id)",[id])).rows.map(r=>r.storage_key as string);
 await c.query("UPDATE document_versions v SET contents=decode('00','hex'),storage_key=NULL,file_name='removed',media_type='application/octet-stream' FROM athlete_documents d WHERE d.id=v.document_id AND d.athlete_id=$1 AND d.status<>'completed' AND NOT EXISTS(SELECT 1 FROM signing_envelopes e JOIN signing_evidence se ON se.envelope_id=e.id WHERE e.document_id=d.id)",[id]);
 await deleteStoredObjects(stored);   // object-storage bytes go with the tombstone (best effort; the rows no longer point at them)
 await c.query("UPDATE athlete_documents SET title='Removed document',folder='',tags='{}',expires_on=NULL,access_scope='family',status='archived' WHERE athlete_id=$1 AND status<>'completed' AND NOT EXISTS(SELECT 1 FROM signing_envelopes e JOIN signing_evidence se ON se.envelope_id=e.id WHERE e.document_id=athlete_documents.id)",[id]);
 await c.query('DELETE FROM document_grants WHERE user_id=$1 OR document_id IN (SELECT id FROM athlete_documents WHERE athlete_id=$1)',[id]);
 await c.query("DELETE FROM travel_stop_contacts WHERE stop_id IN (SELECT s.id FROM travel_stops s JOIN travel_routes r ON r.id=s.route_id WHERE r.athlete_id=$1)",[id]);   // third parties' details go with the trip
 await c.query("UPDATE travel_stops SET name='Removed stop',details='',hotel='',contact='' WHERE route_id IN (SELECT id FROM travel_routes WHERE athlete_id=$1)",[id]);
 await c.query("UPDATE travel_routes SET name='Removed route' WHERE athlete_id=$1",[id]);
 await c.query("UPDATE operational_tasks SET title='Removed task',status='cancelled' WHERE athlete_id=$1 OR created_by=$1 OR assigned_to=$1",[id]);
 await c.query("UPDATE operational_expenses SET description='Removed expense' WHERE athlete_id=$1 OR created_by=$1",[id]);
 await c.query('DELETE FROM scouting_followups WHERE owner_id=$1 OR report_id IN (SELECT id FROM scouting_reports WHERE athlete_id=$1 OR author_id=$1)',[id]);
 await c.query('DELETE FROM scouting_activity WHERE athlete_id=$1 OR actor_id=$1',[id]);
 await c.query('DELETE FROM scouting_reports WHERE athlete_id=$1 OR author_id=$1',[id]);
 await c.query('DELETE FROM athlete_metrics WHERE athlete_id=$1',[id]);
 await c.query('DELETE FROM scouting_watch_state WHERE athlete_id=$1 OR recruiter_id=$1',[id]);
 await c.query('DELETE FROM scouting_templates WHERE owner_id=$1',[id]);
 await c.query('DELETE FROM scouting_stages WHERE owner_id=$1',[id]);
 await departAllOrganizations(c,id);
 await c.query("UPDATE sports_venues SET name='Removed venue',address='',contact_name=NULL,contact_details=NULL,latitude=NULL,longitude=NULL WHERE created_by=$1",[id]);
 await c.query("UPDATE sports_event_details SET notes='' WHERE event_id IN (SELECT id FROM events WHERE organizer_id=$1)",[id]);
 await c.query("UPDATE events SET name='Removed event',sport=NULL,location=NULL,status='cancelled' WHERE organizer_id=$1",[id]);
}
