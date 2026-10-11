import { getSession } from "@/lib/session";
import { readableDocument } from "@/lib/documents";
import { db } from "@/lib/db";
export async function GET(req: Request,{params}:{params:Promise<{id:string}>}) {
 const s=await getSession();
 if(!s?.emailVerified) return new Response("Unauthorized",{status:401});
 const {id}=await params, d=await readableDocument(s,id);
 if(!d) return new Response("Not found",{status:404});
 const url=new URL(req.url), v=url.searchParams.get("version");
 if(v && !/^[1-9]\d{0,5}$/.test(v)) return new Response("Not found",{status:404});
 const row=(await db().query("SELECT * FROM document_versions WHERE document_id=$1 AND ($2::int IS NULL OR version=$2) ORDER BY version DESC LIMIT 1",[id,v?Number(v):null])).rows[0];
 if(!row) return new Response("Not found",{status:404});
 return new Response(new Uint8Array(row.contents),{headers:{"Content-Type":row.media_type,"Content-Disposition":`${url.searchParams.get("preview")==="1" && row.media_type==="application/pdf"?"inline":"attachment"}; filename="${row.file_name}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'","Referrer-Policy":"no-referrer"}});
}
