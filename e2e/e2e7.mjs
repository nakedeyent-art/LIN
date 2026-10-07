import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
const B = "http://localhost:3113";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fails = 0, total = 0;
const rec = (ok, k, extra = "") => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + k.padEnd(70) + (ok ? "" : String(extra).slice(0, 170))); };
const sql = (q) => execSync(`su postgres -c "psql lin -At -q"`, { input: q }).toString().trim();
const settle = async (p) => { await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500); await p.waitForLoadState("networkidle"); };
const text = async (p) => (await p.locator("main, .center").first().innerText().catch(() => "")).replace(/\s+/g, " ");
async function see(p, re, k) { re = new RegExp(re.source, "i"); let t = ""; for (let i = 0; i < 40; i++) { t = await text(p); if (re.test(t)) return rec(true, k); await p.waitForTimeout(500); } rec(false, k, `got=${t}`); }
async function notSee(p, re, k) { await settle(p); const t = await text(p); rec(!new RegExp(re.source, "i").test(t), k, `unexpected: ${t}`); }
const START = readFileSync("/tmp/claude-0/mail.log", "utf8").length;
const mails = () => readFileSync("/tmp/claude-0/mail.log", "utf8").slice(START).split("[mail:dev]").filter((m) => m.includes(" to="));
const mailsTo = (to, subj) => mails().filter((m) => m.includes(`to=${to} subject=${subj}`));
const inviteLinks = (to) => mails().filter((m) => m.includes(`to=${to} `) && /guardian\/accept/.test(m)).map((m) => m.match(/http:\/\/localhost:3113\/guardian\/accept\?token=[\w-]+/)?.[0]).filter(Boolean);
const OLD = "longenoughpw1";
const id = (e) => sql(`select id from users where email='${e}'`);
const card = (p, title) => p.locator("main .card", { has: p.locator(`h3:text-is("${title}")`) });
const newPage = async () => (await br.newContext()).newPage();
async function signup(f) {
  const p = await newPage(); await p.goto(B + "/signup"); await p.waitForSelector("[name=name]");
  await p.fill("[name=name]", f.name); await p.fill("[name=email]", f.email); await p.fill("[name=password]", OLD);
  await p.check(`[name=role][value=${f.role}]`);
  for (const k of ["sport", "position", "birth_date", "guardian_email"]) if (f[k]) await p.fill(`[name=${k}]`, f[k]);
  await p.click("button[type=submit]"); await settle(p); return p;
}
async function made(f) { const p = await signup(f); sql(`update users set email_verified_at=now() where email='${f.email}'`); await p.goto(B + "/dashboard"); await settle(p); return p; }
const open = async (p, path = "/dashboard/team") => { await p.goto(B + path); await settle(p); };
const link = (athlete, guardian) => sql(`insert into athlete_relationships(athlete_id,member_id,relationship,can_view_academics,can_view_health,guardian_approved) select a.id,m.id,'parent',true,true,true from users a, users m where a.email='${athlete}' and m.email='${guardian}'`);
const guardians = (athlete) => sql(`select coalesce(string_agg(u.email, ',' order by u.email),'') from guardian_links g join users u on u.id=g.member_id where g.athlete_id=(select id from users where email='${athlete}')`);
async function invite(p, panelTitle, email) { const c = card(p, panelTitle); await c.locator("[name=email]").fill(email); await c.locator("button:has-text('Invite guardian')").click(); await settle(p); }
async function accept(p, url) { await p.goto(url); await settle(p); await p.locator("button:has-text('Accept')").click(); await settle(p); }

