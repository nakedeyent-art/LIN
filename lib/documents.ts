import { createHash } from "node:crypto";
import type { Session } from "./session";
import type { Subject } from "./access";
import { canEditFamily, subjectFor } from "./access";
import { db } from "./db";
import { validId } from "./operations";

export const DOCUMENT_CATEGORIES = ["eligibility", "identity", "tax", "medical", "travel", "contracts", "media_release", "school_compliance", "other"] as const;
export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number];
export type DocumentRow = { id: string; athlete_id: string; title: string; folder: string; category: DocumentCategory; tags: string[]; access_scope: string; expires_on: string | null; status: string; created_at: Date; deal_id: string | null; event_id: string | null; created_by: string; uploader_name?:string; granted?: boolean };
export const categoryLabel = (s: string) => s.replaceAll("_", " ");
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATHLETE_STORAGE_BYTES = 250 * 1024 * 1024;
export const MAX_VERSIONS_PER_DOCUMENT = 50;
export const MAX_DOCUMENTS_PER_ATHLETE = 500;
/** A limit the person can understand and act on (shown verbatim), as opposed to an internal failure. */
export class UploadLimitError extends Error {}

export async function storageUsed(athleteId: string, c: Pick<import('pg').PoolClient,'query'> = db()): Promise<{ bytes: number; documents: number }> {
  const r = (await c.query(`SELECT COALESCE(sum(v.size_bytes),0)::float8 AS bytes, count(DISTINCT d.id)::int AS documents
    FROM athlete_documents d LEFT JOIN document_versions v ON v.document_id=d.id WHERE d.athlete_id=$1`, [athleteId])).rows[0];
  return { bytes: Number(r.bytes), documents: r.documents };
}

/**
 * Called inside the upload transaction. Takes a per-athlete advisory lock so two simultaneous uploads cannot both squeeze under a limit.
 * Limits: total bytes stored per athlete, versions per document, documents per athlete.
 */
export async function assertUploadAllowed(c: import('pg').PoolClient, athleteId: string, documentId: string | null, addBytes: number) {
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended('docquota:'||$1, 0))", [athleteId]);
  const used = await storageUsed(athleteId, c);
  if (used.bytes + addBytes > MAX_ATHLETE_STORAGE_BYTES) throw new UploadLimitError(`This record has used ${Math.round(used.bytes / 1048576)} MB of its ${MAX_ATHLETE_STORAGE_BYTES / 1048576} MB. Remove or archive documents you no longer need first.`);
  if (documentId) {
    const v = (await c.query('SELECT count(*)::int AS n FROM document_versions WHERE document_id=$1', [documentId])).rows[0].n;
    if (v >= MAX_VERSIONS_PER_DOCUMENT) throw new UploadLimitError(`A document can have up to ${MAX_VERSIONS_PER_DOCUMENT} versions. Upload this as a new document instead.`);
  } else if (used.documents >= MAX_DOCUMENTS_PER_ATHLETE) throw new UploadLimitError(`A record can hold up to ${MAX_DOCUMENTS_PER_ATHLETE} documents.`);
}

/** Sharing is explicit per document; relationship and category consent must both still be current. */
export function canReadDocument(a: Subject, d: Pick<DocumentRow,"category"|"access_scope"|"granted">): boolean {
  if (canEditFamily(a)) return true;
  if (d.access_scope !== "consented" || !d.granted) return false;
  if (d.category === "identity" || d.category === "tax") return false;
  if (d.category === "medical") return a.health;
  if (d.category === "eligibility" || d.category === "school_compliance") return a.academics;
  return true;
}
export async function listDocuments(s: Session, athleteId: string) {
  const a = validId(athleteId) ? await subjectFor(s,athleteId) : null;
  if (!a) return [];
  const docs = (await db().query(`SELECT d.*, (SELECT full_name FROM users WHERE id=d.created_by) AS uploader_name, d.expires_on::text, EXISTS(SELECT 1 FROM document_grants g WHERE g.document_id=d.id AND g.user_id=$2) AS granted
   FROM athlete_documents d WHERE athlete_id=$1 ORDER BY created_at DESC LIMIT 500`, [athleteId,s.userId])).rows as DocumentRow[];
  return docs.filter(d => canReadDocument(a,d));
}
export async function readableDocument(s: Session, id: string) {
  if (!validId(id)) return null;
  const d = (await db().query(`SELECT d.*,d.expires_on::text, EXISTS(SELECT 1 FROM document_grants g WHERE g.document_id=d.id AND g.user_id=$2) AS granted FROM athlete_documents d WHERE d.id=$1`,[id,s.userId])).rows[0] as DocumentRow | undefined;
  if (!d) return null;
  const a = await subjectFor(s,d.athlete_id);
  return a && canReadDocument(a,d) ? d : null;
}

/** Validate binary signatures. Office files are downloadable only; never rendered as active HTML. */
export function validateDocumentFile(name: string, bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new Error("Choose a document between 1 byte and 5 MB.");
  const extension = name.split(".").pop()?.toLowerCase();
  const types: Record<string,string> = { pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",doc:"application/msword",xls:"application/vnd.ms-excel",ppt:"application/vnd.ms-powerpoint" };
  if (!extension || !types[extension]) throw new Error("Use PDF, Word, Excel or PowerPoint documents.");
  if (extension === "pdf" ? bytes.subarray(0,5).toString() !== "%PDF-" : ["docx","xlsx","pptx"].includes(extension) ? bytes.subarray(0,4).toString("hex") !== "504b0304" : bytes.subarray(0,8).toString("hex") !== "d0cf11e0a1b11ae1") throw new Error("The file content does not match its document type.");
  return { mediaType:types[extension], sha256:createHash("sha256").update(bytes).digest("hex"), fileName:name.replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,150) };
}

/** Hold current family authority until the caller's document transaction commits. */
export async function lockDocumentFamily(c: import('pg').PoolClient, athleteId:string,userId:string) {
 const profile=await c.query('SELECT 1 FROM athlete_profiles WHERE user_id=$1 FOR SHARE',[athleteId]);
 if(!profile.rowCount)throw new Error('Your access changed. Reload the record.');
 if(athleteId!==userId) {
  const guardian=await c.query('SELECT 1 FROM guardian_links WHERE athlete_id=$1 AND member_id=$2 FOR SHARE',[athleteId,userId]);
  if(!guardian.rowCount)throw new Error('Your access changed. Reload the record.');
 }
}
