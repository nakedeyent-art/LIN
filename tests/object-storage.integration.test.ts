import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('../lib/mailer', () => ({ appUrl: () => 'http://localhost:3113', sendMail: async () => {} }));
import http from 'node:http';
import { db } from '../lib/db';
import { storeVersion, versionBytes, loadVersion } from '../lib/file-store';
import { eraseOperations } from '../lib/operations-erasure';

/** Minimal S3 stand-in: keeps objects in memory and requires a SigV4 header. */
const objects = new Map<string, Buffer>();
let server: http.Server, port = 0;
beforeAll(() => new Promise<void>((done) => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c)).on('end', () => {
      if (!String(req.headers.authorization).startsWith('AWS4-HMAC-SHA256')) { res.writeHead(403); return res.end(); }
      if (req.method === 'PUT') { objects.set(req.url!, Buffer.concat(chunks)); res.writeHead(200); return res.end(); }
      if (req.method === 'GET') { const o = objects.get(req.url!); res.writeHead(o ? 200 : 404); return res.end(o); }
      if (req.method === 'DELETE') { res.writeHead(objects.delete(req.url!) ? 204 : 404); return res.end(); }
      res.writeHead(405); res.end();
    });
  }).listen(0, '127.0.0.1', () => { port = (server.address() as { port: number }).port; done(); });
}));
afterAll(async () => { await db().end(); await new Promise<void>((r) => server.close(() => r())); });

let athlete: string, doc: string;
beforeEach(async () => {
  await db().query('TRUNCATE users CASCADE'); objects.clear();
  athlete = (await db().query("INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES('a@example.test','A','athlete','x',now()) RETURNING id")).rows[0].id;
  await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','college',CURRENT_DATE-INTERVAL '20 years')", [athlete]);
  doc = (await db().query("INSERT INTO athlete_documents(athlete_id,title,category,created_by) VALUES($1,'Plan','other',$1) RETURNING id", [athlete])).rows[0].id;
  Object.assign(process.env, { OBJECT_STORAGE_ENDPOINT: `http://127.0.0.1:${port}`, OBJECT_STORAGE_BUCKET: 'lin-private', OBJECT_STORAGE_ACCESS_KEY: 'AK', OBJECT_STORAGE_SECRET_KEY: 'SK' });
});
afterAll(() => { for (const k of ['OBJECT_STORAGE_ENDPOINT', 'OBJECT_STORAGE_BUCKET', 'OBJECT_STORAGE_ACCESS_KEY', 'OBJECT_STORAGE_SECRET_KEY']) delete process.env[k]; });

describe('document bytes in private object storage', () => {
  it('stores the file in the bucket, keeps only the key in Postgres, and reads it back through the same helper', async () => {
    const bytes = Buffer.from('hello private world'), c = await db().connect();
    let v: { id: string; version: number };
    try { await c.query('BEGIN'); v = await storeVersion(c, { documentId: doc, fileName: 'p.txt', mediaType: 'text/plain', bytes, sha256: 'a'.repeat(64), uploadedBy: athlete, scanStatus: 'clean' }); await c.query('COMMIT'); } finally { c.release(); }
    const row = (await loadVersion(v!.id))!;
    expect(row.contents).toBeNull();
    expect(row.storage_key).toBe(`documents/${doc}/1-${'a'.repeat(64)}`);
    expect(Number(row.size_bytes)).toBe(bytes.length);
    expect(objects.size).toBe(1);
    expect(Buffer.from((await versionBytes(row))!).toString()).toBe('hello private world');
  });
  it('removes the object when the row fails to insert, and when the account is erased', async () => {
    const c = await db().connect();
    try {
      await c.query('BEGIN');
      await expect(storeVersion(c, { documentId: '00000000-0000-0000-0000-000000000000', fileName: 'x', mediaType: 'text/plain', bytes: Buffer.from('x'), sha256: 'b'.repeat(64), uploadedBy: athlete, scanStatus: 'clean' })).rejects.toThrow();
      await c.query('ROLLBACK');
      expect(objects.size).toBe(0);
      await c.query('BEGIN');
      await storeVersion(c, { documentId: doc, fileName: 'p.txt', mediaType: 'text/plain', bytes: Buffer.from('secret'), sha256: 'c'.repeat(64), uploadedBy: athlete, scanStatus: 'clean' });
      await c.query('COMMIT');
      expect(objects.size).toBe(1);
      await c.query('BEGIN');
      await c.query("UPDATE users SET deleted_at=now() WHERE id=$1", [athlete]);
      await eraseOperations(c, athlete);
      await c.query('COMMIT');
    } finally { c.release(); }
    expect(objects.size).toBe(0);
    const row = (await db().query('SELECT storage_key,file_name FROM document_versions WHERE document_id=$1', [doc])).rows[0];
    expect(row).toMatchObject({ storage_key: null, file_name: 'removed' });
  });
});
