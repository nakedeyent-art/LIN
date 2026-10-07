import { mfaEnroll } from "./mfa-helper.mjs";
import { chromium } from "playwright";
import { execSync, spawnSync } from "node:child_process";
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
const jordan = await made({ name: "Jordan Reyes", email: "jordan@x.com", role: "athlete", sport: "Basketball", birth_date: "2010-03-04", guardian_email: "maria@x.com" });
const maria = await made({ name: "Maria Reyes", email: "maria@x.com", role: "parent" });
const root = await made({ name: "Root Admin", email: "root@x.com", role: "parent" });
sql("delete from guardian_invites");
sql(`insert into athlete_relationships(athlete_id,member_id,relationship,can_view_academics,can_view_health,guardian_approved) values ('${id("jordan@x.com")}','${id("maria@x.com")}','parent',true,true,true)`);
sql(`update athlete_profiles set discoverable=true`);

// ================= NOTIFICATIONS =================
rec(/^Notifications$/.test(await bell(ada)), "no badge when nothing is new");
const offerTo = async (email, amount = "2500") => { await sam.goto(`${B}/dashboard/deals/new?athlete=${id(email)}`); await settle(sam); await sam.fill("[name=title]", "Camp appearance"); await sam.fill("[name=amount]", amount);
  await sam.fill("[name=deliverables]", "Two Instagram posts and one in-store appearance in November."); await sam.check("[name=attest]"); await sam.locator("main button:has-text('Send offer')").click(); await settle(sam); };
await offerTo("ada@x.com");
const A = sql("select id from deals where athlete_id='" + id("ada@x.com") + "'");
rec(/Notifications \(1\)/.test(await bell(ada)), "athlete's bell shows 1 after an offer");
await ada.goto(B + "/dashboard/notifications"); await settle(ada);
await see(ada, /New offer: "Camp appearance"/, "notification names the offer");
rec(!/2,?500|\$/.test(await text(ada).then((t) => t.replace(/Notifications never include amounts or message text\./, ""))), "notification text contains no amount");
rec(mailsTo("ada@x.com", "You have a new NIL offer").length === 1, "email still sent for the offer");
await ada.locator("main button:has-text('Camp appearance')").click(); await settle(ada);
rec(ada.url().endsWith(`/dashboard/deals/${A}`), "clicking opens the deal", ada.url());
rec(/^Notifications$/.test(await bell(ada)), "reading clears the badge");

// messages fold into one notification
const say = async (p, d, body) => { await p.goto(`${B}/dashboard/deals/${d}/messages`); await settle(p); await p.locator("textarea[name=body]").fill(body); await p.locator("main button:text-is('Send')").click(); await settle(p); };
await say(sam, A, "one"); await say(sam, A, "two secret text"); await say(sam, A, "three");
rec(sql(`select count(*) from notifications where user_id='${id("ada@x.com")}' and kind='message' and read_at is null`) === "1", "three messages fold into one unread notification");
rec(sql(`select count from notifications where user_id='${id("ada@x.com")}' and kind='message'`) === "3", "…with a count of 3");
await ada.goto(B + "/dashboard/notifications"); await settle(ada);
await see(ada, /\(3 in total\)/, "page shows the count");
rec(!/secret text/.test(await text(ada)), "notification has no message text");
rec((await sam.goto(B + "/dashboard/notifications"), !/new message/i.test(await text(sam))), "the sender isn't notified of their own messages");
// mark all
await ada.goto(B + "/dashboard/notifications"); await settle(ada);
await ada.locator("main button:has-text('Mark all as read')").click(); await settle(ada);
rec(sql(`select count(*) from notifications where user_id='${id("ada@x.com")}' and read_at is null`) === "0", "mark all read");
rec(/^Notifications$/.test(await bell(ada)), "badge gone");

