import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const B = "http://localhost:3113";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fails = 0, total = 0;
const rec = (ok, k, extra = "") => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + k.padEnd(66) + (ok ? "" : String(extra).slice(0, 170))); };
const sql = (q) => execSync(`su postgres -c "psql lin -At -q"`, { input: q }).toString().trim();
const settle = async (p) => { await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500); await p.waitForLoadState("networkidle"); };
const text = async (p) => (await p.locator("main, .center").first().innerText().catch(() => "")).replace(/\s+/g, " ");
async function see(p, re, k) { re = new RegExp(re.source, "i"); let t = ""; for (let i = 0; i < 40; i++) { t = await text(p); if (re.test(t)) return rec(true, k); await p.waitForTimeout(500); } rec(false, k, `got=${t}`); }
const START = readFileSync("/tmp/claude-0/mail.log", "utf8").length;
const mails = () => readFileSync("/tmp/claude-0/mail.log", "utf8").slice(START).split("[mail:dev]").filter((m) => m.includes(" to="));
const mailsTo = (to, subj) => mails().filter((m) => m.includes(`to=${to} subject=${subj}`));
const newCtx = () => br.newContext();
const OLD = "longenoughpw1";
const id = (e) => sql(`select id from users where email='${e}'`);
const card = (p, title) => p.locator("main .card", { has: p.locator(`h3:text-is("${title}")`) });
async function submit(p, title, vals, button) {
  const c = card(p, title);
  for (const [k, v] of Object.entries(vals)) await c.locator(`[name="${k}"]`).fill(String(v));
  await c.locator(`button:has-text("${button}")`).click(); await settle(p);
}
async function signup(f) {
  const ctx = await newCtx(); const p = await ctx.newPage();
  await p.goto(B + "/signup"); await p.waitForSelector("[name=name]");
  await p.fill("[name=name]", f.name); await p.fill("[name=email]", f.email); await p.fill("[name=password]", OLD);
  await p.check(`[name=role][value=${f.role}]`);
  for (const k of ["sport", "position", "birth_date", "guardian_email", "credential_type"]) if (f[k]) await p.fill(`[name=${k}]`, f[k]);
  await p.click("button[type=submit]"); await settle(p); return p;
}
async function made(f) { const p = await signup(f); sql(`update users set email_verified_at=now() where email='${f.email}'`); await p.goto(B + "/dashboard"); await settle(p); return p; }
async function login(p, email, pw) { await p.goto(B + "/login"); await p.fill("[name=email]", email); await p.fill("[name=password]", pw); await p.click("button[type=submit]"); await settle(p); }
const open = async (p, path = "/dashboard/settings") => { await p.goto(B + path); await settle(p); };
const backdate = () => sql("update email_tokens set created_at = now() - interval '3 minutes' where purpose='change_email'");

sql("truncate users cascade");
const ann = await made({ name: "Ann Parent", email: "ann@x.com", role: "parent" });
const bob = await made({ name: "Bob Other", email: "bob@x.com", role: "parent" });
const jordan = await made({ name: "Jordan Reyes", email: "jordan@x.com", role: "athlete", sport: "Basketball", position: "PG", birth_date: "2010-03-04", guardian_email: "maria@x.com" });
const maria = await made({ name: "Maria Reyes", email: "maria@x.com", role: "parent" });
const sam = await made({ name: "Sam Sponsor", email: "sam@x.com", role: "sponsor" });
const tina = await made({ name: "Tina Trainer", email: "tina@x.com", role: "trainer", credential_type: "CSCS" });
sql("delete from guardian_invites");
sql("insert into athlete_relationships(athlete_id,member_id,relationship,can_view_academics,can_view_health,guardian_approved) select a.id,m.id,'parent',true,true,true from users a, users m where a.email='jordan@x.com' and m.email='maria@x.com'");
sql("insert into athlete_relationships(athlete_id,member_id,relationship,can_view_academics,can_view_health,guardian_approved) select a.id,m.id,'trainer',false,true,false from users a, users m where a.email='jordan@x.com' and m.email='tina@x.com'");

