"use server";
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { db } from '@/lib/db';
import { validId } from '@/lib/operations';
import { capacityOn } from '@/lib/dealsdb';
import { paymentsEnabled } from '@/lib/stripe';
import { screenText } from '@/lib/content-filter';
import { createHash } from 'node:crypto';
import { checkUploads } from '@/lib/attachments';

export async function saveDealWork(form:FormData) {
 const s=await requireUser(),dealId=String(form.get('deal_id')??''),id=String(form.get('item_id')??''),action=String(form.get('action')??'');if(!validId(dealId)||(id&&!validId(id)))redirect('/dashboard/deals');
 const back=`/dashboard/deals/${dealId}?tab=deliverables`,c=await db().connect();
 try{await c.query('BEGIN');const d=(await c.query('SELECT * FROM deals WHERE id=$1 FOR UPDATE',[dealId])).rows[0];const who=d?await capacityOn(s.userId,d,c):null;
  if(!d||!who||!['active','awaiting_signature'].includes(d.status))throw new Error('This deal is not open for deliverable updates.');
  if(action==='create'){
   if(who!=='counterparty')throw new Error('Only the counterparty can add deliverable checklist items.');
   const title=String(form.get('title')??'').trim(),due=String(form.get('due_on')??'');
   if(!title||title.length>200||!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due)))throw new Error('Enter a title and valid deadline.');
   // These are operational notes, so use the same anti-abuse filter as messages.
   const minor=(await c.query("SELECT birth_date>CURRENT_DATE-INTERVAL '18 years' AS minor FROM athlete_profiles WHERE user_id=$1",[d.athlete_id])).rows[0]?.minor;
   const screened=screenText(title,{minorThread:!!minor,paymentsOn:paymentsEnabled(),platformsOk:true});if(!screened.ok)throw new Error(screened.error);
   await c.query('INSERT INTO deal_work_items(deal_id,created_by,title,due_on) VALUES($1,$2,$3,$4)',[dealId,s.userId,title,due]);
  }else{
   const item=(await c.query('SELECT * FROM deal_work_items WHERE id=$1 AND deal_id=$2 FOR UPDATE',[id,dealId])).rows[0];if(!item)throw new Error('Deliverable not found.');
   if(action==='submit'){
    if(who==='counterparty'||item.status==='accepted')throw new Error('Only the athlete or guardian can submit unfinished proof.');
    let attachment=String(form.get('attachment_id')??'');
    const file=form.get('proof_file') as File | null;
    if(file && file.size > 0){
     const bytes=new Uint8Array(await file.arrayBuffer());
     const have=(await c.query("SELECT count(*)::int AS n FROM deal_attachments WHERE deal_id=$1",[dealId])).rows[0].n as number;
     const checked=checkUploads([{ name: file.name, bytes }], have);
     if(!checked.ok)throw new Error(checked.error);
     const f=checked.files[0];
     const mid=(await c.query("INSERT INTO deal_messages(deal_id, sender_id, body) VALUES ($1,$2,$3) RETURNING id",[dealId,s.userId,`[Deliverable proof uploaded for "${item.title}"]`])).rows[0].id as string;
     const ins=(await c.query("INSERT INTO deal_attachments(message_id, deal_id, uploader_id, filename, content_type, size_bytes, sha256, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",[mid,dealId,s.userId,f.filename,f.type,f.bytes.length,createHash("sha256").update(f.bytes).digest("hex"),Buffer.from(f.bytes)]));
     attachment=ins.rows[0].id as string;
    }else{
     if(!validId(attachment)||!(await c.query('SELECT 1 FROM deal_attachments a JOIN deal_messages m ON m.id=a.message_id WHERE a.id=$1 AND a.deal_id=$2 AND m.hidden_at IS NULL',[attachment,dealId])).rowCount)throw new Error('Directly attach a file (PNG, JPG, PDF) or select an existing message attachment.');
    }
    await c.query("UPDATE deal_work_items SET status='submitted',attachment_id=$2,updated_at=now() WHERE id=$1",[id,attachment]);
   }else if(['accepted','changes_requested'].includes(action)){
    if(who!=='counterparty'||item.status!=='submitted')throw new Error('Only the counterparty can review submitted proof.');await c.query('UPDATE deal_work_items SET status=$2,updated_at=now() WHERE id=$1',[id,action]);
   }else throw new Error('Unknown action.');
  }
  await c.query('INSERT INTO deal_events(deal_id,actor_id,action,from_status,to_status) VALUES($1,$2,$3,$4,$4)',[dealId,s.userId,`deliverable_${action}`,d.status]);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');redirect(`${back}&error=${encodeURIComponent((e as Error).message)}`);}finally{c.release();}redirect(back);
}