// guardian notified when a minor accepts
await offerTo("jordan@x.com");
const J = sql("select id from deals where athlete_id='" + id("jordan@x.com") + "'");
await jordan.goto(`${B}/dashboard/deals/${J}`); await settle(jordan);
await jordan.locator("main button:has-text('Accept')").click(); await settle(jordan);
rec(/Notifications \(1\)/.test(await bell(maria)), "guardian's bell shows the deal waiting for them");
await maria.goto(B + "/dashboard/notifications"); await settle(maria);
await see(maria, /Awaiting guardian/, "guardian notification says what changed");

// forging: ada edits the hidden id to maria's notification and submits
await offerTo("ada@x.com", "100");
const mNote = sql(`select id from notifications where user_id='${id("maria@x.com")}' and read_at is null limit 1`);
await ada.goto(B + "/dashboard/notifications"); await settle(ada);
await ada.locator("main input[name=id]").first().evaluate((i, v) => { i.value = v; }, mNote);
await ada.locator("main form button").first().click(); await settle(ada);
rec(sql(`select read_at is null from notifications where id=${mNote}`) === "t", "another user can't mark my notification read by forging its id");

// email preferences
const mailBase = (await mailsTo("ada@x.com", "New message on a NIL deal")).length;
await ada.goto(B + "/dashboard/settings"); await settle(ada);
await ada.locator("main .card", { has: ada.locator("h3:text-is('Email notifications')") }).locator("input[name=messages]").uncheck();
await ada.locator("main .card", { has: ada.locator("h3:text-is('Email notifications')") }).locator("button:has-text('Save')").click(); await settle(ada);
await see(ada, /Email preferences saved/, "preferences saved");
rec(sql(`select email_messages||':'||email_deal_updates from users where email='ada@x.com'`) === "false:true", "message emails off, deal emails on");
await ada.goto(`${B}/dashboard/deals/${A}/messages`); await settle(ada);
await say(sam, A, "after opting out");
rec((await mailsTo("ada@x.com", "New message on a NIL deal")).length === mailBase, "opted-out athlete gets no message email");
rec(sql(`select count(*) from notifications where user_id='${id("ada@x.com")}' and kind='message' and read_at is null`) === "1", "…but still gets the in-app notification");

// housekeeping
sql(`update notifications set read_at = now() - interval '100 days' where user_id='${id("ada@x.com")}' and read_at is not null`);
const oldCount = sql(`select count(*) from notifications where read_at < now() - interval '90 days'`);
const r1 = await cron();
rec(r1.status === "ok" && r1.jobs?.housekeeping?.processed >= Number(oldCount) && Number(oldCount) > 0, "housekeeping job removes old read notifications", JSON.stringify(r1));
rec(sql(`select count(*) from notifications where read_at < now() - interval '90 days'`) === "0", "none left past retention");

// ================= ADMIN =================
for (const [who, p] of [["sponsor", sam], ["athlete", ada]]) {
  rec((await status(p, "/admin")) === 404 && (await status(p, "/admin/users")) === 404 && (await status(p, "/admin/audit")) === 404, `a ${who} gets 404 on every admin page`);
}
rec((await (await br.newContext()).newPage().then((p) => status(p, "/admin"))) === 404, "signed-out visitor gets 404 on /admin");
await root.goto(B + "/dashboard"); await settle(root);
rec((await root.locator(".side nav a:has-text('Admin')").count()) === 0, "no Admin link before being granted");
const run = (args) => spawnSync("node", ["scripts/make-admin.mjs", ...args], { cwd: "/home/user/LIN", env: { ...process.env, DATABASE_URL: "postgres://lin:lin@localhost:5432/lin" } });
sql("update users set email_verified_at=null where email='root@x.com'");
rec(run(["root@x.com"]).status === 1, "make-admin refuses an unverified account");
sql("update users set email_verified_at=now() where email='root@x.com'");
rec(run(["nobody@x.com"]).status === 1, "make-admin refuses an unknown account");
rec(run(["root@x.com"]).status === 0, "make-admin grants admin");
await root.goto(B + "/dashboard"); await settle(root);
rec((await root.locator(".side nav a:has-text('Admin')").count()) === 1, "Admin link appears");
await mfaEnroll(root, B);
await root.goto(B + "/admin"); await settle(root);
await see(root, /Admin overview/, "overview loads");
await see(root, /Deals.*offered/, "overview shows deal counts");
await see(root, /housekeeping/, "overview shows job runs");