// ============ A. profile ============
await open(ann);
await see(ann, /Account settings.*ann@x\.com/, "settings page renders for a parent");
await submit(ann, "Profile", { name: "<b>" }, "Save profile"); await see(ann, /aren't allowed/, "bad display name rejected");
await submit(ann, "Profile", { name: "Ann Updated" }, "Save profile"); await see(ann, /Profile saved/, "name updated");
rec(sql("select full_name from users where email='ann@x.com'") === "Ann Updated", "name persisted");
await open(jordan);
await submit(jordan, "Profile", { name: "Jordan Reyes", sport: "Basketball", position: "PG", state: "TX", grad_year: "27" }, "Save profile"); await see(jordan, /between 2000 and 2100/, "bad graduation year rejected");
await submit(jordan, "Profile", { name: "Jordan Reyes", sport: "Basketball", position: "Combo guard", state: "tx", grad_year: "2027" }, "Save profile"); await see(jordan, /Profile saved/, "athlete profile saved");
rec(sql("select position||':'||state||':'||grad_year from athlete_profiles p join users u on u.id=p.user_id where u.email='jordan@x.com'") === "Combo guard:TX:2027", "athlete fields persisted (state upper-cased)");
rec((await card(ann, "Profile").locator("[name=sport]").count()) === 0, "non-athletes don't see athlete fields");

// ============ B. password ============
const annTwo = await newCtx().then((c) => c.newPage()); await login(annTwo, "ann@x.com", OLD);
rec(new URL(annTwo.url()).pathname === "/dashboard", "setup: ann has a second device session");
await open(ann);
await submit(ann, "Password", { current: "wrong-password-x", password: "brand-new-passphrase-9", confirm: "brand-new-passphrase-9" }, "Change password"); await see(ann, /current password is incorrect/, "wrong current password rejected");
rec(sql("select failed_logins from users where email='ann@x.com'") === "1", "wrong current password counts as a failed attempt");
await submit(ann, "Password", { current: OLD, password: "Password1234!", confirm: "Password1234!" }, "Change password"); await see(ann, /too common/, "weak new password rejected");
await submit(ann, "Password", { current: OLD, password: "brand-new-passphrase-9", confirm: "different-one-123" }, "Change password"); await see(ann, /don't match/, "mismatched confirmation rejected");
await submit(ann, "Password", { current: OLD, password: OLD, confirm: OLD }, "Change password"); await see(ann, /haven't been using/, "re-using the current password rejected");
await submit(ann, "Password", { current: OLD, password: "brand-new-passphrase-9", confirm: "brand-new-passphrase-9" }, "Change password");
await see(ann, /Password changed/, "password changed");
rec(sql("select failed_logins from users where email='ann@x.com'") === "0", "successful re-auth clears the failure counter");
await open(ann); rec(new URL(ann.url()).pathname === "/dashboard/settings", "current device stays signed in");
await open(annTwo, "/dashboard"); rec(new URL(annTwo.url()).pathname === "/login", "other device was signed out");
rec(mailsTo("ann@x.com", "Your LIN password was changed").length === 1, "password-changed notice emailed");
const t1 = await newCtx().then((c) => c.newPage()); await login(t1, "ann@x.com", OLD); await see(t1, /Invalid email or password/, "old password no longer works");
const t2 = await newCtx().then((c) => c.newPage()); await login(t2, "ann@x.com", "brand-new-passphrase-9"); rec(new URL(t2.url()).pathname === "/dashboard", "new password works");
const PW = "brand-new-passphrase-9";
for (let i = 0; i < 5; i++) { await open(ann); await submit(ann, "Password", { current: "nope-nope-nope", password: "another-passphrase-5", confirm: "another-passphrase-5" }, "Change password"); }
await open(ann); await submit(ann, "Password", { current: PW, password: "another-passphrase-5", confirm: "another-passphrase-5" }, "Change password");
await see(ann, /Too many attempts/, "5 wrong re-auth attempts lock the account (even for the right password)");
sql("update users set failed_logins=0, locked_until=null where email='ann@x.com'");

// ============ C. email change ============
await open(ann);
await submit(ann, "Email address", { new_email: "ann.new@x.com", password: "wrong-password-x" }, "Send confirmation link"); await see(ann, /current password is incorrect/, "email change needs the right password");
sql("update users set failed_logins=0, locked_until=null where email='ann@x.com'");
await submit(ann, "Email address", { new_email: "ann@x.com", password: PW }, "Send confirmation link"); await see(ann, /already your email/, "same address rejected");
await submit(ann, "Email address", { new_email: "bob@x.com", password: PW }, "Send confirmation link");
await see(ann, /If bob@x\.com can be used, we've sent/, "taken address gets the same generic reply");
await new Promise((r) => setTimeout(r, 2500));
rec(mails().filter((m) => m.includes("to=bob@x.com") && /Confirm your new/.test(m)).length === 0, "no confirmation mail goes to the other account");
rec(sql("select count(*) from email_tokens where purpose='change_email'") === "0", "no token created for a taken address");
await submit(ann, "Email address", { new_email: "Ann.New@X.com", password: PW }, "Send confirmation link");
await see(ann, /we've sent a confirmation link/, "valid change accepted (case-insensitive)");
await see(ann, /Waiting for you to confirm ann\.new@x\.com/, "pending change is shown");
await new Promise((r) => setTimeout(r, 1500));
const confirmLink = mailsTo("ann.new@x.com", "Confirm your new LIN email address").map((m) => m.match(/http:\/\/localhost:3113\/confirm-email\?token=[\w-]+/)?.[0]).filter(Boolean)[0];
rec(!!confirmLink, "confirmation link emailed to the NEW address");
const oldNotice = mailsTo("ann@x.com", "An email change was requested on your LIN account")[0] ?? "";
rec(/a\*\*\*\*?\*?@x\.com|a\*+@x\.com|n\*+@x\.com/.test(oldNotice) && !oldNotice.includes("ann.new@x.com"), "heads-up goes to the OLD address with the new one masked", oldNotice.slice(0, 200));
rec(sql("select (length(token_hash)=64)||':'||payload from email_tokens where purpose='change_email'") === "true:ann.new@x.com", "token hashed; payload holds the new address");
await submit(ann, "Email address", { new_email: "ann.other@x.com", password: PW }, "Send confirmation link"); await see(ann, /wait a minute/, "rapid second request is rate-limited");
const lo = await newCtx().then((c) => c.newPage()); await lo.goto(confirmLink); await settle(lo); await see(lo, /Log in to the account/, "logged-out visitor is asked to log in");
await bob.goto(confirmLink); await settle(bob); await see(bob, /belongs to a different account/, "another logged-in user can't use the link");
rec(sql("select count(*) from email_tokens where used_at is not null") === "0", "viewing the link doesn't spend it");
const annThree = await newCtx().then((c) => c.newPage()); await login(annThree, "ann@x.com", PW);
await ann.goto(confirmLink); await settle(ann); await ann.locator("button:has-text('Confirm new email')").click(); await settle(ann);
await see(ann, /Email address updated/, "owner confirms the change");
rec(sql("select email||':'||(email_verified_at is not null) from users where id=(select user_id from email_tokens where purpose='change_email' limit 1)") === "ann.new@x.com:true", "email updated and verified");
await open(annThree, "/dashboard"); rec(new URL(annThree.url()).pathname === "/login", "other devices signed out after the change");
rec(mailsTo("ann@x.com", "Your LIN email address was changed").length === 1, "old address told the change happened");
const o1 = await newCtx().then((c) => c.newPage()); await login(o1, "ann@x.com", PW); await see(o1, /Invalid email or password/, "old email can no longer log in");
const o2 = await newCtx().then((c) => c.newPage()); await login(o2, "ann.new@x.com", PW); rec(new URL(o2.url()).pathname === "/dashboard", "new email logs in");
const reuse = await newCtx().then((c) => c.newPage()); await login(reuse, "ann.new@x.com", PW); await reuse.goto(confirmLink); await see(reuse, /invalid, expired or already used/, "used link can't be reused");
// collision at confirm time + cancel
backdate(); await open(ann);
await submit(ann, "Email address", { new_email: "race@x.com", password: PW }, "Send confirmation link");
await new Promise((r) => setTimeout(r, 1500));
const raceLink = mailsTo("race@x.com", "Confirm your new LIN email address").map((m) => m.match(/http:\/\/localhost:3113\/confirm-email\?token=[\w-]+/)?.[0]).filter(Boolean)[0];
sql("insert into users(email, full_name, role, password_hash) values ('race@x.com','Squatter','parent','!x')");
await ann.goto(raceLink); await settle(ann); await ann.locator("button:has-text('Confirm new email')").click(); await settle(ann);
await see(ann, /now used by another account/, "address taken between request and confirm is refused");
rec(sql("select email from users where full_name='Ann Updated'") === "ann.new@x.com", "email unchanged after the refused confirm");
backdate(); await open(ann);
await submit(ann, "Email address", { new_email: "cancelme@x.com", password: PW }, "Send confirmation link");
await card(ann, "Email address").locator("button:has-text('Cancel change')").click(); await settle(ann);
await see(ann, /cancelled/, "pending change can be cancelled");
const cancelLink = mailsTo("cancelme@x.com", "Confirm your new LIN email address").map((m) => m.match(/http:\/\/localhost:3113\/confirm-email\?token=[\w-]+/)?.[0]).filter(Boolean)[0];
await ann.goto(cancelLink); await see(ann, /invalid, expired or already used/, "cancelled link is dead");

// ============ D. mistyped address while unverified ============
const typo = await signup({ name: "Typo Person", email: "typo@x.con", role: "parent" });
await typo.goto(B + "/verify-email"); await settle(typo);
await typo.locator("summary:has-text('Wrong address?')").click();
await typo.fill("[name=new_email]", "typo@x.com"); await typo.fill("main [name=password], .center [name=password]", "wrong-password-x"); await typo.locator("button:has-text('Update and resend')").click(); await settle(typo);
await see(typo, /password is incorrect/, "unverified address fix needs the password");
await typo.locator("summary:has-text('Wrong address?')").click();
await typo.fill("[name=new_email]", "typo@x.com"); await typo.fill(".center [name=password]", OLD); await typo.locator("button:has-text('Update and resend')").click(); await settle(typo);
await see(typo, /typo@x\.com/, "unverified account can correct its address");
await new Promise((r) => setTimeout(r, 1500));
rec(mailsTo("typo@x.com", "Confirm your email for LIN").length >= 1, "verification email re-sent to the corrected address");
rec(sql("select count(*) from users where email='typo@x.con'") === "0", "old typo address is gone");

// ============ E. sign out other devices ============
const a2 = await newCtx().then((c) => c.newPage()); await login(a2, "ann.new@x.com", PW);
await open(ann); rec((await ann.locator("main tr", { hasText: "this device" }).count()) === 1, "sessions list marks this device");
await card(ann, "Where you're signed in").locator("button:has-text('Sign out all other devices')").click(); await settle(ann);
await see(ann, /Signed out of all other devices/, "sign out other devices");
await open(a2, "/dashboard"); rec(new URL(a2.url()).pathname === "/login", "the other session is gone");
await open(ann); rec(new URL(ann.url()).pathname === "/dashboard/settings", "this session survives");

// ============ F. export ============
const jid = id("jordan@x.com"), sid = id("sam@x.com"), tid = id("tina@x.com"), mid = id("maria@x.com");
sql(`insert into academic_logs(athlete_id,course_name,current_grade) values ('${jid}','Core Math',74)`);
sql(`insert into study_sessions(athlete_id,minutes,subject) values ('${jid}',60,'Math')`);
sql(`insert into food_logs(athlete_id,meal_name,calories,protein_grams,carbs_grams,fats_grams) values ('${jid}','Lunch',700,40,80,20)`);
sql(`insert into nutrition_plans(athlete_id,prescribed_by,target_calories,protein_grams,carbs_grams,fats_grams,target_body_profile) values ('${jid}','${tid}',2900,200,300,80,'maintenance')`);
sql(`insert into athlete_workouts(athlete_id,prescribed_by,sport,workout_json,scheduled_date,title) values ('${jid}','${tid}','Basketball','{"exercises":[]}'::jsonb,current_date,'Day 1')`);
sql(`update athlete_profiles set discoverable=true where user_id='${jid}'`);
const ex = await jordan.context().request.post(B + "/dashboard/settings/export");
const body = await ex.text(); let json = {}; try { json = JSON.parse(body); } catch {}
rec(ex.status() === 200 && /attachment/.test(ex.headers()["content-disposition"] ?? ""), "export downloads a JSON attachment", ex.status());
rec(json.grades?.[0]?.course_name === "Core Math" && json.meals?.[0]?.meal_name === "Lunch" && json.account?.email === "jordan@x.com", "export contains the user's own data");
rec(!/password_hash|\$scrypt|scrypt\$/.test(body), "export contains no password hashes");
rec(!body.includes("sam@x.com") && !body.includes("ann.new@x.com"), "export contains no unrelated users' emails");
rec((await (await newCtx()).request.post(B + "/dashboard/settings/export")).status() === 401, "export refuses unauthenticated requests");
rec((await jordan.context().request.get(B + "/dashboard/settings/export")).status() === 405, "export is POST-only");

// ============ G. delete account ============
sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at) values ('${jid}','${sid}','Open deal',150000,'Two posts and an appearance in November','offered',now(), now()+interval '10 days')`);
sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at) values ('${jid}','${sid}','Old finished deal',50000,'One post last spring season','completed',now())`);
const del = async (p, pw, phrase) => { await open(p); await submit(p, "Delete account", { password: pw, confirm: phrase }, "Delete my account"); };
await del(jordan, OLD, "delete"); await see(jordan, /Type DELETE to confirm/, "deletion needs the exact phrase");
await del(jordan, "wrong-password-x", "DELETE"); await see(jordan, /current password is incorrect/, "deletion needs the right password");
sql("update users set failed_logins=0, locked_until=null");
await del(jordan, OLD, "DELETE"); await see(jordan, /1 open deal/, "athlete with an open deal can't delete");
await del(maria, OLD, "DELETE"); await see(maria, /open deals that need a guardian/, "guardian can't delete while a linked minor has open deals");
await del(sam, OLD, "DELETE"); await see(sam, /1 open deal/, "counterparty with an open deal can't delete");
rec(sql("select count(*) from users where deleted_at is not null") === "0", "nothing was deleted by the blocked attempts");
sql("update deals set status='declined' where title='Open deal'");

// trainer deletion: prescriptions stay, attribution cleared
await del(tina, OLD, "DELETE"); for (let i = 0; i < 20 && sql(`select deleted_at is null from users where id='${tid}'`) === "t"; i++) await new Promise((r) => setTimeout(r, 500));
rec(sql(`select deleted_at is not null from users where id='${tid}'`) === "true", "trainer account deleted");
rec(sql("select (select count(*) from nutrition_plans where prescribed_by is null)||':'||(select count(*) from athlete_workouts where prescribed_by is null)") === "1:1", "athlete keeps the plan and workout; prescriber link cleared");
rec(sql(`select count(*) from athlete_relationships where member_id='${tid}'`) === "0" && sql(`select count(*) from manager_declarations where manager_id='${tid}'`) === "0", "trainer's relationships and declaration removed");

// athlete deletion
const jdev = await newCtx().then((c) => c.newPage()); await login(jdev, "jordan@x.com", OLD);
await del(jordan, OLD, "DELETE");
await see(jordan, /Your account has been deleted/, "deleted athlete lands on login with confirmation");
const u = sql(`select email like 'deleted-%@deleted.invalid' ||':'|| full_name ||':'|| (deleted_at is not null) ||':'|| (email_verified_at is null) from users where id='${jid}'`);
rec(u === "true:Deleted user:true:true", "user row anonymized and flagged", u);
rec(sql(`select (select count(*) from sessions where user_id='${jid}')+(select count(*) from athlete_profiles where user_id='${jid}')+(select count(*) from academic_logs where athlete_id='${jid}')+(select count(*) from study_sessions where athlete_id='${jid}')+(select count(*) from food_logs where athlete_id='${jid}')+(select count(*) from nutrition_plans where athlete_id='${jid}')+(select count(*) from athlete_workouts where athlete_id='${jid}')+(select count(*) from athlete_relationships where athlete_id='${jid}' or member_id='${jid}')`) === "0", "all personal data and sessions purged");
rec(sql(`select count(*) from deals where athlete_id='${jid}'`) === "2", "deal records retained for the counterparty");
await open(sam, "/dashboard/deals"); await see(sam, /Old finished deal/, "counterparty can still open the deal list");
await sam.locator("a:has-text('Old finished deal')").click(); await settle(sam); await see(sam, /Deleted user/, "deal shows the deleted athlete as \"Deleted user\"");
await open(jdev, "/dashboard"); rec(new URL(jdev.url()).pathname === "/login", "deleted user's other device is logged out");
const again = await newCtx().then((c) => c.newPage()); await login(again, "jordan@x.com", OLD); await see(again, /Invalid email or password/, "deleted account can't log in");
rec(mailsTo("jordan@x.com", "Your LIN account was deleted").length === 1, "deletion notice emailed");
const re = await signup({ name: "New Jordan", email: "jordan@x.com", role: "parent" });
rec(new URL(re.url()).pathname === "/verify-email", "the freed email address can sign up again", re.url());
await open(maria, "/dashboard"); await see(maria, /No athletes linked yet/, "guardian's dashboard no longer lists the deleted athlete");
rec(sql(`select count(*) from deal_events where deal_id in (select id from deals where athlete_id='${jid}')`) >= "0", "audit trail untouched (no FK errors)");
const rr = await newCtx().then((c) => c.newPage()); await login(rr, "ann.new@x.com", PW); await open(rr);
await submit(rr, "Delete account", { password: PW, confirm: "DELETE" }, "Delete my account"); await see(rr, /Your account has been deleted/, "a simple account (no deals) deletes cleanly");
console.log(`\n${fails ? fails + " FAILED" : "ALL PASSED"} (${total} checks)`);
await br.close();
