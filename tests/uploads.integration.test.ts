import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { db } from '../lib/db';
import { assertUploadAllowed, storageUsed, UploadLimitError, MAX_ATHLETE_STORAGE_BYTES, MAX_VERSIONS_PER_DOCUMENT, MAX_DOCUMENTS_PER_ATHLETE } from '../lib/documents';

let athlete: string, doc: string;
beforeEach(async () => {
  await db().query('TRUNCATE users CASCADE');
  athlete = (await db().query("INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES('a@example.test','A','athlete','x',now()) RETURNING id")).rows[0].id;
  await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','college',CURRENT_DATE-INTERVAL '20 years')", [athlete]);
  doc = (await db().query("INSERT INTO athlete_documents(athlete_id,title,category,created_by) VALUES($1,'D','contracts',$1) RETURNING id", [athlete])).rows[0].id;
});
afterAll(async () => { await db().end(); });
const addVersion = (bytes: number, version: number) =>
  db().query("INSERT INTO document_versions(document_id,version,file_name,media_type,contents,sha256,uploaded_by) VALUES($1,$2,'a.pdf','application/pdf',decode(repeat('ab',$3),'hex'),repeat('0',64),$4)", [doc, version, bytes, athlete]);
async function check(documentId: string | null, add: number) {
  const c = await db().connect();
  try { await c.query('BEGIN'); await assertUploadAllowed(c, athlete, documentId, add); await c.query('ROLLBACK'); return 'ok'; }
  catch (e) { await c.query('ROLLBACK'); return e instanceof UploadLimitError ? e.message : 'unexpected: ' + (e as Error).message; } finally { c.release(); }
}

describe('upload limits', () => {
  it('counts the bytes actually stored, across every version', async () => {
    await addVersion(1000, 1); await addVersion(2500, 2);
    expect(await storageUsed(athlete)).toEqual({ bytes: 3500, documents: 1 });
  });
  it('allows exactly up to the storage limit and not one byte more', async () => {
    await addVersion(1000, 1);
    expect(await check(doc, MAX_ATHLETE_STORAGE_BYTES - 1000)).toBe('ok');
    expect(await check(doc, MAX_ATHLETE_STORAGE_BYTES - 1000 + 1)).toMatch(/used 0 MB of its 250 MB/);
    expect(await check(null, MAX_ATHLETE_STORAGE_BYTES)).toMatch(/250 MB/);
  });
  it('caps versions per document', async () => {
    for (let v = 1; v <= MAX_VERSIONS_PER_DOCUMENT; v++) await addVersion(1, v);
    expect(await check(doc, 10)).toMatch(/up to 50 versions/);
    expect(await check(null, 10)).toBe('ok');                       // a new document is still fine
  });
  it('caps documents per athlete', async () => {
    await db().query("INSERT INTO athlete_documents(athlete_id,title,category,created_by) SELECT $1,'D'||g,'other',$1 FROM generate_series(1,$2) g", [athlete, MAX_DOCUMENTS_PER_ATHLETE - 2]);
    expect(await check(null, 10)).toBe('ok');                       // the 500th document (499 exist: the beforeEach one plus 498)
    await db().query("INSERT INTO athlete_documents(athlete_id,title,category,created_by) VALUES($1,'last','other',$1)", [athlete]);
    expect(await check(null, 10)).toMatch(/up to 500 documents/);
    expect(await check(doc, 10)).toBe('ok');                         // new versions of existing documents are still allowed
  });
  it('limits are per athlete', async () => {
    const other = (await db().query("INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES('b@example.test','B','athlete','x',now()) RETURNING id")).rows[0].id;
    await db().query("INSERT INTO athlete_profiles(user_id,sport,level,birth_date) VALUES($1,'Soccer','college',CURRENT_DATE-INTERVAL '20 years')", [other]);
    await addVersion(5000, 1);
    expect((await storageUsed(other)).bytes).toBe(0);
  });
});
