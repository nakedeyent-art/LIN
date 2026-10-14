// Per-address abuse limits. Start the app with E2E_TRUST_PROXY=1 (one trusted proxy in front); this script plays that proxy.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { B, sql, browserOptions } from './runtime.mjs';
let checks = 0;
const ok = (v, label) => { assert.ok(v, label); checks++; console.log('PASS ' + label); };
sql('TRUNCATE users CASCADE; TRUNCATE rate_limits');
const br = await chromium.launch(browserOptions);
async function attempt(page, n) {
  await page.goto(B + '/login', { waitUntil: 'domcontentloaded' });
  await page.fill('[name=email]', `nobody${n}@example.test`); await page.fill('[name=password]', 'wrong-password-123');
  await Promise.all([page.waitForURL(/\/login\?error=/, { timeout: 60000 }), page.click('button[type=submit]')]);
  return decodeURIComponent(new URL(page.url()).searchParams.get('error') ?? '');
}
try {
  const ctx = await br.newContext({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.9' } });
  const page = await ctx.newPage();
  const seen = [];
  for (let i = 1; i <= 43; i++) seen.push(await attempt(page, i));
  ok(seen.slice(0, 40).every((m) => m === 'Invalid email or password.'), 'the first 40 attempts from one address get the normal answer');
  ok(seen.slice(40).every((m) => /Too many attempts from your network/.test(m)), 'from the 41st the address is told to wait');
  ok(/\d+ minutes?/.test(seen[42]), 'with how long to wait');

  // Forged left-hand entries do not buy a fresh allowance: only the entry the trusted proxy added counts.
  const forged = await br.newContext({ extraHTTPHeaders: { 'x-forwarded-for': '203.0.113.200, 198.51.100.9' } });
  ok(/Too many attempts from your network/.test(await attempt(await forged.newPage(), 100)), 'a forged X-Forwarded-For prefix does not bypass the limit');

  // A different real address is unaffected.
  const other = await br.newContext({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.77' } });
  ok(await attempt(await other.newPage(), 200) === 'Invalid email or password.', 'another address is unaffected');

  // The counters hold no raw addresses or emails.
  ok(!sql('SELECT string_agg(key, \' \') FROM rate_limits').includes('198.51'), 'counters store only hashed keys');

  // Password-reset requests are limited per address too (answers stay identical for every email).
  const reset = await br.newContext({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.55' } });
  const rp = await reset.newPage(); const msgs = [];
  for (let i = 1; i <= 12; i++) {
    await rp.goto(B + '/forgot-password', { waitUntil: 'domcontentloaded' });
    await rp.fill('[name=email]', `ghost${i}@example.test`);
    await Promise.all([rp.waitForURL(/\/forgot-password\?(sent|error)=/, { timeout: 60000 }), rp.click('button[type=submit]')]);
    msgs.push(new URL(rp.url()).searchParams.has('sent') ? 'sent' : 'blocked');
  }
  ok(msgs.slice(0, 10).every((m) => m === 'sent') && msgs.slice(10).every((m) => m === 'blocked'), 'reset requests stop after 10 an hour from one address');
  console.log(`\nALL PASSED (${checks} checks)`);
} finally { await br.close(); }
