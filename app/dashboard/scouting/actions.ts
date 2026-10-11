"use server";
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { db } from '@/lib/db';
import { validId } from '@/lib/operations';
import { organizationFor } from '@/lib/organizations';
import { visibleProspect } from '@/lib/scouting';
export async function saveScoutingReport(form:FormData) {
 const s=await requireUser(),athlete=String(form.get('athlete_id')??'');
 if(!await visibleProspect(s,athlete))redirect('/dashboard/scouting');
 const back=`/dashboard/scouting/${athlete}`,title=String(form.get('title')??'').trim(),notes=String(form.get('notes')??'').trim(),film=String(form.get('film_url')??'').trim(),date=String(form.get('observed_on')??'');
 if(!title||title.length>160||notes.length>10000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))redirect(`${back}?error=Enter+a+title+and+observation+date`);
 if(film){try{const u=new URL(film);if(u.protocol!=='https:'||u.username||u.password||film.length>2000)throw new Error();}catch{redirect(`${back}?error=Film+links+must+use+HTTPS`);}}
 const templateId=String(form.get('template_id')??'');
 const template=validId(templateId)?(await db().query('SELECT * FROM scouting_templates WHERE id=$1 AND owner_id=$2',[templateId,s.userId])).rows[0]:null;
 const evaluation:Record<string,number>={};
 if(template)for(const criterion of template.criteria){const raw=String(form.get(`score_${criterion}`)??'');if(raw){const n=Number(raw);if(!Number.isInteger(n)||n<1||n>5)redirect(`${back}?error=Scores+must+be+1+to+5`);evaluation[criterion]=n;}}
 const organization=String(form.get('organization_id')??'');if(organization&&!await organizationFor(s.userId,organization))redirect(`${back}?error=Organization+access+denied`);
 const c=await db().connect();
 try {await c.query('BEGIN');const report=(await c.query('INSERT INTO scouting_reports(athlete_id,author_id,title,notes,film_url,observed_on,template_id,evaluation,measurables,organization_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',[athlete,s.userId,title,notes,film||null,date,template?.id??null,JSON.stringify(evaluation),String(form.get('measurables')??'').slice(0,3000),organization||null])).rows[0];await c.query("INSERT INTO scouting_activity(athlete_id,actor_id,report_id,action) VALUES($1,$2,$3,'report.created')",[athlete,s.userId,report.id]);await c.query('COMMIT');}catch{await c.query('ROLLBACK');redirect(`${back}?error=Could+not+save+report`);}finally{c.release();}redirect(back);
}
export async function saveScoutingTemplate(form:FormData) {
 const s=await requireUser();if(s.role!=='recruiter')redirect('/dashboard');
 const name=String(form.get('name')??'').trim().slice(0,120),sport=String(form.get('sport')??'').trim().slice(0,50),criteria=[...new Set(String(form.get('criteria')??'').split(',').map(s=>s.trim().slice(0,60)).filter(Boolean))].slice(0,20);
 if(!name||!sport||!criteria.length)redirect('/dashboard/scouting?error=Enter+template+details');
 await db().query('INSERT INTO scouting_templates(owner_id,name,sport,criteria) VALUES($1,$2,$3,$4)',[s.userId,name,sport,criteria]);redirect('/dashboard/scouting');
}
export async function scoutingStage(form:FormData) {
 const s=await requireUser();if(s.role!=='recruiter')redirect('/dashboard');
 const name=String(form.get('stage')??'').trim(),athlete=String(form.get('athlete_id')??'');
 if(!name||name.length>30)redirect('/dashboard/scouting?error=Stage+must+be+1+to+30+characters');
 if(athlete){if(await visibleProspect(s,athlete)){await db().query('UPDATE recruiting_board SET stage=$3,updated_at=now() WHERE recruiter_id=$1 AND athlete_id=$2',[s.userId,athlete,name]);await db().query("INSERT INTO scouting_activity(athlete_id,actor_id,action) VALUES($1,$2,'stage.changed')",[athlete,s.userId]);}}
 else await db().query('INSERT INTO scouting_stages(owner_id,name) VALUES($1,$2) ON CONFLICT DO NOTHING',[s.userId,name]);redirect('/dashboard/scouting');
}
export async function scoutingFollowup(form:FormData) {
 const s=await requireUser(),report=String(form.get('report_id')??''),id=String(form.get('followup_id')??'');
 if(s.role!=='recruiter')redirect('/dashboard');
 if(id&&validId(id))await db().query('UPDATE scouting_followups SET done=true WHERE id=$1 AND owner_id=$2',[id,s.userId]);
 else if(validId(report)){
  const title=String(form.get('title')??'').trim().slice(0,200),due=String(form.get('due_on')??'');
  if(title&&/^\d{4}-\d{2}-\d{2}$/.test(due)&&Number.isFinite(Date.parse(due)))await db().query('INSERT INTO scouting_followups(report_id,owner_id,title,due_on) SELECT id,$2,$3,$4 FROM scouting_reports WHERE id=$1 AND author_id=$2',[report,s.userId,title,due]);
 }redirect('/dashboard/scouting');
}

