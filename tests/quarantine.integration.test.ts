import { beforeEach, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('../lib/mailer', () => ({ appUrl: () => 'http://localhost:3113', sendMail: async () => {} }));
import net from 'node:net';
import { db } from '../lib/db';
import { runUploadScan } from '../lib/jobs/upload-scan';
import { assertServable, storeVersion, versionBytes, scanMode } from '../lib/file-store';
import { createEnvelope } from '../lib/signing';
import type { Session } from '../lib/session';
import { PDFDocument } from 'pdf-lib';

/** clamd stand-in (INSTREAM protocol): OK unless the payload carries the EICAR marker; 'down' closes without answering. */
function fakeClamd(mode: 'normal' | 'down'): Promise<{ port: number; close: () => void }> {
  const server = net.createServer((s) => {
    let buf = Buffer.alloc(0), started = false; const payload: Buffer[] = [];
    s.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (!started) { const i = buf.indexOf(0); if (i < 0) return; started = true; buf = buf.subarray(i + 1); }
      for (;;) {
        if (buf.length < 4) return;
        const len = buf.readUInt32BE(0);
        if (len === 0) { if (mode === 'down') return s.destroy(); const all = Buffer.concat(payload); s.end(all.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') ? 'stream: Eicar-Signature FOUND\0' : 'stream: OK\0'); return; }
        if (buf.length < 4 + len) return;
        payload.push(buf.subarray(4, 4 + len)); buf = buf.subarray(4 + len);
      }
    });
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res({ port: (server.address() as net.AddressInfo).port, close: () => server.close() })));
}
let closers: (() => void)[] = [];
afterEach(() => { closers.forEach((c) => c()); closers = []; delete process.env.UPLOAD_SCANNER; delete process.env.UPLOAD_SCAN_MODE; });
afterAll(async () => { await db().end(); });

let athlete: Session, guardian: string, doc: string;
let pdf: Buffer;
beforeEach(async () => {
  if (!pdf) { const d = await PDFDocument.create(); d.addPage(); pdf = Buffer.from(await d.save()); }
  await db().query('TRUNCATE users CASCADE');
  const id = async (n: string, role: string) => (await db().query('INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now()) RETURNING id', [n + '@example.test', n, role, 'x'])).rows[0].id as string;
  const a = await id('athlete', 'athlete'); guardian = await id('guardian', 'parent');
  athlete = { userId: a, name: 'athlete', email: 'athlete@example.test', role: 'athlete', emailVerified: true, isAdmin: false };
  await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','high_school',CURRENT_DATE-INTERVAL '16 years')", [a]);
  await db().query("INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved) VALUES($1,$2,'parent',true)", [a, guardian]);
  doc = (await db().query("INSERT INTO athlete_documents(athlete_id,title,category,created_by) VALUES($1,'Camp waiver','contracts',$1) RETURNING id", [a])).rows[0].id;
});
async function pending(bytes: Buffer) {
  const c = await db().connect();
  try { await c.query('BEGIN'); const v = await storeVersion(c, { documentId: doc, fileName: 'w.pdf', mediaType: 'application/pdf', bytes, sha256: '0'.repeat(64), uploadedBy: athlete.userId, scanStatus: 'pending' }, {}); await c.query('COMMIT'); return v.id; }
  finally { c.release(); }
}
const status = async (id: string) => (await db().query('SELECT scan_status FROM document_versions WHERE id=$1', [id])).rows[0].scan_status as string;

describe('upload quarantine', () => {
  it('a pending upload cannot be served or pinned into an agreement until the scan job marks it clean', async () => {
    const { port, close } = await fakeClamd('normal'); closers.push(close);
    process.env.UPLOAD_SCANNER = `clamav://127.0.0.1:${port}`; process.env.UPLOAD_SCAN_MODE = 'async';
    expect(scanMode()).toBe('async');
    const v = await pending(pdf);
    const row = (await db().query('SELECT * FROM document_versions WHERE id=$1', [v])).rows[0];
    expect(() => assertServable(row)).toThrow(/still being checked/);
    await expect(createEnvelope({ ...athlete, userId: guardian, role: 'parent' }, doc, 30)).rejects.toThrow(/still being checked/);
    expect(await runUploadScan({ dry: false })).toEqual({ processed: 1, skipped: 0, failed: 0 });
    expect(await status(v)).toBe('clean');
    expect(Array.from((await versionBytes(row))!)).toEqual(Array.from(pdf));
    expect(typeof await createEnvelope({ ...athlete, userId: guardian, role: 'parent' }, doc, 30)).toBe('string');
  });
  it('an infected upload is quarantined for good, the family is told, and it never becomes servable', async () => {
    const { port, close } = await fakeClamd('normal'); closers.push(close);
    process.env.UPLOAD_SCANNER = `clamav://127.0.0.1:${port}`; process.env.UPLOAD_SCAN_MODE = 'async';
    const v = await pending(Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'));
    await runUploadScan({ dry: false });
    expect(await status(v)).toBe('infected');
    expect(() => assertServable({ scan_status: 'infected' })).toThrow(/quarantined/);
    const told = (await db().query("SELECT user_id FROM notifications WHERE title LIKE '%malware%' ORDER BY user_id")).rows.map((r) => r.user_id);
    expect(told.sort()).toEqual([athlete.userId, guardian].sort());
    expect((await db().query("SELECT count(*)::int AS n FROM operations_activity WHERE action='document.quarantined' AND document_id=$1", [doc])).rows[0].n).toBe(1);
    // The verdict is final: a second run does nothing, and nobody can flip it back.
    expect(await runUploadScan({ dry: false })).toEqual({ processed: 0, skipped: 0, failed: 0 });
    await expect(db().query("UPDATE document_versions SET scan_status='clean' WHERE id=$1", [v])).rejects.toThrow(/immutable/);
  });
  it('a scanner outage leaves uploads pending (fails closed) and retries next run', async () => {
    const { port, close } = await fakeClamd('down'); closers.push(close);
    process.env.UPLOAD_SCANNER = `clamav://127.0.0.1:${port}`; process.env.UPLOAD_SCAN_MODE = 'async';
    const v = await pending(pdf);
    expect(await runUploadScan({ dry: false })).toEqual({ processed: 0, skipped: 0, failed: 1 });
    expect(await status(v)).toBe('pending');
  });
  it('inline mode (the default) stays as before: uploads are stored clean and the job is a no-op', async () => {
    expect(scanMode({})).toBe('inline');
    expect(() => scanMode({ UPLOAD_SCAN_MODE: 'async' })).toThrow(/needs a scanner/);
    expect(await runUploadScan({ dry: false })).toEqual({ processed: 0, skipped: 0, failed: 0 });
  });
});
