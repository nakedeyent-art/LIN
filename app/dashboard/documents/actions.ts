"use server";
import { validateOfficePackage } from "@/lib/office-preview";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { subjectFor, canEditFamily } from "@/lib/access";
import { db } from "@/lib/db";
import { validId } from "@/lib/operations";
import { DOCUMENT_CATEGORIES, validateDocumentFile, readableDocument, lockDocumentFamily, assertUploadAllowed, UploadLimitError } from "@/lib/documents";
import { scanUpload } from "@/lib/upload-scan";

export async function uploadDocument(form: FormData) {
 const s = await requireUser();
 const athleteId=String(form.get("athlete_id")??""), documentId=String(form.get("document_id")??"");
 const base=`/dashboard/documents?athlete=${encodeURIComponent(athleteId)}`;
 const fail=(message:string):never=>redirect(`${base}&error=${encodeURIComponent(message)}`);
 const a=validId(athleteId)?await subjectFor(s,athleteId):null;
 if(!a || !canEditFamily(a)) fail("Only the athlete or a current guardian can upload to this record.");
 const title=String(form.get("title")??"").trim(), category=String(form.get("category")??"");
 if(!title || title.length>160 || !DOCUMENT_CATEGORIES.some(c=>c===category)) fail("Enter a title and valid category.");
 const file=form.get("file");
 if(!(file instanceof File)) return fail("Choose a document.");
 const bytes=Buffer.from(await file.arrayBuffer());
 let checked;
 try { checked=validateDocumentFile(file.name,bytes); await validateOfficePackage(file.name,bytes); } catch(e) { fail((e as Error).message); }
 const scan=await scanUpload(bytes); if(!scan.ok) fail(scan.message);
 const expires=String(form.get("expires_on")??"");
 if(expires && (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || !Number.isFinite(Date.parse(expires)))) fail("Enter a valid expiration date.");
 const folder=String(form.get("folder")??"").trim().slice(0,100), tags=String(form.get("tags")??"").split(",").map(t=>t.trim().slice(0,40)).filter(Boolean).slice(0,12);
 if(documentId && !validId(documentId)) fail("Invalid document.");
 const c=await db().connect(); let id=documentId;
 try {
  await c.query("BEGIN");
  await lockDocumentFamily(c,athleteId,s.userId);
  await assertUploadAllowed(c,athleteId,id||null,bytes.length);
  if(id) {
   const d=(await c.query("SELECT status FROM athlete_documents WHERE id=$1 AND athlete_id=$2 FOR UPDATE",[id,athleteId])).rows[0];
   if(!d || d.status!=="active") throw new Error("Only active documents accept new versions.");
  } else {
   id=(await c.query(`INSERT INTO athlete_documents(athlete_id,title,category,folder,tags,expires_on,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[athleteId,title,category,folder,tags,expires||null,s.userId])).rows[0].id;
  }
  await c.query(`INSERT INTO document_versions(document_id,version,file_name,media_type,contents,sha256,uploaded_by) SELECT $1,COALESCE(MAX(version),0)+1,$2,$3,$4,$5,$6 FROM document_versions WHERE document_id=$1`,[id,checked!.fileName,checked!.mediaType,bytes,checked!.sha256,s.userId]);
  await c.query("INSERT INTO operations_activity(athlete_id,actor_id,document_id,action) VALUES($1,$2,$3,$4)",[athleteId,s.userId,id,documentId?"document.version_added":"document.uploaded"]);
  await c.query("COMMIT");
 } catch(e) { await c.query("ROLLBACK"); fail(e instanceof UploadLimitError || (e instanceof Error && /access changed|active documents/.test(e.message))?(e as Error).message:"The document could not be saved. Check its details and try again."); } finally {c.release();}
 redirect(`/dashboard/documents/${id}`);
}

export async function shareDocument(form: FormData) {
 const s=await requireUser(), id=String(form.get("document_id")??""), member=String(form.get("member_id")??""), remove=form.get("remove")==="1";
 const d=await readableDocument(s,id);
 if(!d) redirect("/dashboard/documents");
 const a=await subjectFor(s,d.athlete_id);
 if(!a || !canEditFamily(a) || !validId(member)) redirect(`/dashboard/documents/${id}?error=Access+denied`);
 if(["identity","tax"].includes(d.category)) redirect(`/dashboard/documents/${id}?error=Identity+and+tax+documents+are+family+only`);
 const c=await db().connect();
 try {
  await c.query("BEGIN");
  await lockDocumentFamily(c,d.athlete_id,s.userId);
  const row=(await c.query("SELECT status FROM athlete_documents WHERE id=$1 FOR UPDATE",[id])).rows[0];
  if(row.status==='completed'&&!remove) throw new Error("Completed records cannot be changed");
  if(remove) await c.query("DELETE FROM document_grants WHERE document_id=$1 AND user_id=$2",[id,member]);
  else {
   const rel=(await c.query("SELECT 1 FROM athlete_relationships WHERE athlete_id=$1 AND member_id=$2",[d.athlete_id,member])).rowCount;
   if(!rel) throw new Error("No relationship");
   await c.query("INSERT INTO document_grants(document_id,user_id,granted_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[id,member,s.userId]);
   await c.query("UPDATE athlete_documents SET access_scope='consented' WHERE id=$1",[id]);
  }
  await c.query("INSERT INTO operations_activity(athlete_id,actor_id,document_id,action) VALUES($1,$2,$3,$4)",[d.athlete_id,s.userId,id,remove?"document.access_revoked":"document.access_granted"]);
  await c.query("COMMIT");
 } catch { await c.query("ROLLBACK"); redirect(`/dashboard/documents/${id}?error=Sharing+could+not+be+updated`); } finally {c.release();}
 redirect(`/dashboard/documents/${id}`);
}

export async function updateDocumentMetadata(form:FormData) {
 const s=await requireUser(),id=String(form.get('document_id')??''),d=await readableDocument(s,id);
 if(!d)redirect('/dashboard/documents');
 const a=await subjectFor(s,d.athlete_id);if(!a||!canEditFamily(a))redirect('/dashboard/documents');
 const {validateRecordLinks}=await import('@/lib/operational-tasks');
 const links={deal:String(form.get('deal_id')??''),event:String(form.get('event_id')??'')};
 const c=await db().connect();
 try {await c.query('BEGIN');await lockDocumentFamily(c,d.athlete_id,s.userId);const row=(await c.query('SELECT status FROM athlete_documents WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(row.status==='completed'||(await c.query("SELECT 1 FROM signing_envelopes WHERE document_id=$1 AND status NOT IN ('declined','expired','voided')",[id])).rowCount)throw new Error('This document is frozen by its signing workflow.');
  await validateRecordLinks(d.athlete_id,links,c);
  await c.query('UPDATE athlete_documents SET deal_id=$2,event_id=$3 WHERE id=$1',[id,links.deal||null,links.event||null]);
  await c.query("INSERT INTO operations_activity(athlete_id,actor_id,document_id,action) VALUES($1,$2,$3,'document.links_updated')",[d.athlete_id,s.userId,id]);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');redirect(`/dashboard/documents/${id}?error=${encodeURIComponent((e as Error).message)}`);}finally{c.release();}redirect(`/dashboard/documents/${id}`);
}
