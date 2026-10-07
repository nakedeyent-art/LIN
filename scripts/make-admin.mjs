// Grants or revokes admin rights: node --env-file-if-exists=.env.local scripts/make-admin.mjs you@example.com [--revoke]
// Admin rights can only be changed here (with database access), never from inside the app.
import pg from "pg";
const [email, flag] = [process.argv[2]?.trim().toLowerCase(), process.argv[3]];
if (!email || (flag && flag !== "--revoke")) { console.error("usage: make-admin.mjs <email> [--revoke]"); process.exit(2); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set"); process.exit(2); }
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
try {
  const u = (await c.query("SELECT id, email_verified_at, deleted_at, is_admin FROM users WHERE email=$1", [email])).rows[0];
  if (!u || u.deleted_at) { console.error("No such account."); process.exit(1); }
  if (!flag && !u.email_verified_at) { console.error("That account's email isn't verified yet."); process.exit(1); }
  await c.query("UPDATE users SET is_admin=$2 WHERE id=$1", [u.id, !flag]);
  if (flag) { await c.query("DELETE FROM sessions WHERE user_id=$1", [u.id]); await c.query("DELETE FROM admin_recovery_codes WHERE user_id=$1", [u.id]); await c.query("DELETE FROM admin_mfa WHERE user_id=$1", [u.id]); }
  console.log(`${email}: admin ${flag ? "revoked (sessions ended, two-factor removed)" : "granted — they will be asked to set up two-factor authentication on first visit to /admin"}`);
} finally { await c.end(); }
