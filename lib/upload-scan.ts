import net from 'node:net';

/**
 * Upload screening. Configure with UPLOAD_SCANNER:
 *   clamav://host:port   scan every upload with a ClamAV daemon (clamd) before it is stored
 *   none                 explicit opt-out (the operator accepts unscanned uploads; logged once)
 *   (unset)              development/tests: skipped.  PRODUCTION: uploads are REFUSED — fail closed, never silently unscanned.
 * Any scanner error (down, timeout, protocol error, size limit) also refuses the upload.
 */
type Env = Record<string, string | undefined>;
export type ScanResult = { ok: true } | { ok: false; reason: 'infected' | 'unavailable'; message: string };
export const SCAN_TIMEOUT_MS = 15_000;
const UNAVAILABLE: ScanResult = { ok: false, reason: 'unavailable', message: 'File checking is unavailable right now, so uploads are paused. Please try again shortly.' };
let warned = false;

export function scannerConfig(env: Env = process.env): { kind: 'clamav'; host: string; port: number } | { kind: 'none' } | { kind: 'unset' } | { kind: 'invalid' } {
  const v = (env.UPLOAD_SCANNER ?? '').trim();
  if (!v) return { kind: 'unset' };
  if (v.toLowerCase() === 'none') return { kind: 'none' };
  try {
    const u = new URL(v);
    const port = u.port ? Number(u.port) : 3310;
    if (u.protocol === 'clamav:' && u.hostname && Number.isInteger(port) && port > 0 && port < 65536) return { kind: 'clamav', host: u.hostname.replace(/^\[|\]$/g, ''), port };
  } catch { /* fall through */ }
  return { kind: 'invalid' };
}

export function parseClamReply(raw: string): 'clean' | 'infected' | 'error' {
  const t = raw.replace(/\0/g, '').trim();
  if (/^stream: OK$/.test(t)) return 'clean';
  if (/^stream: .+ FOUND$/.test(t)) return 'infected';
  return 'error';
}

function clamScan(host: string, port: number, bytes: Uint8Array): Promise<'clean' | 'infected' | 'error'> {
  return new Promise((resolve) => {
    let reply = '', done = false;
    const finish = (r: 'clean' | 'infected' | 'error') => { if (!done) { done = true; sock.destroy(); resolve(r); } };
    const sock = net.connect({ host, port });
    sock.setTimeout(SCAN_TIMEOUT_MS, () => finish('error'));
    sock.on('error', () => finish('error'));
    sock.on('data', (d) => { reply += d.toString('latin1'); if (reply.includes('\0') || reply.includes('\n')) finish(parseClamReply(reply)); });
    sock.on('end', () => finish(parseClamReply(reply)));
    sock.on('connect', () => {
      sock.write('zINSTREAM\0');
      for (let i = 0; i < bytes.length; i += 65536) {
        const chunk = bytes.subarray(i, i + 65536), len = Buffer.alloc(4); len.writeUInt32BE(chunk.length);
        sock.write(len); sock.write(chunk);
      }
      sock.write(Buffer.alloc(4));      // zero-length chunk ends the stream
    });
  });
}

export async function scanUpload(bytes: Uint8Array, env: Env = process.env): Promise<ScanResult> {
  const cfg = scannerConfig(env);
  if (cfg.kind === 'none') { if (!warned) { warned = true; console.warn('UPLOAD_SCANNER=none: uploads are NOT being scanned for malware'); } return { ok: true }; }
  if (cfg.kind === 'unset') return env.NODE_ENV === 'production' ? UNAVAILABLE : { ok: true };
  if (cfg.kind === 'invalid') return UNAVAILABLE;
  const r = await clamScan(cfg.host, cfg.port, bytes);
  if (r === 'clean') return { ok: true };
  if (r === 'infected') return { ok: false, reason: 'infected', message: 'That file was blocked because it appears to contain malware.' };
  return UNAVAILABLE;
}
