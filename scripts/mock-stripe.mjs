// Local stand-in for the parts of the Stripe API this app uses — for development and automated tests ONLY.
// It is NOT Stripe: it checks the auth header, honours idempotency keys, and exposes /_admin hooks to drive state.
//   node scripts/mock-stripe.mjs            (port 4010)   then run the app with STRIPE_API_BASE=http://localhost:4010
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_STRIPE_PORT ?? 4010);
const KEY = process.env.MOCK_STRIPE_KEY ?? "sk_test_mock";
let n = 0;
const id = (p) => `${p}_${(++n).toString().padStart(4, "0")}`;
const state = { accounts: {}, sessions: {}, intents: {}, transfers: [], refunds: [], idem: {}, failTransfers: 0, failRefunds: 0, calls: [] };

const parseForm = (body) => {
  const out = {};
  for (const pair of body.split("&").filter(Boolean)) {
    const [rk, rv = ""] = pair.split("=");
    const k = decodeURIComponent(rk.replace(/\+/g, " ")), v = decodeURIComponent(rv.replace(/\+/g, " "));
    const path = k.split(/\]\[|\[|\]/).filter((x) => x !== "");
    let cur = out;
    path.forEach((p, i) => { if (i === path.length - 1) cur[p] = v; else cur = cur[p] ??= {}; });
  }
  return out;
};
const send = (res, status, obj) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const err = (res, status, code, message) => send(res, status, { error: { type: "invalid_request_error", code, message } });
const cur = (s) => ({ ...s });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let raw = ""; for await (const c of req) raw += c;
  const p = url.pathname, m = req.method;
  state.calls.push(`${m} ${p}`);

  // ---- admin hooks (tests) ----
  if (p.startsWith("/_admin/")) {
    if (p === "/_admin/state") return send(res, 200, { ...state, idem: undefined });
    if (p === "/_admin/reset") { Object.assign(state, { accounts: {}, sessions: {}, intents: {}, transfers: [], refunds: [], idem: {}, failTransfers: 0, failRefunds: 0, calls: [] }); return send(res, 200, { ok: true }); }
    if (p === "/_admin/fail-transfers") { state.failTransfers = Number(url.searchParams.get("n") ?? 1); return send(res, 200, { ok: true }); }
    if (p === "/_admin/fail-refunds") { state.failRefunds = Number(url.searchParams.get("n") ?? 1); return send(res, 200, { ok: true }); }
    let mm = p.match(/^\/_admin\/complete-onboarding\/(.+)$/);
    if (mm) { const a = state.accounts[mm[1]]; if (!a) return err(res, 404, "resource_missing", "no such account"); Object.assign(a, { details_submitted: true, payouts_enabled: true, charges_enabled: true }); return send(res, 200, a); }
    mm = p.match(/^\/_admin\/pay\/(.+)$/);                       // the sponsor "pays" on the hosted page
    if (mm) {
      const s = state.sessions[mm[1]]; if (!s) return err(res, 404, "resource_missing", "no such session");
      if (s.status !== "open" && url.searchParams.get("force") !== "1") return err(res, 400, "session_closed", `session is ${s.status}`);   // ?force=1 simulates a payment racing a cancellation
      const pi = id("pi"), ch = id("ch");
      state.intents[pi] = { id: pi, status: "succeeded", amount_received: s.amount_total, currency: s.currency, latest_charge: ch };
      Object.assign(s, { status: "complete", payment_status: "paid", payment_intent: pi });
      return send(res, 200, s);
    }
    return err(res, 404, "not_found", "unknown admin route");
  }

  if (req.headers.authorization !== `Bearer ${KEY}`) return err(res, 401, "api_key_invalid", "Invalid API Key provided");
  const body = m === "POST" ? parseForm(raw) : {};
  const idemKey = req.headers["idempotency-key"];
  if (m === "POST" && idemKey && state.idem[`${p}:${idemKey}`]) return send(res, 200, state.idem[`${p}:${idemKey}`]);
  const ok = (obj) => { if (idemKey) state.idem[`${p}:${idemKey}`] = obj; return send(res, 200, obj); };

  if (m === "POST" && p === "/v1/accounts") {
    if (body.type !== "express" || body.capabilities?.transfers?.requested !== "true") return err(res, 400, "parameter_invalid", "express account with transfers capability required");
    const a = { id: id("acct"), type: "express", details_submitted: false, payouts_enabled: false, charges_enabled: false, metadata: body.metadata ?? {} };
    state.accounts[a.id] = a; return ok(a);
  }
  if (m === "POST" && p === "/v1/account_links") {
    if (!state.accounts[body.account]) return err(res, 404, "resource_missing", "no such account");
    return send(res, 200, { url: `http://localhost:${PORT}/_onboard/${body.account}`, object: "account_link" });
  }
  let mm = p.match(/^\/v1\/accounts\/(.+)$/);
  if (m === "GET" && mm) { const a = state.accounts[mm[1]]; return a ? send(res, 200, a) : err(res, 404, "resource_missing", "no such account"); }

  if (m === "POST" && p === "/v1/checkout/sessions") {
    const li = body.line_items?.["0"]?.price_data;
    if (!li || body.mode !== "payment") return err(res, 400, "parameter_invalid", "payment-mode session with a price required");
    const s = { id: id("cs"), url: `http://localhost:${PORT}/_pay/pending`, status: "open", payment_status: "unpaid", payment_intent: null,
      amount_total: Number(li.unit_amount), currency: li.currency, metadata: body.metadata ?? {}, client_reference_id: body.client_reference_id,
      transfer_group: body.payment_intent_data?.transfer_group, success_url: body.success_url, cancel_url: body.cancel_url };
    s.url = `http://localhost:${PORT}/_pay/${s.id}`;
    state.sessions[s.id] = s; return ok(s);
  }
  mm = p.match(/^\/v1\/checkout\/sessions\/([^/]+)(\/expire)?$/);
  if (mm) {
    const s = state.sessions[mm[1]]; if (!s) return err(res, 404, "resource_missing", "no such session");
    if (m === "GET" && !mm[2]) return send(res, 200, s);
    if (m === "POST" && mm[2]) { if (s.status !== "open") return err(res, 400, "session_not_open", "Only open sessions can be expired"); s.status = "expired"; return send(res, 200, s); }
  }
  mm = p.match(/^\/v1\/payment_intents\/(.+)$/);
  if (m === "GET" && mm) { const pi = state.intents[mm[1]]; return pi ? send(res, 200, pi) : err(res, 404, "resource_missing", "no such payment intent"); }

  if (m === "POST" && p === "/v1/transfers") {
    if (state.failTransfers > 0) { state.failTransfers--; return err(res, 400, "balance_insufficient", "mock: transfer failed on purpose"); }
    if (!state.accounts[body.destination]?.payouts_enabled) return err(res, 400, "account_invalid", "destination cannot receive transfers");
    const t = { id: id("tr"), amount: Number(body.amount), currency: body.currency, destination: body.destination, source_transaction: body.source_transaction, transfer_group: body.transfer_group, metadata: body.metadata ?? {} };
    state.transfers.push(t); return ok(t);
  }
  if (m === "POST" && p === "/v1/refunds") {
    if (state.failRefunds > 0) { state.failRefunds--; return err(res, 400, "refund_failed", "mock: refund failed on purpose"); }
    const pi = state.intents[body.payment_intent]; if (!pi) return err(res, 404, "resource_missing", "no such payment intent");
    const r = { id: id("re"), payment_intent: body.payment_intent, amount: pi.amount_received, status: "succeeded" };
    state.refunds.push(r); return ok(r);
  }
  return err(res, 404, "not_found", `mock has no route ${m} ${p}`);
}).listen(PORT, () => console.log(`mock-stripe listening on :${PORT}`));
