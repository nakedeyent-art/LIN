/** Payments orchestration (Stripe Connect, separate charges and transfers). Card data never reaches this app. */
import type { PoolClient } from "pg";
import { db } from "./db";
import { notifyInApp } from "./notificationsdb";
import { appUrl, sendMail } from "./mailer";
import { paymentsEnabled, stripe, StripeError } from "./stripe";
import { fundingBlocker, payeeValid, type PaymentStatus } from "./payment-rules";
import { platformFee } from "./money";

/** An error whose message is safe to show the user. */
export class UserError extends Error {}

export type PayoutAccount = { userId: string; stripeAccountId: string; detailsSubmitted: boolean; payoutsEnabled: boolean; chargesEnabled: boolean };
export type PaymentRow = {
  id: string; dealId: string; payeeUserId: string; amountCents: number; feeCents: number; status: PaymentStatus; attempts: number;
  checkoutUrl: string | null; sessionId: string | null; paymentIntentId: string | null; transferId: string | null; lastError: string | null;
  createdAt: Date; fundedAt: Date | null; releasedAt: Date | null; refundedAt: Date | null;
};
const MAX_ATTEMPTS = 10;
const safeMsg = (e: unknown) => (e instanceof StripeError ? `${e.code ?? "stripe_error"}: ${e.message}` : (e as Error)?.message ?? "error").slice(0, 200);

const mapPayment = (r: Record<string, unknown>): PaymentRow => ({
  id: r.id as string, dealId: r.deal_id as string, payeeUserId: r.payee_user_id as string, amountCents: Number(r.amount_cents), feeCents: Number(r.fee_cents),
  status: r.status as PaymentStatus, attempts: r.attempts as number, checkoutUrl: r.checkout_url as string | null, sessionId: r.stripe_checkout_session_id as string | null,
  paymentIntentId: r.stripe_payment_intent_id as string | null, transferId: r.stripe_transfer_id as string | null, lastError: r.last_error as string | null,
  createdAt: r.created_at as Date, fundedAt: r.funded_at as Date | null, releasedAt: r.released_at as Date | null, refundedAt: r.refunded_at as Date | null,
});

async function pevent(c: Pick<PoolClient, "query">, paymentId: string, action: string, detail?: string) {
  await c.query("INSERT INTO payment_events(payment_id, action, detail) VALUES ($1,$2,$3)", [paymentId, action, detail ?? null]);
}

export const notifyDealParties = async (dealId: string, subject: string, text: string) => {
  try {
    const r = (await db().query(
      `SELECT d.title, array_remove(ARRAY[d.counterparty_id, d.athlete_id, d.payee_user_id], NULL) AS ids FROM deals d WHERE d.id=$1`, [dealId])).rows[0];
    if (!r) return;
    const ids = [...new Set<string>(r.ids)];
    await notifyInApp(ids, { kind: "payment", title: `${subject}: "${r.title}"`, href: `/dashboard/deals/${dealId}` });
    const emails = (await db().query("SELECT email FROM users WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL AND email_deal_updates", [ids])).rows;
    for (const e of emails) await sendMail(e.email, subject, `${text}\n\n${appUrl()}/dashboard/deals/${dealId}`);
  } catch (e) { console.error("payment notice failed", (e as Error).message); }
};

// ---------------- payout accounts ----------------

export async function getPayoutAccount(userId: string): Promise<PayoutAccount | null> {
  const r = (await db().query("SELECT * FROM payout_accounts WHERE user_id=$1", [userId])).rows[0];
  return r ? { userId, stripeAccountId: r.stripe_account_id, detailsSubmitted: r.details_submitted, payoutsEnabled: r.payouts_enabled, chargesEnabled: r.charges_enabled } : null;
}

/** Creates the user's Stripe Express account if needed and returns a hosted onboarding link. */
export async function startPayoutOnboarding(userId: string, email: string): Promise<string> {
  let acct = await getPayoutAccount(userId);
  if (!acct) {
    const a = await stripe.createExpressAccount(userId, email);   // idempotent per user
    await db().query("INSERT INTO payout_accounts(user_id, stripe_account_id) VALUES ($1,$2) ON CONFLICT (user_id) DO NOTHING", [userId, a.id]);
    acct = await getPayoutAccount(userId);
  }
  const link = await stripe.createAccountLink(acct!.stripeAccountId, `${appUrl()}/dashboard/payouts/return`, `${appUrl()}/dashboard/payouts/refresh`);
  return link.url as string;
}

