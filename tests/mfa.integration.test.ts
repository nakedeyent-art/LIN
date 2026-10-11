import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../lib/db";
import { hashToken } from "../lib/crypto";
import { beginEnrollment, completeEnrollment, disableMfa, isEnrolled, mfaStatus, regenerateRecovery, verifySecondStep } from "../lib/mfa";
import { codeAt, stepAt } from "../lib/totp";
import { recordFailure } from "../lib/lockout";
import { getSession, requireRecentMfa, requireUser, type Session } from "../lib/session";

const cookie = vi.hoisted(() => ({ token: "primary" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: cookie.token }) }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT ${path}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));

let userId: string;
const token = hashToken("primary");
const session = (): Session => ({ userId, name: "Test Person", email: "test@example.test", role: "parent", emailVerified: true, isAdmin: false });
const addSession = async (raw: string, verified = false) => {
  await db().query("INSERT INTO sessions(token_hash,user_id,expires_at,mfa_verified_at) VALUES($1,$2,NOW()+INTERVAL '1 day',CASE WHEN $3 THEN NOW() END)", [hashToken(raw), userId, verified]);
};
const enroll = async () => {
  const pending = await beginEnrollment(userId);
  if (!("secret" in pending)) throw new Error(pending.error);
  const r = await completeEnrollment(userId, codeAt(pending.secret, stepAt(Date.now())), token);
  if (!("codes" in r)) throw new Error(r.error);
  return { ...r, secret: pending.secret };
};
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Math.floor(Date.now() / 30000) * 30000 + 15000);
  cookie.token = "primary";
  delete process.env.MFA_ENCRYPTION_KEY;
  await db().query("TRUNCATE users CASCADE");
  userId = (await db().query("INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES('test@example.test','Test Person','parent','test-only',NOW()) RETURNING id")).rows[0].id;
  await addSession("primary");
});
afterEach(() => { vi.useRealTimers(); delete process.env.MFA_ENCRYPTION_KEY; });
afterAll(async () => { await db().end(); });

