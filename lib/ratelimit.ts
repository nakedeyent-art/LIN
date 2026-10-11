import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { db } from './db';

export type Limit = { name: string; limit: number; windowSeconds: number };
/** Tuned to stop scripted abuse without bothering people: a shared school or team network stays well under these. */
export const LIMITS = {
  login: { name: 'login', limit: 40, windowSeconds: 600 },
  signup: { name: 'signup', limit: 8, windowSeconds: 3600 },
  resetRequest: { name: 'reset', limit: 10, windowSeconds: 3600 },
  mfa: { name: 'mfa', limit: 40, windowSeconds: 600 },
} satisfies Record<string, Limit>;

/**
 * Remote address, or null when it can't be trusted. Proxy headers are forgeable unless a proxy YOU control sets them, so nothing is trusted by default:
 *   TRUST_PROXY=vercel   use Vercel's x-real-ip / x-vercel-forwarded-for
 *   TRUST_PROXY=<N>      you run N proxies in front: take the Nth entry from the RIGHT of x-forwarded-for (extra entries to its left are attacker-supplied)
 */
export function pickClientIp(get: (name: string) => string | null, mode: string | undefined): string | null {
  const m = (mode ?? '').trim().toLowerCase();
  let ip: string | null = null;
  if (m === 'vercel') ip = get('x-real-ip') ?? get('x-vercel-forwarded-for')?.split(',')[0] ?? null;
  else if (/^[1-9]\d?$/.test(m)) {
    const parts = (get('x-forwarded-for') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    ip = parts[parts.length - Number(m)] ?? null;
  }
  ip = ip?.trim() ?? null;
  return ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip.toLowerCase() : null;
}

let warned = false;
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const ip = pickClientIp((n) => h.get(n), process.env.TRUST_PROXY);
  if (!ip && process.env.NODE_ENV === 'production' && !warned) { warned = true; console.warn('TRUST_PROXY is not set: per-address rate limits are OFF. Set TRUST_PROXY=vercel or the number of proxies in front of the app.'); }
  return ip;
}

/** Counts one hit against `name:subject` and reports whether it is still within the limit. */
export async function hit(l: Limit, subject: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const key = `${l.name}:${createHash('sha256').update(subject).digest('hex').slice(0, 32)}`;
  const r = (await db().query(
    `WITH w AS (SELECT to_timestamp(floor(extract(epoch FROM now()) / $2::float8) * $2::float8) AS start)
     INSERT INTO rate_limits(key, window_start) SELECT $1, start FROM w
     ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
     RETURNING hits, extract(epoch FROM (window_start + make_interval(secs => $2::float8)) - now())::int AS left`, [key, l.windowSeconds])).rows[0];
  return { allowed: r.hits <= l.limit, retryAfterSeconds: Math.max(1, r.left) };
}

/** Limits by remote address when it is known; always allowed when it isn't (the per-account protections still apply). */
export async function limitByIp(l: Limit): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const ip = await clientIp();
  return ip ? hit(l, ip) : { allowed: true, retryAfterSeconds: 0 };
}
export const waitMessage = (s: number) => `Too many attempts from your network. Try again in ${Math.max(1, Math.ceil(s / 60))} minute${s > 60 ? 's' : ''}.`;

export async function purgeRateLimits(): Promise<number> {
  return (await db().query("DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'")).rowCount ?? 0;
}
