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
  const [users, deals, pays, disputes, jobs, failedJobs, suspended, reports, creports] = await Promise.all([
    q("SELECT role, count(*)::int AS n FROM users WHERE deleted_at IS NULL GROUP BY role ORDER BY role"),
    q("SELECT status, count(*)::int AS n FROM deals GROUP BY status ORDER BY status"),
    q("SELECT status, count(*)::int AS n FROM deal_payments GROUP BY status ORDER BY status"),
    q(`SELECT count(DISTINCT e.payment_id)::int AS n FROM payment_events e WHERE e.action='dispute_opened' AND NOT EXISTS
         (SELECT 1 FROM payment_events c WHERE c.payment_id=e.payment_id AND c.action='dispute_closed' AND c.created_at > e.created_at)`),
    q("SELECT DISTINCT ON (job) job, status, started_at, processed, failed FROM job_runs ORDER BY job, started_at DESC"),
    q("SELECT count(*)::int AS n FROM job_runs WHERE status='failed' AND started_at > NOW() - INTERVAL '7 days'"),
    q("SELECT count(*)::int AS n FROM users WHERE suspended_at IS NOT NULL AND deleted_at IS NULL"),
    q("SELECT count(*)::int AS n, count(*) FILTER (WHERE reason='safety_minor')::int AS urgent FROM message_reports WHERE status='open'"),
    q("SELECT count(*)::int AS n, count(*) FILTER (WHERE reason='safety_minor')::int AS urgent FROM content_reports WHERE status='open'"),
  ]);
  return { users, deals, pays, openDisputes: disputes[0].n as number, jobs, failedJobs: failedJobs[0].n as number, suspended: suspended[0].n as number, openReports: reports[0].n as number, urgentReports: reports[0].urgent as number, openContent: creports[0].n as number, urgentContent: creports[0].urgent as number };
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
            (SELECT count(*)::int FROM guardian_links g WHERE g.member_id=u.id) AS wards,
            EXISTS (SELECT 1 FROM user_mfa mm WHERE mm.user_id=u.id AND mm.enabled_at IS NOT NULL) AS mfa_enrolled
       FROM users u LEFT JOIN athlete_profiles ap ON ap.user_id=u.id WHERE u.id=$1`, [id])).rows[0];
  return u ?? null;
}
export const targetOf = (u: NonNullable<Awaited<ReturnType<typeof userForAdmin>>>): Target => ({
  id: u.id, isAdmin: u.is_admin, deleted: !!u.deleted_at, suspended: !!u.suspended_at, verified: !!u.email_verified_at,
  role: u.role, liveDeals: u.live_deals, moneyInFlight: u.money_in_flight, mfaEnrolled: u.mfa_enrolled,
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

// ---------------- moderation ----------------
export async function reportQueue(status: "open" | "resolved") {
  return (await db().query(
    `SELECT r.id, r.reason, r.status, r.created_at, r.deal_id, rep.full_name AS reporter, snd.full_name AS sender, snd.id AS sender_id,
            (r.reason = 'safety_minor') AS urgent,
            (SELECT count(*)::int FROM message_reports x WHERE x.message_id = r.message_id) AS reports_on_message
       FROM message_reports r JOIN deal_messages m ON m.id = r.message_id JOIN users snd ON snd.id = m.sender_id JOIN users rep ON rep.id = r.reporter_id
      WHERE ${status === "open" ? "r.status = 'open'" : "r.status <> 'open'"}
      ORDER BY (r.reason = 'safety_minor') DESC, r.created_at ${status === "open" ? "ASC" : "DESC"} LIMIT 100`)).rows;
}

/** One report with the reported message and up to three messages either side — nothing else of the conversation. */
export async function reportDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = (await db().query(
    `SELECT r.*, rep.full_name AS reporter_name, rep.email AS reporter_email, m.sender_id, snd.full_name AS sender_name, snd.email AS sender_email, snd.suspended_at, snd.is_admin AS sender_is_admin,
            m.hidden_at, d.title AS deal_title,
            COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS athlete_minor, d.athlete_id
       FROM message_reports r JOIN deal_messages m ON m.id = r.message_id JOIN users snd ON snd.id = m.sender_id JOIN users rep ON rep.id = r.reporter_id
       JOIN deals d ON d.id = r.deal_id LEFT JOIN athlete_profiles ap ON ap.user_id = d.athlete_id WHERE r.id = $1`, [id])).rows[0];
  if (!r) return null;
  const context = (await db().query(
    `SELECT m.id::float8 AS id, u.full_name AS name, m.sender_id, m.body, m.created_at, m.hidden_at IS NOT NULL AS hidden, (m.id = $2) AS reported,
            COALESCE((SELECT json_agg(json_build_object('id', a.id, 'name', a.filename, 'size', a.size_bytes)) FROM deal_attachments a WHERE a.message_id = m.id), '[]'::json) AS files
       FROM deal_messages m JOIN users u ON u.id = m.sender_id
      WHERE m.deal_id = $1 AND m.id IN (
        SELECT id FROM (SELECT id FROM deal_messages WHERE deal_id=$1 AND id < $2 ORDER BY id DESC LIMIT 3) before
        UNION ALL SELECT $2::bigint
        UNION ALL SELECT id FROM (SELECT id FROM deal_messages WHERE deal_id=$1 AND id > $2 ORDER BY id LIMIT 3) after)
      ORDER BY m.id`, [r.deal_id, r.message_id])).rows;
  const stats = (await db().query(
    `SELECT (SELECT count(*)::int FROM deal_messages WHERE sender_id=$1 AND hidden_at IS NOT NULL) AS hidden_before,
            (SELECT count(*)::int FROM message_reports x JOIN deal_messages m ON m.id=x.message_id WHERE m.sender_id=$1 AND x.status='open') AS open_reports,
            (SELECT count(*)::int FROM user_blocks WHERE blocked_id=$1) AS blocks_received`, [r.sender_id])).rows[0];
  return { r, context, stats };
}

// ---------------- post & comment reports ----------------
export async function contentQueue(status: "open" | "resolved") {
  return (await db().query(
    `SELECT r.id, r.kind, r.reason, r.status, r.created_at, rep.full_name AS reporter, snd.full_name AS author, (r.reason = 'safety_minor') AS urgent
       FROM content_reports r JOIN users rep ON rep.id = r.reporter_id
       JOIN users snd ON snd.id = COALESCE((SELECT c.author_id FROM post_comments c WHERE c.id = r.comment_id), (SELECT p.author_id FROM posts p WHERE p.id = r.post_id))
      WHERE ${status === "open" ? "r.status = 'open'" : "r.status <> 'open'"}
      ORDER BY (r.reason = 'safety_minor') DESC, r.created_at ${status === "open" ? "ASC" : "DESC"} LIMIT 100`)).rows;
}

export async function contentDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = (await db().query(
    `SELECT r.*, rep.full_name AS reporter_name, rep.email AS reporter_email, p.author_id AS post_author, p.body AS post_body, p.created_at AS post_at, p.hidden_at AS post_hidden,
            EXISTS (SELECT 1 FROM post_images i WHERE i.post_id = p.id) AS has_image,
            c.author_id AS comment_author, c.body AS comment_body, c.hidden_at AS comment_hidden,
            COALESCE(c.author_id, p.author_id) AS sender_id, su.full_name AS sender_name, su.email AS sender_email, su.suspended_at, su.is_admin AS sender_is_admin,
            EXISTS (SELECT 1 FROM athlete_profiles ap WHERE ap.user_id IN (p.author_id, COALESCE(c.author_id, p.author_id)) AND ap.birth_date > CURRENT_DATE - INTERVAL '18 years') AS involves_minor
       FROM content_reports r JOIN users rep ON rep.id = r.reporter_id JOIN posts p ON p.id = r.post_id LEFT JOIN post_comments c ON c.id = r.comment_id
       JOIN users su ON su.id = COALESCE(c.author_id, p.author_id) WHERE r.id = $1`, [id])).rows[0];
  if (!r) return null;
  const comments = r.kind === "comment" ? (await db().query(
    `SELECT c.id::float8 AS id, u.full_name AS name, c.body, c.created_at, (c.id = $2) AS reported, c.hidden_at IS NOT NULL AS hidden
       FROM post_comments c JOIN users u ON u.id = c.author_id
      WHERE c.post_id = $1 AND c.id IN (
        SELECT id FROM (SELECT id FROM post_comments WHERE post_id=$1 AND id < $2 ORDER BY id DESC LIMIT 3) b
        UNION ALL SELECT $2::bigint
        UNION ALL SELECT id FROM (SELECT id FROM post_comments WHERE post_id=$1 AND id > $2 ORDER BY id LIMIT 3) a) ORDER BY c.id`, [r.post_id, r.comment_id])).rows : [];
  const stats = (await db().query(
    `SELECT (SELECT count(*)::int FROM posts WHERE author_id=$1 AND hidden_at IS NOT NULL) + (SELECT count(*)::int FROM post_comments WHERE author_id=$1 AND hidden_at IS NOT NULL) AS hidden_before,
            (SELECT count(*)::int FROM user_blocks WHERE blocked_id=$1) AS blocks_received`, [r.sender_id])).rows[0];
  return { r, comments, stats };
}
