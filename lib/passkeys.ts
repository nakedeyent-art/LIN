import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON, AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { db } from "./db";
import { appUrl } from "./mailer";

/**
 * Passkeys as a second factor. The boundary is unchanged: two-factor is on only when an authenticator app is enrolled (that is what issues
 * recovery codes); a passkey is an additional way to pass the second step. Challenges are stored server side, single use, and expire quickly.
 */
export const MAX_PASSKEYS = 5, CHALLENGE_MINUTES = 5;
export type PasskeyRow = { id: string; name: string; created_at: Date; last_used_at: Date | null; device_type: string; backed_up: boolean };

function relyingParty() {
  const url = new URL(appUrl());
  return { rpID: url.hostname, origin: url.origin, rpName: "LIN" };
}

export async function listPasskeys(userId: string): Promise<PasskeyRow[]> {
  return (await db().query("SELECT id,name,created_at,last_used_at,device_type,backed_up FROM user_passkeys WHERE user_id=$1 ORDER BY created_at", [userId])).rows;
}
export async function hasPasskey(userId: string): Promise<boolean> {
  return !!(await db().query("SELECT 1 FROM user_passkeys WHERE user_id=$1 LIMIT 1", [userId])).rowCount;
}

async function saveChallenge(userId: string, purpose: "register" | "authenticate", challenge: string) {
  await db().query("INSERT INTO webauthn_challenges(user_id,purpose,challenge) VALUES($1,$2,$3) ON CONFLICT (user_id,purpose) DO UPDATE SET challenge=EXCLUDED.challenge, created_at=now()", [userId, purpose, challenge]);
}
/** Takes the challenge out as it is read: a second verification with the same response cannot succeed. */
async function takeChallenge(userId: string, purpose: "register" | "authenticate"): Promise<string | null> {
  const r = (await db().query("DELETE FROM webauthn_challenges WHERE user_id=$1 AND purpose=$2 AND created_at > now() - make_interval(mins => $3) RETURNING challenge", [userId, purpose, CHALLENGE_MINUTES])).rows[0];
  return r?.challenge ?? null;
}

