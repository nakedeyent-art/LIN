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
const root = await made({ name: "Root Admin", email: "root@x.com", role: "parent" });
const second = await made({ name: "Second Admin", email: "second@x.com", role: "parent" });
const mk = (args) => spawnSync("node", ["scripts/" + args[0], ...args.slice(1)], { cwd: "/home/user/LIN", env: { ...process.env, DATABASE_URL: "postgres://lin:lin@localhost:5432/lin" } });
const path = (p) => new URL(p.url()).pathname;
const resetStep = () => sql("update admin_mfa set last_used_step = null");
const goto = async (p, u) => { await p.goto(B + u); await settle(p); };
const newSession = async (email) => { const p = await br.newContext().then((c) => c.newPage()); await login(p, email); return p; };
const verifyWith = async (p, v) => { await p.fill("input[name=code]", v); await p.click("main button:text-is('Verify'), button:text-is('Verify')"); await settle(p); };
const logLen = () => readFileSync(LOG, "utf8").length;

// ===== before anyone is admin =====
rec((await (await br.newContext()).newPage().then((p) => p.goto(B + "/mfa/setup"))).status() === 404, "signed-out visitors get 404 on /mfa/setup");
rec((await sam.goto(B + "/mfa/setup")).status() === 404 && (await sam.goto(B + "/mfa/verify")).status() === 404, "non-admins get 404 on the MFA pages");
rec(mk(["make-admin.mjs", "root@x.com"]).status === 0 && mk(["make-admin.mjs", "second@x.com"]).status === 0, "two admins granted");