sql("truncate users cascade");
const jordan = await made({ name: "Jordan Reyes", email: "jordan@x.com", role: "athlete", sport: "Basketball", position: "PG", birth_date: "2010-03-04", guardian_email: "maria@x.com" });
const maria = await made({ name: "Maria Reyes", email: "maria@x.com", role: "parent" });
const dan = await made({ name: "Dan Reyes", email: "dan@x.com", role: "parent" });
const eve = await made({ name: "Eve Unrelated", email: "eve@x.com", role: "parent" });
const kid = await made({ name: "Kid Other", email: "kid@x.com", role: "athlete", sport: "Soccer", birth_date: "2011-05-05", guardian_email: "kidmom@x.com" });
const kidmom = await made({ name: "Kid Mom", email: "kidmom@x.com", role: "parent" });
const mia = await made({ name: "Mia Solo", email: "mia@x.com", role: "athlete", sport: "Tennis", birth_date: "2012-02-02", guardian_email: "gus@x.com" });
const gus = await made({ name: "Gus Solo", email: "gus@x.com", role: "parent" });
const sam = await made({ name: "Sam Sponsor", email: "sam@x.com", role: "sponsor" });
sql("delete from guardian_invites");
link("jordan@x.com", "maria@x.com"); link("kid@x.com", "kidmom@x.com"); link("mia@x.com", "gus@x.com");
const jid = id("jordan@x.com"), kidId = id("kid@x.com"), miaId = id("mia@x.com"), sid = id("sam@x.com");
const PANEL = "Guardians — Jordan Reyes";

// ================= A. who sees what =================
await open(maria);
await see(maria, /Guardians — Jordan Reyes.*Maria Reyes you/, "guardian sees the Guardians panel with herself marked");
await open(jordan);
await see(jordan, /My parents \/ guardians.*Maria Reyes/, "minor athlete sees their guardians (read-only)");
rec((await jordan.locator("main button:has-text('Invite guardian')").count()) === 0 && (await jordan.locator("main button:has-text('Remove')").count()) === 0, "minor has no invite/remove controls");
await open(eve); rec((await eve.locator("main h3:text-is('Guardians — Jordan Reyes')").count()) === 0, "unrelated parent sees no guardian panels");

