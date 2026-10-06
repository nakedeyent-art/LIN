import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { encodeForm, signStripePayload, verifyWebhook, WEBHOOK_TOLERANCE_SECONDS } from "./stripe";

const secret = "whsec_test_secret_0123456789";
const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed", data: { object: { id: "cs_1" } } });
const now = 1_760_000_000;

describe("webhook verification — cross-checked against the official stripe package", () => {
  it("accepts a header produced by the official library", () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: now });
    const r = verifyWebhook(payload, header, secret, now);
    expect(r.ok).toBe(true);
    expect(r.ok && r.event.id).toBe("evt_123");
  });
  it("the official library accepts headers produced by our signer", () => {
    const header = signStripePayload(payload, secret, now);
    const stripe = new Stripe("sk_test_x");
    expect(() => stripe.webhooks.constructEvent(payload, header, secret, 300, undefined, now * 1000)).not.toThrow();
    expect(() => stripe.webhooks.constructEvent(payload + " ", header, secret, 300, undefined, now * 1000)).toThrow();
  });
});

describe("verifyWebhook rejections", () => {
  const good = signStripePayload(payload, secret, now);
  it("rejects a tampered body, wrong secret, missing or malformed headers", () => {
    expect(verifyWebhook(payload + "x", good, secret, now).ok).toBe(false);
    expect(verifyWebhook(payload, good, "whsec_other", now).ok).toBe(false);
    expect(verifyWebhook(payload, null, secret, now).ok).toBe(false);
    expect(verifyWebhook(payload, "garbage", secret, now).ok).toBe(false);
    expect(verifyWebhook(payload, `t=${now}`, secret, now).ok).toBe(false);
    expect(verifyWebhook(payload, `t=abc,v1=00`, secret, now).ok).toBe(false);
    expect(verifyWebhook(payload, good, undefined, now).ok).toBe(false);
  });
  it("rejects replays outside the tolerance window, accepts inside it", () => {
    expect(verifyWebhook(payload, good, secret, now + WEBHOOK_TOLERANCE_SECONDS).ok).toBe(true);
    expect(verifyWebhook(payload, good, secret, now + WEBHOOK_TOLERANCE_SECONDS + 1).ok).toBe(false);
    expect(verifyWebhook(payload, good, secret, now - WEBHOOK_TOLERANCE_SECONDS - 1).ok).toBe(false);
  });
  it("accepts when any v1 signature matches (secret rotation)", () => {
    const sig = signStripePayload(payload, secret, now).split(",v1=")[1];
    expect(verifyWebhook(payload, `t=${now},v1=${"0".repeat(64)},v1=${sig}`, secret, now).ok).toBe(true);
  });
  it("rejects a valid signature over a non-event body", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(verifyWebhook(body, signStripePayload(body, secret, now), secret, now).ok).toBe(false);
    expect(verifyWebhook("not json", signStripePayload("not json", secret, now), secret, now).ok).toBe(false);
  });
});

describe("encodeForm", () => {
  it("encodes nested objects and arrays the way Stripe expects", () => {
    expect(decodeURIComponent(encodeForm({
      mode: "payment", line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 5000 } }], metadata: { a: "b c" }, skip: undefined, nul: null, ok: true,
    }))).toBe("mode=payment&line_items[0][quantity]=1&line_items[0][price_data][currency]=usd&line_items[0][price_data][unit_amount]=5000&metadata[a]=b c&ok=true");
    expect(encodeForm({ payment_method_types: ["card", "link"] })).toBe("payment_method_types%5B0%5D=card&payment_method_types%5B1%5D=link");
  });
  it("percent-encodes values", () => { expect(encodeForm({ name: "a&b=c" })).toBe("name=a%26b%3Dc"); });
});
