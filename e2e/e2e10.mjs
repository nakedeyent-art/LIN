// Payments NOT configured: agreements + e-signature still work and the deal never touches money.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const B = "http://localhost:3113", CRON = "test-cron-secret-0123456789abcdef";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fails = 0, total = 0;
const rec = (ok, k, extra = "") => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + k.padEnd(76) + (ok ? "" : String(extra).slice(0, 200))); };
const sql = (q) => execSync(`su postgres -c "psql lin -At -q"`, { input: q }).toString().trim();
const settle = async (p) => { await p.waitForLoadState("networkidle"); await p.waitForTimeout(1400); await p.waitForLoadState("networkidle"); };
const text = async (p) => (await p.locator("main, .center").first().innerText({ timeout: 2500 }).catch(() => "")).replace(/\s+/g, " ");
async function see(p, re, k) { re = new RegExp(re.source, "i"); let t = ""; for (let i = 0; i < 20; i++) { t = await text(p); if (re.test(t)) return rec(true, k); await p.waitForTimeout(500); } rec(false, k, `got=${t}`); }
const OLD = "longenoughpw1";
const id = (e) => sql(`select id from users where email='${e}'`);
const newPage = async () => (await br.newContext()).newPage();
async function made(f) {
  const p = await newPage(); await p.goto(B + "/signup"); await p.waitForSelector("[name=name]");
  await p.fill("[name=name]", f.name); await p.fill("[name=email]", f.email); await p.fill("[name=password]", OLD);
  await p.check(`[name=role][value=${f.role}]`);
  for (const k of ["sport", "birth_date"]) if (f[k]) await p.fill(`[name=${k}]`, f[k]);
  await p.click("button[type=submit]"); await settle(p);
  sql(`update users set email_verified_at=now() where email='${f.email}'`); await p.goto(B + "/dashboard"); await settle(p); return p;
}
const open = async (p, path) => { await p.goto(B + path); await settle(p); };
const click = async (p, label) => { await p.locator(`main button:has-text("${label}")`).first().click(); await settle(p); };
async function signAs(p, d, name) { await open(p, `/dashboard/deals/${d}/contract`); await p.fill("[name=typed_name]", name); await p.check("[name=consent]"); await p.locator("main button:has-text('Sign agreement')").click(); await settle(p); }

sql("truncate users cascade; truncate job_runs; truncate stripe_events");
const sam = await made({ name: "Sam Sponsor", email: "sam@x.com", role: "sponsor" });
const ada = await made({ name: "Ada Adult", email: "ada@x.com", role: "athlete", sport: "Soccer", birth_date: "2000-01-01" });
const D = sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at) values ('${id("ada@x.com")}','${id("sam@x.com")}','No-pay deal',150000,'Two Instagram posts and one in-store appearance.','offered',now(), now()+interval '10 days') returning id`);
await open(ada, `/dashboard/deals/${D}`); await click(ada, "Accept");
rec(sql(`select status from deals where id='${D}'`) === "awaiting_signature", "accept still goes to signing");
const body = sql(`select body from contracts where deal_id='${D}'`);
rec(/does not itself move money/.test(body) && !/platform fee/i.test(body) && sql(`select platform_fee_bps from contracts where deal_id='${D}'`) === "0", "contract says it doesn't move money; no fee");
await signAs(ada, D, "Ada Adult"); await signAs(sam, D, "Sam Sponsor");
rec(sql(`select status from deals where id='${D}'`) === "active", "two signatures → active");
await open(sam, `/dashboard/deals/${D}`);
rec((await sam.locator("main h3:text-is('Payment')").count()) === 0 && (await sam.locator("main button:has-text('Fund')").count()) === 0, "no Payment card and no Fund button when payments are off");
await open(sam, `/dashboard/deals/${D}`); await see(sam, /Agreement.*Fully executed/, "the agreement is still shown as executed");
await open(ada, "/dashboard/deals"); rec((await ada.locator("main h3:text-is('Payouts')").count()) === 0, "no Payouts card when payments are off");
await open(sam, `/dashboard/deals/${D}`); await click(sam, "Mark completed");
rec(sql(`select status from deals where id='${D}'`) === "completed" && sql("select count(*) from deal_payments") === "0", "completing needs no funding and creates no payment");
rec((await fetch(`${B}/api/stripe/webhook`, { method: "POST", body: "{}" })).status === 503, "webhook endpoint is off (503) without a secret");
const j = await (await fetch(`${B}/api/cron/daily`, { method: "POST", headers: { Authorization: `Bearer ${CRON}` } })).json();
rec(JSON.stringify(j.jobs["payments-retry"]) === JSON.stringify({ processed: 0, skipped: 0, failed: 0 }), "the payments job is a no-op", JSON.stringify(j));
console.log(`\n${fails ? fails + " FAILED" : "ALL PASSED"} (${total} checks)`);
await br.close();
