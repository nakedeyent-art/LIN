import { getSession } from "@/lib/session";
import { getEnvelope } from "@/lib/signing";
import { db } from "@/lib/db";
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const s=await getSession();if(!s?.emailVerified)return new Response('Unauthorized',{status:401});
 const {id}=await params,e=await getEnvelope(s,id);if(!e)return new Response('Not found',{status:404});
 const url=new URL(req.url),kind=url.searchParams.get('kind');
 if(kind&&!['completed','certificate'].includes(kind))return new Response('Not found',{status:404});
 const row=(kind?await db().query('SELECT contents FROM signing_artifacts WHERE envelope_id=$1 AND kind=$2',[id,kind]):await db().query('SELECT contents FROM document_versions WHERE id=$1',[e.version_id])).rows[0];
 if(!row)return new Response('Not found',{status:404});
 return new Response(new Uint8Array(row.contents),{headers:{'Content-Type':'application/pdf','Content-Disposition':`${url.searchParams.get('preview')==='1'?'inline':'attachment'}; filename="forg3-${kind??'original'}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer'}});
}
