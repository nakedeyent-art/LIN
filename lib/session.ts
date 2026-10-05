import { cookies } from "next/headers";
import { isRole, type Role } from "./roles";

/**
 * DEMO SESSION ONLY: a plain cookie holding the chosen role.
 * Replace with real auth (Auth.js / Supabase Auth) + the `users`/`memberships`
 * tables in db/schema.sql before any real data is handled.
 */
export type Session = { name: string; role: Role };

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const role = jar.get("lin_role")?.value;
  const name = jar.get("lin_name")?.value;
  if (!isRole(role) || !name) return null;
  return { role, name };
}

import { notFound, redirect } from "next/navigation";
import { ROLES } from "./roles";

/** Route guard: the page is only reachable if it's in the role's nav. */
export async function requireAccess(href: string): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!ROLES[s.role].nav.some((n) => n.href === href)) notFound();
  return s;
}
