import { beforeEach,afterAll,describe,it,expect,vi } from 'vitest';
import { db } from '../lib/db';
import type { Session } from '../lib/session';
import { subjectFor } from '../lib/access';
import { listDocuments,readableDocument,validateDocumentFile,lockDocumentFamily } from '../lib/documents';
import { createEnvelope,addRecipient,addField,sendEnvelope,startSigning,signEnvelope,getEnvelope } from '../lib/signing';
import { textPdf,pdfHash } from '../lib/signing-pdf';
let athlete:Session,guardian:Session,coach:Session,stranger:Session,doc:string;
async function user(name:string,role:Session['role']) {
 const id=(await db().query('INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now()) RETURNING id',[name.toLowerCase()+'@example.test',name,role,'test'])).rows[0].id;
 return {userId:id,name,email:name+'@example.test',role,emailVerified:true,isAdmin:false};
}
beforeEach(async()=>{
 await db().query('TRUNCATE users CASCADE');
 athlete=await user('Athlete','athlete');guardian=await user('Guardian','parent');coach=await user('Coach','coach');stranger=await user('Stranger','coach');
 await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','high_school',CURRENT_DATE-INTERVAL '16 years')",[athlete.userId]);
 await db().query("INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved,can_view_health) VALUES($1,$2,'parent',true,true),($1,$3,'coach',false,false)",[athlete.userId,guardian.userId,coach.userId]);
 doc=(await db().query("INSERT INTO athlete_documents(athlete_id,title,category,created_by) VALUES($1,'Test agreement','contracts',$1) RETURNING id",[athlete.userId])).rows[0].id;
 const pdf=await textPdf('Agreement','The athlete will attend the community event.');
 await db().query("INSERT INTO document_versions(document_id,version,file_name,media_type,contents,sha256,uploaded_by) VALUES($1,1,'agreement.pdf','application/pdf',$2,$3,$4)",[doc,Buffer.from(pdf),pdfHash(pdf),athlete.userId]);
});
afterAll(async()=>{await db().end();});
describe('document boundaries',()=>{
 it('rechecks family authority within document mutations',async()=>{
  const c=await db().connect();
  try {
   await c.query('BEGIN');await lockDocumentFamily(c,athlete.userId,guardian.userId);await c.query('COMMIT');
   await db().query('DELETE FROM athlete_relationships WHERE athlete_id=$1 AND member_id=$2',[athlete.userId,guardian.userId]);
   await c.query('BEGIN');await expect(lockDocumentFamily(c,athlete.userId,guardian.userId)).rejects.toThrow('access changed');await c.query('ROLLBACK');
  }finally{c.release();}
 });

 it('denies unshared documents to linked team members and strangers',async()=>{
  expect(await readableDocument(coach,doc)).toBeNull();expect(await readableDocument(stranger,doc)).toBeNull();expect((await listDocuments(guardian,athlete.userId))).toHaveLength(1);
 });
 it('requires document grant and health consent independently, rechecking revocation',async()=>{
  await db().query("UPDATE athlete_documents SET category='medical',access_scope='consented' WHERE id=$1",[doc]);
  await db().query('INSERT INTO document_grants(document_id,user_id,granted_by) VALUES($1,$2,$3)',[doc,coach.userId,guardian.userId]);
  expect(await readableDocument(coach,doc)).toBeNull();
  await db().query('UPDATE athlete_relationships SET can_view_health=true WHERE member_id=$1',[coach.userId]);
  expect(await readableDocument(coach,doc)).not.toBeNull();
  await db().query('DELETE FROM athlete_relationships WHERE member_id=$1',[coach.userId]);expect(await readableDocument(coach,doc)).toBeNull();
 });
 it('never shares tax records through team grants',async()=>{
  await db().query("UPDATE athlete_documents SET category='tax',access_scope='consented' WHERE id=$1",[doc]);
  await db().query('INSERT INTO document_grants(document_id,user_id,granted_by) VALUES($1,$2,$3)',[doc,coach.userId,guardian.userId]);expect(await readableDocument(coach,doc)).toBeNull();
 });
 it('ends automatic guardian document access when athlete turns 18',async()=>{
  await db().query("UPDATE athlete_profiles SET birth_date=CURRENT_DATE-INTERVAL '18 years' WHERE user_id=$1",[athlete.userId]);
  expect(await readableDocument(guardian,doc)).toBeNull();expect(await subjectFor(guardian,athlete.userId)).toBeNull();
 });
 it('rejects overwriting or deleting any stored version',async()=>{
  await expect(db().query("UPDATE document_versions SET file_name='changed.pdf' WHERE document_id=$1",[doc])).rejects.toThrow('immutable');
  await expect(db().query('DELETE FROM document_versions WHERE document_id=$1',[doc])).rejects.toThrow('immutable');
 });
 it('checks file size, type and binary signature',()=>{
  expect(()=>validateDocumentFile('a.pdf',Buffer.from('<script>bad</script>'))).toThrow();
  expect(()=>validateDocumentFile('a.exe',Buffer.from('%PDF-1.7'))).toThrow();
  expect(()=>validateDocumentFile('a.pdf',Buffer.alloc(6*1024*1024))).toThrow();
 });
});
async function prepared() {
 const id=await createEnvelope(guardian,doc,30);
 await addRecipient(guardian,id,athlete.userId,'athlete',1);await addRecipient(guardian,id,guardian.userId,'guardian',2);
 const recipients=(await db().query('SELECT * FROM signing_recipients WHERE envelope_id=$1 ORDER BY signing_order',[id])).rows;
 for(const [index,r] of recipients.entries())await addField(guardian,id,{recipient:r.id,kind:'signature',label:'Full name',page:1,x:.1,y:.6+index*.1,width:.5,required:true});
 return id;
}
async function sign(s:Session,id:string,token?:string) {
 const fields=(await db().query('SELECT f.id FROM signing_fields f JOIN signing_recipients r ON r.id=f.recipient_id WHERE f.envelope_id=$1 AND r.user_id=$2',[id,s.userId])).rows;
 return signEnvelope(s,id,token??await startSigning(s,id),Object.fromEntries(fields.map(f=>[f.id,s.name])),true);
}
describe('Forg3',()=>{
 it('rejects strangers and requires current capacity',async()=>{
  await expect(createEnvelope(stranger,doc,30)).rejects.toThrow();const id=await prepared();expect(await getEnvelope(stranger,id)).toBeNull();
  await expect(addRecipient(guardian,id,stranger.userId,'school',1)).rejects.toThrow('relationship');
 });
 it('requires signatures for each recipient and guardian participation for a minor',async()=>{
  const id=await createEnvelope(guardian,doc,30);await addRecipient(guardian,id,athlete.userId,'athlete',1);
  await expect(sendEnvelope(guardian,id)).rejects.toThrow('guardian');
  await addRecipient(guardian,id,guardian.userId,'guardian',2);await expect(sendEnvelope(guardian,id)).rejects.toThrow('signature field');
 });
 it('enforces order and freezes fields after send',async()=>{
  const id=await prepared();await sendEnvelope(guardian,id);
  await expect(startSigning(guardian,id)).rejects.toThrow('Earlier');
  await expect(db().query("UPDATE signing_fields SET label='Changed' WHERE envelope_id=$1",[id])).rejects.toThrow('frozen');
 });
 it('binds signing sessions to the user and refuses duplicate evidence',async()=>{
  const id=await prepared();await sendEnvelope(guardian,id);const token=await startSigning(athlete,id);
  await expect(sign(guardian,id,token)).rejects.toThrow('session');await sign(athlete,id,token);
  await expect(sign(athlete,id,token)).rejects.toThrow('session');expect((await db().query('SELECT count(*)::int n FROM signing_evidence WHERE envelope_id=$1',[id])).rows[0].n).toBe(1);
 });
 it('completes atomically with two PDFs, immutable evidence and closed document versions',async()=>{
  const id=await prepared();await sendEnvelope(guardian,id);await sign(athlete,id);await sign(guardian,id);
  expect((await getEnvelope(athlete,id))?.status).toBe('completed');
  const artifacts=(await db().query('SELECT * FROM signing_artifacts WHERE envelope_id=$1',[id])).rows;expect(artifacts).toHaveLength(2);
  for(const a of artifacts){expect(a.contents.subarray(0,5).toString()).toBe('%PDF-');expect(pdfHash(a.contents)).toBe(a.sha256);}
  await expect(db().query("UPDATE signing_artifacts SET sha256='changed' WHERE envelope_id=$1",[id])).rejects.toThrow('immutable');
  await expect(db().query("UPDATE signing_evidence SET consent_version='changed' WHERE envelope_id=$1",[id])).rejects.toThrow('immutable');
  await expect(db().query("UPDATE athlete_documents SET title='changed' WHERE id=$1",[doc])).rejects.toThrow('immutable');
 });
 it('rechecks guardian authority after the session was issued',async()=>{
  const id=await prepared();await sendEnvelope(guardian,id);await sign(athlete,id);const token=await startSigning(guardian,id);
  await db().query('DELETE FROM athlete_relationships WHERE member_id=$1',[guardian.userId]);await expect(sign(guardian,id,token)).rejects.toThrow();
 });
 it('rejects an expired envelope without accepting evidence',async()=>{
  const id=await prepared();vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(Date.now()+31*86400000);try{await expect(sendEnvelope(guardian,id)).rejects.toThrow("expired");}finally{vi.useRealTimers();}
 });
});