export async function refreshPayoutAccount(userId: string): Promise<PayoutAccount | null> {
  const acct = await getPayoutAccount(userId);
  if (!acct) return null;
  const a = await stripe.getAccount(acct.stripeAccountId);
  await applyAccountState(db(), acct.stripeAccountId, a);
  return getPayoutAccount(userId);
}

async function applyAccountState(c: Pick<PoolClient, "query">, accountId: string, a: { details_submitted?: boolean; payouts_enabled?: boolean; charges_enabled?: boolean }) {
  await c.query(
    `UPDATE payout_accounts SET details_submitted=$2, payouts_enabled=$3, charges_enabled=$4, updated_at=NOW() WHERE stripe_account_id=$1`,
    [accountId, !!a.details_submitted, !!a.payouts_enabled, !!a.charges_enabled]);
}

// ---------------- reading ----------------

export async function livePaymentFor(dealId: string, c?: Pick<PoolClient, "query">): Promise<PaymentRow | null> {
  const r = (await (c ?? db()).query(
    `SELECT * FROM deal_payments WHERE deal_id=$1 ORDER BY (status IN ('pending_checkout','funded','releasing','refunding')) DESC, created_at DESC LIMIT 1`, [dealId])).rows[0];
  return r ? mapPayment(r) : null;
}

export async function payeeInfo(dealId: string, c?: Pick<PoolClient, "query">) {
  const q = c ?? db();
  const r = (await q.query(
    `SELECT d.payee_user_id, d.athlete_id, u.full_name AS payee_name,
            COALESCE(ap.birth_date > CURRENT_DATE - INTERVAL '18 years', FALSE) AS minor,
            EXISTS (SELECT 1 FROM guardian_links g WHERE g.athlete_id = d.athlete_id AND g.member_id = d.payee_user_id) AS payee_is_guardian,
            pa.payouts_enabled, pa.details_submitted
       FROM deals d LEFT JOIN users u ON u.id = d.payee_user_id LEFT JOIN athlete_profiles ap ON ap.user_id = d.athlete_id
       LEFT JOIN payout_accounts pa ON pa.user_id = d.payee_user_id WHERE d.id=$1`, [dealId])).rows[0];
  const set = !!r?.payee_user_id;
  return {
    set, userId: (r?.payee_user_id as string | null) ?? null, name: (r?.payee_name as string | null) ?? null,
    valid: set && payeeValid({ athleteIsMinor: r.minor, payeeIsAthlete: r.payee_user_id === r.athlete_id, payeeIsCurrentGuardian: r.payee_is_guardian }),
    ready: !!r?.payouts_enabled,
  };
}

// ---------------- funding ----------------

