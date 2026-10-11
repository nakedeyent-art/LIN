"use server";
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { db } from '@/lib/db';
import { familyAuthority } from '@/lib/signing';
import { validId } from '@/lib/operations';
import { validateRecordLinks } from '@/lib/operational-tasks';
import { parseDollarsToCents } from '@/lib/deals';
export async function saveOperationalItem(form:FormData) {
 const s=await requireUser(),athlete=String(form.get('athlete_id')??''),kind=String(form.get('kind')??''),title=String(form.get('title')??'').trim();
 if(!validId(athlete)||!await familyAuthority(s.userId,athlete))redirect('/dashboard/tasks');
 const back=`/dashboard/tasks?athlete=${athlete}`;
 if(!title||title.length>200)redirect(`${back}&error=Enter+a+title+up+to+200+characters`);
 const links={event:String(form.get('event_id')??''),deal:String(form.get('deal_id')??''),stop:String(form.get('stop_id')??''),document:String(form.get('document_id')??'')};
 const c=await db().connect();
 try {await c.query('BEGIN');await validateRecordLinks(athlete,links,c);
  if(kind==='task'){
   const assigned=String(form.get('assigned_to')??s.userId),due=String(form.get('due_at')??'');
   if(!validId(assigned)||!await familyAuthority(assigned,athlete,c)||!Number.isFinite(Date.parse(due)))throw new Error('Choose a family assignee and a due date.');
   await c.query('INSERT INTO operational_tasks(athlete_id,event_id,deal_id,stop_id,document_id,created_by,assigned_to,title,due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[athlete,links.event||null,links.deal||null,links.stop||null,links.document||null,s.userId,assigned,title,`${due}Z`]);
  }else if(kind==='expense'){
   const amount=parseDollarsToCents(String(form.get('amount')??''));if(amount===null||amount<0||amount>100000000)throw new Error('Enter a valid USD amount.');
   await c.query('INSERT INTO operational_expenses(athlete_id,event_id,stop_id,receipt_document_id,created_by,description,amount_cents) VALUES($1,$2,$3,$4,$5,$6,$7)',[athlete,links.event||null,links.stop||null,links.document||null,s.userId,title,amount]);
  }else throw new Error('Unknown item type.');
  await c.query('INSERT INTO operations_activity(athlete_id,actor_id,event_id,deal_id,document_id,action) VALUES($1,$2,$3,$4,$5,$6)',[athlete,s.userId,links.event||null,links.deal||null,links.document||null,`${kind}.created`]);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');redirect(`${back}&error=${encodeURIComponent((e as Error).message)}`);}finally{c.release();}redirect(back);
}
export async function updateOperationalItem(form:FormData) {
 const s=await requireUser(),id=String(form.get('id')??''),kind=String(form.get('kind')??''),status=String(form.get('status')??'');
 if(!validId(id)||!['task','expense'].includes(kind))redirect('/dashboard/tasks');
 const table=kind==='task'?'operational_tasks':'operational_expenses',allowed=kind==='task'?['open','done','cancelled']:['estimate','submitted','approved','reimbursed','rejected'];
 if(!allowed.includes(status))redirect('/dashboard/tasks');
 const c=await db().connect();let athlete='';
 try {await c.query('BEGIN');const row=(await c.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[id])).rows[0];
  if(!row||!await familyAuthority(s.userId,row.athlete_id,c))throw new Error('Access denied');athlete=row.athlete_id;
  // Reimbursement is a record of an external payment, never a trigger for Stripe transfers.
  await c.query(`UPDATE ${table} SET status=$2 WHERE id=$1`,[id,status]);
  await c.query('INSERT INTO operations_activity(athlete_id,actor_id,action) VALUES($1,$2,$3)',[athlete,s.userId,`${kind}.${status}`]);await c.query('COMMIT');
 }catch{await c.query('ROLLBACK');redirect('/dashboard/tasks?error=Could+not+update+item');}finally{c.release();}redirect(`/dashboard/tasks?athlete=${athlete}`);
}
