/**
 * Minimal Stripe client (fetch, no SDK) for Connect "separate charges and transfers", plus webhook verification.
 * Card data never touches this app: sponsors pay on Stripe-hosted Checkout.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const STRIPE_VERSION = "2024-06-20";
export const paymentsEnabled = () => !!process.env.STRIPE_SECRET_KEY;
/** The API base can only be overridden outside production (tests point it at a local mock). */
const apiBase = () => (process.env.NODE_ENV !== "production" && process.env.STRIPE_API_BASE) || "https://api.stripe.com";

export class StripeError extends Error {
  constructor(public status: number, public code: string | null, message: string) { super(message); }
}

/** Stripe's form encoding: nested objects as a[b][c]=v, arrays as a[0]=v; null/undefined are skipped. */
export function encodeForm(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => parts.push(typeof item === "object" && item !== null ? encodeForm(item as Record<string, unknown>, `${key}[${i}]`) : `${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`));
    else if (typeof v === "object") parts.push(encodeForm(v as Record<string, unknown>, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.filter(Boolean).join("&");
}

type Params = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(method: "GET" | "POST", path: string, params?: Params, idempotencyKey?: string): Promise<any> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError(0, "not_configured", "Payments are not configured");
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION };
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${apiBase()}${path}`, {
    method, headers, body: method === "POST" && params ? encodeForm(params) : undefined, signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new StripeError(res.status, json?.error?.code ?? null, json?.error?.message ?? `Stripe responded ${res.status}`);
  return json;
}

export const stripe = {
  createExpressAccount: (userId: string, email: string) => call("POST", "/v1/accounts", {
    type: "express", country: "US", email, business_type: "individual",
    capabilities: { transfers: { requested: true } }, metadata: { user_id: userId },
  }, `acct:${userId}`),
  createAccountLink: (account: string, returnUrl: string, refreshUrl: string) =>
    call("POST", "/v1/account_links", { account, type: "account_onboarding", return_url: returnUrl, refresh_url: refreshUrl }),
  getAccount: (id: string) => call("GET", `/v1/accounts/${encodeURIComponent(id)}`),
  createCheckoutSession: (p: { dealId: string; paymentId: string; title: string; amountCents: number; successUrl: string; cancelUrl: string }) =>
    call("POST", "/v1/checkout/sessions", {
      mode: "payment", payment_method_types: ["card"], client_reference_id: p.dealId,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: p.amountCents, product_data: { name: `NIL agreement: ${p.title}`.slice(0, 120) } } }],
      payment_intent_data: { transfer_group: `deal_${p.dealId}`, metadata: { deal_id: p.dealId, payment_id: p.paymentId } },
      metadata: { deal_id: p.dealId, payment_id: p.paymentId },
      success_url: p.successUrl, cancel_url: p.cancelUrl,
    }, `checkout:${p.paymentId}`),
  getCheckoutSession: (id: string) => call("GET", `/v1/checkout/sessions/${encodeURIComponent(id)}`),
  expireCheckoutSession: (id: string) => call("POST", `/v1/checkout/sessions/${encodeURIComponent(id)}/expire`, {}),
  getPaymentIntent: (id: string) => call("GET", `/v1/payment_intents/${encodeURIComponent(id)}`),
  /** Idempotent per payment: retrying a release can never pay out twice. */
  createTransfer: (p: { paymentId: string; dealId: string; amountCents: number; destination: string; sourceCharge: string }) =>
    call("POST", "/v1/transfers", {
      amount: p.amountCents, currency: "usd", destination: p.destination, source_transaction: p.sourceCharge,
      transfer_group: `deal_${p.dealId}`, metadata: { deal_id: p.dealId, payment_id: p.paymentId },
    }, `release:${p.paymentId}`),
  createRefund: (p: { paymentId: string; paymentIntent: string }) =>
    call("POST", "/v1/refunds", { payment_intent: p.paymentIntent, metadata: { payment_id: p.paymentId } }, `refund:${p.paymentId}`),
};

// ---------- webhooks ----------

export const WEBHOOK_TOLERANCE_SECONDS = 300;
const hmac = (secret: string, payload: string) => createHmac("sha256", secret).update(payload, "utf8").digest("hex");

/** Builds a `Stripe-Signature` header value (used by tests and the local mock). */
export function signStripePayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${hmac(secret, `${timestamp}.${payload}`)}`;
}

export type WebhookResult = { ok: true; event: { id: string; type: string; data: { object: Record<string, unknown> } } } | { ok: false; error: string };

/**
 * Verifies a webhook the way Stripe documents it: HMAC-SHA256 of "<timestamp>.<raw body>" with the endpoint secret,
 * constant-time compared against every v1 signature in the header, rejecting timestamps outside the tolerance (replays).
 */
export function verifyWebhook(rawBody: string, header: string | null, secret: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)): WebhookResult {
  if (!secret) return { ok: false, error: "webhook secret not configured" };
  if (!header) return { ok: false, error: "missing signature" };
  const items = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const t = items.find(([k]) => k === "t")?.[1];
  const sigs = items.filter(([k]) => k === "v1").map(([, v]) => v).filter(Boolean);
  if (!t || !/^\d+$/.test(t) || sigs.length === 0) return { ok: false, error: "malformed signature header" };
  if (Math.abs(nowSeconds - parseInt(t, 10)) > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, error: "timestamp outside tolerance" };
  const expected = Buffer.from(hmac(secret, `${t}.${rawBody}`), "hex");
  const valid = sigs.some((s) => { const b = Buffer.from(s, "hex"); return b.length === expected.length && timingSafeEqual(b, expected); });
  if (!valid) return { ok: false, error: "signature mismatch" };
  try {
    const event = JSON.parse(rawBody);
    if (typeof event?.id !== "string" || typeof event?.type !== "string") return { ok: false, error: "malformed event" };
    return { ok: true, event };
  } catch { return { ok: false, error: "invalid JSON" }; }
}
