import { describe, expect, it } from 'vitest';
import { pickClientIp, waitMessage } from './ratelimit';

const h = (o: Record<string, string>) => (n: string) => o[n.toLowerCase()] ?? null;
describe('pickClientIp', () => {
  it('trusts nothing by default, however convincing the headers look', () => {
    expect(pickClientIp(h({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '5.6.7.8' }), undefined)).toBeNull();
    expect(pickClientIp(h({ 'x-forwarded-for': '1.2.3.4' }), 'off')).toBeNull();
  });
  it('with N proxies in front, counts N from the right so forged left-hand entries are ignored', () => {
    const forged = h({ 'x-forwarded-for': '6.6.6.6, 9.9.9.9, 203.0.113.7' });
    expect(pickClientIp(forged, '1')).toBe('203.0.113.7');
    expect(pickClientIp(forged, '2')).toBe('9.9.9.9');
    expect(pickClientIp(h({ 'x-forwarded-for': '203.0.113.7' }), '2')).toBeNull();     // fewer hops than configured: don't guess
  });
  it('supports the Vercel headers', () => {
    expect(pickClientIp(h({ 'x-real-ip': '203.0.113.9' }), 'vercel')).toBe('203.0.113.9');
    expect(pickClientIp(h({ 'x-vercel-forwarded-for': '203.0.113.9, 1.1.1.1' }), 'Vercel')).toBe('203.0.113.9');
  });
  it('rejects values that are not addresses', () => {
    for (const bad of ['<script>', 'a b', '', 'x'.repeat(60), 'unknown']) expect(pickClientIp(h({ 'x-real-ip': bad }), 'vercel'), bad).toBeNull();
    expect(pickClientIp(h({ 'x-real-ip': '2001:DB8::1' }), 'vercel')).toBe('2001:db8::1');
  });
  it('words the wait sensibly', () => { expect(waitMessage(30)).toContain('1 minute.'); expect(waitMessage(600)).toContain('10 minutes'); });
});