/** Starts (or resumes) the sponsor's Stripe Checkout and returns its hosted URL. */
export async function startFunding(dealId: string, buyerId: string): Promise<string> {
  const client = await db().connect();
  let payment: PaymentRow, title: string;
  try {
    await client.query("BEGIN");
    const d = (await client.query(
      `SELECT d.id, d.status, d.title, d.counterparty_id, d.amount_cents::float8 AS amount, (d.expires_at IS NOT NULL AND d.expires_at < NOW()) AS expired,
              c.executed_at IS NOT NULL AS executed, c.voided_at IS NULL AS unvoided, c.platform_fee_bps
         FROM deals d LEFT JOIN contracts c ON c.deal_id = d.id WHERE d.id=$1 FOR UPDATE OF d`, [dealId])).rows[0];
    if (!d) throw new UserError("Unknown deal.");
    const live = await livePaymentFor(dealId, client);
    const payee = await payeeInfo(dealId, client);
    const blocker = fundingBlocker({
      paymentsEnabled: paymentsEnabled(), dealStatus: d.status, contractExecuted: !!d.executed && !!d.unvoided, isBuyer: d.counterparty_id === buyerId,
      payeeSet: payee.set, payeeIsValid: payee.valid, payeeReady: payee.ready, livePayment: live?.status ?? null, expired: false,
    });
    if (blocker) throw new UserError(blocker);

    if (live?.status === "pending_checkout") {
      const fresh = live.checkoutUrl && Date.now() - live.createdAt.getTime() < 20 * 3600 * 1000;
      if (fresh) { await client.query("COMMIT"); return live.checkoutUrl!; }
      await client.query("UPDATE deal_payments SET status='expired', updated_at=NOW() WHERE id=$1", [live.id]);
      await pevent(client, live.id, "expired", "stale checkout replaced");
    }
    title = d.title;
    const fee = platformFee(d.amount, d.platform_fee_bps);
    const ins = await client.query(
      `INSERT INTO deal_payments(deal_id, payee_user_id, amount_cents, fee_cents, status) VALUES ($1,$2,$3,$4,'pending_checkout') RETURNING *`,
      [dealId, payee.userId, d.amount, fee]);
    payment = mapPayment(ins.rows[0]);
    await pevent(client, payment.id, "checkout_started");
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }

  try {
    const base = `${appUrl()}/dashboard/deals/${dealId}`;
    const s = await stripe.createCheckoutSession({ dealId, paymentId: payment.id, title: title!, amountCents: payment.amountCents, successUrl: `${base}?paid=1`, cancelUrl: `${base}?paid=0` });
    await db().query("UPDATE deal_payments SET stripe_checkout_session_id=$2, checkout_url=$3, updated_at=NOW() WHERE id=$1", [payment.id, s.id, s.url]);
    return s.url as string;
  } catch (e) {
    await db().query("UPDATE deal_payments SET status='failed', last_error=$2, updated_at=NOW() WHERE id=$1 AND status='pending_checkout'", [payment.id, safeMsg(e)]);
    await pevent(db(), payment.id, "checkout_failed", safeMsg(e));
    throw new UserError("We couldn't start the payment page. Please try again in a moment.");
  }
}

/** Marks a pending payment funded after verifying Stripe's numbers match ours. Returns false if it did not match. */
async function markFunded(c: PoolClient, p: PaymentRow, s: { id: string; payment_status?: string; payment_intent?: string | null; amount_total?: number; currency?: string }): Promise<boolean> {
  if (s.payment_status !== "paid") return false;
  if (s.amount_total !== p.amountCents || (s.currency ?? "").toLowerCase() !== "usd") {
    await pevent(c, p.id, "amount_mismatch", `expected ${p.amountCents} usd, got ${s.amount_total} ${s.currency}`);
    return false;
  }
  const r = await c.query(
    `UPDATE deal_payments SET status='funded', funded_at=NOW(), stripe_payment_intent_id=$2, updated_at=NOW() WHERE id=$1 AND status='pending_checkout'`, [p.id, s.payment_intent ?? null]);
  if (r.rowCount) await pevent(c, p.id, "funded");
  return !!r.rowCount;
}

/** For a pending payment whose webhook may not have arrived: ask Stripe directly. */
export async function reconcilePayment(paymentId: string): Promise<void> {
  const client = await db().connect();
  let funded = false, dealId = "";
  try {
    await client.query("BEGIN");
    const row = (await client.query("SELECT * FROM deal_payments WHERE id=$1 FOR UPDATE", [paymentId])).rows[0];
    if (!row || row.status !== "pending_checkout" || !row.stripe_checkout_session_id) { await client.query("ROLLBACK"); return; }
    const p = mapPayment(row); dealId = p.dealId;
    const s = await stripe.getCheckoutSession(p.sessionId!);
    if (s.status === "complete") funded = await markFunded(client, p, s);
    else if (s.status === "expired") { await client.query("UPDATE deal_payments SET status='expired', updated_at=NOW() WHERE id=$1", [p.id]); await pevent(client, p.id, "expired"); }
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); console.error("reconcile failed:", safeMsg(e)); return; } finally { client.release(); }
  if (funded) await notifyDealParties(dealId, "A NIL deal was funded", "The sponsor's payment is in and is being held until the deal is marked complete.");
}

// ---------------- webhooks ----------------

