import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { B, sql, browserOptions } from './runtime.mjs';
// Passkeys end to end, using Chromium's virtual authenticator (CDP WebAuthn domain): add a passkey in Settings, then pass the second step with it.
let checks = 0;
function ok(value, label) { assert.ok(value, label); checks++; console.log('PASS ' + label); }
const q = (s) => "'" + s.replaceAll("'", "''") + "'";
sql('TRUNCATE users CASCADE');
const user = sql(`INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES(${q('pk@example.test')},'Pat Keys','parent','fixture',now()) RETURNING id`);
// Enrolled in the authenticator app (fixture); the session below has a fresh second factor, as after entering a code.
sql(`INSERT INTO user_mfa(user_id,secret_sealed,enabled_at) VALUES('${user}','fixture-sealed-not-used',now())`);
const br = await chromium.launch(browserOptions);
const errors = [];
async function pageFor(pending) {
  const ctx = await br.newContext(); const token = createHash('sha256').update(String(Math.random()) + Date.now()).digest('hex'), hash = createHash('sha256').update(token).digest('hex');
  sql(`INSERT INTO sessions(token_hash,user_id,expires_at,mfa_verified_at) VALUES('${hash}','${user}',now()+INTERVAL '1 day',${pending ? 'NULL' : 'now()'})`);
  await ctx.addCookies([{ name: 'lin_session', value: token, url: B }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  return { p, cdp, authenticatorId };
}
try {
  const { p, cdp, authenticatorId } = await pageFor(false);
  await p.goto(`${B}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
  await p.getByText('Passkeys', { exact: true }).first().waitFor();
  await p.getByLabel('Passkey name').fill('Test laptop');
  await p.getByRole('button', { name: 'Add a passkey' }).click();
  await p.waitForURL(/msg=Passkey\+added|msg=Passkey%20added/, { timeout: 30000 });
  ok(sql(`SELECT count(*) FROM user_passkeys WHERE user_id='${user}' AND name='Test laptop'`) === '1', 'a passkey is registered through the browser ceremony');
  const creds = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  ok(creds.credentials.length === 1, 'the virtual authenticator holds the credential');
  ok(sql(`SELECT count(*) FROM security_events WHERE user_id='${user}' AND action='passkey_added'`) === '1', 'the security log records it');
  await p.getByText('Test laptop').first().waitFor();

  // A new sign-in: password done, second step pending. The passkey passes it without a code.
  const second = await pageFor(true);
  // Share the credential with the new context's authenticator.
  await second.cdp.send('WebAuthn.addCredential', { authenticatorId: second.authenticatorId, credential: creds.credentials[0] });
  const r = await second.p.goto(`${B}/dashboard`, { waitUntil: 'domcontentloaded' });
  ok(new URL(second.p.url()).pathname === '/mfa/verify', 'pending session is sent to the second step');
  ok((await second.p.request.get(`${B}/dashboard/settings/export`, { maxRedirects: 0 })).status() !== 200, 'pending session cannot use the app yet');
  await second.p.getByRole('button', { name: 'Use a passkey instead' }).click();
  await second.p.waitForURL((u) => u.pathname === '/dashboard', { timeout: 30000 });
  ok(sql(`SELECT count(*) FROM sessions WHERE user_id='${user}' AND mfa_verified_at IS NOT NULL`) === '2', 'the passkey marks the session verified');
  ok(sql(`SELECT last_used_at IS NOT NULL FROM user_passkeys WHERE user_id='${user}'`) === 't', 'last use is recorded');
  ok(sql(`SELECT count(*) FROM webauthn_challenges WHERE user_id='${user}'`) === '0', 'challenges are single use');

  // A stranger's assertion (different credential) is refused.
  const third = await pageFor(true);
  await third.p.goto(`${B}/dashboard`, { waitUntil: 'domcontentloaded' });
  await third.p.getByRole('button', { name: 'Use a passkey instead' }).click();
  await third.p.getByRole('status').filter({ hasText: /cancelled|not registered|could not/ }).waitFor({ timeout: 30000 });
  ok(new URL(third.p.url()).pathname === '/mfa/verify', 'an unknown authenticator does not pass the second step');

  // Removing the passkey needs a fresh second factor and leaves the authenticator-app enrolment intact.
  await p.goto(`${B}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
  await p.getByRole('button', { name: /Remove passkey Test laptop/ }).click();
  await p.waitForURL(/msg=Passkey\+removed|msg=Passkey%20removed/, { timeout: 30000 });
  ok(sql(`SELECT count(*) FROM user_passkeys WHERE user_id='${user}'`) === '0' && sql(`SELECT count(*) FROM user_mfa WHERE user_id='${user}'`) === '1', 'removing the passkey keeps two-factor on');
  ok(errors.length === 0, 'no browser runtime errors: ' + errors.join('; '));
  console.log(`ALL PASSED (${checks} checks)`);
} finally { await br.close(); }