// users
await root.goto(B + "/admin/users?q=ada"); await settle(root);
await see(root, /Ada Adult.*ada@x.com/, "search finds a user");
await root.goto(B + "/admin/users?q=%25"); await settle(root);
{ const t = await text(root); rec(/Search for an account/i.test(t), "a lone % is not a wildcard (needs 2+ chars)", t); }
await root.goto(B + "/admin/users?q=%25_"); await settle(root);
{ const t = await text(root); rec(/0 results/i.test(t), "wildcard characters are escaped", t); }
const AID = id("ada@x.com");
await root.goto(`${B}/admin/users/${AID}`); await settle(root);
await see(root, /Birth date\s*2000-01-01/, "detail shows the birth date");
await root.goto(`${B}/admin/users/${AID}`); await settle(root);
rec(sql(`select count(*) from admin_audit where action='view_user' and target_user_id='${AID}'`) === "1", "viewing is audited once per hour, not per reload");
rec(!/secret text|one|after opting out/.test((await text(root)).replace(/Admins see.*$/, "").replace(/one /g, "")) , "admin page shows no message text");

const adminForm = async (p, title, vals, button) => { const c = p.locator("main .card", { has: p.locator(`h3:text-is("${title}")`) });
  for (const [k, v] of Object.entries(vals)) await c.locator(`[name="${k}"]`).fill(v); await c.locator(`button:has-text("${button}")`).click(); await settle(p); };
await root.goto(`${B}/admin/users/${AID}`); await settle(root);
await root.locator("main input[name=reason]").first().evaluate((i) => i.removeAttribute("minlength"));
await adminForm(root, "Suspend account", { reason: "short", password: OLD }, "Suspend");
await see(root, /Give a reason/, "a reason is required");
await adminForm(root, "Suspend account", { reason: "Reported for impersonation by a sponsor", password: "wrong-password-x" }, "Suspend");
await see(root, /password is incorrect/, "admin password is re-checked");
rec(sql("select suspended_at is null from users where email='ada@x.com'") === "t", "nothing changed by the failed attempts");
await adminForm(root, "Suspend account", { reason: "Reported for impersonation by a sponsor", password: OLD }, "Suspend");
await see(root, /suspended and signed out everywhere/, "suspension succeeds");
rec(sql(`select count(*) from sessions where user_id='${AID}'`) === "0", "suspended user's sessions are gone");
await ada.goto(B + "/dashboard"); await settle(ada);
rec(new URL(ada.url()).pathname === "/login", "suspended user is signed out on their device");
await login(ada, "ada@x.com");
await see(ada, /account is suspended/, "login says suspended after a correct password");
await login(ada, "ada@x.com", "wrong-password-x");
await see(ada, /Invalid email or password/, "a wrong password still gets the generic message");
await root.goto(`${B}/admin/users/${AID}`); await settle(root);
await adminForm(root, "Restore account", { reason: "Verified identity by phone, report unfounded", password: OLD }, "Restore");
await see(root, /Account restored/, "restore succeeds");
await login(ada, "ada@x.com"); rec(new URL(ada.url()).pathname === "/dashboard", "restored user can sign in again");

// self / admin protections
await root.goto(`${B}/admin/users/${id("root@x.com")}`); await settle(root);
rec((await root.locator("h3:text-is('Suspend account')").count()) === 0 && (await root.locator("h3:text-is('Correct birth date')").count()) === 0, "no suspend/birth-date controls on your own account");