type StripeObj = Record<string, unknown> & { id?: string };
/** Handles a verified event inside the caller's transaction (which also holds the de-duplication row). */
export async function handleStripeEvent(c: PoolClient, type: string, obj: StripeObj): Promise<{ notifyFunded?: string; refund?: string }> {
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    const row = (await c.query("SELECT * FROM deal_payments WHERE stripe_checkout_session_id=$1 FOR UPDATE", [obj.id])).rows[0];
    if (!row) return {};
    const p = mapPayment(row);
    if (p.status !== "pending_checkout") {
      // Money arrived for a checkout we had already given up on (e.g. the deal was cancelled mid-payment): send it back.
      if (obj.payment_status === "paid" && (p.status === "expired" || p.status === "failed") && typeof obj.payment_intent === "string") {
        try {
          await c.query("SAVEPOINT late_payment");
          await c.query("UPDATE deal_payments SET status='refunding', stripe_payment_intent_id=$2, updated_at=NOW() WHERE id=$1", [p.id, obj.payment_intent]);
          await pevent(c, p.id, "late_payment_refunding", "paid after the checkout was closed");
          return { refund: p.id };
        } catch (e) {
          await c.query("ROLLBACK TO SAVEPOINT late_payment");
          await pevent(c, p.id, "unexpected_payment", `paid session while payment was ${p.status} and another payment is live: needs manual review (${(e as Error).message.slice(0, 80)})`);
        }
      } else if (obj.payment_status === "paid" && p.status !== "funded" && p.status !== "releasing" && p.status !== "released") {
        await pevent(c, p.id, "unexpected_payment", `paid session while payment was ${p.status}: needs manual review`);
      }
      return {};
    }
    const funded = await markFunded(c, p, obj as never);
    return funded ? { notifyFunded: p.dealId } : {};
  }
  if (type === "checkout.session.expired") {
    const r = await c.query("UPDATE deal_payments SET status='expired', updated_at=NOW() WHERE stripe_checkout_session_id=$1 AND status='pending_checkout' RETURNING id", [obj.id]);
    if (r.rowCount) await pevent(c, r.rows[0].id, "expired");
    return {};
  }
  if ((type === "charge.dispute.created" || type === "charge.dispute.closed") && typeof obj.payment_intent === "string") {
    // A cardholder disputed (or a dispute was resolved). We don't move money automatically — record it so people can see it.
    const r = (await c.query("SELECT id FROM deal_payments WHERE stripe_payment_intent_id=$1", [obj.payment_intent])).rows[0];
    if (r) await pevent(c, r.id, type === "charge.dispute.created" ? "dispute_opened" : "dispute_closed", `${obj.reason ?? "unknown reason"}; status ${obj.status ?? "?"}`);
    return {};
  }
  if (type === "account.updated" && typeof obj.id === "string") {
    await applyAccountState(c, obj.id, obj as never);
    return {};
  }
  return {};   // everything else is acknowledged and ignored
}

export const notifyFunded = (dealId: string) => notifyDealParties(dealId, "A NIL deal was funded", "The sponsor's payment is in and is being held until the deal is marked complete.");

// ---------------- release & refund (two-phase, idempotent) ----------------

/**
 * Pays the athlete's side. Phase 1 (DB): record intent. Phase 2 (Stripe): transfer with an idempotency key tied to the
 * payment, so a retry after any failure — even a crash after Stripe accepted it — cannot pay twice. Phase 3 (DB): record result.
 */
