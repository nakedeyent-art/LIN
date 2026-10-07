// Removes an admin's two-factor enrolment (lost phone AND lost recovery codes), ends their sessions, and writes an audit entry.
// They enrol again at their next visit to /admin.   node --env-file-if-exists=.env.local scripts/reset-admin-mfa.mjs admin@example.com "reason"
// Needs database access — the same trust level as granting admin rights. Verify the person's identity out-of-band first.
import pg from "pg";
const [email, reason] = [process.argv[2]?.trim().toLowerCase(), (process.argv[3] ?? "").trim()];
if (!email || reason.length < 10) { console.error('usage: reset-admin-mfa.mjs <email> "reason of at least 10 characters"'); process.exit(2); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set"); process.exit(2); }
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
try {
  await c.query("BEGIN");
  const u = (await c.query("SELECT id, is_admin, deleted_at FROM users WHERE email=$1 FOR UPDATE", [email])).rows[0];
  if (!u || u.deleted_at || !u.is_admin) { await c.query("ROLLBACK"); console.error("No such admin account."); process.exit(1); }
  await c.query("DELETE FROM user_recovery_codes WHERE user_id=$1", [u.id]);
  await c.query("DELETE FROM user_mfa WHERE user_id=$1", [u.id]);
  await c.query("DELETE FROM sessions WHERE user_id=$1", [u.id]);
  await c.query("INSERT INTO admin_audit(admin_id, action, target_user_id, detail) VALUES ($1,'mfa_reset',$1,$2)", [u.id, `reset from the server: ${reason}`.slice(0, 500)]);
  await c.query("COMMIT");
  console.log(`${email}: two-factor removed and sessions ended. They will enrol again at their next visit to /admin.`);
} finally { await c.end(); }