export async function shareScoutingReport(form:FormData) {
 const s=await requireUser(),id=String(form.get('report_id')??'');if(s.role!=='recruiter'||!validId(id))redirect('/dashboard/scouting');
 const r=(await db().query('UPDATE scouting_reports SET intentionally_shared=$3 WHERE id=$1 AND author_id=$2 RETURNING athlete_id',[id,s.userId,form.get('share')==='1'])).rows[0];
 if(r)redirect(`/dashboard/scouting/${r.athlete_id}`);redirect('/dashboard/scouting');
}

export async function attachScoutingMedia(form:FormData) {
 const s=await requireUser(),id=String(form.get('report_id')??'');if(s.role!=='recruiter'||!validId(id))redirect('/dashboard/scouting');
 const report=(await db().query('SELECT * FROM scouting_reports WHERE id=$1 AND author_id=$2',[id,s.userId])).rows[0];if(!report)redirect('/dashboard/scouting');
 const file=form.get('file');if(!(file instanceof File))redirect(`/dashboard/scouting/${report.athlete_id}?error=Choose+a+file`);
 const {checkUploads}=await import('@/lib/attachments');
 const checked=checkUploads([{name:file.name,bytes:new Uint8Array(await file.arrayBuffer())}],0);
 if(!checked.ok)redirect(`/dashboard/scouting/${report.athlete_id}?error=${encodeURIComponent(checked.error)}`);
 const {scanUpload}=await import('@/lib/upload-scan');const scan=await scanUpload(checked.files[0].bytes);if(!scan.ok)redirect(`/dashboard/scouting/${report.athlete_id}?error=${encodeURIComponent(scan.message)}`);
 const c=await db().connect();let failure='';
 try {
  await c.query('BEGIN');
  const current=await c.query('SELECT id FROM scouting_reports WHERE id=$1 AND author_id=$2 FOR UPDATE',[id,s.userId]);
  if(!current.rowCount)throw new Error('Report is no longer available');
  const count=(await c.query('SELECT count(*)::int n FROM scouting_attachments WHERE report_id=$1',[id])).rows[0].n;
  if(count>=20)throw new Error('This report has reached its limit of 20 attachments');
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended('scoutquota:'||$1,0))",[s.userId]);
  const mine=Number((await c.query('SELECT COALESCE(sum(octet_length(contents)),0)::float8 n FROM scouting_attachments WHERE uploader_id=$1',[s.userId])).rows[0].n);
  if(mine+checked.files[0].bytes.length>200*1024*1024)throw new Error('You have used your 200 MB of scouting media. Remove some before adding more.');
  const f=checked.files[0];await c.query('INSERT INTO scouting_attachments(report_id,uploader_id,file_name,media_type,contents) VALUES($1,$2,$3,$4,$5)',[id,s.userId,f.filename,f.type,Buffer.from(f.bytes)]);
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');failure=e instanceof Error?e.message:'Could not attach file';}finally{c.release();}
 redirect(`/dashboard/scouting/${report.athlete_id}${failure?'?error='+encodeURIComponent(failure):''}`);
}
