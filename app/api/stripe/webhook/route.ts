import { db } from "@/lib/db";
import { handleStripeEvent, notifyFunded, refundPayment } from "@/lib/payments";
import { verifyWebhook } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook. The raw body is verified against STRIPE_WEBHOOK_SECRET (HMAC + replay window) before anything is read.
 * Each event id is processed once: the de-duplication row and the handler's changes share one transaction, so a failure
 * rolls both back and Stripe's retry processes it properly.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const v = verifyWebhook(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  if (!v.ok) return Response.json({ error: v.error }, { status: v.error === "webhook secret not configured" ? 503 : 400 });
  const { event } = v;

  const client = await db().connect();
  let result: Awaited<ReturnType<typeof handleStripeEvent>> = {};
  try {
    await client.query("BEGIN");
    const fresh = await client.query("INSERT INTO stripe_events(id, type) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING RETURNING id", [event.id, event.type]);
    if (!fresh.rowCount) { await client.query("ROLLBACK"); return Response.json({ received: true, duplicate: true }); }
    result = await handleStripeEvent(client, event.type, event.data.object as Record<string, unknown>);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("stripe webhook failed:", (e as Error).message);
    return Response.json({ error: "processing failed" }, { status: 500 });   // Stripe will retry
  } finally { client.release(); }

  if (result.notifyFunded) await notifyFunded(result.notifyFunded);
  if (result.refund) await refundPayment(result.refund).catch((e) => console.error("late-payment refund failed:", (e as Error).message));
  return Response.json({ received: true });
}
