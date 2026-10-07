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
const eve = await made({ name: "Eve Unrelated", email: "eve@x.com", role: "parent" });
const root = await made({ name: "Root Admin", email: "root@x.com", role: "parent" });
sql("delete from guardian_invites");
sql(`insert into athlete_relationships(athlete_id,member_id,relationship,can_view_academics,can_view_health,guardian_approved) values ('${id("jordan@x.com")}','${id("maria@x.com")}','parent',true,true,true)`);
sql(`update athlete_profiles set discoverable=true`);
spawnSync("node", ["scripts/make-admin.mjs", "root@x.com"], { cwd: "/home/user/LIN", env: { ...process.env, DATABASE_URL: "postgres://lin:lin@localhost:5432/lin" } });
await mfaEnroll(root, B);
const deal = (a, status, title) => sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at) values ('${id(a)}','${id("sam@x.com")}','${title}',150000,'Two posts and an appearance in November','${status}',now(), now()+interval '10 days') returning id`);
const A = deal("ada@x.com", "active", "Ada camp"), J = deal("jordan@x.com", "guardian_review", "Jordan camp");
const page = (d) => `${B}/dashboard/deals/${d}/messages`;
const open = async (p, d) => { await p.goto(page(d)); await settle(p); };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
const send = async (p, d, body, files = []) => { await open(p, d); await p.locator("textarea[name=body]").fill(body);
  if (files.length) await p.locator("input[name=files]").setInputFiles(files); await p.locator("main button:text-is('Send')").click(); await settle(p); };
const adminForm = async (p, title, vals, button) => { const c = p.locator("main .card", { has: p.locator(`h3:text-is("${title}")`) });
  for (const [k, v] of Object.entries(vals)) await c.locator(`[name="${k}"]`).fill(v); await c.locator(`button:has-text("${button}")`).click(); await settle(p); };
const msgCount = (d) => sql(`select count(*) from deal_messages where deal_id='${d}'`);

// ============ content filter ============
await send(sam, J, "Email me at coach@example.com");
await see(sam, /contact details, links and social handles can't be shared/, "minor thread: email address refused");
rec((await sam.locator("textarea[name=body]").inputValue()) === "Email me at coach@example.com", "the draft stays in the box after a refusal");
for (const [t, k] of [["call 555-123-4567", "phone"], ["dm me on insta", "social"], ["see www.thing.co", "link"], ["follow @coachk", "handle"]]) {
  await sam.locator("textarea[name=body]").fill(t); await sam.locator("main button:text-is('Send')").click(); await settle(sam);
  await see(sam, /can't be shared/, `minor thread: ${k} refused`);
}
rec(msgCount(J) === "0", "nothing stored for refused messages");
await sam.locator("textarea[name=body]").fill("send nudes"); await sam.locator("main button:text-is('Send')").click(); await settle(sam);
await see(sam, /abusive or inappropriate/, "abusive message refused");
await sam.locator("textarea[name=body]").fill("Happy to discuss the camp with Jordan's parent."); await sam.locator("main button:text-is('Send')").click(); await settle(sam);
rec(msgCount(J) === "1", "a clean message goes through");
rec((await sam.locator("textarea[name=body]").inputValue()) === "", "box is cleared after sending");
await send(sam, A, "Reach me at coach@example.com or 555-123-4567");
rec(sql(`select count(*) from deal_messages where body like 'Reach me%'`) === "1", "adult thread: contact details are allowed");
await send(sam, A, "you are a bitch"); rec(sql(`select count(*) from deal_messages where body like 'you are%'`) === "0", "adult thread: abuse still refused");

// ============ attachments ============
await send(sam, A, "Here is the flyer", [{ name: "flyer.png", mimeType: "image/png", buffer: PNG }]);
await see(sam, /flyer\.png/, "attachment appears on the message");
rec(sql("select content_type||':'||size_bytes from deal_attachments limit 1") === `image/png:${PNG.length}`, "stored with the sniffed type and size");
const fileId = sql("select id from deal_attachments limit 1");
const dl = await sam.context().request.get(`${B}/dashboard/deals/${A}/attachments/${fileId}`);
rec(dl.status() === 200 && /attachment/.test(dl.headers()["content-disposition"]) && dl.headers()["x-content-type-options"] === "nosniff" && /sandbox/.test(dl.headers()["content-security-policy"]) && dl.headers()["content-type"] === "image/png" && /no-store/.test(dl.headers()["cache-control"]), "download is attachment-only with nosniff, CSP sandbox and no-store");
rec(Buffer.compare(await dl.body(), PNG) === 0, "downloaded bytes match");
rec((await ada.context().request.get(`${B}/dashboard/deals/${A}/attachments/${fileId}`)).status() === 200, "the other party can download it");
rec((await eve.context().request.get(`${B}/dashboard/deals/${A}/attachments/${fileId}`)).status() === 404, "an unrelated user gets 404");
rec((await eve.context().request.get(`${B}/dashboard/deals/${J}/attachments/${fileId}`)).status() === 404, "…and the wrong deal id doesn't work either");
rec((await (await br.newContext()).request.get(`${B}/dashboard/deals/${A}/attachments/${fileId}`)).status() === 401, "signed-out visitors get 401");
await send(sam, A, "disguised file", [{ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") }]);
await see(sam, /Only PNG, JPEG or PDF/, "a file that isn't really a PNG is refused");
await sam.locator("input[name=files]").setInputFiles([{ name: "big.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]) }]);
await sam.locator("main button:text-is('Send')").click(); await settle(sam);
await see(sam, /under 2\.0 MB/, "a file over 2 MB is refused");
await sam.locator("input[name=files]").setInputFiles([1, 2, 3, 4].map((i) => ({ name: `f${i}.png`, mimeType: "image/png", buffer: PNG })));
await sam.locator("main button:text-is('Send')").click(); await settle(sam);
await see(sam, /up to 3 files/, "more than 3 files refused");
await sam.locator("input[name=files]").setInputFiles([{ name: "send-nudes.png", mimeType: "image/png", buffer: PNG }]);
await sam.locator("main button:text-is('Send')").click(); await settle(sam);
await see(sam, /abusive or inappropriate/, "filenames are screened too");
rec(sql("select count(*) from deal_attachments") === "1", "refused uploads stored nothing");
rec(/violates|constraint/.test(dbErr(`insert into deal_attachments(message_id,deal_id,uploader_id,filename,content_type,size_bytes,sha256,data) select id,deal_id,sender_id,'x.html','text/html',1,repeat('0',64),'\\x00' from deal_messages limit 1`)), "DB refuses other content types");
// minor's thread: guardian can fetch, sponsor to minor
await send(sam, J, "Details are in the attached sheet", [{ name: "terms.png", mimeType: "image/png", buffer: PNG }]);
const jfile = sql(`select id from deal_attachments where deal_id='${J}'`);
rec((await maria.context().request.get(`${B}/dashboard/deals/${J}/attachments/${jfile}`)).status() === 200, "guardian can download a file sent to their minor");
rec((await eve.context().request.get(`${B}/dashboard/deals/${J}/attachments/${jfile}`)).status() === 404, "an unlinked parent can't");

// ============ live updates ============
await open(ada, A);
await send(sam, A, "live update check one");
let got = false; for (let i = 0; i < 20 && !got; i++) { got = /live update check one/.test(await text(ada)); if (!got) await ada.waitForTimeout(1000); }
rec(got, "a message appears on the other person's open page without a refresh");
rec(sql(`select max(last_read_id)::text from deal_message_reads where user_id='${id("ada@x.com")}' and deal_id='${A}'`) === sql(`select max(id)::text from deal_messages where deal_id='${A}'`), "live-delivered messages count as read");
await ada.locator("textarea[name=body]").fill("reply from ada"); await ada.locator("main button:text-is('Send')").click();
let got2 = false; for (let i = 0; i < 20 && !got2; i++) { got2 = /reply from ada/.test(await text(sam)); if (!got2) await sam.waitForTimeout(1000); }
await settle(ada);
rec(got2 && (await text(ada)).split("reply from ada").length === 2, "reply reaches the sponsor live and isn't duplicated for the sender");
const f1 = await sam.context().request.get(`${B}/dashboard/deals/${A}/messages/feed?after=0`);
rec(f1.status() === 200 && (await f1.json()).messages.length > 0, "feed returns messages for a party");
rec((await eve.context().request.get(`${B}/dashboard/deals/${A}/messages/feed?after=0`)).status() === 404, "feed is 404 for outsiders");
rec((await (await br.newContext()).request.get(`${B}/dashboard/deals/${A}/messages/feed?after=0`)).status() === 401, "feed is 401 signed out");
const f2 = await (await maria.context().request.get(`${B}/dashboard/deals/${J}/messages/feed?after=0`)).json();

// ============ search ============
await sam.goto(`${B}/dashboard/deals/search?q=flyer`); await settle(sam);
await see(sam, /Messages \(1\)[\s\S]*Here is the flyer/, "search finds a message");
await sam.goto(`${B}/dashboard/deals/search?q=camp`); await settle(sam);
await see(sam, /Deals \(2\)/, "search finds deals by title");
await sam.goto(`${B}/dashboard/deals/search?q=Jordan`); await settle(sam);
rec(/Jordan R\./.test(await text(sam)) && !/Jordan Reyes/.test(await text(sam).then((t) => t.replace(/Jordan's parent/g, ""))), "a minor's name is abbreviated in search results for the sponsor");
await maria.goto(`${B}/dashboard/deals/search?q=Jordan`); await settle(maria);
await see(maria, /Jordan Reyes/, "…and in full for the guardian");
await eve.goto(`${B}/dashboard/deals/search?q=flyer`); await settle(eve);
rec(/Messages \(0\)/i.test(await text(eve)) && /Deals \(0\)/i.test(await text(eve)), "an outsider finds nothing");
await sam.goto(`${B}/dashboard/deals/search?q=${encodeURIComponent('"live update" -nonsense')}`); await settle(sam);
await see(sam, /Messages \(1\)/, "phrase and minus syntax work");
await sam.goto(`${B}/dashboard/deals/search?q=%25_%27%22%28`); await settle(sam);
rec(!/error|Application error/i.test(await text(sam)), "odd characters don't break search");
await sam.goto(`${B}/dashboard/deals/search?q=a`); await settle(sam);
await see(sam, /at least 2 characters/, "short queries get a hint");

// ============ reporting ============
await open(ada, A);
const sm = sql(`select id from deal_messages where body like 'Reach me%'`);
rec((await ada.locator(`li:has-text("reply from ada") summary:has-text("Report")`).count()) === 0, "no Report link on your own messages");
const li = ada.locator("li", { hasText: "Reach me at" });
await li.locator("summary:has-text('Report')").click();
await li.locator("select[name=reason]").selectOption("off_platform_contact");
await li.locator("textarea[name=note]").fill("wants me to call him");
await li.locator("button:has-text('Send report')").click(); await settle(ada);
await see(ada, /a moderator will review this message/, "report sent");
rec(sql("select count(*) from message_reports") === "1", "report stored");
await open(ada, A);
rec(await ada.locator("li", { hasText: "Reach me at" }).locator("text=Reported").count() === 1, "message now shows Reported");
// second, urgent report from a guardian on the minor thread
await open(maria, J);
const jl = maria.locator("li", { hasText: "Happy to discuss" });
await jl.locator("summary:has-text('Report')").click(); await jl.locator("select[name=reason]").selectOption("safety_minor"); await jl.locator("button:has-text('Send report')").click(); await settle(maria);
rec(sql("select count(*) from message_reports where reason='safety_minor'") === "1", "guardian can report on the minor's behalf");
await root.goto(B + "/dashboard"); await settle(root);
rec((await status(sam, "/admin/reports")) === 404 && (await status(ada, "/admin/reports")) === 404, "non-admins get 404 on the report queue");
await root.goto(B + "/admin/reports"); await settle(root);
const rows = await root.locator("main tbody tr").allInnerTexts();
rec(rows.length === 2 && /urgent/i.test(rows[0]), "queue lists both, urgent first", rows.join(" | "));
await root.goto(B + "/admin"); await settle(root);
await see(root, /1 urgent message report/, "overview flags the urgent report");
// context window: add many messages around the reported one
for (let i = 0; i < 6; i++) sql(`insert into deal_messages(deal_id,sender_id,body) values ('${A}','${id("sam@x.com")}','filler before ${i}')`);
const rid = sql(`select id from message_reports where reason='off_platform_contact'`);
await root.goto(`${B}/admin/reports/${rid}`); await settle(root);
await see(root, /Reach me at coach@example\.com/, "moderator sees the reported message");
const ctxText = await text(root);
rec(/REPORTED/.test(ctxText) && /Here is the flyer/.test(ctxText) && !/filler before/.test(ctxText), "context is limited to three messages either side", ctxText.slice(0, 300));
rec(sql(`select count(*) from admin_audit where action='view_report'`) === "1", "reading a report is audited");
await root.goto(`${B}/admin/reports/${rid}`); await settle(root);
rec(sql(`select count(*) from admin_audit where action='view_report'`) === "1", "…once per hour");
await root.goto(`${B}/admin/reports/${rid}`); await settle(root);
await root.locator("main input[name=reason]").evaluate((i) => i.removeAttribute("minlength"));
await root.locator("main input[name=outcome][value=hide]").check();
await adminForm(root, "Resolve", { reason: "short", password: OLD }, "Resolve");
await see(root, /Give a reason/, "a reason is required to resolve");
await root.locator("main input[name=outcome][value=hide]").check();
await adminForm(root, "Resolve", { reason: "Pushes contact outside the app", password: "wrong-password-x" }, "Resolve");
await see(root, /password is incorrect/, "password re-checked");
rec(sql("select count(*) from message_reports where status='open'") === "2", "nothing resolved by failed attempts");
await root.locator("main input[name=outcome][value=warn]").check();
await adminForm(root, "Resolve", { reason: "Pushes contact outside the app", password: OLD }, "Resolve");
await see(root, /hidden and the sender warned/, "hide + warn works");
rec(sql(`select (hidden_at is not null)||':'||body from deal_messages where id=${sm}`).startsWith("true:Reach me"), "message hidden but the original text is kept for the record");
await open(ada, A);
rec(/\[removed by a moderator\]/.test(await text(ada)) && !/Reach me at/.test(await text(ada)), "users see the removal notice, not the text");
await open(sam, A);
rec(/\[removed by a moderator\]/.test(await text(sam)), "the sender sees it too");
rec(/Notifications \(\d+\)/.test(await sam.locator(".side nav a:has-text('Notifications')").innerText()), "sender notified");
rec(sql(`select count(*) from notifications where user_id='${id("sam@x.com")}' and title like 'A message you sent was removed%'`) === "1", "sender's notice doesn't say who reported");
rec(sql(`select count(*) from notifications where user_id='${id("ada@x.com")}' and title like 'A moderator reviewed your report%'`) === "1", "reporter told the outcome");
rec(readFileSync(LOG, "utf8").slice(logStart).includes("to=sam@x.com subject=A message you sent on LIN was removed"), "sender emailed");
rec(!/ada|Ada/.test(sql(`select title from notifications where user_id='${id("sam@x.com")}' and title like 'A message you sent%'`)), "…without naming the reporter");
rec(sql("select status from message_reports where id='" + rid + "'") === "actioned", "report marked actioned");
rec(/cannot be edited/.test(dbErr(`update deal_messages set body='tampered' where id=${sm}`)), "hiding didn't loosen the edit protection");
rec(sql(`select count(*) from admin_audit where action='resolve_report'`) === "1", "resolution audited");
// hidden attachments
sql(`update deal_messages set hidden_at=now(), hidden_by='${id("root@x.com")}' where id=(select message_id from deal_attachments where id='${fileId}')`);
rec((await sam.context().request.get(`${B}/dashboard/deals/${A}/attachments/${fileId}`)).status() === 404, "attachments of a hidden message can't be downloaded");
await sam.goto(`${B}/dashboard/deals/search?q=flyer`); await settle(sam);
rec(/Messages \(0\)/i.test(await text(sam)), "hidden messages drop out of search");
sql(`update deal_messages set hidden_at=null, hidden_by=null where hidden_by='${id("root@x.com")}' and id=(select message_id from deal_attachments where id='${fileId}')`);
// suspend outcome on the urgent report
const rid2 = sql(`select id from message_reports where reason='safety_minor'`);
await root.goto(`${B}/admin/reports/${rid2}`); await settle(root);
rec((await root.locator("main").innerText()).includes("involves an athlete under 18"), "report page flags a minor's involvement");
await root.locator("main input[name=outcome][value=suspend]").check();
await adminForm(root, "Resolve", { reason: "Urgent: contact attempts with a minor", password: OLD }, "Resolve");
await see(root, /hidden and the sender suspended/, "suspend outcome works");
rec(sql("select (suspended_at is not null) from users where email='sam@x.com'") === "t", "the sender is suspended");
await sam.goto(B + "/dashboard"); await settle(sam);
rec(new URL(sam.url()).pathname === "/login", "…and signed out");
sql(`update users set suspended_at=null where email='sam@x.com'`);
const sam2 = await br.newContext().then((c) => c.newPage()); await login(sam2, "sam@x.com");
// dismiss path + double resolve
const J2 = sql(`insert into deal_messages(deal_id,sender_id,body) values ('${A}','${id("sam@x.com")}','a normal message') returning id`);
sql(`insert into message_reports(message_id,deal_id,reporter_id,reason) values (${J2},'${A}','${id("ada@x.com")}','spam')`);
const rid3 = sql(`select id from message_reports where status='open'`);
await root.goto(`${B}/admin/reports/${rid3}`); await settle(root);
await root.locator("main input[name=outcome][value=dismiss]").check();
await adminForm(root, "Resolve", { reason: "No violation, ordinary message", password: OLD }, "Resolve");
await see(root, /Report dismissed/, "dismissal works");
rec(sql(`select (hidden_at is null) from deal_messages where id=${J2}`) === "t", "a dismissed report leaves the message alone");
await root.goto(`${B}/admin/reports?show=resolved`); await settle(root);
rec((await root.locator("main tbody tr").count()) >= 3, "resolved list shows past reports");
rec((await root.context().request.get(`${B}/admin/reports/${rid3}/attachment/${fileId}`)).status() === 404, "admin can't pull an attachment that isn't on a reported message");
rec(sql("select count(*) from admin_audit where action='view_attachment'") === "0", "no attachment views logged for refused fetches");

// ============ blocking ============
await open(ada, A);
await ada.locator("main .card", { has: ada.locator("h3:text-is('Safety')") }).locator("button:has-text('Block')").click(); await settle(ada);
await see(ada, /Blocked\. Messaging is off/, "athlete can block the sponsor");
await open(sam2, A);
const safety = await sam2.locator("main .card", { has: sam2.locator("h3:text-is('Safety')") }).innerText();
rec(/Messaging isn't available on this deal right now/.test(await text(sam2)) && !/block/i.test(safety) && (await sam2.locator("textarea[name=body]").count()) === 0, "the blocked sponsor gets a vague message and no box", safety);
const asafety = await ada.locator("main .card", { has: ada.locator("h3:text-is('Safety')") }).innerText();
rec(/You've blocked Sam Sponsor/.test(asafety) && /Unblock/.test(asafety) && (await ada.locator("textarea[name=body]").count()) === 0, "the blocker sees what they did and can undo it", asafety);
await sam2.goto(`${B}/dashboard/athletes`); await settle(sam2);
rec(!/Ada Adult/.test(await text(sam2)), "sponsor no longer finds the athlete in the directory");
await sam2.goto(`${B}/dashboard/deals/new?athlete=${id("ada@x.com")}`); await settle(sam2);
await sam2.fill("[name=title]", "Second try"); await sam2.fill("[name=amount]", "100"); await sam2.fill("[name=deliverables]", "Two Instagram posts and one in-store appearance in November."); await sam2.check("[name=attest]");
await sam2.locator("main button:has-text('Send offer')").click(); await settle(sam2);
await see(sam2, /isn't available for offers/, "new offers to a blocker are refused, without saying why");
rec(sql("select count(*) from deals where title='Second try'") === "0", "no offer created");
rec(sql(`select status from deals where id='${A}'`) === "active", "the existing deal is untouched");
await ada.goto(`${B}/dashboard/deals/${A}`); await settle(ada);
rec((await ada.locator("h3:text-is('Messages')").count()) === 1, "the deal page still works");
await open(ada, A);
await ada.locator("main .card", { has: ada.locator("h3:text-is('Safety')") }).locator("button:has-text('Unblock')").click(); await settle(ada);
await see(ada, /Unblocked/, "adult athlete can unblock");
await send(sam2, A, "back in touch");
rec(sql(`select count(*) from deal_messages where body='back in touch'`) === "1", "messaging works again after unblocking");
// sponsor blocks athlete
await open(sam2, A);
await sam2.locator("main .card", { has: sam2.locator("h3:text-is('Safety')") }).locator("button:has-text('Block')").click(); await settle(sam2);
await open(ada, A);
rec(/Messaging isn't available/.test(await text(ada)), "athlete sees a vague notice when the sponsor blocked them");
await open(sam2, A);
await sam2.locator("main .card", { has: sam2.locator("h3:text-is('Safety')") }).locator("button:has-text('Unblock')").click(); await settle(sam2);
// minor blocks; only a guardian lifts
sql(`update deals set status='active' where id='${J}'`);
await open(jordan, J);
await jordan.locator("main .card", { has: jordan.locator("h3:text-is('Safety')") }).locator("button:has-text('Block')").click(); await settle(jordan);
await see(jordan, /Blocked/, "a minor can block for their own safety");
await open(jordan, J);
rec((await jordan.locator("button:has-text('Unblock')").count()) === 0 && /parent\/guardian lifts blocks/.test(await text(jordan)), "…but can't lift it");
await open(maria, J);
await see(maria, /A block protecting this athlete is in place/, "the guardian sees the block");
await maria.locator("button:has-text('Lift the block')").click(); await settle(maria);
rec(sql("select count(*) from user_blocks") === "0", "the guardian lifted it");
await maria.locator("main .card", { has: maria.locator("h3:text-is('Safety')") }).locator("button:has-text('Block')").click(); await settle(maria);
rec(sql("select athlete_id is not null from user_blocks") === "t", "guardian blocks are recorded on the athlete's behalf");
await open(sam2, J);
rec(/Messaging isn't available/.test(await text(sam2)), "the sponsor can't message the minor");
await sam2.goto(`${B}/dashboard/athletes`); await settle(sam2);
rec(!/Jordan R\./.test(await text(sam2)), "…and the minor is hidden from them in the directory");
// guardian authority ends at 18 -> the guardian's block lapses
sql(`update athlete_profiles set birth_date = current_date - interval '18 years' - interval '1 day' where user_id='${id("jordan@x.com")}'`);
await open(sam2, J);
rec((await sam2.locator("textarea[name=body]").count()) === 1, "a guardian's block lapses when the athlete turns 18");
// outsiders can't block / unblock
rec((await status(eve, `/dashboard/deals/${J}/messages`)) === 404, "outsider can't reach the safety controls");
// DB
rec(/violates check|blocker_id/.test(dbErr(`insert into user_blocks(blocker_id,blocked_id) values ('${id("sam@x.com")}','${id("sam@x.com")}')`)), "can't block yourself");

// ============ deletion cleanup ============
sql(`update deals set status='completed'`);
await sam2.goto(`${B}/dashboard/settings`); await settle(sam2);
const dc = sam2.locator("main .card", { has: sam2.locator("h3:text-is('Delete account')") });
await dc.locator('[name="password"]').fill(OLD); await dc.locator('[name="confirm"]').fill("DELETE");
await dc.locator('button:has-text("Delete my account")').click(); await new Promise((r) => setTimeout(r, 3000));
const SID = sql("select id from users where deleted_at is not null limit 1");
rec(sql(`select count(*) from deal_attachments where uploader_id='${SID}'`) === "0", "a deleted account's attachments are removed");
rec(sql(`select count(*) from user_blocks where blocker_id='${SID}' or blocked_id='${SID}'`) === "0", "…and its blocks");
console.log(fails ? `\n${fails} FAILED (${total} checks)` : `\nALL PASSED (${total} checks)`);
await br.close(); process.exit(fails ? 1 : 0);
