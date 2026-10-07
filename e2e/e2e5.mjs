import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const B = "http://localhost:3113";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fails = 0, total = 0;
const rec = (ok, k, extra = "") => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + k.padEnd(62) + (ok ? "" : String(extra).slice(0, 150))); };
const sql = (q) => execSync(`su postgres -c "psql lin -At -q"`, { input: q }).toString().trim();
const settle = async (p) => { await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500); await p.waitForLoadState("networkidle"); };
const text = async (p) => (await p.locator("main, .center").first().innerText().catch(() => "")).replace(/\s+/g, " ");
async function see(p, re, k) { let t = ""; for (let i = 0; i < 40; i++) { t = await text(p); if (re.test(t)) return rec(true, k); await p.waitForTimeout(500); } rec(false, k, `got=${t}`); }
const START = readFileSync("/tmp/claude-0/mail.log", "utf8").length; // ignore mail from earlier runs
const mail = () => readFileSync("/tmp/claude-0/mail.log", "utf8").slice(START).split("[mail:dev]").filter((m) => m.includes(" to="));
const mailsTo = (to, subj) => mail().filter((m) => m.includes(`to=${to} subject=${subj}`));
const resetLink = (to) => mailsTo(to, "Reset your LIN password").map((m) => m.match(/http:\/\/localhost:3113\/reset-password\?token=[\w-]+/)?.[0]).filter(Boolean);
const newPage = async () => (await br.newContext()).newPage();
const OLD = "longenoughpw1", NEW = "brand-new-passphrase-9";

async function signup(email, role = "parent") {
  const p = await newPage(); await p.goto(B + "/signup"); await p.waitForSelector("[name=name]");
  await p.fill("[name=name]", "Reset Tester"); await p.fill("[name=email]", email); await p.fill("[name=password]", OLD);
  await p.check(`[name=role][value=${role}]`); await p.click("button[type=submit]"); await settle(p); return p;
}
async function login(p, email, pw) { await p.goto(B + "/login"); await p.fill("[name=email]", email); await p.fill("[name=password]", pw); await p.click("button[type=submit]"); await settle(p); }
async function forgot(email) { const p = await newPage(); await p.goto(B + "/forgot-password"); await p.fill("[name=email]", email); const t0 = Date.now(); await p.click("button[type=submit]"); await p.waitForURL(/sent=1|error=/, { timeout: 60000 }); const ms = Date.now() - t0; await settle(p); return { p, ms }; }
const requestedMails = async (n, to) => { for (let i = 0; i < 20; i++) { if (resetLink(to).length >= n) break; await new Promise((r) => setTimeout(r, 500)); } return resetLink(to); };

sql("truncate users cascade");
const live = await signup("ann@x.com"); sql("update users set email_verified_at=now() where email='ann@x.com'");
await live.goto(B + "/dashboard"); await settle(live);
rec(new URL(live.url()).pathname === "/dashboard", "setup: ann has a live session");
const other = await signup("bob@x.com"); sql("update users set email_verified_at=now() where email='bob@x.com'");

// ---- no enumeration ----
const unknown = await forgot("nobody@x.com");
const known = await forgot("ann@x.com");
const msg = (p) => text(p);
rec((await msg(unknown.p)) === (await msg(known.p)) && /If an account exists/.test(await msg(known.p)), "same response for unknown and known email");
rec(Math.abs(unknown.ms - known.ms) < 1500, `response time similar (${unknown.ms}ms vs ${known.ms}ms)`);
await new Promise((r) => setTimeout(r, 2500));
rec(mail().filter((m) => m.includes("to=nobody@x.com")).length === 0, "no email sent to an unknown address");
rec(sql("select count(*) from email_tokens where purpose='password_reset'") === "1", "exactly one reset token created (for ann)");
const [link1] = await requestedMails(1, "ann@x.com");
rec(!!link1, "reset email contains a link");
rec(sql("select bool_and(length(token_hash)=64) from email_tokens where purpose='password_reset'") === "t", "token stored hashed");
// ---- rate limiting ----
await forgot("ann@x.com"); await new Promise((r) => setTimeout(r, 2500));
rec(resetLink("ann@x.com").length === 1 && sql("select count(*) from email_tokens where purpose='password_reset'") === "1", "second request within 60s sends nothing new");

// ---- link behaviour ----
const lp = await newPage();
await lp.goto(link1); await lp.goto(link1); await settle(lp);
rec(sql("select count(*) from email_tokens where used_at is not null") === "0", "opening the link (twice) doesn't consume it");
await see(lp, /Choose a new password.*ann@x\.com/, "link shows the reset form for the right account");

