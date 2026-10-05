import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "./db";
import { hashToken, newSessionToken } from "./crypto";
import { ROLES, type Role } from "./roles";

export const COOKIE = "lin_session";
const SESSION_DAYS = 7;

export type Session = { userId: string; name: string; email: string; role: Role };

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

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { rows } = await db().query(
    `SELECT u.id, u.full_name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(token)],
  );
  const r = rows[0];
  return r ? { userId: r.id, name: r.full_name, email: r.email, role: r.role as Role } : null;
}

/** Route guard: signed in, and the page is in the role's nav. */
export async function requireAccess(href: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!ROLES[s.role].nav.some((n) => n.href === href)) notFound();
  return s;
}
