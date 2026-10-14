import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { validId } from '@/lib/operations';
import { familyAuthority } from '@/lib/signing';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}) {
 const s=await getSession();if(!s?.emailVerified)return new Response('Unauthorized',{status:401});const {id}=await params;if(!validId(id))return new Response('Not found',{status:404});
 const r=(await db().query('SELECT a.*,r.author_id,r.athlete_id,r.intentionally_shared,r.organization_id FROM scouting_attachments a JOIN scouting_reports r ON r.id=a.report_id WHERE a.id=$1',[id])).rows[0];
 if(!r)return new Response('Not found',{status:404});
 const access=(s.role==='recruiter'&&(r.author_id===s.userId||!!(await db().query('SELECT 1 FROM organization_members m JOIN organizations og ON og.id=m.organization_id AND og.archived_at IS NULL WHERE m.organization_id=$1 AND m.user_id=$2',[r.organization_id,s.userId])).rowCount))||(r.intentionally_shared&&await familyAuthority(s.userId,r.athlete_id));
 if(!access)return new Response('Not found',{status:404});
 return new Response(new Uint8Array(r.contents),{headers:{'Content-Type':r.media_type,'Content-Disposition':`attachment; filename="${r.file_name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
}