// ---- validation doesn't burn the token ----
const fill = async (p, pw, confirm) => { await p.fill("[name=password]", pw); await p.fill("[name=confirm]", confirm ?? pw); await p.click("button[type=submit]"); await settle(p); };
await fill(lp, "short", "short"); await see(lp, /at least 10 characters/, "short password rejected");
await fill(lp, NEW, NEW + "x"); await see(lp, /don't match/, "mismatched confirmation rejected");
await fill(lp, "Password1234!", "Password1234!"); await see(lp, /too common/, "common password rejected");
await fill(lp, "ann@x.com", "ann@x.com"); await see(lp, /can't be your email|too short|at least 10/i, "email-as-password rejected");
rec(sql("select count(*) from email_tokens where used_at is not null") === "0", "validation errors didn't use up the token");

// ---- lock + live session + unverified, then reset ----
const victim = await newPage();
for (let i = 0; i < 5; i++) await login(victim, "ann@x.com", "wrong-password-xx");
await login(victim, "ann@x.com", OLD); await see(victim, /Too many attempts/, "account is locked after 5 failures");
sql("update users set email_verified_at = NULL where email='ann@x.com'");
await fill(lp, NEW);
await see(lp, /Password changed/, "reset succeeds → login page with confirmation");
rec(sql("select failed_logins||':'||(locked_until is null) from users where email='ann@x.com'") === "0:t", "lockout cleared by reset");
rec(sql("select email_verified_at is not null from users where email='ann@x.com'") === "t", "reset proves mailbox control → email verified");
rec(sql("select count(*) from sessions s join users u on u.id=s.user_id where u.email='ann@x.com'") === "0", "all of ann's sessions were ended");
await live.goto(B + "/dashboard"); await settle(live);
rec(new URL(live.url()).pathname === "/login", "previously signed-in browser is logged out");
rec(mailsTo("ann@x.com", "Your LIN password was changed").length === 1, "password-changed notice emailed");

// ---- credentials ----
const c1 = await newPage(); await login(c1, "ann@x.com", OLD); await see(c1, /Invalid email or password/, "old password no longer works");
const c2 = await newPage(); await login(c2, "ann@x.com", NEW);
rec(new URL(c2.url()).pathname === "/dashboard", "new password logs in", c2.url());

// ---- reuse / expiry / superseding ----
const re = await newPage(); await re.goto(link1); await see(re, /invalid, expired or already used/, "used link can't be reused");
await re.goto(B + "/reset-password"); await see(re, /invalid, expired or already used/, "missing token handled");
await re.goto(B + "/reset-password?token=garbage"); await see(re, /invalid, expired or already used/, "garbage token handled");
sql("update email_tokens set created_at = now() - interval '2 minutes' where purpose='password_reset'");
await forgot("ann@x.com"); const [, linkA] = await requestedMails(2, "ann@x.com");
sql("update email_tokens set created_at = now() - interval '2 minutes' where purpose='password_reset'");
await forgot("ann@x.com"); const links = await requestedMails(3, "ann@x.com"); const linkB = links[2];
rec(!!linkA && !!linkB && linkA !== linkB, "two further links issued");
const pB = await newPage(); await pB.goto(linkB); await fill(pB, "yet-another-passphrase-7"); await see(pB, /Password changed/, "newest link works");
const pA = await newPage(); await pA.goto(linkA); await see(pA, /invalid, expired or already used/, "older outstanding link was voided by the reset");
sql("update email_tokens set created_at = now() - interval '2 minutes' where purpose='password_reset'");
await forgot("ann@x.com"); const links2 = await requestedMails(4, "ann@x.com");
sql("update email_tokens set expires_at = now() - interval '1 minute' where used_at is null and purpose='password_reset'");
const pE = await newPage(); await pE.goto(links2[3]); await see(pE, /invalid, expired or already used/, "expired link rejected");

// ---- hourly cap ----
sql("delete from email_tokens where purpose='password_reset'");
sql("insert into email_tokens(token_hash,user_id,purpose,expires_at,created_at) select md5(g::text)||md5(g::text), (select id from users where email='bob@x.com'), 'password_reset', now()+interval '1 hour', now() - (g||' minutes')::interval from generate_series(2,6) g");
const before = resetLink("bob@x.com").length;
await forgot("bob@x.com"); await new Promise((r) => setTimeout(r, 2500));
rec(resetLink("bob@x.com").length === before, "hourly cap (5) stops further reset emails");

// ---- reset link in the page head: no referrer ----
const meta = await pB.goto(links2[3]).then(() => pB.locator('meta[name="referrer"]').getAttribute("content")).catch(() => null);
rec(meta === "no-referrer", "reset page sets referrer policy no-referrer", meta);
console.log(`\n${fails ? fails + " FAILED" : "ALL PASSED"} (${total} checks)`);
await br.close();