// ================= B. inviting another guardian =================
await invite(maria, PANEL, "maria@x.com"); await see(maria, /already a guardian/, "can't invite yourself");
await invite(maria, PANEL, "dan@x.com"); await see(maria, /Invite sent to dan@x\.com/, "guardian invites a second guardian");
await invite(maria, PANEL, "dan@x.com"); await see(maria, /already a pending invite/, "duplicate pending invite blocked");
await new Promise((r) => setTimeout(r, 1500));
const m1 = mailsTo("dan@x.com", "Jordan Reyes invited you as a parent/guardian on LIN")[0] ?? "";
rec(/Maria Reyes, a parent\/guardian of Jordan Reyes, invited you/.test(m1), "invite email names the inviting guardian", m1.slice(0, 160));
const [danLink] = inviteLinks("dan@x.com");
rec(!!danLink, "invite link emailed");
await see(maria, /d\*+@x\.com.*invite pending/, "pending invite shown with a masked address");
await eve.goto(danLink); await settle(eve); await eve.locator("button:has-text('Accept')").count().then(async (n) => { if (n) { await eve.locator("button:has-text('Accept')").click(); await settle(eve); } });
await see(eve, /different email address|different account|isn't|invalid/, "another parent can't use Dan's invite");
rec(guardians("jordan@x.com") === "maria@x.com", "still only Maria after the failed attempt");
await accept(dan, danLink);
await see(dan, /now linked as a parent\/guardian/, "Dan accepts and is linked");
rec(guardians("jordan@x.com") === "dan@x.com,maria@x.com", "two active guardians");
await see(dan, /My athletes.*Jordan Reyes/, "Dan's dashboard lists Jordan");
await open(dan, "/dashboard/academics"); await see(dan, /Viewing Jordan Reyes|Academic Monitoring/, "Dan can open Jordan's academics");
rec(sql("select count(*) from guardian_events where action in ('invited','accepted')") === "2", "invite and acceptance were logged");
// cap = 4 linked+pending
await open(maria); await invite(maria, PANEL, "x1@x.com"); await see(maria, /Invite sent to x1@x\.com/, "third slot");
await invite(maria, PANEL, "x2@x.com"); await see(maria, /Invite sent to x2@x\.com/, "fourth slot");
rec((await card(maria, PANEL).locator("button:has-text('Invite guardian')").count()) === 0, "invite form disappears at the cap (4)");
await card(maria, PANEL).locator("tr", { hasText: "invite pending" }).last().locator("button:has-text('Cancel')").click(); await settle(maria);
await see(maria, /Invite cancelled/, "pending invite can be cancelled");
await card(maria, PANEL).locator("tr", { hasText: "invite pending" }).last().locator("button:has-text('Cancel')").click(); await settle(maria);
// forged authority: point Maria's invite form at someone else's child
await open(maria);
await card(maria, PANEL).locator("[name=athlete_id]").first().evaluate((el, v) => { el.value = v; }, kidId);
await invite(maria, PANEL, "hacker@x.com");
await see(maria, /Only a linked parent\/guardian of an athlete under 18/, "FORGED: inviting a guardian for someone else's child is refused");
rec(sql("select count(*) from guardian_invites where guardian_email='hacker@x.com'") === "0", "no invite row created by the forgery");
await open(maria);
const kidRel = sql(`select id from guardian_links where athlete_id='${kidId}'`);
await card(maria, PANEL).locator("form:has(button:has-text('Step down')) [name=relationship_id]").evaluate((el, v) => { el.value = v; }, kidRel);
await card(maria, PANEL).locator("button:has-text('Step down')").click(); await settle(maria);
await see(maria, /Only a linked parent\/guardian of an athlete under 18/, "FORGED: removing another family's guardian is refused");
rec(guardians("kid@x.com") === "kidmom@x.com", "other family's guardian untouched");

// ================= C. removal =================
await open(maria);
await card(maria, PANEL).locator("tr", { hasText: "Dan Reyes" }).locator("button:has-text('Remove')").click(); await settle(maria);
await see(maria, /Dan Reyes was removed as a guardian/, "guardian removes another guardian");
rec(guardians("jordan@x.com") === "maria@x.com", "Dan's authority is gone");
await open(dan, "/dashboard"); await see(dan, /No athletes linked yet/, "Dan's dashboard no longer lists Jordan");
await open(dan, `/dashboard/academics?athlete=${jid}`); await see(dan, /No athletes have shared academics/, "Dan can't read academics via ?athlete=");
await new Promise((r) => setTimeout(r, 1500));
rec(mailsTo("dan@x.com", "You were removed as a guardian on LIN").length === 1, "removed guardian is emailed");
rec(mailsTo("jordan@x.com", "A guardian on your LIN account changed").length === 1, "athlete is emailed");
rec(sql("select count(*) from guardian_events where action='removed'") === "1", "removal logged");
await open(maria); await see(maria, /Recent guardian activity/, "activity log is visible to guardians");
// re-invite works, old (accepted) link is dead
await invite(maria, PANEL, "dan@x.com"); await new Promise((r) => setTimeout(r, 1500));
const links2 = inviteLinks("dan@x.com"); const danLink2 = links2[links2.length - 1];
const old = await newPage(); await old.goto(danLink); await see(old, /invalid, expired or already used/, "the earlier accepted link is dead");
await accept(dan, danLink2); await see(dan, /now linked/, "re-invited guardian can rejoin");
// concurrent mutual removal
const m2 = await newPage(); await m2.context().addCookies(await maria.context().cookies());
const d2 = await newPage(); await d2.context().addCookies(await dan.context().cookies());
await open(m2); await open(d2);
const mTarget = card(m2, PANEL).locator("tr", { hasText: "Dan Reyes" }).locator("button:has-text('Remove')");
const dTarget = card(d2, PANEL).locator("tr", { hasText: "Maria Reyes" }).locator("button:has-text('Remove')");
await Promise.all([mTarget.click(), dTarget.click()]); await Promise.all([settle(m2), settle(d2)]);
const left = guardians("jordan@x.com");
rec(left === "dan@x.com" || left === "maria@x.com", `mutual removal at the same instant leaves exactly one guardian (${left})`);
const survivor = left === "dan@x.com" ? dan : maria, survivorEmail = left, loser = left === "dan@x.com" ? "maria@x.com" : "dan@x.com";
await open(survivor); await invite(survivor, PANEL, loser); await new Promise((r) => setTimeout(r, 1500));
const links3 = inviteLinks(loser); await accept(left === "dan@x.com" ? maria : dan, links3[links3.length - 1]);
rec(guardians("jordan@x.com") === "dan@x.com,maria@x.com", "both guardians restored");

// ================= D. listing control =================
await open(maria);
await card(maria, PANEL).locator("button:has-text('List to sponsors')").click(); await settle(maria);
await see(maria, /Listed: sponsors can now find this athlete/, "guardian lists the minor");
await open(sam, "/dashboard/athletes"); await see(sam, /Jordan R\./, "sponsor sees the minor as \"Jordan R.\"");
await open(maria); await card(maria, PANEL).locator("button:has-text('Unlist')").click(); await settle(maria);
await open(sam, "/dashboard/athletes"); await notSee(sam, /Jordan/, "unlisting hides the minor from sponsors");
rec(sql("select count(*) from guardian_events where action='listing_changed'") === "2", "listing changes logged");

// ================= E. stepping down (last guardian) + athlete re-invites =================
sql(`update athlete_profiles set discoverable=true where user_id='${jid}'`);
await open(dan); await card(dan, PANEL).locator("tr", { hasText: "Maria Reyes" }).locator("button:has-text('Remove')").click(); await settle(dan);
await see(dan, /Maria Reyes was removed/, "(setup) Dan is now the only guardian");
sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at) values ('${jid}','${sid}','Open deal',100000,'Two posts and an appearance in November','guardian_review',now(), now()+interval '10 days')`);
await open(dan); await card(dan, PANEL).locator("button:has-text('Step down')").click(); await settle(dan);
await see(dan, /open deals that need a guardian/, "last guardian can't step down while a deal is open");
rec(guardians("jordan@x.com") === "dan@x.com", "Dan is still linked");
sql("update deals set status='declined'");
await open(dan); await card(dan, PANEL).locator("button:has-text('Step down')").click(); await settle(dan);
await see(dan, /You stepped down.*unlisted/, "last guardian steps down once deals are resolved");
rec(sql(`select discoverable from athlete_profiles where user_id='${jid}'`) === "f", "the minor was automatically unlisted");
rec(guardians("jordan@x.com") === "", "no guardians remain");
await open(jordan, "/dashboard"); await see(jordan, /Guardian approval needed.*no guardian is linked/i, "athlete sees the guardian-needed banner");
await open(jordan, "/dashboard/deals"); await jordan.locator("main button:has-text('List me to sponsors')").click(); await settle(jordan);
await see(jordan, /linked parent\/guardian is required/, "the minor can't list themself without a guardian");
// athlete names a new guardian (typo'd first, then replaced)
await open(jordan, "/dashboard");
await jordan.locator("main input[name=email]").fill("mariia@x.com"); await jordan.locator("main button:has-text('Send invite')").click(); await settle(jordan);
await see(jordan, /We invited m\w+@x\.com/, "athlete invites a replacement guardian");
await jordan.locator("main input[name=email]").fill("maria@x.com"); await jordan.locator("main button:has-text('Replace invite')").click(); await settle(jordan);
await new Promise((r) => setTimeout(r, 1500));
rec(sql("select count(*) from guardian_invites where status='pending'") === "1", "replacing revoked the older pending invite");
const l4 = inviteLinks("maria@x.com"); await accept(maria, l4[l4.length - 1]);
rec(guardians("jordan@x.com") === "maria@x.com", "new guardian links via the athlete's invite");
await open(jordan, "/dashboard"); await jordan.locator("main input[name=email]").count().then((n) => rec(n === 0, "no more invite form once a guardian is linked"));

// ================= F. guardian deletes a minor's account / guardian deletes self =================
sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at) values ('${kidId}','${sid}','Kid deal',100000,'Two posts and an appearance in November','offered',now(), now()+interval '10 days')`);
const KP = "Guardians — Kid Other";
const delMinor = async (pw, phrase) => { await open(kidmom); const c = card(kidmom, KP); await c.locator("summary").click(); await c.locator("[name=password]").fill(pw); await c.locator("[name=confirm]").fill(phrase); await c.locator("button:has-text('Delete this account')").click(); await settle(kidmom); };
await delMinor(OLD, "delete"); await see(kidmom, /Type DELETE/, "minor deletion needs the exact phrase");
await delMinor("wrong-password-x", "DELETE"); await see(kidmom, /current password is incorrect/, "minor deletion needs the guardian's password");
sql("update users set failed_logins=0, locked_until=null");
await delMinor(OLD, "DELETE"); await see(kidmom, /1 open deal/, "can't delete a minor who has an open deal");
sql("update deals set status='declined' where title='Kid deal'");
await delMinor(OLD, "DELETE"); await see(kidmom, /Kid Other's account was deleted/, "guardian deletes the minor's account");
await new Promise((r) => setTimeout(r, 1500));
rec(sql(`select (deleted_at is not null)::text||':'||full_name from users where id='${kidId}'`) === "true:Deleted user", "minor's row anonymized");
rec(sql(`select (select count(*) from athlete_profiles where user_id='${kidId}')+(select count(*) from athlete_relationships where athlete_id='${kidId}')+(select count(*) from sessions where user_id='${kidId}')`) === "0", "minor's personal data and sessions purged");
rec(mailsTo("kid@x.com", "A LIN account was deleted").length === 1 && mailsTo("kidmom@x.com", "A LIN account was deleted").length === 1, "minor and guardian both notified");
await open(kidmom, "/dashboard/team"); rec((await kidmom.locator("main h3:text-is('Guardians — Kid Other')").count()) === 0, "the deleted minor's panel is gone");
// guardian deletes own account while being the only guardian of a listed minor
sql(`update athlete_profiles set discoverable=true where user_id='${miaId}'`);
await open(gus, "/dashboard/settings"); const del = card(gus, "Delete account");
await del.locator("[name=password]").fill(OLD); await del.locator("[name=confirm]").fill("DELETE"); await del.locator("button:has-text('Delete my account')").click(); await settle(gus);
await see(gus, /Your account has been deleted/, "sole guardian deletes their own account (no open deals)");
rec(sql(`select discoverable from athlete_profiles where user_id='${miaId}'`) === "f", "the orphaned minor was unlisted automatically");

// ================= G. turning 18: consent transfers =================
sql(`update athlete_profiles set birth_date = current_date - interval '18 years' - interval '5 days' where user_id='${jid}'`);
sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at) values ('${jid}','${sid}','Pending at 18',100000,'Two posts and an appearance in November','guardian_review',now(), now()+interval '10 days')`);
sql(`insert into academic_logs(athlete_id,course_name,current_grade) values ('${jid}','Core Math',74)`);
await open(maria, "/dashboard"); await see(maria, /Now adults.*Jordan Reyes turned 18/, "former guardian is told the athlete is now an adult");
await see(maria, /No athletes linked yet/, "…and the athlete is no longer on her roster");
await open(maria, `/dashboard/academics?athlete=${jid}`); await see(maria, /No athletes have shared academics/, "former guardian loses academic access by default");
const dealId = sql("select id from deals where title='Pending at 18'");
rec((await maria.goto(`${B}/dashboard/deals/${dealId}`)).status() === 404, "former guardian can't open the athlete's deals (404)");
await open(maria); await see(maria, /Jordan Reyes is now an adult/, "Team page explains it");
rec((await card(maria, PANEL).count()) === 0, "no guardian management panel for an adult");
await open(jordan, "/dashboard"); await see(jordan, /You're 18 now, so you control your own information/, "athlete sees the 'you're 18' notice");
await open(jordan); await see(jordan, /Parent \/ guardian access.*Maria Reyes.*not sharing/, "adult athlete controls what a parent sees");
await see(jordan, /Invite someone/, "…and can now manage their own team");
// guardian_review at 18 → athlete decides
await open(jordan, `/dashboard/deals/${dealId}`);
await see(jordan, /now 18, so this deal no longer needs a guardian/, "athlete is told they decide the pending deal");
await see(jordan, /Confirm deal/, "athlete gets a 'Confirm deal' action");
// share academics only (view-only)
await open(jordan); const pa = card(jordan, "Parent / guardian access");
await pa.locator("[name=academics]").check(); await pa.locator("button:has-text('Share')").click(); await settle(jordan);
await see(jordan, /Sharing with Maria Reyes \(view-only\)/, "athlete shares academics with the parent");
await open(maria, `/dashboard/academics?athlete=${jid}`); await see(maria, /Viewing Jordan Reyes/, "parent can now view academics");
rec((await maria.locator("main button:has-text('Verify')").count()) === 0 && (await maria.locator("main button:has-text('Save grade')").count()) === 0, "…but only view: no verify or edit controls");
await open(maria, "/dashboard/nutrition"); await see(maria, /No athletes have shared nutrition/, "health data stays private (not shared)");
await open(maria, "/dashboard"); await see(maria, /Jordan Reyes/, "roster shows the consenting adult");
// share health too → still view-only
await open(jordan); const pa2 = card(jordan, "Parent / guardian access");
await pa2.locator("[name=health]").check(); await pa2.locator("button:has-text('Update')").click(); await settle(jordan);
await open(maria, `/dashboard/nutrition?athlete=${jid}`); await see(maria, /Viewing Jordan Reyes/, "parent can view nutrition once shared");
rec((await maria.locator("main button:has-text('Save details')").count()) === 0 && (await maria.locator("main button:has-text('Create targets')").count()) === 0, "parent of an adult can't edit nutrition");
await open(maria, `/dashboard/training?athlete=${jid}`); rec((await maria.locator("main button:has-text('Switch to')").count()) === 0, "parent of an adult can't change season mode");
await open(maria, `/dashboard/deals`); await notSee(maria, /Pending at 18/, "sharing academics/health never exposes deals");
// athlete confirms the deal; former guardian can't
await open(jordan, `/dashboard/deals/${dealId}`); await jordan.locator("main button:has-text('Confirm deal')").click(); await settle(jordan);
rec(sql("select status from deals where title='Pending at 18'") === "awaiting_signature", "adult athlete confirmed the deal that was awaiting a guardian (it now goes to signing)");
// stop sharing, then remove
await open(jordan); await card(jordan, "Parent / guardian access").locator("button:has-text('Stop sharing')").click(); await settle(jordan);
await open(maria, `/dashboard/academics?athlete=${jid}`); await see(maria, /No athletes have shared academics/, "stop sharing ends the parent's access immediately");
await open(jordan); await card(jordan, "Parent / guardian access").locator("button:has-text('Remove link')").click(); await settle(jordan);
rec(sql(`select count(*) from athlete_relationships where athlete_id='${jid}' and relationship='parent'`) === "0", "athlete can remove the parent link entirely");
// an invite that was pending when they turned 18 can't be accepted
const tok = "adult-invite-token-123"; const th = createHash("sha256").update(tok).digest("hex");
sql(`insert into guardian_invites(athlete_id,guardian_email,status,token_hash,expires_at) values ('${jid}','dan@x.com','pending','${th}', now()+interval '5 days')`);
await dan.goto(`${B}/guardian/accept?token=${tok}`); await settle(dan); await dan.locator("button:has-text('Accept')").click(); await settle(dan);
await see(dan, /athlete is now an adult/, "a guardian invite can't be accepted for an athlete who is 18+");
rec(sql(`select count(*) from athlete_relationships where athlete_id='${jid}' and relationship='parent'`) === "0", "no guardian link created for the adult");
console.log(`\n${fails ? fails + " FAILED" : "ALL PASSED"} (${total} checks)`);
await br.close();
