import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { createHmac } from "node:crypto";
const B = "http://localhost:3113", WH = "whsec_test_mock_secret_0123456789";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fails = 0, total = 0;
const rec = (ok, k, extra = "") => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + k.padEnd(76) + (ok ? "" : String(extra).slice(0, 200))); };
const sql = (q) => execSync(`su postgres -c "psql lin -At -q"`, { input: q }).toString().trim();
const settle = async (p) => { await p.waitForLoadState("networkidle"); await p.waitForTimeout(1400); await p.waitForLoadState("networkidle"); };
const text = async (p) => (await p.locator("main, .center").first().innerText({ timeout: 2500 }).catch(() => "")).replace(/\s+/g, " ");
async function see(p, re, k) { re = new RegExp(re.source, "i"); let t = ""; for (let i = 0; i < 20; i++) { t = await text(p); if (re.test(t)) return rec(true, k); await p.waitForTimeout(500); } rec(false, k, `got=${t}`); }
const OLD = "longenoughpw1", id = (e) => sql(`select id from users where email='${e}'`);
const hook = async (type, obj) => { const body = JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2, 10)}`, type, data: { object: obj } }); const ts = Math.floor(Date.now() / 1000);
  return (await fetch(`${B}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": `t=${ts},v1=${createHmac("sha256", WH).update(`${ts}.${body}`).digest("hex")}` }, body })).status; };
async function made(f) {
  const ctx = await br.newContext(); const p = await ctx.newPage(); await p.goto(B + "/signup"); await p.waitForSelector("[name=name]");
  await p.fill("[name=name]", f.name); await p.fill("[name=email]", f.email); await p.fill("[name=password]", OLD); await p.check(`[name=role][value=${f.role}]`);
  for (const k of ["sport", "birth_date"]) if (f[k]) await p.fill(`[name=${k}]`, f[k]);
  await p.click("button[type=submit]"); await settle(p); sql(`update users set email_verified_at=now() where email='${f.email}'`); await p.goto(B + "/dashboard"); await settle(p); return p;
}
sql("truncate users cascade; truncate stripe_events");
const sam = await made({ name: "Sam Sponsor", email: "sam@x.com", role: "sponsor" });
const ada = await made({ name: "Ada Adult", email: "ada@x.com", role: "athlete", sport: "Soccer", birth_date: "2000-01-01" });
sql(`update athlete_profiles set discoverable=true where user_id='${id("ada@x.com")}'`);

// minimum amount
await sam.goto(`${B}/dashboard/deals/new?athlete=${id("ada@x.com")}`); await settle(sam);
const offer = async (amount) => { await sam.goto(`${B}/dashboard/deals/new?athlete=${id("ada@x.com")}`); await settle(sam); await sam.fill("[name=title]", "Min amount test"); await sam.fill("[name=amount]", amount);
  await sam.fill("[name=deliverables]", "Two Instagram posts and one in-store appearance in November."); await sam.check("[name=attest]"); await sam.locator("main button:has-text('Send offer')").click(); await settle(sam); };
await offer("0.50"); await see(sam, /minimum deal is \$1\.00/, "with payments on, a 50¢ offer is refused");
rec(sql("select count(*) from deals") === "0", "no deal created for the too-small offer");
await offer("1.00"); rec(sql("select count(*) from deals") === "1", "a $1.00 offer is accepted");

// dispute visibility
const D = sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,payee_user_id) values ('${id("ada@x.com")}','${id("sam@x.com")}','Card-funded deal',150000,'Two posts and an appearance in November','active',now(),'${id("ada@x.com")}') returning id`);
sql(`insert into deal_payments(deal_id,payee_user_id,amount_cents,fee_cents,status,stripe_payment_intent_id,funded_at) values ('${D}','${id("ada@x.com")}',150000,7500,'funded','pi_disputed',now())`);
await sam.goto(`${B}/dashboard/deals/${D}`); await settle(sam);
{ const t0 = await text(sam); rec(!/dispute/i.test(t0), "no dispute warning on a normal payment"); if (/dispute/i.test(t0)) console.log("CTX:", t0.slice(Math.max(0,t0.search(/dispute/i)-200), t0.search(/dispute/i)+200)); }
rec((await hook("charge.dispute.created", { id: "dp_1", payment_intent: "pi_disputed", reason: "fraudulent", status: "needs_response" })) === 200, "dispute webhook accepted");
rec(sql(`select count(*) from payment_events where action='dispute_opened'`) === "1", "dispute recorded against the payment");
await sam.goto(`${B}/dashboard/deals/${D}`); await see(sam, /cardholder opened a dispute/, "sponsor sees a dispute warning");
await ada.goto(`${B}/dashboard/deals/${D}`); await see(ada, /cardholder opened a dispute/, "athlete sees the same warning");
rec(sql("select status from deal_payments") === "funded", "nothing is moved automatically");
rec((await hook("charge.dispute.closed", { id: "dp_1", payment_intent: "pi_disputed", reason: "fraudulent", status: "won" })) === 200, "dispute-closed webhook accepted");
await sam.goto(`${B}/dashboard/deals/${D}`); await settle(sam);
rec(!/cardholder opened a dispute/i.test(await text(sam)), "the warning clears once the dispute is closed");
rec((await hook("charge.dispute.created", { id: "dp_2", payment_intent: "pi_unknown", reason: "x", status: "x" })) === 200, "disputes for unknown payments are ignored safely");
console.log(`\n${fails ? fails + " FAILED" : "ALL PASSED"} (${total} checks)`);
await br.close();
