"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser,requireRecentMfa } from "@/lib/session";
import { validId } from "@/lib/operations";
import { createEnvelope,addRecipient,addField,sendEnvelope,startSigning,signEnvelope,closeEnvelope } from "@/lib/signing";
export async function newEnvelope(form:FormData) {
 const s=await requireUser(),doc=String(form.get('document_id')??'');
 if(!validId(doc))redirect('/dashboard/documents');
 await requireRecentMfa(s,`/dashboard/documents/${doc}`);   // creating an agreement is as sensitive as signing one
 let id:string;
 try{id=await createEnvelope(s,doc,Number(form.get('days')));}catch(e){redirect(`/dashboard/documents/${doc}?error=${encodeURIComponent((e as Error).message)}`);}
 redirect(`/dashboard/signing/${id}`);
}
export async function configureEnvelope(form:FormData) {
 const s=await requireUser(),id=String(form.get('envelope_id')??''),action=String(form.get('action')??'');
 if(!validId(id))redirect('/dashboard/signing');
 try {
  if(action==='recipient')await addRecipient(s,id,String(form.get('user_id')),String(form.get('capacity')),Number(form.get('order')));
  else if(action==='field')await addField(s,id,{recipient:String(form.get('recipient_id')),kind:String(form.get('kind')),label:String(form.get('label')),page:Number(form.get('page')),x:Number(form.get('x'))/100,y:Number(form.get('y'))/100,width:Number(form.get('width'))/100,required:form.get('required')==='on'});
  else if(action==='send'){await requireRecentMfa(s,`/dashboard/signing/${id}`);await sendEnvelope(s,id);}
  else throw new Error('Unknown action.');
 }catch(e){redirect(`/dashboard/signing/${id}?error=${encodeURIComponent((e as Error).message)}`);}
 redirect(`/dashboard/signing/${id}`);
}
export async function beginSigning(form:FormData) {
 const s=await requireUser(),id=String(form.get('envelope_id')??'');
 if(!validId(id))redirect('/dashboard/signing');
 await requireRecentMfa(s,`/dashboard/signing/${id}`);
 let token:string;
 try{token=await startSigning(s,id);}catch(e){redirect(`/dashboard/signing/${id}?error=${encodeURIComponent((e as Error).message)}`);}
 (await cookies()).set(`forg3_${id}`,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:`/dashboard/signing/${id}`,maxAge:900});
 redirect(`/dashboard/signing/${id}`);
}
export async function finishSigning(form:FormData) {
 const s=await requireUser(),id=String(form.get('envelope_id')??'');
 if(!validId(id))redirect('/dashboard/signing');
 await requireRecentMfa(s,`/dashboard/signing/${id}`);
 const jar=await cookies(),token=jar.get(`forg3_${id}`)?.value??'',values:Record<string,string>={};
 for(const [key,value] of form.entries())if(key.startsWith('field_')&&typeof value==='string')values[key.slice(6)]=value;
 // A deadlock (40P01) aborts one of two racing transactions; the signature is still valid, so try it once more before giving up.
 try{try{await signEnvelope(s,id,token,values,form.get('consent')==='on');}catch(e){if((e as {code?:string}).code!=='40P01')throw e;await signEnvelope(s,id,token,values,form.get('consent')==='on');}}catch(e){redirect(`/dashboard/signing/${id}?error=${encodeURIComponent((e as Error).message)}`);}
 jar.set(`forg3_${id}`,'',{path:`/dashboard/signing/${id}`,maxAge:0});redirect(`/dashboard/signing/${id}`);
}
export async function endEnvelope(form:FormData) {
 const s=await requireUser(),id=String(form.get('envelope_id')??''),action=String(form.get('action'));
 if(!validId(id)||!['declined','voided'].includes(action))redirect('/dashboard/signing');
 await requireRecentMfa(s,`/dashboard/signing/${id}`);   // a hijacked stale session must not be able to void or decline
 try{await closeEnvelope(s,id,action as 'declined'|'voided');}catch(e){redirect(`/dashboard/signing/${id}?error=${encodeURIComponent((e as Error).message)}`);}
 redirect(`/dashboard/signing/${id}`);
}

export async function generateDealAgreement(form:FormData) {
 const s=await requireUser(),deal=String(form.get('deal_id')??'');
 if(!validId(deal))redirect('/dashboard/deals');
 // Standing first: a minor athlete is told a guardian must start the agreement rather than being sent to set up two-factor.
 const {db}=await import('@/lib/db');
 const minorHere=(await db().query("SELECT 1 FROM deals d JOIN athlete_profiles p ON p.user_id=d.athlete_id WHERE d.id=$1 AND d.athlete_id=$2 AND p.birth_date>CURRENT_DATE-INTERVAL '18 years'",[deal,s.userId])).rowCount;
 if(minorHere)redirect(`/dashboard/deals/${deal}/contract?error=${encodeURIComponent('A guardian must start the agreement for an athlete under 18.')}`);
 await requireRecentMfa(s,`/dashboard/deals/${deal}/contract`);
 const {prepareDealSigning}=await import('@/lib/deal-signing');
 let id:string;
 try{id=await prepareDealSigning(s,deal);const {deliverSigningNotices}=await import('@/lib/signing');await deliverSigningNotices(id,'sent');}catch(e){redirect(`/dashboard/deals/${deal}/contract?error=${encodeURIComponent((e as Error).message)}`);}
 redirect(`/dashboard/signing/${id}`);
}
