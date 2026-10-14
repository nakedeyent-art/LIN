import { loadVersion, versionBytes, assertServable } from './file-store';
import { completeLinkedDeal } from "./deal-signing";
import type { PoolClient } from "pg";
import type { Session } from "./session";
import { db } from "./db";
import { hashToken, newSessionToken } from "./crypto";
import { validId } from "./operations";
import { completedPdf, textPdf, pdfHash } from "./signing-pdf";
import { PDFDocument } from "pdf-lib";
import { nameMatches } from "./contract";
import { appUrl } from "./mailer";
import { drainOutbox, enqueueMail } from "./outbox";
export const SIGNING_CONSENT="forg3-nil-v1";
export const FIELD_KINDS=["signature","initials","date","checkbox","text"] as const;
export type Envelope={id:string;athlete_id:string;document_id:string;version_id:string;deal_id:string|null;event_id:string|null;created_by:string;title:string;status:string;expires_at:Date};
type Runner=Pick<PoolClient,"query">;
export async function familyAuthority(userId:string,athleteId:string,c:Runner=db()) {
 return !!(await c.query("SELECT 1 FROM athlete_profiles WHERE user_id=$1 AND (user_id=$2 OR EXISTS(SELECT 1 FROM guardian_links WHERE athlete_id=$1 AND member_id=$2))",[athleteId,userId])).rowCount;
}
export async function recipientAuthorized(userId:string,capacity:string,e:Envelope,c:Runner=db()) {
 if(capacity==='athlete')return e.athlete_id===userId;
 if(capacity==='guardian')return !!(await c.query("SELECT 1 FROM guardian_links WHERE athlete_id=$1 AND member_id=$2",[e.athlete_id,userId])).rowCount;
 if(capacity==='sponsor')return !!e.deal_id&&!!(await c.query("SELECT 1 FROM deals WHERE id=$1 AND athlete_id=$2 AND counterparty_id=$3",[e.deal_id,e.athlete_id,userId])).rowCount;
 const roles=capacity==='agent'?['manager']:capacity==='school'?['coach']:['manager','coach'];
 return !!(await c.query("SELECT 1 FROM athlete_relationships WHERE athlete_id=$1 AND member_id=$2 AND relationship::text=ANY($3::text[])",[e.athlete_id,userId,roles])).rowCount;
}
export async function getEnvelope(s:Session,id:string,c:Runner=db()) {
 if(!validId(id))return null;
 const e=(await c.query("SELECT * FROM signing_envelopes WHERE id=$1",[id])).rows[0] as Envelope|undefined;
 if(!e)return null;
 if(await familyAuthority(s.userId,e.athlete_id,c))return e;
 const r=(await c.query("SELECT capacity FROM signing_recipients WHERE envelope_id=$1 AND user_id=$2",[id,s.userId])).rows[0];
 return r&&await recipientAuthorized(s.userId,r.capacity,e,c)?e:null;
}
export async function signingAudit(c:Runner,id:string,actor:string|null,action:string) {
 await c.query("INSERT INTO signing_events(envelope_id,actor_id,action) VALUES($1,$2,$3)",[id,actor,action]);
}
export async function createEnvelope(s:Session,documentId:string,days:number) {
 if(!validId(documentId)||!Number.isInteger(days)||days<1||days>90)throw new Error("Choose a document and expiration between 1 and 90 days.");
 const c=await db().connect();
 try {
  await c.query('BEGIN');
  const d=(await c.query("SELECT * FROM athlete_documents WHERE id=$1 FOR UPDATE",[documentId])).rows[0];
  if(!d||d.status!=='active'||d.category!=='contracts'||!await familyAuthority(s.userId,d.athlete_id,c))throw new Error("Choose an active agreement that you manage.");
  const v=(await c.query("SELECT * FROM document_versions WHERE document_id=$1 ORDER BY version DESC LIMIT 1",[documentId])).rows[0];
  if(!v||v.media_type!=='application/pdf')throw new Error("Signing requires a PDF. Convert the Office document to PDF first.");
  assertServable(v);   // a quarantined or unscanned file is never pinned into an agreement
  const bytes=await versionBytes(v);if(!bytes)throw new Error("The document's file is missing.");
  const pdf=await PDFDocument.load(bytes);
  if(pdf.getPageCount()>200)throw new Error("Agreements must have at most 200 pages.");
  const e=(await c.query(`INSERT INTO signing_envelopes(document_id,version_id,athlete_id,deal_id,event_id,created_by,title,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+make_interval(days=>$8)) RETURNING id`,[d.id,v.id,d.athlete_id,d.deal_id,d.event_id,s.userId,d.title,days])).rows[0];
  await signingAudit(c,e.id,s.userId,'envelope.created');await c.query('COMMIT');return e.id as string;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function addRecipient(s:Session,id:string,userId:string,capacity:string,order:number) {
 if(!validId(userId)||!['athlete','sponsor','guardian','agent','school','internal'].includes(capacity)||!Number.isInteger(order)||order<1||order>30)throw new Error("Choose a valid recipient, capacity and signing order.");
 const c=await db().connect();
 try {await c.query('BEGIN');await lockDealThenEnvelope(c,id);
  const e=await getEnvelope(s,id,c);
  if(!e||e.status!=='draft'||!await familyAuthority(s.userId,e.athlete_id,c))throw new Error("Only the family can configure a draft.");
  if(!await recipientAuthorized(userId,capacity,e,c))throw new Error("The recipient does not have this relationship to the athlete.");
  if((await c.query('SELECT count(*)::int n FROM signing_recipients WHERE envelope_id=$1',[id])).rows[0].n>=30)throw new Error("An agreement supports up to 30 recipients.");
  await c.query('INSERT INTO signing_recipients(envelope_id,user_id,capacity,signing_order) VALUES($1,$2,$3,$4)',[id,userId,capacity,order]);
  await signingAudit(c,id,s.userId,'recipient.added');await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function addField(s:Session,id:string,input:{recipient:string;kind:string;label:string;page:number;x:number;y:number;width:number;required:boolean}) {
 if(!validId(input.recipient)||!FIELD_KINDS.some(k=>k===input.kind)||!input.label.trim()||input.label.length>120||![input.x,input.y,input.width].every(Number.isFinite)||input.x<0||input.y<0||input.y>.95||input.width<=0||input.x+input.width>1||!Number.isInteger(input.page)||input.page<1)throw new Error("Enter valid field details and a position within the page.");
 const c=await db().connect();
 try {await c.query('BEGIN');await lockDealThenEnvelope(c,id);
  const e=await getEnvelope(s,id,c);
  if(!e||e.status!=='draft'||!await familyAuthority(s.userId,e.athlete_id,c))throw new Error("Only the family can configure a draft.");
  const v=await loadVersion(e.version_id,c);const vb=v&&await versionBytes(v);if(!vb)throw new Error("The document's file is missing.");
  const pdf=await PDFDocument.load(vb);
  if(input.page>pdf.getPageCount())throw new Error("This page does not exist in the PDF.");
  if((await c.query('SELECT count(*)::int n FROM signing_fields WHERE envelope_id=$1',[id])).rows[0].n>=150)throw new Error("An agreement supports up to 150 fields.");
  await c.query('INSERT INTO signing_fields(envelope_id,recipient_id,kind,label,page,x,y,width,required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,input.recipient,input.kind,input.label,input.page,input.x,input.y,input.width,input.required]);
  await signingAudit(c,id,s.userId,'field.added');await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function sendEnvelope(s:Session,id:string) {
 const c=await db().connect();
 try {await c.query('BEGIN');await lockDealThenEnvelope(c,id);
  const e=await getEnvelope(s,id,c);
  if(!e||e.status!=='draft'||!await familyAuthority(s.userId,e.athlete_id,c))throw new Error("Only the family can send a draft.");
  if(new Date(e.expires_at)<=new Date())throw new Error("This draft has expired. Create a new envelope.");
  const recipients=(await c.query('SELECT * FROM signing_recipients WHERE envelope_id=$1',[id])).rows;
  if(!recipients.length)throw new Error("Add at least one recipient.");
  const minor=(await c.query("SELECT birth_date>CURRENT_DATE-INTERVAL '18 years' AS minor FROM athlete_profiles WHERE user_id=$1",[e.athlete_id])).rows[0].minor;
  if(minor&&s.userId===e.athlete_id)throw new Error('A current guardian must send agreements for an athlete under 18.');
  if(minor&&!recipients.some(r=>r.capacity==='guardian'))throw new Error("A minor’s agreement requires a current guardian to sign.");
  for(const r of recipients){
   if(!await recipientAuthorized(r.user_id,r.capacity,e,c))throw new Error("A recipient’s relationship has changed.");
   if(!(await c.query("SELECT 1 FROM signing_fields WHERE recipient_id=$1 AND kind='signature' AND required",[r.id])).rowCount)throw new Error("Every recipient needs a required signature field.");
  }
  await c.query("UPDATE signing_envelopes SET status='sent' WHERE id=$1",[id]);
  await signingAudit(c,id,s.userId,'envelope.sent');await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 await deliverSigningNotices(id,'sent');
}
export async function startSigning(s:Session,id:string) {
 const c=await db().connect();
 try {await c.query('BEGIN');await lockDealThenEnvelope(c,id);
  const e=await getEnvelope(s,id,c);
  if(!e||!['sent','viewed','partially_signed'].includes(e.status)||new Date(e.expires_at)<=new Date())throw new Error("This envelope is not open for signing.");
  const r=(await c.query('SELECT * FROM signing_recipients WHERE envelope_id=$1 AND user_id=$2',[id,s.userId])).rows[0];
  if(!r||r.status==='signed'||!await recipientAuthorized(s.userId,r.capacity,e,c))throw new Error("You do not have a pending signature.");
  if((await c.query("SELECT 1 FROM signing_recipients WHERE envelope_id=$1 AND signing_order<$2 AND status<>'signed'",[id,r.signing_order])).rowCount)throw new Error("Earlier recipients must sign first.");
  const token=newSessionToken();
  await c.query("INSERT INTO signing_sessions(token_hash,envelope_id,recipient_id,user_id,expires_at) VALUES($1,$2,$3,$4,now()+INTERVAL '15 minutes')",[hashToken(token),id,r.id,s.userId]);
  await c.query("UPDATE signing_recipients SET status='viewed' WHERE id=$1",[r.id]);
  if(e.status==='sent')await c.query("UPDATE signing_envelopes SET status='viewed' WHERE id=$1",[id]);
  await signingAudit(c,id,s.userId,'envelope.viewed');await c.query('COMMIT');return token;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
/** Lock order everywhere is deal, then envelope: the deal paths (generating or voiding an agreement) hold the deal first, so every envelope mutation must too, or the two deadlock. */
async function lockDealThenEnvelope(c:PoolClient,envelopeId:string) {
 await c.query('SELECT d.id FROM deals d WHERE d.id=(SELECT deal_id FROM signing_envelopes WHERE id=$1) FOR UPDATE OF d',[envelopeId]);
 await c.query('SELECT 1 FROM signing_envelopes WHERE id=$1 FOR UPDATE',[envelopeId]);
}
export async function signEnvelope(s:Session,id:string,token:string,values:Record<string,string>,consent:boolean) {
 if(!consent)throw new Error("Confirm electronic signing consent.");
 const c=await db().connect();
 try {await c.query('BEGIN');await lockDealThenEnvelope(c,id);
  const e=await getEnvelope(s,id,c);
  if(!e||!['sent','viewed','partially_signed'].includes(e.status)||new Date(e.expires_at)<=new Date())throw new Error("This envelope is not open for signing.");
  const session=(await c.query('SELECT * FROM signing_sessions WHERE token_hash=$1 AND envelope_id=$2 AND user_id=$3 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[hashToken(token),id,s.userId])).rows[0];
  if(!session)throw new Error("Signing session expired. Start signing again.");
  const r=(await c.query('SELECT * FROM signing_recipients WHERE id=$1',[session.recipient_id])).rows[0];
  if(r.status==='signed'||!await recipientAuthorized(s.userId,r.capacity,e,c))throw new Error("Your signing authority has changed.");
  if((await c.query("SELECT 1 FROM signing_recipients WHERE envelope_id=$1 AND signing_order<$2 AND status<>'signed'",[id,r.signing_order])).rowCount)throw new Error("Earlier recipients must sign first.");
  const fields=(await c.query('SELECT * FROM signing_fields WHERE recipient_id=$1',[r.id])).rows;
  const clean:Record<string,string>={};
  for(const f of fields){let v=(values[f.id]??'').trim();
   if(f.kind==='date')v=new Date().toISOString().slice(0,10);
   if(v.length>300)throw new Error("A field value is too long.");
   if(f.required&&!v)throw new Error(`Complete ${f.label}.`);
   if(f.kind==='signature'&&!nameMatches(v,s.name))throw new Error("Sign using the full name on your account.");
   if(f.kind==='checkbox'&&v&&v!=='Yes')throw new Error("Invalid checkbox value.");
   clean[f.id]=v;
  }
  const sourceRow=await loadVersion(e.version_id,c);if(!sourceRow)throw new Error("The document's file is missing.");assertServable(sourceRow);
  const sourceBytes=await versionBytes(sourceRow);if(!sourceBytes)throw new Error("The document's file is missing.");const source={contents:sourceBytes,sha256:sourceRow.sha256};
  // Reject values that cannot fit before accepting irreversible evidence.
  await completedPdf(source.contents,fields,clean);
  await c.query('INSERT INTO signing_evidence(envelope_id,recipient_id,user_id,document_sha256,field_values,consent_version) VALUES($1,$2,$3,$4,$5,$6)',[id,r.id,s.userId,source.sha256,JSON.stringify(clean),SIGNING_CONSENT]);
  await c.query("UPDATE signing_recipients SET status='signed',signed_at=now() WHERE id=$1",[r.id]);
  await c.query('UPDATE signing_sessions SET used_at=now() WHERE token_hash=$1',[hashToken(token)]);
  await signingAudit(c,id,s.userId,'recipient.signed');
  const remaining=(await c.query("SELECT 1 FROM signing_recipients WHERE envelope_id=$1 AND status<>'signed'",[id])).rowCount;
  if(remaining)await c.query("UPDATE signing_envelopes SET status='partially_signed' WHERE id=$1",[id]);
  else {
   const allFields=(await c.query('SELECT * FROM signing_fields WHERE envelope_id=$1',[id])).rows;
   const evidence=(await c.query('SELECT se.*,u.full_name FROM signing_evidence se JOIN users u ON u.id=se.user_id WHERE envelope_id=$1 ORDER BY signed_at',[id])).rows;
   const merged=Object.assign({},...evidence.map(v=>v.field_values));
   const pdf=await completedPdf(source.contents,allFields,merged);
   await signingAudit(c,id,s.userId,'envelope.completed');
   const audit=(await c.query('SELECT action,actor_id,created_at FROM signing_events WHERE envelope_id=$1 ORDER BY id',[id])).rows;
   const certificate=await textPdf('Forg3 audit certificate',`Envelope: ${id}\nSource SHA-256: ${source.sha256}\nCompleted PDF SHA-256: ${pdfHash(pdf)}\nConsent: ${SIGNING_CONSENT}\n\n`+evidence.map(v=>`${v.full_name} | ${v.user_id} | ${new Date(v.signed_at).toISOString()}`).join('\n')+'\n\n'+audit.map(v=>`${new Date(v.created_at).toISOString()} ${v.action} ${v.actor_id??'system'}`).join('\n'));
   for(const [kind,bytes] of [['completed',pdf],['certificate',certificate]] as const)await c.query('INSERT INTO signing_artifacts(envelope_id,kind,contents,sha256) VALUES($1,$2,$3,$4)',[id,kind,Buffer.from(bytes),pdfHash(bytes)]);
   await completeLinkedDeal(c,id,s.userId);
   await c.query("UPDATE athlete_documents SET status='completed' WHERE id=$1 AND status<>'completed'",[e.document_id]);
   await c.query("UPDATE signing_envelopes SET status='completed',completed_at=now() WHERE id=$1",[id]);
   await c.query("INSERT INTO operations_activity(athlete_id,actor_id,document_id,deal_id,event_id,action) VALUES($1,$2,$3,$4,$5,'agreement.completed')",[e.athlete_id,s.userId,e.document_id,e.deal_id,e.event_id]);
  }
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 // Each step is its own notice: same-day dedupe must not swallow the second signature or the completion.
 const after=(await db().query("SELECT status,(SELECT count(*) FROM signing_recipients WHERE envelope_id=$1 AND signed_at IS NOT NULL) AS signed FROM signing_envelopes WHERE id=$1",[id])).rows[0];
 await deliverSigningNotices(id,after?.status==='completed'?'completed':'progress',String(after?.signed??''));
}
export async function closeEnvelope(s:Session,id:string,action:'declined'|'voided') {
 const c=await db().connect();
 try {await c.query('BEGIN');await lockDealThenEnvelope(c,id);const e=await getEnvelope(s,id,c);
  if(!e||!['draft','sent','viewed','partially_signed'].includes(e.status))throw new Error("This envelope is already closed.");
  if(action==='voided'&&!await familyAuthority(s.userId,e.athlete_id,c))throw new Error("Only the family can void this agreement.");
  if(action==='declined'){
   const r=(await c.query("SELECT * FROM signing_recipients WHERE envelope_id=$1 AND user_id=$2 AND status<>'signed'",[id,s.userId])).rows[0];
   if(!r||!await recipientAuthorized(s.userId,r.capacity,e,c))throw new Error("You cannot decline this agreement.");
   await c.query("UPDATE signing_recipients SET status='declined' WHERE id=$1",[r.id]);
  }
  await c.query('UPDATE signing_envelopes SET status=$2 WHERE id=$1',[id,action]);await signingAudit(c,id,s.userId,`envelope.${action}`);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 await deliverSigningNotices(id,action);
}
/**
 * Transactional delivery: the event, the in-app notification and the (generic) email all commit together, and retries deduplicate by day.
 * The email carries no document names, amounts or people — just a link behind login — and goes through the retrying outbox.
 */
export async function deliverSigningNotices(id:string,kind:string,variant='') {
 const c=await db().connect();
 try {await c.query('BEGIN');
  const recipients=(await c.query('SELECT r.id,r.user_id,u.email FROM signing_recipients r JOIN users u ON u.id=r.user_id WHERE r.envelope_id=$1 AND u.deleted_at IS NULL',[id])).rows;
  const label=kind==='reminder'?'needs your attention':kind;
  for(const r of recipients){const event=await c.query('INSERT INTO signing_delivery_events(envelope_id,recipient_id,kind) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id',[id,r.id,variant?`${kind}#${variant}`:kind]);
   if(!event.rowCount)continue;
   await c.query("INSERT INTO notifications(user_id,kind,title,href) VALUES($1,'account',$2,$3)",[r.user_id,`Agreement ${label}`,`/dashboard/signing/${id}`]);
   await enqueueMail(r.email,`An agreement ${label} on LIN`,`An agreement on LIN ${label==='needs your attention'?'still needs your attention':'has an update ('+label+')'}.\n\nLog in to review it: ${appUrl()}/dashboard/signing/${id}`,{dedupeKey:`signing:${event.rows[0].id}`,client:c});
  }await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 await drainOutbox(20).catch(()=>{});
}
