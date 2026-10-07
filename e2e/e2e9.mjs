import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
const B = "http://localhost:3113", M = "http://localhost:4010", WH = "whsec_test_mock_secret_0123456789", CRON = "test-cron-secret-0123456789abcdef";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fails = 0, total = 0;
const rec = (ok, k, extra = "") => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + k.padEnd(76) + (ok ? "" : String(extra).slice(0, 220))); };
const sql = (q) => execSync(`su postgres -c "psql lin -At -q"`, { input: q }).toString().trim();
const settle = async (p) => { await p.waitForLoadState("networkidle"); await p.waitForTimeout(1400); await p.waitForLoadState("networkidle"); };
const text = async (p) => (await p.locator("main, .center").first().innerText({ timeout: 2500 }).catch(() => "")).replace(/\s+/g, " ");
async function see(p, re, k) { re = new RegExp(re.source, "i"); let t = ""; for (let i = 0; i < 40; i++) { t = await text(p); if (re.test(t)) return rec(true, k); await p.waitForTimeout(500); } rec(false, k, `got=${t}`); }
async function notSee(p, re, k) { await settle(p); const t = await text(p); rec(!new RegExp(re.source, "i").test(t), k, `unexpected: ${t.slice(0, 200)}`); }
const START = readFileSync("/tmp/claude-0/mail.log", "utf8").length;
const mails = () => readFileSync("/tmp/claude-0/mail.log", "utf8").slice(START).split("[mail:dev]").filter((m) => m.includes(" to="));
const mailsTo = (to, subj) => mails().filter((m) => m.includes(`to=${to} subject=${subj}`));
const mock = async (path, method = "GET") => (await fetch(M + path, { method })).json();
const hook = async (type, obj, o = {}) => {
  const body = JSON.stringify({ id: o.id ?? `evt_${Math.random().toString(36).slice(2, 10)}`, type, data: { object: obj } });
  const ts = o.ts ?? Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", o.secret ?? WH).update(`${ts}.${o.rawBody ?? body}`).digest("hex");
  const r = await fetch(`${B}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": o.header ?? `t=${ts},v1=${sig}`, "content-type": "application/json" }, body: o.rawBody ?? body });
  return { status: r.status, json: await r.json().catch(() => null), id: JSON.parse(body).id, body };
};
const OLD = "longenoughpw1";
const id = (e) => sql(`select id from users where email='${e}'`);
const newPage = async () => (await br.newContext()).newPage();
async function made(f) {
  const p = await newPage(); await p.goto(B + "/signup"); await p.waitForSelector("[name=name]");
  await p.fill("[name=name]", f.name); await p.fill("[name=email]", f.email); await p.fill("[name=password]", OLD);
  await p.check(`[name=role][value=${f.role}]`);
  for (const k of ["sport", "position", "birth_date", "guardian_email"]) if (f[k]) await p.fill(`[name=${k}]`, f[k]);
  await p.click("button[type=submit]"); await settle(p);
  sql(`update users set email_verified_at=now() where email='${f.email}'`); await p.goto(B + "/dashboard"); await settle(p); return p;
}
const open = async (p, path) => { await p.goto(B + path); await settle(p); };
const click = async (p, label) => { await p.locator(`main button:has-text("${label}")`).first().click(); await settle(p); };
const SAM = () => id("sam@x.com");
const mkDeal = (athlete, title, cents = 150000, status = "offered") => sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at) values ('${id(athlete)}','${SAM()}','${title}',${cents},'Two Instagram posts and one in-store appearance in November.','${status}',now(), now()+interval '10 days') returning id`);
const dstate = (d) => sql(`select status from deals where id='${d}'`);
const pstate = (d) => sql(`select coalesce(string_agg(status,',' order by created_at),'none') from deal_payments where deal_id='${d}'`);
async function signAs(p, dealId, name) {
  await open(p, `/dashboard/deals/${dealId}/contract`);
  await p.fill("[name=typed_name]", name); await p.check("[name=consent]");
  await p.locator("main button:has-text('Sign agreement')").click(); await settle(p);
}
const completeOnboarding = (email) => mock(`/_admin/complete-onboarding/${sql(`select stripe_account_id from payout_accounts where user_id='${id(email)}'`)}`, "POST");
async function setupPayouts(p, email) {   // clicks "Set up payouts" (redirects to the mock's onboarding URL), then finishes onboarding there and returns
  await open(p, "/dashboard/deals"); await p.locator("main button:has-text('payout')").first().click();
  await p.waitForURL(/localhost:4010/, { timeout: 30000 }).catch(() => {});
  const url = p.url(); await completeOnboarding(email);
  await open(p, "/dashboard/payouts/return"); return url;
}

await mock("/_admin/reset", "POST");
sql("truncate users cascade; truncate stripe_events");
const sam = await made({ name: "Sam Sponsor", email: "sam@x.com", role: "sponsor" });
const ada = await made({ name: "Ada Adult", email: "ada@x.com", role: "athlete", sport: "Soccer", birth_date: "2000-01-01" });
const jordan = await made({ name: "Jordan Reyes", email: "jordan@x.com", role: "athlete", sport: "Basketball", birth_date: "2010-03-04", guardian_email: "maria@x.com" });
const maria = await made({ name: "Maria Reyes", email: "maria@x.com", role: "parent" });
const dan = await made({ name: "Dan Reyes", email: "dan@x.com", role: "parent" });
const eve = await made({ name: "Eve Unrelated", email: "eve@x.com", role: "parent" });
sql("delete from guardian_invites");
for (const g of ["maria@x.com", "dan@x.com"]) sql(`insert into athlete_relationships(athlete_id,member_id,relationship,can_view_academics,can_view_health,guardian_approved) values ('${id("jordan@x.com")}','${id(g)}','parent',true,true,true)`);

// =================== A. adult athlete: accept → contract → sign → payouts → fund → complete → paid ===================
const A = mkDeal("ada@x.com", "Soccer ambassador");
await open(ada, `/dashboard/deals/${A}`); await click(ada, "Accept");
rec(dstate(A) === "awaiting_signature", "accepting moves an adult's deal to awaiting_signature (not active)", dstate(A));
const ct = sql(`select length(sha256)||':'||platform_fee_bps||':'||(voided_at is null)||':'||(executed_at is null) from contracts where deal_id='${A}'`);
rec(ct === "64:500:true:true", "contract created with a SHA-256 and the 5% fee snapshot", ct);
rec(sql(`select payee_user_id='${id("ada@x.com")}' from deals where id='${A}'`) === "t", "adult athlete is the payee");
const body = sql(`select body from contracts where deal_id='${A}'`);
rec(/Sponsor: Sam Sponsor/.test(body) && /Athlete: Ada Adult\./.test(body) && /\$1,500\.00/.test(body) && /Two Instagram posts/.test(body) && /5% of the Compensation/.test(body), "contract text has the parties, amount, deliverables and fee");
rec(sql(`select expires_at > now() + interval '13 days' from deals where id='${A}'`) === "t", "signing window set to 14 days");

// signing rules
await open(sam, `/dashboard/deals/${A}`); await notSee(sam, /Fund this deal/, "can't fund before the agreement is signed");
await open(ada, `/dashboard/deals/${A}/contract`);
await ada.fill("[name=typed_name]", "Someone Else"); await ada.check("[name=consent]"); await ada.locator("main button:has-text('Sign agreement')").click(); await settle(ada);
await see(ada, /exactly as it appears on your account/, "wrong typed name is refused");
await ada.fill("[name=typed_name]", "Ada Adult"); await ada.uncheck("[name=consent]"); await ada.locator("main button:has-text('Sign agreement')").click(); await settle(ada);
await see(ada, /Tick the box/, "signing without e-sign consent is refused");
rec(sql(`select count(*) from contract_signatures`) === "0", "no signature recorded by the refused attempts");
await signAs(ada, A, "  ada   ADULT ");
await see(ada, /Signed\. Waiting for the other side/, "athlete signs (name matched case/spacing-insensitively)");
rec(sql(`select signer_role||':'||typed_name||':'||(document_sha256=(select sha256 from contracts where deal_id='${A}'))||':'||consent_version from contract_signatures`) === "athlete:ada ADULT:true:esign-v1", "signature binds to the exact document hash with consent version", sql("select * from contract_signatures"));
rec(dstate(A) === "awaiting_signature", "one signature doesn't make the deal active");
await open(ada, `/dashboard/deals/${A}/contract`); rec((await ada.locator("main [name=typed_name]").count()) === 0, "no second signing form for the same person");
await open(eve, `/dashboard/deals/${A}/contract`); rec((await eve.goto(`${B}/dashboard/deals/${A}/contract`)).status() === 404, "an outsider gets 404 for the agreement");
await signAs(sam, A, "Sam Sponsor");
await see(sam, /fully executed and the deal is active/, "sponsor signs → fully executed");
rec(dstate(A) === "active" && sql(`select (executed_at is not null)::text from contracts where deal_id='${A}'`) === "true", "deal becomes active only now, contract executed");
rec(sql(`select expires_at is null from deals where id='${A}'`) === "t", "expiry cleared on activation");
rec(sql(`select string_agg(action||':'||to_status, ',' order by created_at, id) from deal_events where deal_id='${A}'`) === "accept:awaiting_signature,sign:awaiting_signature,sign:active", "audit trail: accept, sign, sign→active");

// evidence is immutable at the database level
const dbErr = (q) => { const r = spawnSync("su", ["postgres", "-c", "psql lin -At -q -v ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }); return r.status === 0 ? "" : String(r.stderr); };
rec(/immutable/.test(dbErr(`update contracts set body='tampered' where deal_id='${A}'`)), "DB refuses to edit contract text");
rec(/immutable/.test(dbErr(`update contracts set sha256='${"0".repeat(64)}' where deal_id='${A}'`)), "DB refuses to edit the contract hash");
rec(/immutable/.test(dbErr(`update contracts set executed_at=now() - interval '1 day' where deal_id='${A}'`)), "DB refuses to rewrite the execution time");
rec(/cannot be deleted/.test(dbErr(`delete from contracts where deal_id='${A}'`)), "DB refuses to delete a contract");
rec(/immutable/.test(dbErr(`update contract_signatures set typed_name='Forged Name'`)), "DB refuses to edit a signature");
rec(/append-only/.test(dbErr(`delete from contract_signatures`)), "DB refuses to delete signatures");

// payouts → funding
await open(sam, `/dashboard/deals/${A}`); await see(sam, /hasn't finished payout setup|choose who receives|payout setup/, "sponsor is told the payee isn't ready (no Fund button)");
rec((await sam.locator("main button:has-text('Fund this deal')").count()) === 0, "no Fund button until payouts are ready");
await open(ada, "/dashboard/deals"); await see(ada, /Payouts.*Not set up/, "athlete sees the Payouts card");
const onboardUrl = await setupPayouts(ada, "ada@x.com");
rec(/localhost:4010\/_onboard\/acct_/.test(onboardUrl), "Set up payouts redirects to Stripe's hosted onboarding", onboardUrl);
await see(ada, /Payouts are ready/, "returning from onboarding reads the real account state");
rec(sql(`select payouts_enabled::text from payout_accounts where user_id='${id("ada@x.com")}'`) === "true", "payout account flags stored");
await open(sam, `/dashboard/deals/${A}`);
await see(sam, /Platform fee \(5%\).*\$75\.00.*Payee receives.*\$1,425\.00/, "payment card shows the fee breakdown (5% of $1,500 = $75)");
await sam.locator("main button:has-text('Fund this deal')").click(); await sam.waitForURL(/localhost:4010\/_pay\/cs_/, { timeout: 30000 }).catch(() => {});
rec(/localhost:4010\/_pay\/cs_/.test(sam.url()), "Fund redirects to Stripe-hosted Checkout (no card form in our app)", sam.url());
const ms = await mock("/_admin/state"); const sess = Object.values(ms.sessions)[0];
rec(sess?.amount_total === 150000 && sess.currency === "usd" && sess.metadata.deal_id === A && sess.transfer_group === `deal_${A}`, "Checkout session has the exact amount, deal metadata and transfer group", JSON.stringify(sess));
rec(pstate(A) === "pending_checkout" && sql(`select amount_cents||':'||fee_cents from deal_payments where deal_id='${A}'`) === "150000:7500", "payment row pending with fee 7500");
await open(sam, `/dashboard/deals/${A}?paid=1`); await see(sam, /processing/, "returning before paying shows 'processing', not 'paid'");
await sam.locator("main button:has-text('Continue to payment')").click(); await sam.waitForURL(/localhost:4010\/_pay\/cs_/, { timeout: 30000 }).catch(() => {});
rec(Object.keys((await mock("/_admin/state")).sessions).length === 1, "resuming funding reuses the same Checkout session (no duplicates)");
rec(sql(`select count(*) from deal_payments where deal_id='${A}'`) === "1", "still exactly one payment row");

// webhook security + processing
const paid = await mock(`/_admin/pay/${sess.id}`, "POST");
const evt = { id: "evt_fixed_A1", type: "checkout.session.completed" };
const bad1 = await hook(evt.type, paid, { id: evt.id, header: "t=1,v1=deadbeef" });
const bad2 = await hook(evt.type, paid, { id: evt.id, secret: "whsec_wrong_secret_value" });
const bad3 = await hook(evt.type, paid, { id: evt.id, ts: Math.floor(Date.now() / 1000) - 600 });
const bad4 = await fetch(`${B}/api/stripe/webhook`, { method: "POST", body: "{}" });
rec([bad1.status, bad2.status, bad3.status, bad4.status].every((s) => s === 400), "webhook rejects bad signature, wrong secret, replayed timestamp, no header (400)", [bad1.status, bad2.status, bad3.status, bad4.status].join());
rec(pstate(A) === "pending_checkout" && sql("select count(*) from stripe_events") === "0", "rejected webhooks changed nothing");
const good = await hook(evt.type, paid, { id: evt.id });
rec(good.status === 200 && pstate(A) === "funded", "valid webhook marks the payment funded", JSON.stringify(good.json) + pstate(A));
const dup = await hook(evt.type, paid, { id: evt.id });
rec(dup.status === 200 && dup.json?.duplicate === true && sql(`select count(*) from payment_events where action='funded'`) === "1", "duplicate delivery is acknowledged and processed once");
rec(sql("select count(*) from stripe_events where id='evt_fixed_A1'") === "1", "event id recorded for de-duplication");
await open(sam, `/dashboard/deals/${A}`); await see(sam, /Funded — held until/, "deal page shows funded");
await open(sam, `/dashboard/deals/${A}`); rec((await sam.locator("main button:has-text('Fund this deal')").count()) === 0, "can't fund twice");

// completion releases the money
await open(ada, `/dashboard/deals/${A}`); rec((await ada.locator("main button:has-text('Mark completed')").count()) === 0, "the athlete can't mark the deal completed");
await open(sam, `/dashboard/deals/${A}`); await click(sam, "Mark completed");
rec(dstate(A) === "completed" && pstate(A) === "released", "completing releases the payment", dstate(A) + "/" + pstate(A));
const ms2 = await mock("/_admin/state"); const tr = ms2.transfers[0];
const acctAda = sql(`select stripe_account_id from payout_accounts where user_id='${id("ada@x.com")}'`);
rec(ms2.transfers.length === 1 && tr.amount === 142500 && tr.destination === acctAda && tr.transfer_group === `deal_${A}` && !!tr.source_transaction, "exactly one transfer: $1,425.00 (after the 5% fee) to the athlete's account, tied to the charge", JSON.stringify(ms2.transfers));
rec(sql(`select stripe_transfer_id is not null from deal_payments where deal_id='${A}'`) === "t", "transfer id stored");
await open(ada, `/dashboard/deals/${A}`); await see(ada, /Paid out/, "athlete sees 'Paid out'");
rec(mailsTo("ada@x.com", "Your NIL payment was released").length === 1 && !mails().some((m) => /\$1,?[04]\d\d|142500|150000/.test(m)), "payout email sent, with no amounts in any email");

// agreement download
const dl = await ada.context().request.get(`${B}/dashboard/deals/${A}/contract/download`);
const dlText = await dl.text();
rec(dl.status() === 200 && /attachment/.test(dl.headers()["content-disposition"]) && dlText.includes("NAME, IMAGE AND LIKENESS") && dlText.includes("ada ADULT") && dlText.includes("FULLY EXECUTED"), "agreement downloads with signatures and execution stamp");
rec((await (await newPage()).context().request.get(`${B}/dashboard/deals/${A}/contract/download`)).status() === 401, "download refuses anonymous requests");
rec((await eve.context().request.get(`${B}/dashboard/deals/${A}/contract/download`)).status() === 404, "download 404s for outsiders");


// ===== part 1 evidence: tampered rows really are unchanged =====
rec(sql(`select (select body from contracts where deal_id='${A}') like '%Ada Adult%'`) === "t" && sql("select count(*) from contract_signatures") === "2", "…and the attempted tampering left the evidence intact");

// helper: drive a deal through accept → both sign → fund → (paid + webhook) using the real UI
async function fullFund(athletePage, athleteEmail, title, cents = 150000) {
  const d = mkDeal(athleteEmail, title, cents);
  await open(athletePage, `/dashboard/deals/${d}`); await click(athletePage, "Accept");
  await signAs(athletePage, d, sql(`select full_name from users where email='${athleteEmail}'`)); await signAs(sam, d, "Sam Sponsor");
  await open(sam, `/dashboard/deals/${d}`); await sam.locator("main button:has-text('Fund this deal')").click(); await sam.waitForURL(/localhost:4010/, { timeout: 30000 }).catch(() => {});
  const sid = sql(`select stripe_checkout_session_id from deal_payments where deal_id='${d}'`);
  const paidSession = await mock(`/_admin/pay/${sid}`, "POST");
  await hook("checkout.session.completed", paidSession);
  return { d, sid, paidSession };
}
const transfers = async () => (await mock("/_admin/state")).transfers;
const refunds = async () => (await mock("/_admin/state")).refunds;

// =================== B. minor: guardian approval → guardian signs → guardian is the payee → reconcile → mutual cancel/refund ===================
const Bd = mkDeal("jordan@x.com", "Hoops camp", 100000);
await open(jordan, `/dashboard/deals/${Bd}`); await click(jordan, "Accept");
rec(dstate(Bd) === "guardian_review", "minor's acceptance waits for a guardian");
await open(maria, `/dashboard/deals/${Bd}`); await click(maria, "Approve (guardian)");
rec(dstate(Bd) === "awaiting_signature", "guardian approval moves it to signing (not active)");
rec(sql(`select payee_user_id='${id("maria@x.com")}' from deals where id='${Bd}'`) === "t", "the approving guardian becomes the payee");
const bBody = sql(`select body from contracts where deal_id='${Bd}'`);
rec(/Athlete: Jordan Reyes, a minor\./.test(bBody) && /6\. MINOR ATHLETE/.test(bBody) && /Parent\/Legal Guardian/.test(bBody), "minor's contract names the minor in full and adds the guardian clause");
await open(jordan, `/dashboard/deals/${Bd}/contract`); await see(jordan, /A minor can't sign/, "the minor can't sign");
rec((await jordan.locator("main [name=typed_name]").count()) === 0, "no signing form for the minor");
rec((await eve.goto(`${B}/dashboard/deals/${Bd}/contract`)).status() === 404, "an unrelated parent can't see the minor's agreement");
await signAs(dan, Bd, "Dan Reyes");   // ANY current guardian may sign for the minor
rec(sql(`select signer_role from contract_signatures where signer_user_id='${id("dan@x.com")}'`) === "guardian", "a (second) guardian signs on the minor's behalf");
rec(dstate(Bd) === "awaiting_signature", "guardian signature alone doesn't activate");
await signAs(sam, Bd, "Sam Sponsor"); rec(dstate(Bd) === "active", "sponsor + guardian signatures → active");
await open(sam, `/dashboard/deals/${Bd}`); rec((await sam.locator("main button:has-text('Fund this deal')").count()) === 0, "no funding while the payee has no payout account");
await open(dan, `/dashboard/deals/${Bd}`); await click(dan, "Receive this payment myself");
rec(sql(`select payee_user_id='${id("dan@x.com")}' from deals where id='${Bd}'`) === "t", "a current guardian can take over as payee");
await open(eve, `/dashboard/deals/${Bd}`); rec((await eve.goto(`${B}/dashboard/deals/${Bd}`)).status() === 404, "outsiders can't see the deal or its payment");
await setupPayouts(dan, "dan@x.com");
await open(sam, `/dashboard/deals/${Bd}`); await sam.locator("main button:has-text('Fund this deal')").click(); await sam.waitForURL(/localhost:4010/, { timeout: 30000 }).catch(() => {});
const bSid = sql(`select stripe_checkout_session_id from deal_payments where deal_id='${Bd}'`);
await mock(`/_admin/pay/${bSid}`, "POST");   // paid on Stripe, but NO webhook is sent
rec(pstate(Bd) === "pending_checkout", "(setup) paid on Stripe, webhook not delivered");
await open(sam, `/dashboard/deals/${Bd}?paid=1`); await see(sam, /Funded — held until/, "viewing the deal reconciles with Stripe and finds it funded (no webhook needed)");
rec(pstate(Bd) === "funded", "payment funded via reconciliation");
// mutual cancellation
await open(sam, `/dashboard/deals/${Bd}`);
rec((await sam.locator("main button:has-text('Cancel deal')").count()) === 0, "funded deals can't be cancelled unilaterally");
await click(sam, "Request cancellation & refund"); rec(sql(`select cancel_requested_side from deals where id='${Bd}'`) === "buyer", "sponsor requests cancellation");
await open(sam, `/dashboard/deals/${Bd}`); rec((await sam.locator("main button:has-text('Agree to cancel')").count()) === 0, "the requester can't agree to their own request");
await see(sam, /Withdraw cancellation request/, "…but can withdraw it");
await open(jordan, `/dashboard/deals/${Bd}`); rec((await jordan.locator("main button:has-text('cancel')").count()) === 0, "the minor athlete has no cancellation controls");
await click(sam, "Withdraw cancellation request"); rec(sql(`select cancel_requested_side is null from deals where id='${Bd}'`) === "t", "request withdrawn");
await open(sam, `/dashboard/deals/${Bd}`); await click(sam, "Request cancellation & refund");
await open(maria, `/dashboard/deals/${Bd}`); await see(maria, /asked to cancel and refund/, "a guardian sees the request");
await click(maria, "Agree to cancel & refund");
rec(dstate(Bd) === "cancelled" && pstate(Bd) === "refunded", "mutual agreement cancels the deal and refunds the sponsor", dstate(Bd) + "/" + pstate(Bd));
const rf = (await refunds()); rec(rf.length === 1 && rf[0].amount === 100000, "exactly one refund of the full $1,000.00", JSON.stringify(rf));
rec((await transfers()).length === 1, "no money was paid out for the cancelled deal");
rec(mailsTo("sam@x.com", "A NIL deal was cancelled and refunded").length === 1, "parties notified of the refund");

// =================== C. failed payout is retried, and can never pay twice ===================
const C = await fullFund(ada, "ada@x.com", "Retry deal");
rec(pstate(C.d) === "funded", "(setup) deal C funded");
await mock("/_admin/fail-transfers?n=1", "POST");
await open(sam, `/dashboard/deals/${C.d}`); await click(sam, "Mark completed");
rec(dstate(C.d) === "completed" && pstate(C.d) === "releasing", "when Stripe fails, the deal is completed and the payout stays pending", dstate(C.d) + "/" + pstate(C.d));
rec(sql(`select attempts||':'||(last_error like '%balance_insufficient%') from deal_payments where deal_id='${C.d}'`) === "1:true", "failure recorded with attempt count");
await open(ada, `/dashboard/deals/${C.d}`); await see(ada, /Payout in progress|Payout pending/, "athlete sees the payout is pending, not lost");
rec((await transfers()).length === 1, "no transfer yet for deal C");
const cron = async () => (await fetch(`${B}/api/cron/daily`, { method: "POST", headers: { Authorization: `Bearer ${CRON}` } })).json();
let j = await cron();
rec(pstate(C.d) === "releasing", "the retry job leaves it alone for the first couple of minutes (no hammering)", JSON.stringify(j));
sql(`update deal_payments set updated_at = now() - interval '5 minutes' where deal_id='${C.d}'`);
j = await cron();
rec(pstate(C.d) === "released" && j.jobs["payments-retry"]?.processed >= 1, "the daily job retries and the payout goes through", JSON.stringify(j) + pstate(C.d));
rec((await transfers()).length === 2, "exactly one transfer for deal C (idempotent)");
const trId = sql(`select stripe_transfer_id from deal_payments where deal_id='${C.d}'`);
// crash after Stripe accepted but before we recorded it: put the row back and let the job run again
sql(`update deal_payments set status='releasing', released_at=null, stripe_transfer_id=null, updated_at = now() - interval '5 minutes' where deal_id='${C.d}'`);
await cron();
rec(pstate(C.d) === "released" && sql(`select stripe_transfer_id from deal_payments where deal_id='${C.d}'`) === trId && (await transfers()).length === 2, "re-running after a simulated crash returns the SAME transfer — no double payout");

// =================== D. two simultaneous 'complete' clicks pay once ===================
const D = await fullFund(ada, "ada@x.com", "Race deal");
const sam2 = await newPage(); await sam2.context().addCookies(await sam.context().cookies());
await open(sam, `/dashboard/deals/${D.d}`); await open(sam2, `/dashboard/deals/${D.d}`);
const before = (await transfers()).length;
await Promise.all([sam.locator("main button:has-text('Mark completed')").first().click(), sam2.locator("main button:has-text('Mark completed')").first().click()]);
await Promise.all([settle(sam), settle(sam2)]);
rec((await transfers()).length === before + 1 && pstate(D.d) === "released", "two simultaneous completions → exactly one payout", `${(await transfers()).length - before} transfers`);
rec(sql(`select count(*) from deal_events where deal_id='${D.d}' and action='complete'`) === "1", "completion recorded once");

// =================== E. unfunded cancel; payment that arrives after the checkout was closed is refunded ===================
const E = mkDeal("ada@x.com", "Cancel deal test");
await open(ada, `/dashboard/deals/${E}`); await click(ada, "Accept"); await signAs(ada, E, "Ada Adult"); await signAs(sam, E, "Sam Sponsor");
await open(sam, `/dashboard/deals/${E}`); await sam.locator("main button:has-text('Fund this deal')").click(); await sam.waitForURL(/localhost:4010/, { timeout: 30000 }).catch(() => {});
const eSid = sql(`select stripe_checkout_session_id from deal_payments where deal_id='${E}'`);
// forgery: turn the "Cancel deal" form into a "complete" request on an unfunded deal
await open(sam, `/dashboard/deals/${E}`);
await sam.locator('main form:has(button:has-text("Cancel deal")) [name=action]').evaluate((el) => { el.value = "complete"; });
await click(sam, "Cancel deal"); await see(sam, /Fund the deal first/, "FORGED: completing an unfunded deal is refused server-side");
rec(dstate(E) === "active", "deal unchanged after the forgery");
await open(ada, `/dashboard/deals/${E}`); await click(ada, "Cancel deal");
rec(dstate(E) === "cancelled" && pstate(E) === "expired", "either side may cancel an unfunded deal; the open checkout is closed");
rec((await mock("/_admin/state")).sessions[eSid].status === "expired", "the Stripe checkout session was expired");
const refundsBefore = (await refunds()).length;
const lateSession = await mock(`/_admin/pay/${eSid}?force=1`, "POST");   // the sponsor's payment races the cancellation
const late = await hook("checkout.session.completed", lateSession);
rec(late.status === 200 && pstate(E) === "refunded" && (await refunds()).length === refundsBefore + 1, "a payment that lands after cancellation is automatically refunded", pstate(E));
rec(sql(`select count(*) from payment_events pe join deal_payments p on p.id=pe.payment_id where p.deal_id='${E}' and pe.action='late_payment_refunding'`) === "1", "…and logged as such");

// =================== F. webhook edge cases ===================
const F = mkDeal("ada@x.com", "Webhook edge cases");
await open(ada, `/dashboard/deals/${F}`); await click(ada, "Accept"); await signAs(ada, F, "Ada Adult"); await signAs(sam, F, "Sam Sponsor");
await open(sam, `/dashboard/deals/${F}`); await sam.locator("main button:has-text('Fund this deal')").click(); await sam.waitForURL(/localhost:4010/, { timeout: 30000 }).catch(() => {});
const fSid = sql(`select stripe_checkout_session_id from deal_payments where deal_id='${F}'`);
const fPaid = await mock(`/_admin/pay/${fSid}`, "POST");
const wrongAmt = await hook("checkout.session.completed", { ...fPaid, amount_total: fPaid.amount_total - 100 });
rec(wrongAmt.status === 200 && pstate(F) === "pending_checkout" && sql(`select count(*) from payment_events pe join deal_payments p on p.id=pe.payment_id where p.deal_id='${F}' and pe.action='amount_mismatch'`) === "1", "an amount that doesn't match is NOT treated as funded (and is logged)");
const wrongCur = await hook("checkout.session.completed", { ...fPaid, currency: "eur" });
rec(pstate(F) === "pending_checkout", "a wrong currency is not treated as funded");
const unpaid = await hook("checkout.session.completed", { ...fPaid, payment_status: "unpaid" });
rec(pstate(F) === "pending_checkout", "an unpaid session is not treated as funded");
rec((await hook("checkout.session.completed", { id: "cs_unknown", payment_status: "paid", amount_total: 1, currency: "usd" })).status === 200, "events for unknown sessions are acknowledged and ignored");
rec((await hook("customer.created", { id: "cus_1" })).status === 200, "unrelated event types are acknowledged");
const goodF = await hook("checkout.session.completed", fPaid);
rec(pstate(F) === "funded", "the correct event then funds it");
const acct = sql(`select stripe_account_id from payout_accounts where user_id='${id("ada@x.com")}'`);
await hook("account.updated", { id: acct, details_submitted: true, payouts_enabled: false, charges_enabled: true });
rec(sql(`select payouts_enabled::text from payout_accounts where user_id='${id("ada@x.com")}'`) === "false", "account.updated webhook turns payouts off");
await open(sam, `/dashboard/deals/${F}`); await click(sam, "Mark completed");
rec(dstate(F) === "completed", "(setup) deal completed while the payee's payouts are disabled", dstate(F));
rec(pstate(F) === "releasing", "no payout while the payee can't receive: it waits", pstate(F));
await hook("account.updated", { id: acct, details_submitted: true, payouts_enabled: true, charges_enabled: true });
sql(`update deal_payments set updated_at = now() - interval '5 minutes' where deal_id='${F}'`);
await cron();
rec(pstate(F) === "released", "once payouts are re-enabled the job pays out", pstate(F));

// =================== G. authorization forgeries ===================
const bo = await made({ name: "Bo Sponsor", email: "bo@x.com", role: "sponsor" });
const G = mkDeal("ada@x.com", "Bo deal"); sql(`update deals set counterparty_id='${id("bo@x.com")}' where id='${G}'`);
await open(ada, `/dashboard/deals/${G}`); await click(ada, "Accept"); await signAs(ada, G, "Ada Adult"); await signAs(bo, G, "Bo Sponsor");
const H = mkDeal("ada@x.com", "Sam deal for forgery"); await open(ada, `/dashboard/deals/${H}`); await click(ada, "Accept"); await signAs(ada, H, "Ada Adult"); await signAs(sam, H, "Sam Sponsor");
await open(sam, `/dashboard/deals/${H}`);
await sam.locator('main form:has(button:has-text("Fund this deal")) [name=deal_id]').evaluate((el, v) => { el.value = v; }, G);
await click(sam, "Fund this deal");
await settle(sam);
rec(decodeURIComponent(sam.url()).includes("Only the sponsor funds a deal"), "FORGED: funding someone else's deal is refused by the server", sam.url());
rec(pstate(G) === "none", "no payment created for the other sponsor's deal");
await open(ada, `/dashboard/deals/${Bd}/contract`);   // Ada has no standing on Jordan's deal
const J = mkDeal("ada@x.com", "Forged signature"); await open(ada, `/dashboard/deals/${J}`); await click(ada, "Accept");
await open(ada, `/dashboard/deals/${J}/contract`);
await ada.locator("[name=deal_id]").evaluate((el, v) => { el.value = v; }, Bd);
await ada.fill("[name=typed_name]", "Ada Adult"); await ada.check("[name=consent]"); await ada.locator("main button:has-text('Sign agreement')").click(); await settle(ada);
rec(sql(`select count(*) from contract_signatures where signer_user_id='${id("ada@x.com")}' and contract_id=(select id from contracts where deal_id='${Bd}')`) === "0", "FORGED: signing a deal you're not part of records nothing");

// =================== H. expiry and withdrawal while signing ===================
sql(`update deals set expires_at = now() - interval '1 minute' where id='${J}'`);
await open(ada, `/dashboard/deals/${J}/contract`); await see(ada, /expired/i, "an agreement can't be signed after the signing window");
rec((await ada.locator("main [name=typed_name]").count()) === 0, "no signing form once expired");
const K = mkDeal("ada@x.com", "Withdraw while signing"); await open(ada, `/dashboard/deals/${K}`); await click(ada, "Accept"); await signAs(sam, K, "Sam Sponsor");
await open(sam, `/dashboard/deals/${K}`); await click(sam, "Withdraw offer");
rec(dstate(K) === "withdrawn" && sql(`select (voided_at is not null)::text from contracts where deal_id='${K}'`) === "true", "withdrawing during signing voids the agreement");
rec(sql(`select count(*) from contract_signatures where contract_id=(select id from contracts where deal_id='${K}')`) === "1", "…but the existing signature stays on record");
await open(ada, `/dashboard/deals/${K}/contract`); await see(ada, /Voided/, "agreement shows as voided");
rec((await ada.locator("main [name=typed_name]").count()) === 0, "no signing form on a voided agreement");

// =================== I. account deletion vs money, signatures retained ===================
const zoe = await made({ name: "Zoe Zed", email: "zoe@x.com", role: "athlete", sport: "Tennis", birth_date: "1999-05-05" });
const Z = mkDeal("zoe@x.com", "Zoe finished deal", 50000, "completed");
sql(`insert into contracts(deal_id,template_version,terms,body,sha256,platform_fee_bps,executed_at) values ('${Z}','nil-v1','{}','Zoe agreement body','${"a".repeat(64)}',0,now())`);
sql(`insert into contract_signatures(contract_id,signer_user_id,signer_role,typed_name,consent_version,document_sha256,ip,user_agent) select c.id,'${id("zoe@x.com")}','athlete','Zoe Zed','esign-v1',c.sha256,'203.0.113.9','TestBrowser/1' from contracts c where c.deal_id='${Z}'`);
sql(`insert into payout_accounts(user_id,stripe_account_id,payouts_enabled) values ('${id("zoe@x.com")}','acct_zoe_test',true)`);
sql(`insert into deal_payments(deal_id,payee_user_id,amount_cents,fee_cents,status,stripe_payment_intent_id) values ('${Z}','${id("zoe@x.com")}',50000,0,'releasing','pi_zoe')`);
const delAcct = async (p) => { await open(p, "/dashboard/settings"); const c = p.locator("main .card", { has: p.locator('h3:text-is("Delete account")') }); await c.locator("[name=password]").fill(OLD); await c.locator("[name=confirm]").fill("DELETE"); await c.locator("button:has-text('Delete my account')").click(); await settle(p); };
await delAcct(zoe); await see(zoe, /payment connected to you is still being held or processed/, "can't delete an account while a payout to it is in flight");
sql(`update deal_payments set status='released' where deal_id='${Z}'`);
await delAcct(zoe); await see(zoe, /Your account has been deleted/, "deletion proceeds once the money has settled");
rec(sql(`select typed_name||':'||coalesce(ip,'NULL')||':'||coalesce(user_agent,'NULL') from contract_signatures where signer_role='athlete' and typed_name='Zoe Zed'`) === "Zoe Zed:NULL:NULL", "signed agreement kept (typed name), network metadata scrubbed");
rec(sql("select count(*) from payout_accounts where stripe_account_id='acct_zoe_test'") === "0", "payout account row removed on deletion");
rec(sql(`select count(*) from contracts where deal_id='${Z}'`) === "1", "the contract itself remains as a record");

// =================== J. daily job reconciles a checkout whose webhook never arrived ===================
const Jd = mkDeal("ada@x.com", "Reconcile by job"); await open(ada, `/dashboard/deals/${Jd}`); await click(ada, "Accept"); await signAs(ada, Jd, "Ada Adult"); await signAs(sam, Jd, "Sam Sponsor");
await open(sam, `/dashboard/deals/${Jd}`); await sam.locator("main button:has-text('Fund this deal')").click(); await sam.waitForURL(/localhost:4010/, { timeout: 30000 }).catch(() => {});
await mock(`/_admin/pay/${sql(`select stripe_checkout_session_id from deal_payments where deal_id='${Jd}'`)}`, "POST");
sql(`update deal_payments set updated_at = now() - interval '5 minutes' where deal_id='${Jd}'`);
await cron(); rec(pstate(Jd) === "funded", "the daily job reconciles a paid checkout whose webhook was lost");

console.log(`\n${fails ? fails + " FAILED" : "ALL PASSED"} (${total} checks)`);
await br.close();
