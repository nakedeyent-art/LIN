import { chromium } from "playwright";
import { execSync, spawnSync } from "node:child_process";
import { code, nowStep, totpAt } from "./mfa-helper.mjs";
import { readFileSync } from "node:fs";
const B = "http://localhost:3113";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fails = 0, total = 0;
const rec = (ok, k, extra = "") => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + k.padEnd(76) + (ok ? "" : String(extra).slice(0, 300))); };
const sql = (q) => execSync(`su postgres -c "psql lin -At -q"`, { input: q }).toString().trim();
const dbErr = (q) => { const r = spawnSync("su", ["postgres", "-c", "psql lin -At -q -v ON_ERROR_STOP=1"], { input: q }); return (r.stderr?.toString() ?? "") + (r.status ? " [exit " + r.status + "]" : ""); };
const settle = async (p) => { await p.waitForLoadState("networkidle"); await p.waitForTimeout(1200); await p.waitForLoadState("networkidle"); };
const text = async (p) => (await p.locator("main, .center").first().innerText({ timeout: 2500 }).catch(() => "")).replace(/\s+/g, " ");
async function see(p, re, k) { re = new RegExp(re.source, "i"); let t = ""; for (let i = 0; i < 12; i++) { t = await text(p); if (re.test(t)) return rec(true, k); await p.waitForTimeout(500); } rec(false, k, `got=${t}`); }
const OLD = "longenoughpw1", id = (e) => sql(`select id from users where email='${e}'`);
async function made(f) {
  const ctx = await br.newContext(); const p = await ctx.newPage(); await p.goto(B + "/signup"); await p.waitForSelector("[name=name]");
  await p.fill("[name=name]", f.name); await p.fill("[name=email]", f.email); await p.fill("[name=password]", OLD); await p.check(`[name=role][value=${f.role}]`);
  for (const k of ["sport", "birth_date", "guardian_email"]) if (f[k]) await p.fill(`[name=${k}]`, f[k]);
  await p.click("button[type=submit]"); await settle(p); sql(`update users set email_verified_at=now() where email='${f.email}'`); await p.goto(B + "/dashboard"); await settle(p); return p;
}
const LOG = "/tmp/claude-0/mail.log";
const all = () => readFileSync(LOG, "utf8").split("[mail:dev]").filter((m) => /subject=(New message on a NIL deal|NIL deal update|You have a new NIL offer)/.test(m));
const base = all().length; const mails = () => all().slice(base);


const login = async (p, email, pw = OLD) => { await p.goto(B + "/login"); await p.fill("[name=email]", email); await p.fill("[name=password]", pw); await p.click("button[type=submit]"); await settle(p); };
const bell = async (p) => { await p.goto(B + "/dashboard"); await settle(p); return (await p.locator(".side nav a:has-text('Notifications')").innerText()).replace(/\s+/g, " "); };
const logStart = readFileSync(LOG, "utf8").length;
const mailsTo = (to, subj) => readFileSync(LOG, "utf8").slice(logStart).split("[mail:dev]").filter((m) => m.includes(`to=${to} subject=${subj}`));
const status = async (p, path) => (await p.goto(B + path)).status();
const cron = (path = "") => fetch(B + "/api/cron/daily" + path, { method: "POST", headers: { Authorization: "Bearer test-cron-secret-0123456789abcdef" } }).then((r) => r.json());