/** Step 1 of adding a passkey. The caller has already required a fresh second factor from the authenticator app. */
export async function beginPasskeyRegistration(user: { userId: string; email: string; name: string }): Promise<PublicKeyCredentialCreationOptionsJSON | { error: string }> {
  const existing = (await db().query("SELECT credential_id,transports FROM user_passkeys WHERE user_id=$1", [user.userId])).rows;
  if (existing.length >= MAX_PASSKEYS) return { error: `You can register up to ${MAX_PASSKEYS} passkeys. Remove one first.` };
  const rp = relyingParty();
  const options = await generateRegistrationOptions({
    rpName: rp.rpName, rpID: rp.rpID, userName: user.email, userDisplayName: user.name, userID: new TextEncoder().encode(user.userId),
    attestationType: "none", excludeCredentials: existing.map((e) => ({ id: e.credential_id, transports: e.transports })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
  await saveChallenge(user.userId, "register", options.challenge);
  return options;
}

/** Step 2: stores the verified credential under a name the person chose. */
export async function finishPasskeyRegistration(userId: string, name: string, response: RegistrationResponseJSON): Promise<{ ok: true } | { error: string }> {
  const label = name.trim().slice(0, 60) || "Passkey";
  const expectedChallenge = await takeChallenge(userId, "register");
  if (!expectedChallenge) return { error: "The passkey request expired. Start again." };
  const rp = relyingParty();
  let v: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try { v = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: false }); }
  catch (e) { return { error: `The passkey could not be verified: ${(e as Error).message}` }; }
  if (!v.verified || !v.registrationInfo) return { error: "The passkey could not be verified." };
  const { credential, credentialDeviceType, credentialBackedUp } = v.registrationInfo;
  const r = await db().query(
    `INSERT INTO user_passkeys(user_id,credential_id,public_key,counter,transports,device_type,backed_up,name) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (credential_id) DO NOTHING RETURNING id`,
    [userId, credential.id, Buffer.from(credential.publicKey), credential.counter, credential.transports ?? [], credentialDeviceType, credentialBackedUp, label]);
  if (!r.rowCount) return { error: "That passkey is already registered." };
  await db().query("INSERT INTO security_events(user_id, action) VALUES ($1,'passkey_added')", [userId]);
  return { ok: true };
}

export async function removePasskey(userId: string, id: string): Promise<boolean> {
  const r = await db().query("DELETE FROM user_passkeys WHERE id=$1 AND user_id=$2", [id, userId]);
  if (r.rowCount) await db().query("INSERT INTO security_events(user_id, action) VALUES ($1,'passkey_removed')", [userId]);
  return !!r.rowCount;
}

/** Step 1 of passing the second step with a passkey: only this person's own credentials are offered. */
export async function beginPasskeyAuthentication(userId: string): Promise<PublicKeyCredentialRequestOptionsJSON | { error: string }> {
  const creds = (await db().query("SELECT credential_id,transports FROM user_passkeys WHERE user_id=$1", [userId])).rows;
  if (!creds.length) return { error: "No passkey is registered on this account." };
  const options = await generateAuthenticationOptions({ rpID: relyingParty().rpID, userVerification: "preferred", allowCredentials: creds.map((c) => ({ id: c.credential_id, transports: c.transports as AuthenticatorTransportFuture[] })) });
  await saveChallenge(userId, "authenticate", options.challenge);
  return options;
}

/** Step 2: verifies the assertion against the stored credential, advances the counter and marks this session's second step as done. */
export async function finishPasskeyAuthentication(userId: string, tokenHash: string, response: AuthenticationResponseJSON): Promise<{ ok: true } | { error: string }> {
  const expectedChallenge = await takeChallenge(userId, "authenticate");
  if (!expectedChallenge) return { error: "The passkey request expired. Try again." };
  const row = (await db().query("SELECT * FROM user_passkeys WHERE user_id=$1 AND credential_id=$2", [userId, response.id])).rows[0];
  if (!row) return { error: "That passkey is not registered on this account." };
  const rp = relyingParty();
  let v: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    v = await verifyAuthenticationResponse({ response, expectedChallenge, expectedOrigin: rp.origin, expectedRPID: rp.rpID, requireUserVerification: false,
      credential: { id: row.credential_id, publicKey: new Uint8Array(row.public_key), counter: Number(row.counter), transports: row.transports } });
  } catch (e) { return { error: `The passkey could not be verified: ${(e as Error).message}` }; }
  if (!v.verified) return { error: "The passkey could not be verified." };
  const c = await db().connect();
  try {
    await c.query("BEGIN");
    // A counter that did not advance on an authenticator that uses one means a cloned credential: refuse and leave a trace.
    const upd = await c.query("UPDATE user_passkeys SET counter=$3,last_used_at=now() WHERE id=$1 AND user_id=$2 AND (counter=0 OR $3>counter)", [row.id, userId, v.authenticationInfo.newCounter]);
    if (!upd.rowCount) { await c.query("INSERT INTO security_events(user_id, action) VALUES ($1,'passkey_counter_rejected')", [userId]); await c.query("COMMIT"); return { error: "This passkey could not be trusted. Use your authenticator app and review your security settings." }; }
    await c.query("UPDATE sessions SET mfa_verified_at = NOW() WHERE token_hash=$1 AND user_id=$2", [tokenHash, userId]);
    await c.query("INSERT INTO security_events(user_id, action) VALUES ($1,'mfa_passkey_verified')", [userId]);
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
  return { ok: true };
}

/** Removes every passkey. Called wherever the authenticator enrolment ends (turning MFA off, an admin reset, account deletion): a passkey never outlives it. */
export async function forgetPasskeys(q: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, userId: string): Promise<void> {
  await q.query("DELETE FROM user_passkeys WHERE user_id=$1", [userId]);
  await q.query("DELETE FROM webauthn_challenges WHERE user_id=$1", [userId]);
}