// birth date: blocked mid-deal, works otherwise
await root.goto(`${B}/admin/users/${AID}`); await settle(root);
await see(root, /Not available while the athlete has open deals/, "birth date change blocked while deals are open");
sql(`update deals set status='declined' where athlete_id='${AID}'`);
await root.goto(`${B}/admin/users/${AID}`); await settle(root);
await adminForm(root, "Correct birth date", { birth_date: "2012-06-01", reason: "Parent supplied a birth certificate", password: OLD }, "Correct birth date");
await see(root, /Birth date corrected/, "birth date corrected");
rec(sql(`select birth_date::text||':'||discoverable from athlete_profiles where user_id='${AID}'`) === "2012-06-01:false", "now a minor with no guardian, so unlisted from sponsors");
rec(/\[birth date 2000-01-01 -> 2012-06-01\]/.test(sql("select detail from admin_audit where action='set_birth_date'")), "audit records old and new value");
await root.goto(`${B}/admin/users/${AID}`); await settle(root);
await adminForm(root, "Correct birth date", { birth_date: "2999-01-01", reason: "Testing an impossible date", password: OLD }, "Correct birth date");
await see(root, /valid birth date/, "impossible dates are refused");

// lockout + verification
sql(`update users set failed_logins=5, locked_until=now()+interval '10 minutes' where email='sam@x.com'`);
const SID = id("sam@x.com");
await root.goto(`${B}/admin/users/${SID}`); await settle(root);
await see(root, /locked until/, "lockout shown");
await adminForm(root, "Clear lockout", { reason: "User verified by phone after being locked out", password: OLD }, "Clear lockout");
await see(root, /Lockout cleared/, "lockout cleared");
rec(sql("select failed_logins||':'||(locked_until is null) from users where email='sam@x.com'") === "0:true", "counters reset");

// deals
await root.goto(B + "/admin/deals"); await settle(root);
await see(root, /Camp appearance.*Sam Sponsor/, "deals list loads");
await root.goto(B + "/admin/deals?status=declined"); await settle(root);
rec(/Camp appearance/.test(await text(root)), "status filter works");
await root.goto(`${B}/admin/deals/${A}`); await settle(root);
await see(root, /message\(s\) in the deal thread \(text is not shown/, "deal detail shows message count only");
rec(!/after opting out|two secret/.test(await text(root)), "no message text on the admin deal page");
rec((await status(root, "/admin/deals/not-a-uuid")) === 404, "bad deal id is a 404");

// audit trail
await root.goto(B + "/admin/audit"); await settle(root);
await see(root, /Suspend account.*ada@x.com/, "audit log lists the suspension");
await see(root, /Reported for impersonation/, "audit log shows the reason");
rec(/append-only/.test(dbErr("update admin_audit set detail='x'")) && /append-only/.test(dbErr("delete from admin_audit")), "DB refuses audit edits and deletes");
rec(sql("select count(*) from admin_audit where action in ('suspend','unsuspend','set_birth_date','unlock')") === "4", "every change is in the audit log (4)");
await root.goto(B + "/admin/jobs"); await settle(root);
await see(root, /housekeeping/, "jobs page loads");

// revoke
rec(run(["root@x.com", "--revoke"]).status === 0, "make-admin --revoke");
await root.goto(B + "/admin"); await settle(root);
rec((await root.title()).includes("404") || /could not be found/i.test(await text(root)) || new URL(root.url()).pathname === "/login", "revoked admin loses access (and sessions)");

// ================= deletion removes notifications =================
sql(`update deals set status='completed'`);
await sam.goto(`${B}/dashboard/settings`); await settle(sam);
const dc = sam.locator("main .card", { has: sam.locator("h3:text-is('Delete account')") });
await dc.locator('[name="password"]').fill(OLD); await dc.locator('[name="confirm"]').fill("DELETE");
await dc.locator('button:has-text("Delete my account")').click(); await new Promise((r) => setTimeout(r, 2500));
rec(sql(`select count(*) from notifications where user_id='${SID}'`) === "0", "deleting an account removes its notifications");
console.log(fails ? `\n${fails} FAILED (${total} checks)` : `\nALL PASSED (${total} checks)`);
await br.close(); process.exit(fails ? 1 : 0);