describe("MFA transitions with real PostgreSQL locks", () => {
  it("concurrent setup requests return the same secret", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => beginEnrollment(userId)));
    expect(results.every(r => "secret" in r)).toBe(true);
    expect(new Set(results.map(r => "secret" in r ? r.secret : "error")).size).toBe(1);
  });
  it("enrollment revokes all other sessions and records activity atomically", async () => {
    await addSession("other");
    await enroll();
    expect((await db().query("SELECT token_hash FROM sessions")).rows).toEqual([{ token_hash: token }]);
    expect((await db().query("SELECT action FROM security_events")).rows).toEqual([{ action: "mfa_enabled" }]);
    expect((await mfaStatus(userId, token)).verifiedFresh).toBe(true);
  });
  it("does not replace an enabled authenticator", async () => {
    await enroll();
    const before = (await db().query("SELECT secret_sealed FROM user_mfa")).rows[0];
    expect(await beginEnrollment(userId)).toHaveProperty("error");
    expect((await db().query("SELECT secret_sealed FROM user_mfa")).rows[0]).toEqual(before);
  });
  it("disabling MFA never promotes pending sessions", async () => {
    const { codes } = await enroll();
    await addSession("attacker");
    await addSession("other-verified", true);
    cookie.token = "attacker";
    expect(await getSession()).toBeNull();
    expect(await disableMfa(userId, codes[0], token)).toEqual({ ok: true });
    expect(await getSession()).toBeNull();
    expect((await db().query("SELECT token_hash FROM sessions")).rows).toEqual([{ token_hash: token }]);
    cookie.token = "primary";
    expect(await getSession()).toMatchObject({ userId });
  });
  it("refuses to disable an admin's MFA even through the domain function", async () => {
    const { codes } = await enroll();
    await db().query("UPDATE users SET is_admin=TRUE WHERE id=$1", [userId]);
    expect(await disableMfa(userId, codes[0], token)).toHaveProperty("error");
    expect(await isEnrolled(userId)).toBe(true);
  });
  it("accepts a TOTP only once across simultaneous sessions", async () => {
    const { secret } = await enroll();
    await addSession("second");
    const input = codeAt(secret, stepAt(Date.now()) + 1);
    const results = await Promise.all([verifySecondStep(userId, input, token), verifySecondStep(userId, input, hashToken("second"))]);
    expect(results.filter(r => "ok" in r)).toHaveLength(1);
    expect(results.filter(r => "error" in r)).toHaveLength(1);
  });
  it("accepts a recovery code only once under concurrent use", async () => {
    const { codes } = await enroll();
    await addSession("second");
    const results = await Promise.all([verifySecondStep(userId, codes[0], token), verifySecondStep(userId, codes[0], hashToken("second"))]);
    expect(results.filter(r => "ok" in r)).toHaveLength(1);
    expect((await db().query("SELECT count(*)::int AS n FROM user_recovery_codes WHERE used_at IS NOT NULL")).rows[0].n).toBe(1);
  });
  it("keeps recovery codes usable after loss of the TOTP encryption key", async () => {
    const { codes, secret } = await enroll();
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(await verifySecondStep(userId, codeAt(secret, stepAt(Date.now()) + 1), token)).toHaveProperty("error");
    expect(await verifySecondStep(userId, codes[0], token)).toMatchObject({ ok: true, remaining: 9 });
    expect(await disableMfa(userId, codes[1], token)).toEqual({ ok: true });
  });
  it("cannot enroll using a revoked session", async () => {
    const r = await beginEnrollment(userId);
    if (!("secret" in r)) throw new Error(r.error);
    await db().query("DELETE FROM sessions");
    expect(await completeEnrollment(userId, codeAt(r.secret, stepAt(Date.now())), token)).toHaveProperty("error");
    expect(await isEnrolled(userId)).toBe(false);
  });
  it("cannot consume recovery codes using a revoked session", async () => {
    const { codes } = await enroll();
    await db().query("DELETE FROM sessions");
    expect(await verifySecondStep(userId, codes[0], token)).toHaveProperty("error");
    expect((await db().query("SELECT count(*)::int AS n FROM user_recovery_codes WHERE used_at IS NOT NULL")).rows[0].n).toBe(0);
  });
  it("regeneration rejects revoked sessions and records successful changes", async () => {
    const { secret } = await enroll();
    const input = codeAt(secret, stepAt(Date.now()) + 1);
    expect(await regenerateRecovery(userId, input, "missing")).toHaveProperty("error");
    expect(await regenerateRecovery(userId, input, token)).toHaveProperty("codes");
    expect((await db().query("SELECT count(*)::int AS n FROM security_events WHERE action='mfa_codes_regenerated'")).rows[0].n).toBe(1);
  });
  it("a wrong code after an expired lock starts a new attempt budget", async () => {
    await enroll();
    await db().query("UPDATE user_mfa SET failed_attempts=5,locked_until=NOW()-INTERVAL '1 minute'");
    await verifySecondStep(userId, "not-a-code", token);
    expect((await db().query("SELECT failed_attempts,locked_until FROM user_mfa")).rows[0]).toEqual({ failed_attempts: 1, locked_until: null });
  });
  it("password lockout also resets its attempt budget after expiry", async () => {
    await db().query("UPDATE users SET failed_logins=5,locked_until=NOW()-INTERVAL '1 minute'");
    await recordFailure(userId);
    expect((await db().query("SELECT failed_logins,locked_until FROM users")).rows[0]).toEqual({ failed_logins: 1, locked_until: null });
  });
  it("a support-recovery session cannot access account data before re-enrollment", async () => {
    await db().query("UPDATE users SET mfa_reenrollment_required=TRUE");
    expect(await getSession()).toBeNull();
    await expect(requireUser()).rejects.toThrow("REDIRECT /mfa/setup");
    await enroll();
    expect(await getSession()).toMatchObject({ userId });
    expect((await db().query("SELECT mfa_reenrollment_required FROM users")).rows[0].mfa_reenrollment_required).toBe(false);
  });
  it("financial actions require enrollment, then verification within ten minutes", async () => {
    await expect(requireRecentMfa(session(), "/dashboard/deals")).rejects.toThrow("REDIRECT /mfa/setup?");
    await enroll();
    await expect(requireRecentMfa(session(), "/dashboard/deals")).resolves.toBeUndefined();
    await db().query("UPDATE sessions SET mfa_verified_at=NOW()-INTERVAL '11 minutes'");
    expect(await getSession()).toMatchObject({ userId });
    await expect(requireRecentMfa(session(), "/dashboard/deals")).rejects.toThrow("REDIRECT /mfa/verify?");
  });
  it("an expired session cannot satisfy the financial gate", async () => {
    await enroll();
    await db().query("UPDATE sessions SET expires_at=NOW()-INTERVAL '1 minute'");
    await expect(requireRecentMfa(session(), "/dashboard/deals")).rejects.toThrow("REDIRECT /mfa/verify?");
  });
});
