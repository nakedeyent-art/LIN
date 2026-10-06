import { db } from "./db";
import { verifyPassword } from "./crypto";
import { clearFailures, recordFailure } from "./lockout";

/** Password re-check for sensitive actions; wrong attempts feed the same lockout as login. */
export async function checkPassword(userId: string, password: string):
  Promise<{ ok: true; email: string; name: string; hash: string } | { ok: false; error: string }> {
  const u = (await db().query("SELECT email, full_name, password_hash, locked_until FROM users WHERE id=$1", [userId])).rows[0];
  if (u.locked_until && new Date(u.locked_until) > new Date()) return { ok: false, error: "Too many attempts. Try again in 15 minutes." };
  if (!(await verifyPassword(password, u.password_hash))) {
    await recordFailure(userId);
    return { ok: false, error: "Your current password is incorrect." };
  }
  await clearFailures(userId);
  return { ok: true, email: u.email, name: u.full_name, hash: u.password_hash };
}