describe('linked deal signing',()=>{
 it('generates only from frozen terms and activates the deal after both required signatures',async()=>{
  const {createContractForDeal}=await import('../lib/contractdb');const {prepareDealSigning}=await import('../lib/deal-signing');
  const sponsor=await user('Sponsor','sponsor');
  const deal=(await db().query("INSERT INTO deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,guardian_approved_by) VALUES($1,$2,'Camp',10000,'Attend supervised camp','awaiting_signature',$3) RETURNING id",[athlete.userId,sponsor.userId,guardian.userId])).rows[0].id;
  const c=await db().connect();try{await c.query('BEGIN');await createContractForDeal(c,deal);await c.query('COMMIT');}finally{c.release();}
  const id=await prepareDealSigning(sponsor,deal);expect(await prepareDealSigning(guardian,deal)).toBe(id);
  await expect(prepareDealSigning(stranger,deal)).rejects.toThrow();
  await sign(sponsor,id);expect((await db().query('SELECT status FROM deals WHERE id=$1',[deal])).rows[0].status).toBe('awaiting_signature');
  await sign(guardian,id);expect((await db().query('SELECT status FROM deals WHERE id=$1',[deal])).rows[0].status).toBe('active');
  expect((await db().query('SELECT count(*)::int n FROM contract_signatures WHERE contract_id IN (SELECT id FROM contracts WHERE deal_id=$1)',[deal])).rows[0].n).toBe(2);
 });
});

