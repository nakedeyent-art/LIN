import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses (IPv4 and IPv6). */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  if (isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (isIP(v) === 6) return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || /^fe[89ab]/.test(v) || v.startsWith("ff") || v.startsWith("64:ff9b");
  return true;
}

export class FetchError extends Error {}
export type SafeOpts = { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; allowLocal?: boolean };

/** Only a local mock may be fetched, and only outside production, when explicitly allowed. */
const localOk = (o: SafeOpts) => !!o.allowLocal && process.env.NODE_ENV !== "production";

async function checkUrl(raw: string, o: SafeOpts): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new FetchError("invalid URL"); }
  const local = localOk(o) && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) throw new FetchError("only https:// sources are allowed");
  if (u.username || u.password) throw new FetchError("credentials in URLs aren't allowed");
  if (local) return u;
  if (u.port && u.port !== "443") throw new FetchError("non-standard ports aren't allowed");
  const addrs = isIP(u.hostname) ? [{ address: u.hostname }] : await lookup(u.hostname, { all: true }).catch(() => { throw new FetchError("host not found"); });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new FetchError("host isn't on the public internet");
  return u;
}

/**
 * Fetches a public URL as text: https only, public IPs only (re-checked on every redirect), bounded time and size.
 * The checked address and the connection address can differ in theory (DNS rebinding); the 8 s / 1 MB bounds and the
 * fact that responses are parsed, never returned to users, limit what that could reach.
 */
export async function safeFetchText(raw: string, o: SafeOpts = {}): Promise<string> {
  const maxBytes = o.maxBytes ?? 1_000_000, timeout = o.timeoutMs ?? 8000;
  let url = raw;
  for (let hop = 0; hop <= (o.maxRedirects ?? 3); hop++) {
    const u = await checkUrl(url, o);
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(u, { redirect: "manual", signal: ctl.signal, headers: { "User-Agent": "LIN-news/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1" } });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location"); if (!loc) throw new FetchError("redirect without a location");
        url = new URL(loc, u).toString(); continue;
      }
      if (!res.ok) throw new FetchError(`HTTP ${res.status}`);
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > maxBytes) throw new FetchError("response too large");
      const reader = res.body?.getReader(); if (!reader) throw new FetchError("empty response");
      const chunks: Uint8Array[] = []; let total = 0;
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.length; if (total > maxBytes) { await reader.cancel(); throw new FetchError("response too large"); }
        chunks.push(value);
      }
      return Buffer.concat(chunks).toString("utf8");
    } catch (e) {
      if (e instanceof FetchError) throw e;
      throw new FetchError((e as Error).name === "AbortError" ? "timed out" : "network error");
    } finally { clearTimeout(timer); }
  }
  throw new FetchError("too many redirects");
}
