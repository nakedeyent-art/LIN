import type { PoolClient } from "pg";
import { db } from "./db";
import { LIVE_STATUSES, sqlIn } from "./deals";
import { MONEY_IN_FLIGHT } from "./payment-rules";
import type { Target } from "./admin";

type Q = Pick<PoolClient, "query">;

export async function audit(adminId: string, action: string, o: { userId?: string; dealId?: string; detail?: string }, c: Q = db()): Promise<void> {
  await c.query("INSERT INTO admin_audit(admin_id, action, target_user_id, target_deal_id, detail) VALUES ($1,$2,$3,$4,$5)",
    [adminId, action, o.userId ?? null, o.dealId ?? null, (o.detail ?? "").slice(0, 500) || null]);
}

/** One 'view' line per admin, subject and hour: reading a person's details is itself auditable, but not spammy. */
export async function auditView(adminId: string, userId: string): Promise<void> {
  await db().query(
    `INSERT INTO admin_audit(admin_id, action, target_user_id) SELECT $1,'view_user',$2
      WHERE NOT EXISTS (SELECT 1 FROM admin_audit WHERE admin_id=$1 AND target_user_id=$2 AND action='view_user' AND created_at > NOW() - INTERVAL '1 hour')`, [adminId, userId]);
}

export async function overview() {
  const q = (sql: string) => db().query(sql).then((r) => r.rows);
  const [users, deals, pays, disputes, jobs, failedJobs, suspended] = await Promise.all([
    q("SELECT role, count(*)::int AS n FROM users WHERE deleted_at IS NULL GROUP BY role ORDER BY role"),
    q("SELECT status, count(*)::int AS n FROM deals GROUP BY status ORDER BY status"),
    q("SELECT status, count(*)::int AS n FROM deal_payments GROUP BY status ORDER BY status"),
    q(`SELECT count(DISTINCT e.payment_id)::int AS n FROM payment_events e WHERE e.action='dispute_opened' AND NOT EXISTS
         (SELECT 1 FROM payment_events c WHERE c.payment_id=e.payment_id AND c.action='dispute_closed' AND c.created_at > e.created_at)`),
    q("SELECT DISTINCT ON (job) job, status, started_at, processed, failed FROM job_runs ORDER BY job, started_at DESC"),
    q("SELECT count(*)::int AS n FROM job_runs WHERE status='failed' AND started_at > NOW() - INTERVAL '7 days'"),
    q("SELECT count(*)::int AS n FROM users WHERE suspended_at IS NOT NULL AND deleted_at IS NULL"),
  ]);
  return { users, deals, pays, openDisputes: disputes[0].n as number, jobs, failedJobs: failedJobs[0].n as number, suspended: suspended[0].n as number };
}

export type UserHit = { id: string; email: string; full_name: string; role: string; created_at: Date; verified: boolean; suspended: boolean; deleted: boolean; is_admin: boolean };
export async function searchUsers(term: string): Promise<UserHit[]> {
  const t = term.trim();
  if (t.length < 2) return [];
  const like = "%" + t.replace(/[\\%_]/g, "\\$&") + "%";
  return (await db().query(
    `SELECT id, email, full_name, role, created_at, email_verified_at IS NOT NULL AS verified, suspended_at IS NOT NULL AS suspended, deleted_at IS NOT NULL AS deleted, is_admin
       FROM users WHERE email ILIKE $1 OR full_name ILIKE $1 ORDER BY created_at DESC LIMIT 50`, [like])).rows;
}

