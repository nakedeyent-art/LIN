"use server";
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { db } from '@/lib/db';
import { subjectFor,canManageTeam } from '@/lib/access';
import { familyAuthority } from '@/lib/signing';
import { validId } from '@/lib/operations';
export async function recordMetric(form:FormData) {
 const s=await requireUser(),athlete=String(form.get('athlete_id')??''),subject=validId(athlete)?await subjectFor(s,athlete):null;
 if(!subject||!await familyAuthority(s.userId,athlete)&&!(s.role==='coach'&&subject.health))redirect('/dashboard/metrics');
 const label=String(form.get('label')??'').trim(),value=String(form.get('value')??'').trim(),source=String(form.get('source')??'').trim(),date=String(form.get('recorded_on')??'');
 if(!label||label.length>100||!value||value.length>100||!source||source.length>500||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))redirect(`/dashboard/metrics?athlete=${athlete}&error=Enter+complete+metric+details`);
 const visible=form.get('recruiting_visible')==='on'&&await canManageTeam(s,athlete);
 await db().query('INSERT INTO athlete_metrics(athlete_id,recorded_by,label,value,source,recorded_on,recruiting_visible) VALUES($1,$2,$3,$4,$5,$6,$7)',[athlete,s.userId,label,value,source,date,visible]);redirect(`/dashboard/metrics?athlete=${athlete}`);
}
export async function verifyMetric(form:FormData) {
 const s=await requireUser(),id=String(form.get('metric_id')??'');if(s.role!=='coach'||!validId(id))redirect('/dashboard/metrics');
 const m=(await db().query('SELECT * FROM athlete_metrics WHERE id=$1',[id])).rows[0],subject=m?await subjectFor(s,m.athlete_id):null;
 if(!m||!subject?.health||m.recorded_by===s.userId)redirect('/dashboard/metrics?error=Verification+requires+an+independent+linked+coach+with+health+consent');
 await db().query('UPDATE athlete_metrics SET verified_by=$2,verified_at=now() WHERE id=$1 AND verified_by IS NULL',[id,s.userId]);redirect(`/dashboard/metrics?athlete=${m.athlete_id}`);
}