sql("truncate users cascade; truncate job_runs");
const sam = await made({ name: "Sam Sponsor", email: "sam@x.com", role: "sponsor" });
const ada = await made({ name: "Ada Adult", email: "ada@x.com", role: "athlete", sport: "Soccer", birth_date: "2000-01-01" });
const maria = await made({ name: "Maria Reyes", email: "maria@x.com", role: "parent" });
const root = await made({ name: "Root Admin", email: "root@x.com", role: "parent" });
const mk = (args) => spawnSync("node", ["scripts/" + args[0], ...args.slice(1)], { cwd: "/home/user/LIN", env: { ...process.env, DATABASE_URL: "postgres://lin:lin@localhost:5432/lin" } });
const path = (p) => new URL(p.url()).pathname;
const goto = async (p, u) => { await p.goto(B + u); await settle(p); };
const newSession = async (email, next) => { const p = await br.newContext().then((c) => c.newPage()); await p.goto(B + "/login" + (next ? `?next=${encodeURIComponent(next)}` : "")); await p.fill("[name=email]", email); await p.fill("[name=password]", OLD); await p.click("button[type=submit]"); await settle(p); return p; };
const verifyWith = async (p, v) => { await p.fill("input[name=code]", v); await p.click("button:text-is('Verify')"); await settle(p); };
const resetStep = () => sql("update user_mfa set last_used_step = null");
const settings = async (p) => { await goto(p, "/dashboard/settings"); return p.locator("main .card", { has: p.locator("h3:text-is('Two-factor authentication')") }); };
const enroll = async (p, secret, pw = OLD, c = null) => { await p.fill("input[name=code]", c ?? code(secret)); await p.fill("input[name=password]", pw); await p.click("button:text-is('Turn on two-factor')"); await settle(p); };
const logMails = (to, subj) => readFileSync(LOG, "utf8").slice(logStart).split("[mail:dev]").filter((m) => m.includes(`to=${to} subject=${subj}`)).length;

// ===== opt-in, with a nudge for roles that handle money =====
await goto(sam, "/dashboard"); rec(/turn on two-factor authentication/i.test(await text(sam)), "a sponsor sees a gentle nudge");
await goto(maria, "/dashboard"); rec(/turn on two-factor authentication/i.test(await text(maria)), "…and so does a parent/guardian");
await goto(ada, "/dashboard"); rec(!/turn on two-factor authentication/i.test(await text(ada)), "an athlete doesn't get the banner");
let card = await settings(ada);
rec(/Off/.test(await card.innerText()) && (await card.locator("a:text-is('Turn on two-factor')").count()) === 1, "Settings offers to turn it on (anyone can)");
rec((await ada.goto(B + "/dashboard")).status() === 200, "without it, nothing changes about signing in");