describe('operations privacy and lifecycle',()=>{
 it('keeps private recruiter notes out of athlete and other recruiter queries',async()=>{
  const {privateReports}=await import('../lib/scouting');const recruiter=await user('Recruiter','recruiter'),other=await user('Other','recruiter');
  await db().query("INSERT INTO scouting_reports(athlete_id,author_id,title,notes,observed_on) VALUES($1,$2,'Private','Sensitive evaluation',CURRENT_DATE)",[athlete.userId,recruiter.userId]);
  expect(await privateReports(athlete,athlete.userId)).toEqual([]);expect(await privateReports(other,athlete.userId)).toEqual([]);expect(await privateReports(recruiter,athlete.userId)).toHaveLength(1);
 });
 it('rejects cross-athlete links and hides exact schedules from a health-consented coach',async()=>{
  const {validateRecordLinks}=await import('../lib/operational-tasks');const {athleteSchedule}=await import('../lib/sports-operations');
  const other=await user('Other','athlete');await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','college','2000-01-01')",[other.userId]);
  await expect(validateRecordLinks(other.userId,{document:doc})).rejects.toThrow('belong');
  const event=(await db().query("INSERT INTO events(organizer_id,name,status) VALUES($1,'Private game','published') RETURNING id",[guardian.userId])).rows[0].id;
  await db().query("INSERT INTO sports_event_details(event_id,kind,starts_at,ends_at) VALUES($1,'game',now(),now()+INTERVAL '2 hours')",[event]);await db().query('INSERT INTO sports_attendees(event_id,athlete_id) VALUES($1,$2)',[event,athlete.userId]);
  await db().query('UPDATE athlete_relationships SET can_view_health=true WHERE member_id=$1',[coach.userId]);expect(await athleteSchedule(coach,athlete.userId)).toEqual([]);expect(await athleteSchedule(guardian,athlete.userId)).toHaveLength(1);
 });
 it('erases unsigned private files when the athlete deletes their account',async()=>{
  const {purgeAndAnonymize}=await import('../lib/account-deletion');
  const c=await db().connect();try{await c.query('BEGIN');await purgeAndAnonymize(c,athlete.userId,athlete.email);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  expect((await db().query('SELECT contents FROM document_versions WHERE document_id=$1',[doc])).rows[0].contents).toEqual(Buffer.from([0]));
  expect(await readableDocument(guardian,doc)).toBeNull();
 });
});
