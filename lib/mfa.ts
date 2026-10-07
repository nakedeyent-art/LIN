import { db } from "./db";
import { open, seal } from "./secretbox";
import { newSecret, verifyTotp } from "./totp";
import { hashRecovery, looksLikeRecovery, newRecoveryCodes } from "./recovery";

export type CodesState = { error?: string; codes?: string[] };
export const MFA_MAX_AGE_HOURS = 8;
export const MFA_MAX_FAILS = 5;
export const MFA_LOCK_MINUTES = 15;

export type MfaStatus = { enrolled: boolean; verifiedFresh: boolean; verifiedEver: boolean };

export async function mfaStatus(userId: string, tokenHash: string | null): Promise<MfaStatus> {
  const r = (await db().query(
    `SELECT (m.enabled_at IS NOT NULL) AS enrolled,
            COALESCE((SELECT s.mfa_verified_at > NOW() - make_interval(hours => $3) FROM sessions s WHERE s.token_hash = $2 AND s.user_id = $1), FALSE) AS fresh,
            COALESCE((SELECT s.mfa_verified_at IS NOT NULL FROM sessions s WHERE s.token_hash = $2 AND s.user_id = $1), FALSE) AS ever
       FROM (SELECT $1::uuid AS id) u LEFT JOIN user_mfa m ON m.user_id = u.id`, [userId, tokenHash ?? "", MFA_MAX_AGE_HOURS])).rows[0];
  return { enrolled: !!r?.enrolled, verifiedFresh: !!r?.fresh, verifiedEver: !!r?.ever };
}

/** Starts (or resumes) enrolment: one pending secret per person, reused on reload so the QR code doesn't change under them. */
export async function beginEnrollment(userId: string): Promise<{ secret: string } | { error: string }> {
  const r = (await db().query("SELECT secret_sealed, enabled_at FROM user_mfa WHERE user_id=$1", [userId])).rows[0];
  if (r?.enabled_at) return { error: "Two-factor authentication is already set up." };
  if (r) { const s = open(r.secret_sealed, userId); if (s) return { secret: s }; }
  const secret = newSecret();
  await db().query(
    `INSERT INTO user_mfa(user_id, secret_sealed) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET secret_sealed=$2, failed_attempts=0, locked_until=NULL`, [userId, seal(secret, userId)]);
  return { secret };
}

type Locked = { error: string };
const lockedMsg = (until: Date): Locked => ({ error: `Too many wrong codes. Try again in ${Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000))} minutes.` });

