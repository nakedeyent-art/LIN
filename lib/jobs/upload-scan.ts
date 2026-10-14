import { db } from "../db";
import { scanUpload } from "../upload-scan";
import { versionBytes, scanMode } from "../file-store";
import type { JobResult } from "./adult-transition";

export const SCAN_BATCH = 50;

/**
 * Releases quarantined uploads. Oldest pending versions first; a clean verdict makes the file servable, an infected one quarantines it for good
 * and tells the family, and a scanner outage leaves the row pending so the next run tries again (never fails open).
 */
export async function runUploadScan({ dry }: { dry: boolean }): Promise<JobResult> {
  if (dry || scanMode() !== "async") return { processed: 0, skipped: 0, failed: 0 };
  const pending = (await db().query("SELECT id,document_id,contents,storage_key,file_name FROM document_versions WHERE scan_status='pending' ORDER BY created_at LIMIT $1", [SCAN_BATCH])).rows;
  let processed = 0, failed = 0;
  for (const v of pending) {
    try {
      const bytes = await versionBytes(v);
      if (!bytes) { await db().query("UPDATE document_versions SET scan_status='error',scanned_at=now() WHERE id=$1 AND scan_status='pending'", [v.id]); failed++; continue; }
      const r = await scanUpload(bytes);
      if (!r.ok && r.reason === "unavailable") { failed++; continue; }         // stays pending; retried next run
      const status = r.ok ? "clean" : "infected";
      const c = await db().connect();
      try {
        await c.query("BEGIN");
        await c.query("UPDATE document_versions SET scan_status=$2,scanned_at=now() WHERE id=$1 AND scan_status='pending'", [v.id, status]);
        if (status === "infected") {
          const d = (await c.query("SELECT athlete_id,title FROM athlete_documents WHERE id=$1", [v.document_id])).rows[0];
          await c.query("INSERT INTO operations_activity(athlete_id,actor_id,document_id,action) VALUES($1,$1,$2,'document.quarantined')", [d.athlete_id, v.document_id]);
          await c.query(`INSERT INTO notifications(user_id,kind,title,href) SELECT u,'account',$2,$3 FROM (SELECT $1::uuid AS u UNION SELECT member_id FROM guardian_links WHERE athlete_id=$1) p`,
            [d.athlete_id, `An uploaded file failed a malware scan and was quarantined: ${String(d.title).slice(0, 80)}`, `/dashboard/documents/${v.document_id}`]);
        }
        await c.query("COMMIT");
      } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
      processed++;
    } catch { failed++; }
  }
  return { processed, skipped: 0, failed };
}
