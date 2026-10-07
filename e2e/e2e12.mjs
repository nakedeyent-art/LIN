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
const all = () => readFileSync(LOG, "utf8").split("[mail:dev]").filter((m) => /New message on a NIL deal/.test(m));
const base = all().length; const mails = () => all().slice(base);

sql("truncate users cascade");
const sam = await made({ name: "Sam Sponsor", email: "sam@x.com", role: "sponsor" });
const ada = await made({ name: "Ada Adult", email: "ada@x.com", role: "athlete", sport: "Soccer", birth_date: "2000-01-01" });
const jordan = await made({ name: "Jordan Reyes", email: "jordan@x.com", role: "athlete", sport: "Basketball", birth_date: "2010-03-04", guardian_email: "maria@x.com" });
const maria = await made({ name: "Maria Reyes", email: "maria@x.com", role: "parent" });
const eve = await made({ name: "Eve Unrelated", email: "eve@x.com", role: "parent" });
sql("delete from guardian_invites");
sql(`insert into athlete_relationships(athlete_id,member_id,relationship,can_view_academics,can_view_health,guardian_approved) values ('${id("jordan@x.com")}','${id("maria@x.com")}','parent',true,true,true)`);
const deal = (a, status, title) => sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at) values ('${id(a)}','${id("sam@x.com")}','${title}',150000,'Two posts and an appearance in November','${status}',now(), now()+interval '10 days') returning id`);
const A = deal("ada@x.com", "offered", "Ada deal"), J = deal("jordan@x.com", "guardian_review", "Jordan deal");
const msgPage = (d) => `${B}/dashboard/deals/${d}/messages`;
const send = async (p, d, body) => { await p.goto(msgPage(d)); await settle(p); await p.locator("textarea[name=body]").fill(body); await p.locator("main button:text-is('Send')").click(); await settle(p); };

// ---- adult deal
await send(sam, A, "Hi Ada — can you do Saturday?\nLine two.");
await see(sam, /Hi Ada — can you do Saturday\? Line two\./, "sponsor sees their own message");
rec(sql("select body from deal_messages order by id limit 1").includes("\n"), "line breaks preserved");
await send(sam, A, "Also bring boots <b>please</b>");
await see(sam, /<b>please<\/b>/, "markup is shown as text, not rendered");
rec((await sam.locator("main b").count()) === 0, "no HTML injected into the page");
rec(mails().length === 1, "one email for the first message, none for the second while unread", mails().length);
rec(mails().every((m) => !/Saturday|boots/.test(m)) && /to=ada@x.com/.test(mails()[0] ?? ""), "email goes to the athlete and contains no message text");
await ada.goto(`${B}/dashboard/deals`); await settle(ada);
await see(ada, /2 new messages/, "athlete's deal list shows 2 new messages");
await ada.goto(`${B}/dashboard/deals/${A}`); await settle(ada);
await see(ada, /2 unread/, "deal page shows unread count");
await ada.goto(msgPage(A)); await settle(ada);
await see(ada, /Sam Sponsor · Sponsor/, "athlete sees sender name and role");
await ada.goto(`${B}/dashboard/deals`); await settle(ada);
rec(!/new message/i.test(await text(ada)), "reading clears the unread badge");
await send(ada, A, "Yes, Saturday works.");
await send(sam, A, "Great!");
rec(mails().length === 3, "after the athlete read and replied, new messages email again", mails().length);
await eve.goto(msgPage(A)); await settle(eve);
rec(/404|could not be found/i.test(await text(eve)) || (await eve.title()).includes("404"), "unrelated user gets 404 on the thread");
rec(sql(`select count(*) from deal_messages where sender_id='${id("eve@x.com")}'`) === "0", "unrelated user has no messages");
const maria0 = await maria.goto(msgPage(A)); rec(maria0.status() === 404, "a guardian of a different athlete can't read an adult's deal thread");

// ---- empty / over-long / rate limit
await sam.goto(msgPage(A)); await settle(sam);
await sam.locator("textarea[name=body]").evaluate((t) => { t.removeAttribute("required"); t.value = "   "; });
await sam.locator("main button:text-is('Send')").click(); await settle(sam);
await see(sam, /Write a message first/, "blank message refused server-side");
const before = sql("select count(*) from deal_messages");
await sam.goto(msgPage(A)); await settle(sam);
await sam.locator("textarea[name=body]").evaluate((t) => { t.removeAttribute("maxlength"); t.removeAttribute("required"); t.value = "x".repeat(2001); });
await sam.locator("main button:text-is('Send')").click(); await settle(sam);
await see(sam, /up to 2000 characters/, "over-long message refused server-side");
rec(sql("select count(*) from deal_messages") === before, "nothing stored for the refused messages");
sql(`insert into deal_messages(deal_id,sender_id,body) select '${A}','${id("sam@x.com")}','filler '||g from generate_series(1,8) g`);
await send(sam, A, "one too many");
await see(sam, /too quickly/, "rate limit kicks in");
rec(sql("select count(*) from deal_messages where body='one too many'") === "0", "rate-limited message not stored");
sql("alter table deal_messages disable trigger deal_messages_guard; update deal_messages set created_at = now() - interval '5 minutes' where body like 'filler%'; alter table deal_messages enable trigger deal_messages_guard");
await send(sam, A, "after the wait");
rec(sql("select count(*) from deal_messages where body='after the wait'") === "1", "sending works again after the window");

// ---- minor: guardian sees everything, names abbreviated for third parties
await send(sam, J, "Hello Jordan, interested in a camp appearance?");
await maria.goto(msgPage(J)); await settle(maria);
await see(maria, /Hello Jordan, interested in a camp appearance\?/, "guardian reads the sponsor's message to the minor");
await see(maria, /every message here is also visible to their linked parent/, "thread tells everyone the guardian can read it");
await send(jordan, J, "Sounds fun!");
await sam.goto(msgPage(J)); await settle(sam);
await see(sam, /Jordan R\. · Athlete/, "sponsor sees the minor as 'Jordan R.'");
rec(!/Jordan Reyes/.test(await text(sam)), "sponsor never sees the minor's full name in the thread");
await maria.goto(msgPage(J)); await settle(maria);
await see(maria, /Jordan Reyes · Athlete/, "guardian sees the minor's full name");
await send(maria, J, "Happy to review the details.");
await see(maria, /You · Parent\/guardian/, "guardian's own messages labelled");
rec(mails().some((m) => /to=maria@x.com/.test(m)), "guardian is emailed about new messages");
await eve.goto(msgPage(J)); await settle(eve);
rec(sql(`select count(*) from deal_messages where deal_id='${J}' and sender_id='${id("eve@x.com")}'`) === "0" && (await eve.title()).includes("404") || /could not be found/i.test(await text(eve)), "unlinked parent can't read the minor's thread");
// no guardian -> paused
sql(`update athlete_relationships set guardian_approved=false where athlete_id='${id("jordan@x.com")}'`);
await sam.goto(msgPage(J)); await settle(sam);
await see(sam, /paused until a parent\/guardian is linked/, "thread pauses when the minor has no guardian");
rec((await sam.locator("textarea[name=body]").count()) === 0, "no message box while paused");
sql(`update athlete_relationships set guardian_approved=true where athlete_id='${id("jordan@x.com")}'`);
// athlete turns 18: guardian loses the thread, athlete keeps it
sql(`update athlete_profiles set birth_date = current_date - interval '18 years' - interval '1 day' where user_id='${id("jordan@x.com")}'`);
rec((await maria.goto(msgPage(J))).status() === 404, "guardian loses the thread when the athlete turns 18");
await jordan.goto(msgPage(J)); await settle(jordan);
await see(jordan, /Hello Jordan, interested in a camp appearance\?/, "the new adult still has the full history");
rec(/Visible to the sponsor and the athlete/.test(await text(jordan)), "banner no longer claims guardian visibility");

// ---- closed threads
sql(`update deals set status='declined' where id='${A}'`);
await sam.goto(msgPage(A)); await settle(sam);
await see(sam, /conversation is closed/, "declined offer closes the thread");
rec((await sam.locator("textarea[name=body]").count()) === 0 && /Great!/.test(await text(sam)), "closed thread is read-only but history stays");
sql(`update deals set status='offered', expires_at = now() - interval '1 day' where id='${A}'`);
await sam.goto(msgPage(A)); await settle(sam);
await see(sam, /expired, so the conversation is closed/, "expired open offer closes the thread");
sql(`update deals set status='completed' where id='${A}'`);
await sam.goto(msgPage(A)); await settle(sam);
rec((await sam.locator("textarea[name=body]").count()) === 1, "finished deals can still be discussed");

// ---- DB integrity
rec(/cannot be edited/.test(dbErr("update deal_messages set body='tampered' where id=(select min(id) from deal_messages)")), "DB refuses edits");
rec(/cannot be deleted/.test(dbErr("delete from deal_messages where id=(select min(id) from deal_messages)")), "DB refuses deletes");
rec(/immutable/.test(dbErr("update deal_messages set sender_id=(select id from users where email='eve@x.com') where id=(select min(id) from deal_messages)")), "DB refuses changing the sender");
rec(/char_length|violates check/.test(dbErr(`insert into deal_messages(deal_id,sender_id,body) values ('${A}','${id("sam@x.com")}','')`)), "DB refuses empty messages");

// ---- account deletion blanks the leaver's words, keeps the thread
sql(`update deals set status='completed'`);
await sam.goto(`${B}/dashboard/settings`); await settle(sam);
const card = (p, title) => p.locator("main .card", { has: p.locator(`h3:text-is("${title}")`) });
const cc = card(sam, "Delete account");
await cc.locator('[name="password"]').fill(OLD); await cc.locator('[name="confirm"]').fill("DELETE");
await cc.locator('button:has-text("Delete my account")').click(); await new Promise((r) => setTimeout(r, 2500));
rec(sql("select deleted_at is not null from users where email like 'deleted-%' limit 1") === "t" || sql(`select deleted_at is not null from users where id='${id("sam@x.com") || "00000000-0000-0000-0000-000000000000"}'`) === "t", "sponsor account deleted");
const sid = sql("select id from users where deleted_at is not null limit 1");
rec(sql(`select count(*) from deal_messages where sender_id='${sid}' and body<>'[message removed]'`) === "0", "deleted sponsor's messages are blanked");
rec(sql(`select count(*) from deal_messages where sender_id='${sid}'`) !== "0", "the thread's shape is kept");
rec(sql(`select count(*) from deal_messages where body='Yes, Saturday works.'`) === "1", "other people's messages untouched");
await ada.goto(msgPage(A)); await settle(ada);
await see(ada, /\[message removed\]/, "athlete sees a removed-message placeholder");
await see(ada, /Deleted user/, "sender shown as Deleted user");
console.log(fails ? `\n${fails} FAILED (${total} checks)` : `\nALL PASSED (${total} checks)`);
await br.close(); process.exit(fails ? 1 : 0);
