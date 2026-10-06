import { db } from "../db";
import { runAdultTransition, type JobResult } from "./adult-transition";
import { retryStuckPayments } from "../payments";
import { paymentsEnabled } from "../stripe";
import { purgeOldNotifications } from "../notificationsdb";
import { ingestAll } from "../newsdb";

const LOCK_KEY = 7_345_001;   // arbitrary app-wide advisory-lock id: only one run of the daily jobs at a time

export type RunSummary =
  | { status: "skipped_locked" }
  | { status: "ok" | "failed"; dry: boolean; jobs: Record<string, JobResult> };

/** Add new scheduled jobs here; each must be idempotent and safe to retry. */
const JOBS: { name: string; run: (o: { dry: boolean }) => Promise<JobResult> }[] = [
  { name: "adult-transition", run: runAdultTransition },
  // Finishes payouts/refunds that failed mid-way and reconciles checkouts whose webhook never arrived. Safe to retry: Stripe calls are idempotent.
  { name: "payments-retry", run: async ({ dry }) => {
      if (dry || !paymentsEnabled()) return { processed: 0, skipped: 0, failed: 0 };
      const r = await retryStuckPayments();
      return { processed: r.processed, skipped: 0, failed: r.failed };
    } },
  // Pulls the admin-configured news sources (each at most every 30 minutes). A source that fails 10 times in a row is switched off.
  { name: "news-ingest", run: async ({ dry }) => {
      if (dry) return { processed: 0, skipped: 0, failed: 0 };
      const r = await ingestAll();
      return { processed: r.added, skipped: r.failed, failed: 0 };   // a flaky third-party source is shown on /admin/news, not as a failed job
    } },
  // Read notifications expire; expired login sessions and old finished job logs are dropped. Counts only.
  { name: "housekeeping", run: async ({ dry }) => {
      if (dry) return { processed: 0, skipped: 0, failed: 0 };
      const notes = await purgeOldNotifications();
      const sessions = (await db().query("DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '1 day'")).rowCount ?? 0;
      const logs = (await db().query("DELETE FROM job_runs WHERE started_at < NOW() - INTERVAL '180 days'")).rowCount ?? 0;
      return { processed: notes + sessions + logs, skipped: 0, failed: 0 };
    } },
];

/**
 * Runs the daily jobs. A Postgres advisory lock (held on a dedicated connection) makes overlapping triggers harmless:
 * the second caller returns immediately. Real runs are recorded in job_runs (counts only — no personal data).
 */
export async function runDaily(opts: { dry: boolean }): Promise<RunSummary> {
  const lockConn = await db().connect();
  try {
    const got = (await lockConn.query("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_KEY])).rows[0].ok as boolean;
    if (!got) return { status: "skipped_locked" };
    const jobs: Record<string, JobResult> = {};
    let status: "ok" | "failed" = "ok";
    for (const job of JOBS) {
      const runId = opts.dry ? null : (await db().query("INSERT INTO job_runs(job) VALUES ($1) RETURNING id", [job.name])).rows[0].id as string;
      try {
        const r = await job.run(opts);
        jobs[job.name] = r;
        if (r.failed > 0) status = "failed";
        if (runId) await db().query("UPDATE job_runs SET finished_at=NOW(), status=$2, processed=$3, skipped=$4, failed=$5 WHERE id=$1",
          [runId, r.failed > 0 ? "failed" : "ok", r.processed, r.skipped, r.failed]);
      } catch (e) {
        status = "failed";
        jobs[job.name] = { processed: 0, skipped: 0, failed: 1 };
        console.error(`job ${job.name} crashed:`, (e as Error).message);
        if (runId) await db().query("UPDATE job_runs SET finished_at=NOW(), status='failed', failed=1, error=$2 WHERE id=$1", [runId, (e as Error).message.slice(0, 300)]);
      }
    }
    return { status, dry: opts.dry, jobs };
  } finally {
    await lockConn.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    lockConn.release();
  }
}
