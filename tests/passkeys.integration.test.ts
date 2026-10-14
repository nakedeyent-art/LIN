import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('../lib/mailer', () => ({ appUrl: () => 'http://localhost:3113', sendMail: async () => {} }));
import { db } from '../lib/db';
import { beginPasskeyRegistration, finishPasskeyRegistration, beginPasskeyAuthentication, finishPasskeyAuthentication, listPasskeys, hasPasskey, removePasskey, forgetPasskeys, MAX_PASSKEYS } from '../lib/passkeys';

let user: string, other: string;
beforeEach(async () => {
  await db().query('TRUNCATE users CASCADE');
  const mk = async (n: string) => (await db().query('INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES($1,$2,$3,$4,now()) RETURNING id', [n + '@example.test', n, 'parent', 'x'])).rows[0].id as string;
  user = await mk('user'); other = await mk('other');
});
afterAll(async () => { await db().end(); });
const me = () => ({ userId: user, email: 'user@example.test', name: 'User' });
const fakeCredential = (id: string, owner: string) => db().query("INSERT INTO user_passkeys(user_id,credential_id,public_key,counter,name) VALUES($1,$2,'\\x00',0,'Laptop')", [owner, id]);

describe('passkeys', () => {
  it('issues registration options bound to this person, stores one challenge, and only its own credentials are excluded', async () => {
    await fakeCredential('cred-mine', user); await fakeCredential('cred-other', other);
    const o = await beginPasskeyRegistration(me());
    if ('error' in o) throw new Error(o.error);
    expect(o.rp.id).toBe('localhost'); expect(o.user.name).toBe('user@example.test'); expect(o.attestation).toBe('none');
    expect(o.excludeCredentials?.map((c) => c.id)).toEqual(['cred-mine']);
    expect((await db().query('SELECT challenge FROM webauthn_challenges WHERE user_id=$1 AND purpose=$2', [user, 'register'])).rows[0].challenge).toBe(o.challenge);
  });
  it('a garbage registration response is refused and the challenge is spent (no second try with the same one)', async () => {
    await beginPasskeyRegistration(me());
    const bad = { id: 'x', rawId: 'x', type: 'public-key', response: { clientDataJSON: 'e30', attestationObject: 'AA' }, clientExtensionResults: {} } as never;
    const r1 = await finishPasskeyRegistration(user, 'Phone', bad);
    expect('error' in r1 && /could not be verified/.test(r1.error)).toBe(true);
    const r2 = await finishPasskeyRegistration(user, 'Phone', bad);
    expect(r2).toEqual({ error: 'The passkey request expired. Start again.' });
    expect(await hasPasskey(user)).toBe(false);
  });
  it('caps the number of passkeys and lets the owner (only) remove one', async () => {
    for (let i = 0; i < MAX_PASSKEYS; i++) await fakeCredential(`c${i}`, user);
    expect(await beginPasskeyRegistration(me())).toMatchObject({ error: expect.stringMatching(/up to/) });
    const mine = await listPasskeys(user);
    expect(mine.length).toBe(MAX_PASSKEYS);
    expect(await removePasskey(other, mine[0].id)).toBe(false);
    expect(await removePasskey(user, mine[0].id)).toBe(true);
    expect((await listPasskeys(user)).length).toBe(MAX_PASSKEYS - 1);
    expect((await db().query("SELECT count(*)::int AS n FROM security_events WHERE user_id=$1 AND action='passkey_removed'", [user])).rows[0].n).toBe(1);
  });
  it('authentication offers only this person’s credentials and refuses an unknown or unverifiable assertion without marking the session', async () => {
    expect(await beginPasskeyAuthentication(user)).toMatchObject({ error: expect.stringMatching(/No passkey/) });
    await fakeCredential('cred-mine', user); await fakeCredential('cred-other', other);
    const o = await beginPasskeyAuthentication(user);
    if ('error' in o) throw new Error(o.error);
    expect(o.allowCredentials?.map((c) => c.id)).toEqual(['cred-mine']);
    await db().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(repeat('a',64),$1,now()+interval '1 day')", [user]);
    const assertion = (id: string) => ({ id, rawId: id, type: 'public-key', response: { clientDataJSON: 'e30', authenticatorData: 'AA', signature: 'AA' }, clientExtensionResults: {} }) as never;
    expect(await finishPasskeyAuthentication(user, 'a'.repeat(64), assertion('cred-other'))).toMatchObject({ error: expect.stringMatching(/not registered/) });
    await beginPasskeyAuthentication(user);
    const r = await finishPasskeyAuthentication(user, 'a'.repeat(64), assertion('cred-mine'));
    expect('error' in r).toBe(true);
    expect((await db().query("SELECT mfa_verified_at FROM sessions WHERE token_hash=repeat('a',64)")).rows[0].mfa_verified_at).toBeNull();
  });
  it('ending the enrolment forgets every passkey and open challenge, so a passkey never outlives the authenticator it rests on', async () => {
    await fakeCredential('cred-mine', user); await fakeCredential('cred-other', other);
    await beginPasskeyAuthentication(user);
    await forgetPasskeys(db(), user);
    expect(await hasPasskey(user)).toBe(false);
    expect(await hasPasskey(other)).toBe(true);
    expect((await db().query('SELECT count(*)::int AS n FROM webauthn_challenges WHERE user_id=$1', [user])).rows[0].n).toBe(0);
  });
});
