import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { storageConfig, putObject, getObject, deleteObject, s3Request, documentObjectKey } from './storage';

/** A tiny S3 stand-in: stores objects by path, insists on a SigV4 Authorization header and the payload hash header. */
const objects = new Map<string, { bytes: Buffer; type: string }>();
let server: http.Server, port = 0;
const seen: { method: string; path: string; auth: string; hash: string }[] = [];
beforeAll(() => new Promise<void>((done) => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const auth = String(req.headers.authorization ?? ''), hash = String(req.headers['x-amz-content-sha256'] ?? '');
      seen.push({ method: req.method!, path: req.url!, auth, hash });
      if (!/^AWS4-HMAC-SHA256 Credential=AK\/\d{8}\/us-east-1\/s3\/aws4_request, SignedHeaders=.*, Signature=[0-9a-f]{64}$/.test(auth)) { res.writeHead(403); return res.end(); }
      if (req.method === 'PUT') { objects.set(req.url!, { bytes: Buffer.concat(chunks), type: String(req.headers['content-type']) }); res.writeHead(200); return res.end(); }
      if (req.method === 'GET') { const o = objects.get(req.url!); if (!o) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': o.type }); return res.end(o.bytes); }
      if (req.method === 'DELETE') { res.writeHead(objects.delete(req.url!) ? 204 : 404); return res.end(); }
      res.writeHead(405); res.end();
    });
  }).listen(0, '127.0.0.1', () => { port = (server.address() as { port: number }).port; done(); });
}));
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const env = () => ({ OBJECT_STORAGE_ENDPOINT: `http://127.0.0.1:${port}`, OBJECT_STORAGE_BUCKET: 'lin-private', OBJECT_STORAGE_ACCESS_KEY: 'AK', OBJECT_STORAGE_SECRET_KEY: 'SK' });

describe('object storage adapter', () => {
  it('is off when unset, and refuses half a configuration or a non-https public endpoint', () => {
    expect(storageConfig({})).toBeNull();
    expect(() => storageConfig({ OBJECT_STORAGE_ENDPOINT: 'https://s3.example.com' })).toThrow(/must all be set/);
    expect(() => storageConfig({ ...env(), OBJECT_STORAGE_ENDPOINT: 'http://s3.example.com' })).toThrow(/https/);
    expect(() => storageConfig({ ...env(), OBJECT_STORAGE_BUCKET: 'Bad Bucket' })).toThrow(/bucket/);
    expect(storageConfig(env())).toMatchObject({ bucket: 'lin-private', region: 'us-east-1', pathStyle: true });
  });
  it('writes, reads back and deletes an object with signed, path-style requests', async () => {
    const cfg = storageConfig(env())!, key = documentObjectKey('11111111-1111-1111-1111-111111111111', 1, 'ab'.repeat(32)), bytes = new Uint8Array([1, 2, 3, 4]);
    await putObject(cfg, key, bytes, 'application/pdf');
    expect(seen.at(-1)).toMatchObject({ method: 'PUT', path: `/lin-private/${key}` });
    expect(seen.at(-1)!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(Array.from((await getObject(cfg, key))!)).toEqual([1, 2, 3, 4]);
    await deleteObject(cfg, key);
    expect(await getObject(cfg, key)).toBeNull();
    await deleteObject(cfg, key);   // deleting what is already gone is fine
  });
  it('never sends a key it did not generate', async () => {
    const cfg = storageConfig(env())!;
    await expect(s3Request(cfg, 'GET', '../etc/passwd')).rejects.toThrow(/Invalid object key/);
    await expect(s3Request(cfg, 'GET', 'documents/x y')).rejects.toThrow(/Invalid object key/);
  });
  it('reports a rejected write instead of pretending it stored the file', async () => {
    const cfg = { ...storageConfig(env())!, accessKey: 'WRONG' };
    await expect(putObject(cfg, documentObjectKey('a', 1, 'b'), new Uint8Array([1]), 'text/plain')).rejects.toThrow(/rejected/);
  });
});
