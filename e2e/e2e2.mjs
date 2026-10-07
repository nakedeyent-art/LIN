import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const B = "http://localhost:3113";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
const log = (k, v) => console.log(k.padEnd(40), v);
const sql = (q) => execSync(`su postgres -c "psql lin -Atc \\"${q}\\""`).toString().trim();
const mails = () => readFileSync("/tmp/claude-0/mail.log", "utf8").split("[mail:dev]").filter((m) => m.includes(" to="));
const lastLink = (to, re) => { const m = mails().filter((x) => x.includes(`to=${to} `)).map((x) => x.match(re)?.[0]).filter(Boolean); return m.at(-1); };
const body = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const path = (p) => { const u = new URL(p.url()); return u.pathname + u.search.slice(0, 60); };
const settle = async (p) => { await p.waitForLoadState("networkidle"); await p.waitForTimeout(1200); await p.waitForLoadState("networkidle"); };
const page = async () => (await br.newContext()).newPage();

async function signup(p, f, next) {
  await p.goto(B + "/signup" + (next ? `?next=${encodeURIComponent(next)}` : ""));
  await p.fill("[name=name]", f.name); await p.fill("[name=email]", f.email); await p.fill("[name=password]", "longenoughpw1");
  await p.check(`[name=role][value=${f.role}]`);
  for (const k of ["sport", "position", "birth_date", "guardian_email"]) if (f[k]) await p.fill(`[name=${k}]`, f[k]);
  await p.click("button[type=submit]"); await settle(p);
}
async function login(p, email, next) {
  await p.goto(B + "/login" + (next ? `?next=${encodeURIComponent(next)}` : ""));
  await p.fill("[name=email]", email); await p.fill("[name=password]", "longenoughpw1");
  await p.click("button[type=submit]"); await settle(p);
}
const verify = async (email) => { const p = await page(); await p.goto(lastLink(email, /http:\/\/localhost:3113\/verify\?token=[\w-]+/)); await p.click("text=Confirm email address"); await settle(p); return path(p); };

// --- Athlete (minor) ---
const a = await page();
await signup(a, { name: "Jordan Reyes", email: "jordan@x.com", role: "athlete", sport: "Basketball", birth_date: "2010-03-04", guardian_email: "mom@x.com" });
log("signup lands on", path(a));
await a.goto(B + "/dashboard"); log("unverified /dashboard ->", path(a));
await a.goto(B + "/dashboard/training"); log("unverified /training ->", path(a));
log("verify mail sent to athlete", !!lastLink("jordan@x.com", /\/verify\?token=/));
log("guardian mail sent to mom", !!lastLink("mom@x.com", /\/guardian\/accept\?token=/));
await a.click("text=Resend email"); await settle(a); log("immediate resend", (await body(a)).match(/Please wait[^.]*\./)?.[0]);

// GET alone must not consume the token; confirm button does; reuse fails
const vlink = lastLink("jordan@x.com", /http:\/\/localhost:3113\/verify\?token=[\w-]+/);
const v1 = await page(); await v1.goto(vlink); await v1.goto(vlink);
log("verified after 2 GETs only?", sql("select email_verified_at is not null from users where email='jordan@x.com'"));
await v1.click("text=Confirm email address"); await settle(v1);
log("after confirm ->", path(v1) + " verified=" + sql("select email_verified_at is not null from users where email='jordan@x.com'"));
const v2 = await page(); await v2.goto(vlink); log("reused link", (await body(v2)).match(/invalid, expired[^.]*\./)?.[0]);

// athlete now in dashboard with guardian banner
await login(a, "jordan@x.com"); log("athlete dashboard banner", (await body(a)).match(/Guardian approval needed[^.]*\.[^.]*\./)?.[0]);
const oldInvite = lastLink("mom@x.com", /http:\/\/localhost:3113\/guardian\/accept\?token=[\w-]+/);
await a.click("text=Re-send invite"); await settle(a); log("invite resend cooldown", (await body(a)).match(/Please wait a minute[^.]*\./)?.[0]);
sql("update guardian_invites set last_sent_at = now() - interval '5 minutes'");
await a.click("text=Re-send invite"); await settle(a); log("invite resend ok", (await body(a)).match(/Invite re-sent\./)?.[0]);
const invite = lastLink("mom@x.com", /http:\/\/localhost:3113\/guardian\/accept\?token=[\w-]+/);
log("new token != old token", invite !== oldInvite);
const o = await page(); await o.goto(oldInvite); log("old invite link", (await body(o)).match(/invalid, expired[^.]*\./)?.[0]);

// --- Guardian flow ---
const g0 = await page(); await g0.goto(invite); log("logged-out invite page", (await body(g0)).includes("Create account") ? "offers login/signup" : await body(g0));
const inviteNext = new URL(invite).pathname + new URL(invite).search;

// wrong-email parent
const w = await page();
await signup(w, { name: "Other Parent", email: "other@x.com", role: "parent" }, inviteNext);
log("parent signup (next) lands on", path(w));
await verify("other@x.com"); await login(w, "other@x.com", inviteNext);
log("wrong-email parent sees", (await body(w)).match(/different email address[^.]*\./)?.[0]);

// athlete cannot accept
await a.goto(invite); log("athlete opens invite", (await body(a)).match(/Only a Parent[^.]*\./)?.[0]);

// right parent: unverified can't accept, then verified can
const m = await page();
await signup(m, { name: "Maria Reyes", email: "mom@x.com", role: "parent" }, inviteNext);
await m.goto(B + inviteNext); log("unverified mom opens invite", (await body(m)).match(/Verify your email first/)?.[0]);
log("verify link ->", await verify("mom@x.com"));
await m.goto(B + inviteNext); await m.click("text=Accept as parent/guardian"); await settle(m);
log("accept ->", path(m)); log("parent My Athletes", (await body(m)).match(/My Athletes[^.]*Jordan[^.]*/)?.[0]?.slice(0, 60));
log("relationship row", sql("select guardian_approved, can_view_health from athlete_relationships"));
log("invite row", sql("select status, token_hash is null from guardian_invites"));
await a.goto(B + "/dashboard"); log("athlete sees", (await body(a)).match(/Guardian linked: [\w ]+/)?.[0]);
const re = await page(); await re.goto(invite); log("accepted link reused", (await body(re)).match(/invalid, expired[^.]*\./)?.[0]);

// --- misc ---
const x = await page(); await login(x, "mom@x.com", "https://evil.com"); log("open-redirect next ->", path(x));
sql("update email_tokens set expires_at = now() - interval '1 minute'");
const e = await page(); await signup(e, { name: "Late", email: "late@x.com", role: "parent" }); sql("update email_tokens set expires_at = now() - interval '1 minute' where user_id=(select id from users where email='late@x.com')");
const ex = await page(); await ex.goto(lastLink("late@x.com", /http:\/\/localhost:3113\/verify\?token=[\w-]+/)); log("expired verify link", (await body(ex)).match(/invalid, expired[^.]*\./)?.[0]);
log("tokens stored hashed (len64 hex)", sql("select bool_and(length(token_hash)=64) from email_tokens"));
await br.close();