// ===== enrolling from Settings =====
const adaOther = await newSession("ada@x.com");                  // a second device signed in before she enrols
await goto(ada, "/dashboard/settings");
await ada.locator("a:text-is('Turn on two-factor')").click(); await settle(ada);
rec(path(ada) === "/mfa/setup", "the setup page is open to ordinary accounts", path(ada));
rec(/A second step protects your account/.test(await text(ada)) && (await ada.locator("img[alt*='QR']").count()) === 1, "friendly wording and a QR code");
const secret = (await ada.locator("[data-testid=mfa-secret]").innerText()).replace(/\s/g, "");
rec(/^[A-Z2-7]{32}$/.test(secret) && !sql("select secret_sealed from user_mfa").includes(secret), "secret shown once for manual entry, stored encrypted");
rec((await ada.locator("a:text-is('Not now')").count()) === 1, "ordinary users can back out");
await enroll(ada, secret, "wrong-password-x"); await see(ada, /password is incorrect/, "wrong password refused");
await enroll(ada, secret, OLD, "000000"); await see(ada, /code isn't right/, "wrong code refused");
rec(sql("select enabled_at is null from user_mfa") === "t", "still pending after failures");
await enroll(ada, secret);
await see(ada, /Save your recovery codes/, "the right code turns it on");
const codes = (await ada.locator("[data-testid=recovery-codes]").innerText()).trim().split("\n");
rec(codes.length === 10, "ten recovery codes");
await ada.locator("input[type=checkbox]").check(); await ada.locator("a:text-is('Continue')").click(); await settle(ada);
rec(path(ada) === "/dashboard/settings", "Continue returns to Settings (not the admin panel)", path(ada));
card = await settings(ada);
rec(/On/.test(await card.innerText()) && /10 recovery codes left/.test(await card.innerText()), "Settings now shows it on, with the recovery count");
rec(/Two-factor turned on/.test(await card.innerText()), "and a security activity entry");
rec(logMails("ada@x.com", "Two-factor authentication is on for your LIN account") === 1, "an email confirms it");
await goto(adaOther, "/dashboard"); rec(path(adaOther) === "/login", "other devices were signed out when she enrolled", path(adaOther));
rec(sql("select count(*) from admin_audit") === "0", "ordinary enrolment doesn't touch the admin audit log");

// ===== the gate: password alone is no longer enough =====
let p2 = await newSession("ada@x.com", "/dashboard/deals");
rec(path(p2) === "/mfa/verify", "signing in lands on the second step", path(p2));
rec(/dashboard\/deals/.test(await p2.locator("input[name=next]").getAttribute("value") ?? ""), "and remembers where she was going");
for (const u of ["/dashboard", "/dashboard/deals", "/dashboard/settings", "/dashboard/feed", "/dashboard/notifications", "/dashboard/news"]) {
  await goto(p2, u); rec(path(p2) === "/mfa/verify", `${u} is closed until the second step is done`, path(p2));
}
const ctx2 = p2.context().request;
rec((await ctx2.post(B + "/dashboard/settings/export")).status() === 401, "the data export refuses a half-signed-in session");
rec((await ctx2.get(B + "/dashboard/feed/image/1")).status() === 401, "picture downloads refuse it");
rec((await ctx2.get(B + `/dashboard/deals/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}/messages/feed?after=0`)).status() === 401, "the live message feed refuses it");
rec((await ctx2.get(B + `/dashboard/deals/${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}/contract/download`)).status() === 401, "contract downloads refuse it");
rec((await ctx2.get(B + "/dashboard/feed/post/1")).url().includes("/mfa/verify"), "even a direct post link goes to the second step");
await goto(p2, "/mfa/verify?next=/dashboard/deals"); await verifyWith(p2, "12ab56"); await see(p2, /code isn't right/, "garbage is refused");
const cur = nowStep(); sql(`update user_mfa set failed_attempts = 0, last_used_step = ${cur + 1}`);   // every step up to the next counts as spent: no boundary flake
await verifyWith(p2, totpAt(secret, cur));
await see(p2, /code isn't right/, "a code from a step that was already used can't be replayed");
sql("update user_mfa set failed_attempts = 0");
resetStep();
await verifyWith(p2, code(secret, -1));
rec(path(p2) === "/dashboard/deals", "the right code opens the page she was heading to", path(p2));
await goto(p2, "/dashboard/settings"); rec(path(p2) === "/dashboard/settings", "and everything else works");
rec(sql("select count(*) from sessions where mfa_verified_at is not null") === "2", "only verified sessions are marked");
// a new device is gated separately
let p3 = await newSession("ada@x.com"); await goto(p3, "/dashboard"); rec(path(p3) === "/mfa/verify", "each new sign-in needs its own second step");
// a second factor doesn't make other accounts slower
const adaLike = await newSession("maria@x.com"); rec(path(adaLike) === "/dashboard", "accounts without it sign in as before", path(adaLike));

// ===== lockout =====
resetStep();
for (let i = 0; i < 5; i++) { await goto(p3, "/mfa/verify"); await verifyWith(p3, "111111"); }
await goto(p3, "/mfa/verify"); await verifyWith(p3, code(secret, 1));
await see(p3, /Too many wrong codes/, "after 5 wrong codes even the right one is refused for a while");
rec(sql(`select count(*) from security_events where action='mfa_locked' and user_id='${id("ada@x.com")}'`) === "1", "the lock appears in her security activity (once)");
sql("update user_mfa set locked_until = null, failed_attempts = 0"); resetStep();
await goto(p3, "/mfa/verify"); await verifyWith(p3, code(secret, 1)); rec(path(p3) === "/dashboard", "works again when the lock lifts", path(p3));

// ===== recovery code =====
let p4 = await newSession("ada@x.com"); await goto(p4, "/mfa/verify"); await verifyWith(p4, codes[0].toLowerCase());
rec(path(p4) === "/dashboard/settings", "a recovery code signs in and shows Settings", path(p4));
await see(p4, /signed in with a recovery code\. 9 left/, "and says how many are left");
rec(logMails("ada@x.com", "A recovery code was used on your LIN account") === 1, "using one sends an email");
let p5 = await newSession("ada@x.com"); await goto(p5, "/mfa/verify"); await verifyWith(p5, codes[0]); await see(p5, /code isn't right/, "a recovery code works once");

// ===== regenerate + turn off =====
card = await settings(ada);
await card.locator("details:has(summary:has-text('New recovery codes'))").evaluate((d) => { d.open = true; });
const regen = async (c, pw = OLD) => { const f = card.locator("form").first(); await f.locator("[name=code]").evaluate((i) => { i.removeAttribute("pattern"); i.removeAttribute("maxlength"); }); await f.locator("[name=code]").fill(c); await f.locator("[name=password]").fill(pw); await f.locator("button:text-is('Create new codes')").click(); await settle(ada); };
await regen("000000"); await see(ada, /code isn't right/, "new codes need a real authenticator code");
resetStep(); await regen(code(secret, 1), "wrong-password-x"); await see(ada, /password is incorrect/, "and the password");
resetStep(); await regen(code(secret, 1));
await see(ada, /Save your recovery codes/, "new codes are issued");
const codes2 = (await ada.locator("[data-testid=recovery-codes]").innerText()).trim().split("\n");
rec(!codes2.some((c) => codes.includes(c)) && sql("select count(*) from user_recovery_codes where used_at is null") === "10", "ten different codes; the old ones are gone");
card = await settings(ada); rec(/New recovery codes created/.test(await card.innerText()), "recorded in her activity");
// turn off
await card.locator("details:has(summary:has-text('Turn off two-factor'))").evaluate((d) => { d.open = true; });
const off = async (c, pw = OLD) => { await card.locator("details:has(summary:has-text('Turn off two-factor'))").evaluate((d) => { d.open = true; }); const f = card.locator("form:has(button:text-is('Turn off'))"); await f.locator("[name=code]").fill(c); await f.locator("[name=password]").fill(pw); await f.locator("button:text-is('Turn off')").click(); await settle(ada); };
await off("000000"); await see(ada, /code isn't right/, "turning it off needs a real code");
await off(codes2[0], "wrong-password-x"); await see(ada, /password is incorrect/, "and the password");
rec(sql("select count(*) from user_mfa") === "1", "still on after failures");
sql("update user_mfa set failed_attempts = 0, locked_until = null");
await off(codes2[0]);
await see(ada, /Two-factor authentication is off/, "a recovery code is enough to turn it off");
rec(sql("select count(*) from user_mfa") === "0" && sql("select count(*) from user_recovery_codes") === "0", "all enrolment data is deleted");
rec(logMails("ada@x.com", "Two-factor authentication was turned off on your LIN account") === 1, "an email says so");
card = await settings(ada); rec(/Two-factor turned off/.test(await card.innerText()), "and it's in her activity");
let p6 = await newSession("ada@x.com"); rec(path(p6) === "/dashboard", "signing in is back to password-only", path(p6));

// ===== a stolen session can't quietly add a second factor =====
// Re-enrol, then check that the enrolment kicked everyone else out and needed the password (both shown above); here: enrolment asks for the password.
await goto(ada, "/mfa/setup"); const secret3 = (await ada.locator("[data-testid=mfa-secret]").innerText()).replace(/\s/g, "");
await ada.fill("input[name=code]", code(secret3)); await ada.fill("input[name=password]", ""); await ada.evaluate(() => document.querySelector("input[name=password]").removeAttribute("required")); await ada.click("button:text-is('Turn on two-factor')"); await settle(ada);
await see(ada, /password is incorrect/, "enrolling without the password is refused");

// ===== support reset =====
await mk(["make-admin.mjs", "root@x.com"]);
const { mfaEnroll } = await import("./mfa-helper.mjs"); await mfaEnroll(root, B);
await goto(sam, "/mfa/setup"); const secretS = (await sam.locator("[data-testid=mfa-secret]").innerText()).replace(/\s/g, ""); await enroll(sam, secretS);
await sam.locator("input[type=checkbox]").check(); await sam.locator("a:text-is('Continue')").click(); await settle(sam);
const SID = id("sam@x.com");
await goto(root, `/admin/users/${SID}`);
await see(root, /Two-factor\s*on/i, "an admin sees whether someone has two-factor on");
const adminForm = async (p, title, vals, button) => { const c = p.locator("main .card", { has: p.locator(`h3:text-is("${title}")`) }); for (const [k, v] of Object.entries(vals)) await c.locator(`[name="${k}"]`).fill(v); await c.locator(`button:has-text("${button}")`).click(); await settle(p); };
await root.locator("main input[name=reason]").first().evaluate((i) => i.removeAttribute("minlength"));
await adminForm(root, "Remove two-factor", { reason: "short", password: OLD }, "Remove two-factor"); await see(root, /Give a reason/, "support needs a written reason");
await adminForm(root, "Remove two-factor", { reason: "Lost phone and recovery codes; verified by video call", password: "wrong-password-x" }, "Remove two-factor"); await see(root, /password is incorrect/, "and the admin's password");
rec(sql(`select count(*) from user_mfa where user_id='${SID}'`) === "1", "nothing changed by the failed attempts");
await adminForm(root, "Remove two-factor", { reason: "Lost phone and recovery codes; verified by video call", password: OLD }, "Remove two-factor");
await see(root, /Two-factor removed/, "support can remove it");
rec(sql(`select count(*) from user_mfa where user_id='${SID}'`) === "0" && sql(`select count(*) from sessions where user_id='${SID}'`) === "0", "enrolment gone, person signed out everywhere");
rec(sql("select count(*) from admin_audit where action='reset_mfa'") === "1" && sql(`select count(*) from security_events where user_id='${SID}' and action='mfa_reset_by_admin'`) === "1", "audited, and in the person's own activity");
rec(logMails("sam@x.com", "Two-factor authentication was removed from your LIN account") === 1, "and they're emailed");
let ps = await newSession("sam@x.com"); rec(path(ps) === "/dashboard", "they can sign in with their password and set it up again", path(ps));
await goto(root, `/admin/users/${SID}`); rec((await root.locator("h3:text-is('Remove two-factor')").count()) === 0, "no reset card for someone without it");
await goto(root, `/admin/users/${id("root@x.com")}`); rec((await root.locator("h3:text-is('Remove two-factor')").count()) === 0, "…or for an admin (theirs is reset from the server)");
// admins can't turn theirs off
await goto(root, "/dashboard/settings");
const rcard = root.locator("main .card", { has: root.locator("h3:text-is('Two-factor authentication')") });
rec(/required for admin accounts/.test(await rcard.innerText()) && (await rcard.locator("summary:has-text('Turn off')").count()) === 0, "admins see no way to turn it off");

// ===== the admin side still works, and is stricter at login =====
let rs = await newSession("root@x.com");
rec(path(rs) === "/mfa/verify", "an admin's ordinary dashboard also needs the second step now", path(rs));
await goto(rs, "/dashboard"); rec(path(rs) === "/mfa/verify", "…not just /admin");
await goto(rs, "/admin"); rec(path(rs) === "/mfa/verify", "/admin too");

// ===== deleting an account removes the two-factor data =====
await goto(ada, "/mfa/setup"); // pending enrolment from the "without the password" test
rec(sql(`select count(*) from user_mfa where user_id='${id("ada@x.com")}'`) === "1", "setup: a pending enrolment exists to be purged");
const dc = (await goto(ada, "/dashboard/settings"), ada.locator("main .card", { has: ada.locator("h3:text-is('Delete account')") }));
await dc.locator('[name="password"]').fill(OLD); await dc.locator('[name="confirm"]').fill("DELETE"); await dc.locator('button:has-text("Delete my account")').click(); await new Promise((r) => setTimeout(r, 3000));
rec(sql(`select count(*) from user_mfa where user_id='${id("ada@x.com") || "00000000-0000-0000-0000-000000000000"}'`) === "0" && sql("select count(*) from security_events where user_id in (select id from users where deleted_at is not null)") === "0", "deleting an account removes enrolment, codes and security history");

console.log(fails ? `\n${fails} FAILED (${total} checks)` : `\nALL PASSED (${total} checks)`);
await br.close(); process.exit(fails ? 1 : 0);
