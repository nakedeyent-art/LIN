import type { PoolClient } from "pg";
import { db } from "./db";
import { storageConfig, putObject, getObject, deleteObject, documentObjectKey } from "./storage";
import { scannerConfig } from "./upload-scan";

/**
 * Where a document version's bytes live and whether they may be served.
 *  - Bytes: Postgres (`contents`) by default; private object storage (`storage_key`) when OBJECT_STORAGE_* is configured.
 *  - Scanning: inline by default (the upload is refused on the spot). With UPLOAD_SCAN_MODE=async and a scanner configured, the upload is
 *    accepted into quarantine (`scan_status='pending'`) and becomes downloadable, previewable and signable only once the scan job marks it clean.
 */
export type ScanMode = "inline" | "async";
type Env = Record<string, string | undefined>;

export function scanMode(env: Env = process.env): ScanMode {
  if (env.UPLOAD_SCAN_MODE?.trim().toLowerCase() !== "async") return "inline";
  const cfg = scannerConfig(env);
  if (cfg.kind !== "clamav") throw new Error("UPLOAD_SCAN_MODE=async needs a scanner (UPLOAD_SCANNER).");
  return "async";
}

export type VersionRow = { id: string; document_id: string; version: number; file_name: string; media_type: string; contents: Buffer | null; storage_key: string | null; sha256: string; scan_status: "pending" | "clean" | "infected" | "error"; size_bytes: number | string };

export type StoreInput = { documentId: string; fileName: string; mediaType: string; bytes: Uint8Array; sha256: string; uploadedBy: string; scanStatus: "pending" | "clean" };

/**
 * Inserts the next version of a document inside the caller's transaction. With object storage the bytes are written first; if the transaction
 * then fails, the orphaned object is removed on a best-effort basis (and is unreachable anyway: nothing refers to it).
 */
export async function storeVersion(c: PoolClient, input: StoreInput, env: Env = process.env): Promise<{ id: string; version: number }> {
  const cfg = storageConfig(env);
  const next = (await c.query("SELECT COALESCE(MAX(version),0)+1 AS v FROM document_versions WHERE document_id=$1", [input.documentId])).rows[0].v as number;
  const key = cfg ? documentObjectKey(input.documentId, next, input.sha256) : null;
  if (cfg && key) await putObject(cfg, key, input.bytes, input.mediaType);
  try {
    const r = await c.query(
      `INSERT INTO document_versions(document_id,version,file_name,media_type,contents,storage_key,sha256,uploaded_by,size_bytes,scan_status,scanned_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $10='clean' THEN now() END) RETURNING id,version`,
      [input.documentId, next, input.fileName, input.mediaType, cfg ? null : Buffer.from(input.bytes), key, input.sha256, input.uploadedBy, input.bytes.byteLength, input.scanStatus]);
    return r.rows[0];
  } catch (e) {
    if (cfg && key) await deleteObject(cfg, key).catch(() => {});
    throw e;
  }
}

/** The bytes of a version, wherever they are. Null when object storage no longer has them. */
export async function versionBytes(row: Pick<VersionRow, "contents" | "storage_key">, env: Env = process.env): Promise<Uint8Array | null> {
  if (row.contents) return new Uint8Array(row.contents);
  if (!row.storage_key) return null;
  const cfg = storageConfig(env);
  if (!cfg) throw new Error("This file is in object storage, which is not configured on this server.");
  return getObject(cfg, row.storage_key);
}

export class QuarantinedError extends Error { status: number; constructor(m: string, status = 409) { super(m); this.status = status; } }

/** Only a clean version may be served or signed. */
export function assertServable(row: Pick<VersionRow, "scan_status">): void {
  if (row.scan_status === "clean") return;
  if (row.scan_status === "infected") throw new QuarantinedError("This file failed a malware scan and is quarantined. It cannot be opened or signed.", 451);
  throw new QuarantinedError("This file is still being checked for malware. Try again in a few minutes.", 409);
}

export const scanLabel = (status: VersionRow["scan_status"]) =>
  status === "clean" ? "" : status === "pending" ? "Checking for malware" : status === "infected" ? "Quarantined: failed malware scan" : "Scan error";

/** Removes stored objects for versions whose rows have been tombstoned by erasure. Best effort: a miss is not an error. */
export async function deleteStoredObjects(keys: string[], env: Env = process.env): Promise<void> {
  const cfg = storageConfig(env);
  if (!cfg) return;
  for (const k of keys) await deleteObject(cfg, k).catch(() => {});
}

/** Reads a version row for serving; the shape the download routes and signing need. */
export async function loadVersion(id: string, c: Pick<PoolClient, "query"> = db()): Promise<VersionRow | null> {
  return (await c.query("SELECT id,document_id,version,file_name,media_type,contents,storage_key,sha256,scan_status,size_bytes FROM document_versions WHERE id=$1", [id])).rows[0] ?? null;
}
