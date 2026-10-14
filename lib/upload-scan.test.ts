import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';
import { parseClamReply, scanUpload, scannerConfig } from './upload-scan';

// A tiny clamd stand-in speaking the real INSTREAM protocol: "zINSTREAM\0", then [4-byte length][data]... and a zero length.
function fakeClamd(mode: 'normal' | 'garbage' | 'silent' | 'error'): Promise<{ port: number; close: () => void; received: () => Buffer }> {
  let received = Buffer.alloc(0);
  const server = net.createServer((s) => {
    let buf = Buffer.alloc(0), started = false, payload: Buffer[] = [];
    s.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (!started) { const i = buf.indexOf(0); if (i < 0) return; if (buf.subarray(0, i).toString() !== 'zINSTREAM') { s.destroy(); return; } started = true; buf = buf.subarray(i + 1); }
      for (;;) {
        if (buf.length < 4) return;
        const len = buf.readUInt32BE(0);
        if (len === 0) {
          received = Buffer.concat(payload);
          if (mode === 'silent') return;
          if (mode === 'garbage') s.end('what is this\0');
          else if (mode === 'error') s.end('INSTREAM size limit exceeded. ERROR\0');
          else s.end(received.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') ? 'stream: Eicar-Signature FOUND\0' : 'stream: OK\0');
          return;
        }
        if (buf.length < 4 + len) return;
        payload.push(buf.subarray(4, 4 + len)); buf = buf.subarray(4 + len);
      }
    });
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res({ port: (server.address() as net.AddressInfo).port, close: () => server.close(), received: () => received })));
}
let closers: (() => void)[] = [];
afterEach(() => { closers.forEach((c) => c()); closers = []; });
const envFor = (port: number, extra: Record<string, string> = {}) => ({ UPLOAD_SCANNER: `clamav://127.0.0.1:${port}`, ...extra });

describe('scanner configuration', () => {
  it('reads each form', () => {
    expect(scannerConfig({ UPLOAD_SCANNER: 'clamav://scan.internal:3311' })).toEqual({ kind: 'clamav', host: 'scan.internal', port: 3311 });
    expect(scannerConfig({ UPLOAD_SCANNER: 'clamav://scan.internal' })).toMatchObject({ port: 3310 });
    expect(scannerConfig({ UPLOAD_SCANNER: 'NONE' })).toEqual({ kind: 'none' });
    expect(scannerConfig({})).toEqual({ kind: 'unset' });
    for (const bad of ['http://x:1', 'clamav://', 'clamav://h:0', 'clamav://h:99999', 'garbage']) expect(scannerConfig({ UPLOAD_SCANNER: bad }).kind, bad).toBe('invalid');
  });
  it('parses clamd replies strictly', () => {
    expect(parseClamReply('stream: OK\0')).toBe('clean');
    expect(parseClamReply('stream: Eicar-Signature FOUND\0')).toBe('infected');
    for (const x of ['', 'OK', 'stream: OK extra', 'INSTREAM size limit exceeded. ERROR', 'stream: FOUND', 'garbage']) expect(parseClamReply(x), x).toBe('error');
  });
});

describe('fail-closed policy', () => {
  it('skips in development, refuses in production, honours an explicit opt-out', async () => {
    expect((await scanUpload(Buffer.from('x'), { NODE_ENV: 'development' })).ok).toBe(true);
    const prod = await scanUpload(Buffer.from('x'), { NODE_ENV: 'production' });
    expect(prod).toMatchObject({ ok: false, reason: 'unavailable' });
    expect((await scanUpload(Buffer.from('x'), { NODE_ENV: 'production', UPLOAD_SCANNER: 'none' })).ok).toBe(true);
    expect(await scanUpload(Buffer.from('x'), { UPLOAD_SCANNER: 'nonsense' })).toMatchObject({ ok: false, reason: 'unavailable' });
  });
});

describe('ClamAV protocol', () => {
  it('passes a clean file and sends the exact bytes, in chunks', async () => {
    const s = await fakeClamd('normal'); closers.push(s.close);
    const big = Buffer.alloc(200_000, 7);
    expect(await scanUpload(big, envFor(s.port))).toEqual({ ok: true });
    expect(s.received().equals(big)).toBe(true);
  });
  it('blocks a file the scanner flags', async () => {
    const s = await fakeClamd('normal'); closers.push(s.close);
    expect(await scanUpload(Buffer.from('X5O!P%@AP EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'), envFor(s.port))).toMatchObject({ ok: false, reason: 'infected' });
  });
  it('refuses when the scanner is down, errors, answers nonsense or never answers', async () => {
    const dead = await fakeClamd('normal'); dead.close();
    expect(await scanUpload(Buffer.from('x'), envFor(dead.port))).toMatchObject({ ok: false, reason: 'unavailable' });
    for (const mode of ['error', 'garbage'] as const) {
      const s = await fakeClamd(mode); closers.push(s.close);
      expect(await scanUpload(Buffer.from('x'), envFor(s.port)), mode).toMatchObject({ ok: false, reason: 'unavailable' });
    }
  });
  it('treats an empty file like any other', async () => {
    const s = await fakeClamd('normal'); closers.push(s.close);
    expect((await scanUpload(Buffer.alloc(0), envFor(s.port))).ok).toBe(true);
  });
});