export async function releasePayment(paymentId: string): Promise<{ ok: boolean; error?: string }> {
  const client = await db().connect();
  let p: PaymentRow, destination: string;
  try {
    await client.query("BEGIN");
    const row = (await client.query("SELECT * FROM deal_payments WHERE id=$1 FOR UPDATE", [paymentId])).rows[0];
    if (!row) { await client.query("ROLLBACK"); return { ok: false, error: "unknown payment" }; }
    p = mapPayment(row);
    if (p.status === "released") { await client.query("COMMIT"); return { ok: true }; }
    if (p.status !== "funded" && p.status !== "releasing") { await client.query("ROLLBACK"); return { ok: false, error: `cannot release a ${p.status} payment` }; }
    const deal = (await client.query("SELECT status FROM deals WHERE id=$1", [p.dealId])).rows[0];
    if (deal?.status !== "completed") { await client.query("ROLLBACK"); return { ok: false, error: "deal is not completed" }; }
    const payee = await payeeInfo(p.dealId, client);
    const acct = (await client.query("SELECT stripe_account_id, payouts_enabled FROM payout_accounts WHERE user_id=$1", [p.payeeUserId])).rows[0];
    if (!payee.valid || payee.userId !== p.payeeUserId || !acct?.payouts_enabled) {
      await client.query("UPDATE deal_payments SET status='releasing', last_error=$2, updated_at=NOW() WHERE id=$1", [p.id, "waiting for a valid payee with payouts enabled"]);
      await client.query("COMMIT");
      return { ok: false, error: "payee isn't ready" };
    }
    destination = acct.stripe_account_id;
    await client.query("UPDATE deal_payments SET status='releasing', attempts=attempts+1, updated_at=NOW() WHERE id=$1", [p.id]);
    await pevent(client, p.id, "release_attempt", `attempt ${p.attempts + 1}`);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }

  try {
    const pi = await stripe.getPaymentIntent(p.paymentIntentId!);
    if (pi.status !== "succeeded" || pi.amount_received !== p.amountCents || pi.currency !== "usd" || !pi.latest_charge) throw new Error("payment intent does not match the funded amount");
    const t = await stripe.createTransfer({ paymentId: p.id, dealId: p.dealId, amountCents: p.amountCents - p.feeCents, destination, sourceCharge: pi.latest_charge });
    await db().query("UPDATE deal_payments SET status='released', released_at=NOW(), stripe_transfer_id=$2, last_error=NULL, updated_at=NOW() WHERE id=$1 AND status='releasing'", [p.id, t.id]);
    await pevent(db(), p.id, "released", `transfer ${t.id}`);
    await notifyDealParties(p.dealId, "Your NIL payment was released", "The payment for a completed deal has been released to the payee's connected account.");
    return { ok: true };
  } catch (e) {
    await db().query("UPDATE deal_payments SET last_error=$2, updated_at=NOW() WHERE id=$1", [p.id, safeMsg(e)]);
    await pevent(db(), p.id, "release_failed", safeMsg(e));
    return { ok: false, error: safeMsg(e) };
  }
}

/** Refunds the sponsor in full (mutual cancellation). Same two-phase, idempotent shape as release. */
export async function refundPayment(paymentId: string): Promise<{ ok: boolean; error?: string }> {
  const client = await db().connect();
  let p: PaymentRow;
  try {
    await client.query("BEGIN");
    const row = (await client.query("SELECT * FROM deal_payments WHERE id=$1 FOR UPDATE", [paymentId])).rows[0];
    if (!row) { await client.query("ROLLBACK"); return { ok: false, error: "unknown payment" }; }
    p = mapPayment(row);
    if (p.status === "refunded") { await client.query("COMMIT"); return { ok: true }; }
    if (p.status !== "refunding") { await client.query("ROLLBACK"); return { ok: false, error: `cannot refund a ${p.status} payment` }; }
    await client.query("UPDATE deal_payments SET attempts=attempts+1, updated_at=NOW() WHERE id=$1", [p.id]);
    await pevent(client, p.id, "refund_attempt", `attempt ${p.attempts + 1}`);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); throw e; } finally { client.release(); }
  try {
    const r = await stripe.createRefund({ paymentId: p.id, paymentIntent: p.paymentIntentId! });
    await db().query("UPDATE deal_payments SET status='refunded', refunded_at=NOW(), stripe_refund_id=$2, last_error=NULL, updated_at=NOW() WHERE id=$1 AND status='refunding'", [p.id, r.id]);
    await pevent(db(), p.id, "refunded", `refund ${r.id}`);
    await notifyDealParties(p.dealId, "A NIL deal was cancelled and refunded", "Both sides agreed to cancel; the sponsor's payment was refunded.");
    return { ok: true };
  } catch (e) {
    await db().query("UPDATE deal_payments SET last_error=$2, updated_at=NOW() WHERE id=$1", [p.id, safeMsg(e)]);
    await pevent(db(), p.id, "refund_failed", safeMsg(e));
    return { ok: false, error: safeMsg(e) };
  }
}

/** Called by the daily job: finish stuck releases/refunds and reconcile checkouts whose webhook never arrived. */
export async function retryStuckPayments(): Promise<{ processed: number; failed: number }> {
  let processed = 0, failed = 0;
  const rows = (await db().query(
    `SELECT id, status FROM deal_payments WHERE status IN ('releasing','refunding','pending_checkout') AND attempts < ${MAX_ATTEMPTS}
        AND updated_at < NOW() - INTERVAL '2 minutes' ORDER BY updated_at LIMIT 50`)).rows;
  for (const r of rows) {
    if (r.status === "pending_checkout") { await reconcilePayment(r.id); processed++; continue; }
    const res = r.status === "releasing" ? await releasePayment(r.id) : await refundPayment(r.id);
    if (res.ok) processed++; else failed++;
  }
  return { processed, failed };
}
