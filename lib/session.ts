import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "./db";
import { hashToken, newSessionToken } from "./crypto";
import { ROLES, type Role } from "./roles";
import { mfaStatus } from "./mfa";

export const COOKIE = "lin_session";
const SESSION_DAYS = 7;

export type Session = { userId: string; name: string; email: string; role: Role; emailVerified: boolean; isAdmin: boolean };

export async function createSession(userId: string): Promise<void> {
  const token = newSessionToken();
  await db().query(
    "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1,$2, NOW() + make_interval(days => $3))",
    [hashToken(token), userId, SESSION_DAYS],
  );
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db().query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  jar.delete(COOKIE);
}

/** SHA-256 of this browser's session cookie (null if none) — used to keep the current session when ending others. */
export async function currentTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/** Ends every session of the user except the one making this request. */
export async function endOtherSessions(userId: string): Promise<void> {
  await db().query("DELETE FROM sessions WHERE user_id=$1 AND token_hash <> COALESCE($2, '')", [userId, await currentTokenHash()]);
}

type Loaded = Session & { mfaEnrolled: boolean; mfaPending: boolean };

async function load(): Promise<Loaded | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { rows } = await db().query(
    `SELECT u.id, u.full_name, u.email, u.role, u.email_verified_at IS NOT NULL AS verified, u.is_admin,
            (m.enabled_at IS NOT NULL) AS enrolled, (m.enabled_at IS NOT NULL AND s.mfa_verified_at IS NULL) AS pending
       FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN user_mfa m ON m.user_id = u.id
      WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.deleted_at IS NULL AND u.suspended_at IS NULL`,
    [hashToken(token)],
  );
  const r = rows[0];
  return r ? { userId: r.id, name: r.full_name, email: r.email, role: r.role as Role, emailVerified: r.verified, isAdmin: r.is_admin, mfaEnrolled: !!r.enrolled, mfaPending: !!r.pending } : null;
}

/**
 * The signed-in person, or null. A session whose owner has two-factor on but hasn't completed the second step is NOT signed in:
 * this returns null for it, so every page, action and download route (all of which call this) treats it as a stranger.
 */
export async function getSession(): Promise<Session | null> {
  const s = await load();
  return s && !s.mfaPending ? s : null;
}

/** Someone who has passed the password but not yet the second step. Only the /mfa pages use this. */
export async function getPendingSession(): Promise<Session | null> {
  return load();
}

/** Signed in with a verified email, else redirect (to the second step if that's the only thing missing). */
export async function requireUser(): Promise<Session> {
  const s = await load();
  if (!s) redirect("/login");
  if (s.mfaPending) redirect("/mfa/verify");
  if (!s.emailVerified) redirect("/verify-email");
  return s;
}

/** Route guard: verified user, and the page is in the role's nav. */
export async function requireAccess(href: string): Promise<Session> {
  const s = await requireUser();
  if (!ROLES[s.role].nav.some((n) => n.href === href)) notFound();
  return s;
}

/**
 * Admin pages: a verified admin, else the page simply doesn't exist (404). An admin must also have two-factor authentication set up
 * (first visit sends them to enrol) and must have completed the second step on THIS session within the last 8 hours.
 */
export async function requireAdmin(): Promise<Session> {
  const s = await load();
  if (!s || !s.emailVerified || !s.isAdmin) notFound();
  const m = await mfaStatus(s.userId, await currentTokenHash());
  if (!m.enrolled) redirect("/mfa/setup");
  if (!m.verifiedFresh) redirect("/mfa/verify");
  return s;
}

/** For route handlers (images, downloads): the admin session, or null if not an admin or the second step isn't done. Never redirects. */
export async function getAdminSession(): Promise<Session | null> {
  const s = await load();
  if (!s || !s.emailVerified || !s.isAdmin) return null;
  const m = await mfaStatus(s.userId, await currentTokenHash());
  return m.enrolled && m.verifiedFresh ? s : null;
}

/** Anyone with a verified email who may be mid-way through the second step (used only by the /mfa pages). */
export async function requireMfaPage(): Promise<Session & { mfaPending: boolean }> {
  const s = await load();
  if (!s) redirect("/login");
  if (!s.emailVerified) redirect("/verify-email");
  return s;
}