// ===== forced enrolment =====
for (const u of ["/admin", "/admin/users", "/admin/audit", "/admin/mfa", "/admin/news", "/admin/reports"]) {
  await goto(root, u); rec(path(root) === "/mfa/setup", `${u} sends an un-enrolled admin to set up two-factor`, path(root));
}
rec(sql("select count(*) from admin_audit") === "0", "nothing was audited yet");
const mut = await root.context().request.get(B + "/admin/reports/00000000-0000-0000-0000-000000000000/attachment/00000000-0000-0000-0000-000000000000");
rec(mut.status() === 404, "admin download routes refuse a session that hasn't done the second step");
await goto(root, "/mfa/setup");
await see(root, /Set up two-factor authentication/, "setup page loads");
rec((await root.locator("img[alt*='QR']").count()) === 1 && (await root.locator("img[alt*='QR']").getAttribute("src")).startsWith("data:image/png;base64,"), "shows a QR code");
const secret = (await root.locator("[data-testid=mfa-secret]").innerText()).replace(/\s/g, "");
rec(/^[A-Z2-7]{32}$/.test(secret), "and the key for manual entry", secret);
rec(!sql("select secret_sealed from admin_mfa").includes(secret) && /^v1:/.test(sql("select secret_sealed from admin_mfa")), "the secret is stored encrypted, never in plaintext");
rec(sql("select enabled_at is null from admin_mfa") === "t", "enrolment stays pending until a code proves it");
await goto(root, "/mfa/setup");
rec((await root.locator("[data-testid=mfa-secret]").innerText()).replace(/\s/g, "") === secret, "reloading keeps the same secret (the QR doesn't change under you)");
const enroll = async (p, c, pw = OLD) => { await p.fill("input[name=code]", c); await p.fill("input[name=password]", pw); await p.click("button:text-is('Turn on two-factor')"); await settle(p); };
await enroll(root, "000000"); await see(root, /code isn't right/, "a wrong code is refused");
await enroll(root, code(secret), "wrong-password-x"); await see(root, /password is incorrect/, "a wrong password is refused");
rec(sql("select enabled_at is null from admin_mfa") === "t", "still pending after failures");
await enroll(root, code(secret));
await see(root, /Save your recovery codes/, "the right code turns it on and shows recovery codes");
const codes = (await root.locator("[data-testid=recovery-codes]").innerText()).trim().split("\n");
rec(codes.length === 10 && codes.every((c) => /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(c)), "ten recovery codes", codes.join(","));
rec((await root.locator("button:text-is('Continue')").isDisabled()), "Continue stays disabled until you confirm you saved them");
rec(sql("select count(*) from admin_recovery_codes") === "10" && !codes.some((c) => sql("select code_hash from admin_recovery_codes").includes(c.replace("-", ""))), "only hashes of the codes are stored");
await root.locator("input[type=checkbox]").check(); await root.locator("a:text-is('Continue')").click(); await settle(root);
rec(path(root) === "/admin", "after saving them, the admin lands in the panel", path(root));
rec(sql("select count(*) from admin_audit where action='mfa_enrolled'") === "1" && readFileSync(LOG, "utf8").includes("subject=Two-factor authentication is on for your LIN admin account"), "enrolment is audited and emailed");
await goto(root, "/admin/users"); rec(path(root) === "/admin/users", "this session now works everywhere");
await goto(root, "/mfa/setup"); rec(path(root) === "/admin", "setup can't be run again once on");
await goto(root, "/admin/mfa"); rec(!/Turn off|Disable/i.test(await text(root)), "there is no way for an admin to switch it off");
await see(root, /10 recovery codes left/, "security page counts recovery codes");

// ===== signing in again =====
let s2 = await newSession("root@x.com");
await goto(s2, "/admin"); rec(path(s2) === "/mfa/verify", "a new session must do the second step", path(s2));
await goto(s2, "/admin/audit"); rec(path(s2) === "/mfa/verify", "on every admin page");
// replay: the step used to enrol cannot be used again, even though the code is "valid"
rec(Number(sql("select last_used_step from admin_mfa")) > 0, "the step used to enrol is remembered");
// Replay: pretend this very step was just used, then present its (still valid) code.
const cur = nowStep(); sql(`update admin_mfa set last_used_step = ${cur + 1}`);   // any step up to next is "spent", so a step boundary can't flake this
await goto(s2, "/mfa/verify"); await verifyWith(s2, totpAt(secret, cur));
await see(s2, /code isn't right/, "a code from the step that was just used is refused (replay protection)");
sql("update admin_mfa set failed_attempts = 0");
await verifyWith(s2, "12ab56"); await see(s2, /code isn't right/, "garbage is refused");
resetStep();
await verifyWith(s2, code(secret, -1)); rec(path(s2) === "/admin", "a code one step old is accepted (clock drift)", path(s2));
rec(sql("select count(*) from sessions where mfa_verified_at is not null") === "2", "only the verified sessions are marked");
// other sessions of the same admin aren't verified by this one
let s3 = await newSession("root@x.com"); await goto(s3, "/admin"); rec(path(s3) === "/mfa/verify", "verifying one session doesn't verify another");

// ===== lockout =====
resetStep(); let bad = (code(secret) === "111111") ? "222222" : "111111";
for (let i = 0; i < 5; i++) { await goto(s3, "/mfa/verify"); await verifyWith(s3, bad); }
await see(s3, /code isn't right/, "wrong codes are refused");
await goto(s3, "/mfa/verify"); await verifyWith(s3, code(secret));
await see(s3, /Too many wrong codes/, "after 5 wrong codes even the right code is refused for a while");
rec(sql("select count(*) from admin_audit where action='mfa_locked'") === "1", "the lock is audited");
sql("update admin_mfa set locked_until = null, failed_attempts = 0"); resetStep();
await goto(s3, "/mfa/verify"); await verifyWith(s3, code(secret, 1)); rec(path(s3) === "/admin", "after the lock lifts, the right code works", path(s3));

// ===== recovery codes =====
let s4 = await newSession("root@x.com");
await goto(s4, "/mfa/verify"); await verifyWith(s4, codes[0].toLowerCase().replace("-", " "));
rec(path(s4) === "/admin/mfa", "a recovery code signs in (any case, spaces fine) and lands on the security page", path(s4));
await see(s4, /signed in with a recovery code\. 9 left/, "and says how many remain");
rec(readFileSync(LOG, "utf8").includes("subject=A recovery code was used on your LIN admin account") && sql("select count(*) from admin_audit where action='mfa_recovery_used'") === "1", "using one is audited and emailed");
let s5 = await newSession("root@x.com"); await goto(s5, "/mfa/verify"); await verifyWith(s5, codes[0]);
await see(s5, /code isn't right/, "a recovery code works only once");
rec(sql("select count(*) from admin_recovery_codes where used_at is not null") === "1", "exactly one is spent");
await verifyWith(s5, "AAAAA-BBBBB"); await see(s5, /code isn't right/, "an invented recovery code is refused");

// ===== session freshness =====
sql("update sessions set mfa_verified_at = now() - interval '9 hours' where mfa_verified_at is not null");
await goto(s2, "/admin"); rec(path(s2) === "/mfa/verify", "after 8 hours the second step is asked for again", path(s2));
sql("update sessions set mfa_verified_at = now() - interval '7 hours' where mfa_verified_at is not null");
await goto(s4, "/admin"); rec(path(s4) === "/admin", "within 8 hours it isn't", path(s4));

// ===== regenerate recovery codes =====
await goto(s4, "/admin/mfa");
const regen = async (p, c, pw = OLD) => { const card = p.locator("main .card", { has: p.locator("h3:text-is('New recovery codes')") }); await card.locator("[name=code]").evaluate((i) => { i.removeAttribute("pattern"); i.removeAttribute("maxlength"); }); await card.locator("[name=code]").fill(c); await card.locator("[name=password]").fill(pw); await card.locator("button:text-is('Generate new codes')").click(); await settle(p); };
resetStep();
await regen(s4, "000000"); await see(s4, /code isn't right/, "regenerating needs a real authenticator code");
await s4.locator("main input[name=code]").evaluate((i) => i.removeAttribute("pattern")); await regen(s4, codes[1]); await see(s4, /Use a code from your authenticator app/, "…not a recovery code");
await regen(s4, code(secret), "wrong-password-x"); await see(s4, /password is incorrect/, "…and the password");
resetStep();
await regen(s4, code(secret));
await see(s4, /Save your recovery codes/, "new codes are issued");
const codes2 = (await s4.locator("[data-testid=recovery-codes]").innerText()).trim().split("\n");
rec(codes2.length === 10 && !codes2.some((c) => codes.includes(c)), "ten fresh, different codes");
let s6 = await newSession("root@x.com"); await goto(s6, "/mfa/verify"); await verifyWith(s6, codes[2]);
await see(s6, /code isn't right/, "old recovery codes stop working");
await verifyWith(s6, codes2[0]); rec(path(s6) === "/admin/mfa", "new ones work", path(s6));
rec(sql("select count(*) from admin_audit where action='mfa_recovery_regenerated'") === "1", "regeneration audited");

// ===== two admins don't share =====
await goto(second, "/mfa/setup");
const secret2 = (await second.locator("[data-testid=mfa-secret]").innerText()).replace(/\s/g, "");
rec(secret2 !== secret, "each admin gets their own secret");
await second.fill("input[name=code]", code(secret)); await second.fill("input[name=password]", OLD); await second.click("button:text-is('Turn on two-factor')"); await settle(second);
await see(second, /code isn't right/, "another admin's code is no good for me");
await second.fill("input[name=code]", code(secret2)); await second.fill("input[name=password]", OLD); await second.click("button:text-is('Turn on two-factor')"); await settle(second);
await see(second, /Save your recovery codes/, "their own works");
// sealed secrets are bound to their owner
const sealedRoot = sql(`select secret_sealed from admin_mfa where user_id='${id("root@x.com")}'`);
sql(`update admin_mfa set secret_sealed='${sealedRoot}' where user_id='${id("second@x.com")}'`);
let s7 = await newSession("second@x.com"); await goto(s7, "/mfa/verify"); await verifyWith(s7, code(secret));
await see(s7, /can't be read/, "a sealed secret copied onto another account is useless (and fails safely)");
sql(`update admin_mfa set secret_sealed='v1:AAAA:AAAA:AAAA' where user_id='${id("second@x.com")}'`);
await goto(s7, "/mfa/verify"); await verifyWith(s7, "123456"); await see(s7, /can't be read/, "a corrupted secret fails safely, not with a crash");

// ===== non-admins are unaffected =====
await goto(sam, "/dashboard"); rec(path(sam) === "/dashboard", "ordinary users never see any of this");
rec((await sam.goto(B + "/admin")).status() === 404, "and still get 404 on /admin");

// ===== server-side reset =====
rec(mk(["reset-admin-mfa.mjs"]).status === 2 && mk(["reset-admin-mfa.mjs", "root@x.com", "short"]).status === 2, "the reset script demands a real reason");
rec(mk(["reset-admin-mfa.mjs", "sam@x.com", "Lost phone and recovery codes, verified by video call"]).status === 1, "…and refuses non-admins");
rec(mk(["reset-admin-mfa.mjs", "root@x.com", "Lost phone and recovery codes, verified by video call"]).status === 0, "reset works for an admin");
rec(sql(`select count(*) from admin_mfa where user_id='${id("root@x.com")}'`) === "0" && sql(`select count(*) from admin_recovery_codes where user_id='${id("root@x.com")}'`) === "0" && sql(`select count(*) from sessions where user_id='${id("root@x.com")}'`) === "0", "enrolment, codes and sessions are gone");
rec(sql("select count(*) from admin_audit where action='mfa_reset'") === "1", "the reset is audited");
let s8 = await newSession("root@x.com"); await goto(s8, "/admin"); rec(path(s8) === "/mfa/setup", "the admin must enrol again", path(s8));
rec(mk(["make-admin.mjs", "second@x.com", "--revoke"]).status === 0 && sql(`select count(*) from admin_mfa where user_id='${id("second@x.com")}'`) === "0", "revoking admin rights also removes their two-factor data");
rec(/Turned on two-factor|Two-factor reset/.test(await (async () => { await goto(s8, "/mfa/setup"); const sec = (await s8.locator("[data-testid=mfa-secret]").innerText()).replace(/\s/g, ""); await s8.fill("input[name=code]", code(sec)); await s8.fill("input[name=password]", OLD); await s8.click("button:text-is('Turn on two-factor')"); await settle(s8); await s8.locator("input[type=checkbox]").check(); await s8.locator("a:text-is('Continue')").click(); await settle(s8); await goto(s8, "/admin/audit"); return text(s8); })()), "audit log shows the two-factor events with readable labels");

console.log(fails ? `\n${fails} FAILED (${total} checks)` : `\nALL PASSED (${total} checks)`);
await br.close(); process.exit(fails ? 1 : 0);
