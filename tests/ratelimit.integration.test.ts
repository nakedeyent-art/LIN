import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.5' }) }));
import { db } from '../lib/db';
import { hit, limitByIp, purgeRateLimits } from '../lib/ratelimit';

beforeEach(async () => { await db().query('TRUNCATE rate_limits'); delete process.env.TRUST_PROXY; });
afterAll(async () => { await db().end(); });
const L = { name: 't', limit: 3, windowSeconds: 600 };

describe('rate limiter', () => {
  it('allows up to the limit then blocks, and reports a wait', async () => {
    const r = [await hit(L, 'a'), await hit(L, 'a'), await hit(L, 'a'), await hit(L, 'a')];
    expect(r.map((x) => x.allowed)).toEqual([true, true, true, false]);
    expect(r[3].retryAfterSeconds).toBeGreaterThan(0); expect(r[3].retryAfterSeconds).toBeLessThanOrEqual(600);
  });
  it('counts subjects and limit names separately, and never stores the raw subject', async () => {
    for (let i = 0; i < 4; i++) await hit(L, 'a');
    expect((await hit(L, 'b')).allowed).toBe(true); expect((await hit({ ...L, name: 'other' }, 'a')).allowed).toBe(true);
    const keys = (await db().query('SELECT key FROM rate_limits')).rows.map((x) => x.key).join(' ');
    expect(keys).not.toContain('a:a'); expect(keys).toMatch(/^t:[0-9a-f]{32}/);
  });
  it('is exact under concurrency', async () => {
    const out = await Promise.all(Array.from({ length: 20 }, () => hit({ ...L, limit: 5 }, 'burst')));
    expect(out.filter((x) => x.allowed)).toHaveLength(5);
  });
  it('starts a fresh window later', async () => {
    for (let i = 0; i < 4; i++) await hit(L, 'a');
    await db().query("UPDATE rate_limits SET window_start = window_start - interval '1 hour'");
    expect((await hit(L, 'a')).allowed).toBe(true);
    expect(await purgeRateLimits()).toBe(0);
    await db().query("UPDATE rate_limits SET window_start = window_start - interval '2 days'");
    expect(await purgeRateLimits()).toBeGreaterThan(0);
  });
  it('limits by address only when the address is trustworthy', async () => {
    expect(await limitByIp({ ...L, limit: 1 })).toMatchObject({ allowed: true, retryAfterSeconds: 0 });    // TRUST_PROXY unset: off
    expect((await db().query('SELECT count(*)::int AS n FROM rate_limits')).rows[0].n).toBe(0);
    process.env.TRUST_PROXY = '1';
    expect((await limitByIp({ ...L, limit: 1 })).allowed).toBe(true);
    expect((await limitByIp({ ...L, limit: 1 })).allowed).toBe(false);
  });
});