/** Runs `fn` with the admin's MFA row locked, committing whatever it did (including failed-attempt counters). */
async function withRow<T>(userId: string, fn: (row: { secret: string; enabled: boolean; last: number | null }, q: (sql: string, p?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>) => Promise<T>): Promise<T | Locked> {
  const c = await db().connect();
  try {
    await c.query("BEGIN");
    const r = (await c.query("SELECT secret_sealed, enabled_at, last_used_step, locked_until FROM user_mfa WHERE user_id=$1 FOR UPDATE", [userId])).rows[0];
    if (!r) { await c.query("ROLLBACK"); return { error: "Two-factor authentication isn't set up." }; }
    if (r.locked_until && new Date(r.locked_until) > new Date()) { await c.query("ROLLBACK"); return lockedMsg(new Date(r.locked_until)); }
    const secret = open(r.secret_sealed, userId);
    if (!secret) { await c.query("ROLLBACK"); return { error: "Your two-factor secret can't be read (the server key changed). Ask whoever runs the server to reset it." }; }
    const out = await fn({ secret, enabled: !!r.enabled_at, last: r.last_used_step === null ? null : Number(r.last_used_step) }, (sql, p) => c.query(sql, p));
    await c.query("COMMIT");
    return out;
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; } finally { c.release(); }
}

const fail = async (q: (s: string, p?: unknown[]) => Promise<unknown>, userId: string): Promise<{ error: string; justLocked: boolean }> => {
  const r = (await q(`UPDATE user_mfa SET failed_attempts = failed_attempts + 1,
             locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN NOW() + make_interval(mins => $3) ELSE locked_until END WHERE user_id=$1 RETURNING failed_attempts`, [userId, MFA_MAX_FAILS, MFA_LOCK_MINUTES]) as { rows: { failed_attempts: number }[] }).rows[0];
  return { error: "That code isn't right.", justLocked: r.failed_attempts === MFA_MAX_FAILS };
};
const markSession = (q: (s: string, p?: unknown[]) => Promise<unknown>, userId: string, tokenHash: string) =>
  q("UPDATE sessions SET mfa_verified_at = NOW() WHERE token_hash=$1 AND user_id=$2", [tokenHash, userId]);

/** Confirms the first code from the authenticator app, turns MFA on, verifies this session and returns the recovery codes (shown once). */
export async function completeEnrollment(userId: string, code: string, tokenHash: string): Promise<{ codes: string[] } | { error: string }> {
  const r = await withRow(userId, async (row, q) => {
    if (row.enabled) return { error: "Two-factor authentication is already set up." };
    const v = verifyTotp(row.secret, code);
    if (!v.ok) return fail(q, userId);
    const codes = newRecoveryCodes();
    await q("UPDATE user_mfa SET enabled_at=NOW(), last_used_step=$2, failed_attempts=0, locked_until=NULL WHERE user_id=$1", [userId, v.step]);
    await q("DELETE FROM user_recovery_codes WHERE user_id=$1", [userId]);
    for (const c of codes) await q("INSERT INTO user_recovery_codes(user_id, code_hash) VALUES ($1,$2)", [userId, hashRecovery(c)]);
    await markSession(q, userId, tokenHash);
    return { codes };
  });
  return r as { codes: string[] } | { error: string };
}

/** The second step at sign-in: an authenticator code, or a recovery code (single use). */
export async function verifySecondStep(userId: string, input: string, tokenHash: string): Promise<{ ok: true; usedRecovery: boolean; remaining: number } | { error: string; justLocked?: boolean }> {
  const r = await withRow(userId, async (row, q) => {
    if (!row.enabled) return { error: "Two-factor authentication isn't set up." };
    if (looksLikeRecovery(input)) {
      const used = await q("UPDATE user_recovery_codes SET used_at=NOW() WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL RETURNING 1", [userId, hashRecovery(input)]);
      if (!used.rowCount) return fail(q, userId);
      await q("UPDATE user_mfa SET failed_attempts=0, locked_until=NULL WHERE user_id=$1", [userId]);
      await markSession(q, userId, tokenHash);
      const left = (await q("SELECT count(*)::int AS n FROM user_recovery_codes WHERE user_id=$1 AND used_at IS NULL", [userId])).rows[0].n as number;
      return { ok: true as const, usedRecovery: true, remaining: left };
    }
    const v = verifyTotp(row.secret, input, { lastUsedStep: row.last });
    if (!v.ok) return fail(q, userId);
    await q("UPDATE user_mfa SET last_used_step=$2, failed_attempts=0, locked_until=NULL WHERE user_id=$1", [userId, v.step]);
    await markSession(q, userId, tokenHash);
    return { ok: true as const, usedRecovery: false, remaining: -1 };
  });
  return r as { ok: true; usedRecovery: boolean; remaining: number } | { error: string; justLocked?: boolean };
}

/** New recovery codes (the old ones stop working). Needs a fresh authenticator code, not a recovery code. */
export async function regenerateRecovery(userId: string, code: string): Promise<{ codes: string[] } | { error: string }> {
  const r = await withRow(userId, async (row, q) => {
    if (!row.enabled) return { error: "Two-factor authentication isn't set up." };
    if (looksLikeRecovery(code)) return { error: "Use a code from your authenticator app." };
    const v = verifyTotp(row.secret, code, { lastUsedStep: row.last });
    if (!v.ok) return fail(q, userId);
    const codes = newRecoveryCodes();
    await q("UPDATE user_mfa SET last_used_step=$2, failed_attempts=0, locked_until=NULL WHERE user_id=$1", [userId, v.step]);
    await q("DELETE FROM user_recovery_codes WHERE user_id=$1", [userId]);
    for (const c of codes) await q("INSERT INTO user_recovery_codes(user_id, code_hash) VALUES ($1,$2)", [userId, hashRecovery(c)]);
    return { codes };
  });
  return r as { codes: string[] } | { error: string };
}

export async function recoveryRemaining(userId: string): Promise<number> {
  return (await db().query("SELECT count(*)::int AS n FROM user_recovery_codes WHERE user_id=$1 AND used_at IS NULL", [userId])).rows[0].n;
}

/** Turns two-factor off for an ordinary account. Needs a current authenticator code or an unused recovery code (the caller has checked the password). */
export async function disableMfa(userId: string, input: string): Promise<{ ok: true } | { error: string; justLocked?: boolean }> {
  const r = await withRow(userId, async (row, q) => {
    if (!row.enabled) return { error: "Two-factor authentication isn't turned on." };
    if (looksLikeRecovery(input)) {
      const used = await q("UPDATE user_recovery_codes SET used_at=NOW() WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL RETURNING 1", [userId, hashRecovery(input)]);
      if (!used.rowCount) return fail(q, userId);
    } else if (!verifyTotp(row.secret, input, { lastUsedStep: row.last }).ok) return fail(q, userId);
    await q("DELETE FROM user_recovery_codes WHERE user_id=$1", [userId]);
    await q("DELETE FROM user_mfa WHERE user_id=$1", [userId]);
    return { ok: true as const };
  });
  return r as { ok: true } | { error: string; justLocked?: boolean };
}

/** Removes someone's two-factor enrolment (an admin or the server operator helping a locked-out person). Ends their sessions. */
export async function resetMfa(userId: string): Promise<void> {
  await db().query("DELETE FROM user_recovery_codes WHERE user_id=$1", [userId]);
  await db().query("DELETE FROM user_mfa WHERE user_id=$1", [userId]);
  await db().query("DELETE FROM sessions WHERE user_id=$1", [userId]);
}

export async function isEnrolled(userId: string): Promise<boolean> {
  return !!(await db().query("SELECT 1 FROM user_mfa WHERE user_id=$1 AND enabled_at IS NOT NULL", [userId])).rowCount;
}

export type SecurityAction = "mfa_enabled" | "mfa_disabled" | "mfa_recovery_used" | "mfa_codes_regenerated" | "mfa_reset_by_admin" | "mfa_locked";
export async function securityEvent(userId: string, action: SecurityAction): Promise<void> {
  await db().query("INSERT INTO security_events(user_id, action) VALUES ($1,$2)", [userId, action]);
}
export const SECURITY_LABEL: Record<SecurityAction, string> = {
  mfa_enabled: "Two-factor turned on", mfa_disabled: "Two-factor turned off", mfa_recovery_used: "Signed in with a recovery code",
  mfa_codes_regenerated: "New recovery codes created", mfa_reset_by_admin: "Two-factor removed by LIN support", mfa_locked: "Two-factor locked after wrong codes",
};