export async function userForAdmin(id: string, c: Q = db()) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const u = (await c.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.created_at, u.email_verified_at, u.failed_logins, u.locked_until, u.suspended_at, u.deleted_at, u.is_admin,
            ap.birth_date::text AS birth_date, ap.level, ap.discoverable,
            (SELECT count(*)::int FROM sessions s WHERE s.user_id=u.id AND s.expires_at > NOW()) AS sessions,
            (SELECT count(*)::int FROM deals d WHERE d.athlete_id=u.id OR d.counterparty_id=u.id) AS deals_total,
            (SELECT count(*)::int FROM deals d WHERE (d.athlete_id=u.id OR d.counterparty_id=u.id) AND d.status IN ${sqlIn(LIVE_STATUSES)}) AS live_deals,
            (SELECT count(*)::int FROM deal_payments p JOIN deals d ON d.id=p.deal_id WHERE p.status IN ${sqlIn(MONEY_IN_FLIGHT)} AND (p.payee_user_id=u.id OR d.athlete_id=u.id OR d.counterparty_id=u.id)) AS money_in_flight,
            (SELECT count(*)::int FROM guardian_links g WHERE g.athlete_id=u.id) AS guardians,
            (SELECT count(*)::int FROM guardian_links g WHERE g.member_id=u.id) AS wards
       FROM users u LEFT JOIN athlete_profiles ap ON ap.user_id=u.id WHERE u.id=$1`, [id])).rows[0];
  return u ?? null;
}
export const targetOf = (u: NonNullable<Awaited<ReturnType<typeof userForAdmin>>>): Target => ({
  id: u.id, isAdmin: u.is_admin, deleted: !!u.deleted_at, suspended: !!u.suspended_at, verified: !!u.email_verified_at,
  role: u.role, liveDeals: u.live_deals, moneyInFlight: u.money_in_flight,
});

export async function adminDeals(status?: string) {
  return (await db().query(
    `SELECT d.id, d.title, d.status, d.amount_cents::float8 AS amount_cents, d.created_at, a.full_name AS athlete, c.full_name AS counterparty,
            (SELECT p.status FROM deal_payments p WHERE p.deal_id=d.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status
       FROM deals d JOIN users a ON a.id=d.athlete_id JOIN users c ON c.id=d.counterparty_id
      WHERE ($1::text IS NULL OR d.status=$1) ORDER BY d.created_at DESC LIMIT 100`, [status ?? null])).rows;
}

/** Deal metadata for support. Deliberately excludes message text, and everything about health, academics and training. */
export async function adminDeal(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const d = (await db().query(
    `SELECT d.*, d.amount_cents::float8 AS amount, a.full_name AS athlete, a.id AS athlete_uid, c.full_name AS counterparty, c.id AS counterparty_uid,
            (SELECT count(*)::int FROM deal_messages m WHERE m.deal_id=d.id) AS message_count
       FROM deals d JOIN users a ON a.id=d.athlete_id JOIN users c ON c.id=d.counterparty_id WHERE d.id=$1`, [id])).rows[0];
  if (!d) return null;
  const [events, contract, payments, pevents] = await Promise.all([
    db().query("SELECT e.action, e.to_status, e.created_at, u.role FROM deal_events e JOIN users u ON u.id=e.actor_id WHERE e.deal_id=$1 ORDER BY e.created_at, e.id", [id]),
    db().query(`SELECT k.sha256, k.template_version, k.executed_at, k.voided_at, k.platform_fee_bps,
                       (SELECT count(*)::int FROM contract_signatures s WHERE s.contract_id=k.id) AS signatures FROM contracts k WHERE k.deal_id=$1`, [id]),
    db().query("SELECT id, status, amount_cents::float8 AS amount_cents, fee_cents::float8 AS fee_cents, attempts, last_error, created_at FROM deal_payments WHERE deal_id=$1 ORDER BY created_at", [id]),
    db().query("SELECT e.payment_id, e.action, e.detail, e.created_at FROM payment_events e JOIN deal_payments p ON p.id=e.payment_id WHERE p.deal_id=$1 ORDER BY e.created_at, e.id", [id]),
  ]);
  return { d, events: events.rows, contract: contract.rows[0] ?? null, payments: payments.rows, paymentEvents: pevents.rows };
}

export async function auditLog(limit = 100) {
  return (await db().query(
    `SELECT l.id::float8 AS id, l.action, l.detail, l.created_at, a.email AS admin_email, t.email AS target_email, l.target_deal_id
       FROM admin_audit l JOIN users a ON a.id=l.admin_id LEFT JOIN users t ON t.id=l.target_user_id ORDER BY l.id DESC LIMIT $1`, [limit])).rows;
}

export async function jobRuns(limit = 40) {
  return (await db().query("SELECT job, status, started_at, finished_at, processed, skipped, failed, error FROM job_runs ORDER BY started_at DESC LIMIT $1", [limit])).rows;
}
