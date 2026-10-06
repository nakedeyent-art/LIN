import { db } from "./db";

export const MAX_FAILS = 5;
export const LOCK_MINUTES = 15;

/** Counts a failed credential check (login or re-authentication) and locks the account at MAX_FAILS. */
export async function recordFailure(userId: string): Promise<void> {
  await db().query(
    `UPDATE users SET failed_logins = failed_logins + 1,
       locked_until = CASE WHEN failed_logins + 1 >= $2 THEN NOW() + make_interval(mins => $3) ELSE locked_until END
     WHERE id = $1`, [userId, MAX_FAILS, LOCK_MINUTES]);
}

export async function clearFailures(userId: string): Promise<void> {
  await db().query("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1", [userId]);
}
