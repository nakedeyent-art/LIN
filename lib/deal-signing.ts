import type { Session } from './session';
import type { PoolClient } from 'pg';
import { db } from './db';
import { capacityOn } from './dealsdb';
import { textPdf,pdfHash } from './signing-pdf';
import { PDFDocument } from 'pdf-lib';
import { validId } from './operations';
import { ESIGN_CONSENT_VERSION } from './contract';
/** Generate Forg3 from the frozen contract, never from submitted terms. Existing signed legacy contracts stay intact. */
export async function prepareDealSigning(s:Session,dealId:string) {
 if(!validId(dealId))throw new Error('Invalid deal');const c=await db().connect();
 try{await c.query('BEGIN');const d=(await c.query('SELECT * FROM deals WHERE id=$1 FOR UPDATE',[dealId])).rows[0];
  if(!d||!await capacityOn(s.userId,d,c))throw new Error('Deal unavailable');
  const k=(await c.query('SELECT * FROM contracts WHERE deal_id=$1',[dealId])).rows[0];
  if(!k||k.executed_at||k.voided_at||d.status!=='awaiting_signature'||(d.expires_at&&new Date(d.expires_at)<=new Date()))throw new Error('This deal is not open for signing.');
  const existing=(await c.query('SELECT id FROM signing_envelopes WHERE legacy_contract_id=$1',[k.id])).rows[0];
  if(existing){await c.query('COMMIT');return existing.id as string;}
  if((await c.query('SELECT 1 FROM contract_signatures WHERE contract_id=$1',[k.id])).rowCount)throw new Error('This agreement already has a legacy signature. Finish it in the original agreement view.');
  const minor=(await c.query("SELECT birth_date>CURRENT_DATE-INTERVAL '18 years' AS minor FROM athlete_profiles WHERE user_id=$1",[d.athlete_id])).rows[0].minor;
  const guardian=minor?(await c.query('SELECT member_id FROM guardian_links WHERE athlete_id=$1 ORDER BY (member_id=$2) DESC,member_id LIMIT 1',[d.athlete_id,d.guardian_approved_by])).rows[0]?.member_id:null;
  if(minor&&!guardian)throw new Error('A current guardian is required.');
  const pdf=await PDFDocument.load(await textPdf(d.title,k.body));pdf.addPage();const bytes=await pdf.save(),page=pdf.getPageCount();
  const doc=(await c.query("INSERT INTO athlete_documents(athlete_id,deal_id,title,category,created_by) VALUES($1,$2,$3,'contracts',$4) RETURNING id",[d.athlete_id,d.id,d.title,s.userId])).rows[0];
  const version=(await c.query("INSERT INTO document_versions(document_id,version,file_name,media_type,contents,sha256,uploaded_by) VALUES($1,1,'nil-agreement.pdf','application/pdf',$2,$3,$4) RETURNING id",[doc.id,Buffer.from(bytes),pdfHash(bytes),s.userId])).rows[0];
  const env=(await c.query("INSERT INTO signing_envelopes(document_id,version_id,athlete_id,deal_id,created_by,title,expires_at,legacy_contract_id) VALUES($1,$2,$3,$4,$5,$6,COALESCE($7,now()+INTERVAL '30 days'),$8) RETURNING id",[doc.id,version.id,d.athlete_id,d.id,s.userId,d.title,d.expires_at,k.id])).rows[0];
  const parties=[{user:d.counterparty_id,capacity:'sponsor'},{user:guardian??d.athlete_id,capacity:minor?'guardian':'athlete'}];
  for(const [index,p] of parties.entries()){
   const recipient=(await c.query('INSERT INTO signing_recipients(envelope_id,user_id,capacity,signing_order) VALUES($1,$2,$3,$4) RETURNING id',[env.id,p.user,p.capacity,index+1])).rows[0];
   await c.query("INSERT INTO signing_fields(envelope_id,recipient_id,kind,label,page,x,y,width) VALUES($1,$2,'signature',$3,$4,.1,$5,.7),($1,$2,'date','Date',$4,.1,$6,.5)",[env.id,recipient.id,`${p.capacity} full name`,page,.15+index*.3,.23+index*.3]);
  }
  await c.query("UPDATE signing_envelopes SET status='sent' WHERE id=$1",[env.id]);
  await c.query("INSERT INTO signing_events(envelope_id,actor_id,action) VALUES($1,$2,'envelope.generated_from_deal'),($1,$2,'envelope.sent')",[env.id,s.userId]);
  await c.query('COMMIT');return env.id as string;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
/** Called inside Forg3's locked completion transaction. Only generated contract envelopes activate deals. */
export async function completeLinkedDeal(c:PoolClient,envelopeId:string,actor:string) {
 const e=(await c.query('SELECT * FROM signing_envelopes WHERE id=$1',[envelopeId])).rows[0];
 if(!e.legacy_contract_id)return;
 const d=(await c.query('SELECT * FROM deals WHERE id=$1 FOR UPDATE',[e.deal_id])).rows[0];
 const k=(await c.query('SELECT * FROM contracts WHERE id=$1',[e.legacy_contract_id])).rows[0];
 if(d.status!=='awaiting_signature'||k.voided_at||k.executed_at||(d.expires_at&&new Date(d.expires_at)<=new Date()))throw new Error('The deal is no longer open for signing.');
 const evidence=(await c.query('SELECT r.user_id,r.capacity,se.field_values,se.signed_at FROM signing_recipients r JOIN signing_evidence se ON se.recipient_id=r.id WHERE r.envelope_id=$1',[envelopeId])).rows;
 for(const r of evidence){
  const capacity=await capacityOn(r.user_id,d,c);
  if(!capacity||capacity!==(r.capacity==='sponsor'?'counterparty':r.capacity))throw new Error('A deal party’s authority changed.');
  const field=(await c.query("SELECT id FROM signing_fields WHERE envelope_id=$1 AND recipient_id IN (SELECT id FROM signing_recipients WHERE envelope_id=$1 AND user_id=$2) AND kind='signature' LIMIT 1",[envelopeId,r.user_id])).rows[0];
  await c.query('INSERT INTO contract_signatures(contract_id,signer_user_id,signer_role,typed_name,consent_version,document_sha256,signed_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[k.id,r.user_id,capacity,r.field_values[field.id],ESIGN_CONSENT_VERSION,k.sha256,r.signed_at]);
 }
 await c.query('UPDATE contracts SET executed_at=now() WHERE id=$1',[k.id]);
 await c.query("UPDATE deals SET status='active',expires_at=NULL,updated_at=now() WHERE id=$1",[d.id]);
 await c.query("INSERT INTO deal_events(deal_id,actor_id,action,from_status,to_status) VALUES($1,$2,'sign','awaiting_signature','active')",[d.id,actor]);
}
