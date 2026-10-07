import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const B = "http://localhost:3113";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fails = 0;
const check = (k, got, want) => { const ok = want instanceof RegExp ? want.test(String(got)) : got === want; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + k.padEnd(52) + (ok ? "" : ` got=${String(got).slice(0, 110)}`)); };
const sess = (l) => console.log("  [sessions @ "+l+"]", execSync(`su postgres -c "psql lin -Atc \\"select string_agg(split_part(u.email,'@',1), ',') from sessions s join users u on u.id=s.user_id\\""`).toString().trim());
const sql = (q) => execSync(`su postgres -c "psql lin -Atc \\"${q}\\""`).toString().trim();
const settle = async (p) => { await p.waitForLoadState("networkidle"); await p.waitForTimeout(1200); await p.waitForLoadState("networkidle"); };
const text = async (p) => (await p.locator("main, .center, body").first().innerText()).replace(/\s+/g, " ");
const newPage = async () => (await br.newContext()).newPage();

async function signup(f) {
  const p = await newPage();
  await p.goto(B + "/signup");
  await p.fill("[name=name]", f.name); await p.fill("[name=email]", f.email); await p.fill("[name=password]", "longenoughpw1");
  await p.check(`[name=role][value=${f.role}]`);
  for (const k of ["sport", "position", "birth_date", "guardian_email"]) if (f[k]) await p.fill(`[name=${k}]`, f[k]);
  await p.click("button[type=submit]"); await settle(p);
  sql(`update users set email_verified_at=now() where email='${f.email}'`);
  await p.goto(B + "/dashboard"); await settle(p);
  return p;
}

sql("truncate users cascade");
const sponsor = await signup({ name: "Sam Sponsor", email: "sam@x.com", role: "sponsor" });
const booster = await signup({ name: "Bo Booster", email: "bo@x.com", role: "booster" });
const jordan = await signup({ name: "Jordan Reyes", email: "jordan@x.com", role: "athlete", sport: "Basketball", position: "PG", birth_date: "2010-03-04", guardian_email: "maria@x.com" });
const kid = await signup({ name: "Kid Unlinked", email: "kid@x.com", role: "athlete", sport: "Soccer", birth_date: "2011-05-05", guardian_email: "p@x.com" });
const ada = await signup({ name: "Ada Adult", email: "ada@x.com", role: "athlete", sport: "Basketball", birth_date: "2000-01-01" });
const maria = await signup({ name: "Maria Reyes", email: "maria@x.com", role: "parent" });
const other = await signup({ name: "Other Parent", email: "other@x.com", role: "parent" });
// guardian linking itself is covered by earlier e2e; link directly here
sql("insert into athlete_relationships(athlete_id,member_id,relationship,can_view_academics,can_view_health,guardian_approved) select a.id,m.id,'parent',true,true,true from users a, users m where a.email='jordan@x.com' and m.email='maria@x.com'");

sess("after signups");
// ---- visibility ----
sess("before kid");
await kid.goto(B + "/dashboard/deals"); await settle(kid);
await kid.click("text=List me to sponsors"); await settle(kid);
check("unlinked minor can't be listed", await text(kid), /linked parent\/guardian is required/);
for (const p of [jordan, ada]) { await p.goto(B + "/dashboard/deals"); await settle(p); await p.click("text=List me to sponsors"); await settle(p); }
check("listed flags in DB", sql("select string_agg(u.email, ',' order by u.email) from athlete_profiles a join users u on u.id=a.user_id where discoverable"), "ada@x.com,jordan@x.com");
await sponsor.goto(B + "/dashboard/athletes"); await settle(sponsor);
const dir = await text(sponsor);
check("directory: minor abbreviated", dir.includes("Jordan R.") && !dir.includes("Jordan Reyes"), true);
check("directory: adult full name", dir.includes("Ada Adult"), true);
check("directory: unlisted minor hidden", dir.includes("Kid"), false);
await booster.goto(B + "/dashboard/athletes"); await settle(booster);
const bdir = await text(booster);
check("booster: HS athlete not offerable", /Jordan R\..*Not available to your role/.test(bdir), true);
check("booster: adult offerable", /Ada Adult.*Make offer/.test(bdir), true);
check("parent can't open directory (404)", (await maria.goto(B + "/dashboard/athletes")).status(), 404);
check("athlete can't open directory (404)", (await ada.goto(B + "/dashboard/athletes")).status(), 404);

sess("before offers");
// ---- offer validation ----
const jid = sql("select id from users where email='jordan@x.com'"), aid = sql("select id from users where email='ada@x.com'"), kidId = sql("select id from users where email='kid@x.com'");
async function offer(p, athleteId, o) {
  await p.goto(`${B}/dashboard/deals/new?athlete=${athleteId}`); await settle(p);
  await p.fill("[name=title]", o.title ?? "Social ambassador"); await p.fill("[name=amount]", o.amount ?? "1500");
  await p.fill("[name=deliverables]", o.deliverables ?? "Two Instagram posts and one in-store appearance in November.");
  if (o.attest !== false) await p.check("[name=attest]");
  await p.click("main button[type=submit]");
  await p.waitForURL((u) => u.pathname !== "/dashboard/deals/new" || u.search.includes("error"), { timeout: 45000 }).catch(() => {});
  await settle(p);
  return { url: p.url(), body: await text(p) };
}
check("short deliverables rejected", (await offer(sponsor, jid, { deliverables: "too short" })).body, /20–2000 characters/);
check("bad amount rejected", (await offer(sponsor, jid, { amount: "12abc" })).body, /valid amount/);
check("attestation required", (await offer(sponsor, jid, { attest: false })).body, /must confirm/);
check("booster offer to HS blocked server-side", (await offer(booster, jid, {})).body, /can't make offers to high-school/);
check("offer to unlisted athlete blocked (404 page)", (await sponsor.goto(`${B}/dashboard/deals/new?athlete=${kidId}`)).status(), 404);
check("no deal rows yet", sql("select count(*) from deals"), "0");

// ---- minor path: offered -> athlete accepts -> guardian_review -> guardian approves -> awaiting_signature -> both sign -> active -> completed ----
async function signAs(p, dealUrl, name) { await p.goto(dealUrl + "/contract"); await settle(p); await p.fill("[name=typed_name]", name); await p.check("[name=consent]"); await p.locator("main button:has-text('Sign agreement')").click(); await settle(p); }
const o1 = await offer(sponsor, jid, { title: "Sneaker ambassador" });
check("offer created", o1.url, /\/dashboard\/deals\/[0-9a-f-]{36}\?msg=/);
const dealUrl = o1.url.split("?")[0];
check("deal row: offered + attested + expiry", sql("select status, attested_at is not null, expires_at > now() + interval '13 days' from deals"), "offered|t|t");
check("athlete notified by email", readFileSync("/tmp/claude-0/mail.log", "utf8").includes("to=jordan@x.com subject=You have a new NIL offer"), true);
await jordan.goto(dealUrl); await settle(jordan);
const jt = await text(jordan);
check("athlete sees accept + minor notice", /Accept/.test(jt) && /under 18/.test(jt), true);
check("athlete sees sponsor full name, own full name ok", jt.includes("Sam Sponsor"), true);
check("sponsor can't see approve/accept", /Approve|Accept/.test(await (await sponsor.goto(dealUrl), settle(sponsor), text(sponsor))), false);
check("unlinked parent gets 404", (await other.goto(dealUrl)).status(), 404);
check("other athlete gets 404", (await ada.goto(dealUrl)).status(), 404);
check("guardian can't approve before athlete accepts", /Approve \(guardian\)/.test(await (await maria.goto(dealUrl), settle(maria), text(maria))), false);

// forged action: sponsor flips withdraw form to 'approve'
await sponsor.goto(dealUrl); await settle(sponsor);
await sponsor.evaluate(() => { document.querySelector("input[name=action]").value = "approve"; });
await sponsor.click("main form button[type=submit]"); await settle(sponsor);
check("forged 'approve' by sponsor rejected", await text(sponsor), /Only a linked guardian can approve/);
check("status unchanged after forgery", sql("select status from deals"), "offered");

await jordan.goto(dealUrl); await settle(jordan);
await jordan.click("button:has-text('Accept')"); await settle(jordan);
check("minor accept -> guardian_review (NOT active)", sql("select status from deals"), "guardian_review");
check("guardian emailed", readFileSync("/tmp/claude-0/mail.log", "utf8").includes("to=maria@x.com subject=NIL deal update: Awaiting guardian"), true);
// athlete can't self-approve via forgery
await jordan.goto(dealUrl); await settle(jordan);
check("athlete has no approve button", /Approve/.test(await text(jordan)), false);
await jordan.evaluate(() => { const f = document.querySelector("input[name=action]"); f.value = "approve"; });
await jordan.click("main form button[type=submit]"); await settle(jordan);
check("forged self-approval by minor rejected", sql("select status from deals"), "guardian_review");

await maria.goto(B + "/dashboard/deals"); await settle(maria);
check("guardian sees waiting notice", await text(maria), /1 deal waiting for your decision/);
await maria.goto(dealUrl); await settle(maria);
check("guardian sees full athlete name", (await text(maria)).includes("Jordan Reyes"), true);
await maria.click("button:has-text('Approve (guardian)')"); await settle(maria);
check("guardian approve -> awaiting_signature (not active)", sql("select status from deals"), "awaiting_signature");
check("guardian_approved_by recorded", sql("select u.email from deals d join users u on u.id=d.guardian_approved_by"), "maria@x.com");
await signAs(maria, dealUrl, "Maria Reyes"); check("one signature: still awaiting_signature", sql("select status from deals"), "awaiting_signature");
await signAs(sponsor, dealUrl, "Sam Sponsor"); check("guardian + sponsor signed -> active", sql("select status from deals"), "active");
await sponsor.goto(dealUrl); await settle(sponsor);
await sponsor.click("button:has-text('Mark completed')"); await settle(sponsor);
check("sponsor completes active deal", sql("select status from deals"), "completed");
check("audit trail complete", sql("select string_agg(action||':'||to_status, ',' order by created_at, id) from deal_events"), "offer:offered,accept:guardian_review,approve:awaiting_signature,sign:awaiting_signature,sign:active,complete:completed");

// ---- adult path + concurrency + expiry + cap ----
sql("truncate deals cascade");
const o2 = await offer(sponsor, aid, { title: "Gym promo" });
const adaUrl = o2.url.split("?")[0];
const a1 = await newPage(), a2 = await newPage();
for (const p of [a1, a2]) { await p.context().addCookies(await ada.context().cookies()); await p.goto(adaUrl); await settle(p); }
await Promise.all([a1.click("button:has-text('Accept')"), a2.click("button:has-text('Accept')")]);
await Promise.all([settle(a1), settle(a2)]);
const bodies = [await text(a1), await text(a2)];
check("adult accept -> awaiting_signature (never straight to active)", sql("select status from deals"), "awaiting_signature");
check("concurrent double-accept: exactly one wins", bodies.filter((b) => /Updated\./.test(b)).length + "/" + bodies.filter((b) => /can't be accepted now/.test(b)).length, "1/1");
check("only one accept event recorded", sql("select count(*) from deal_events where action='accept'"), "1");

sql("truncate deals cascade");
await offer(sponsor, aid, { title: "Expiring" });
sql("update deals set expires_at = now() - interval '1 minute'");
const exUrl = `${B}/dashboard/deals/${sql("select id from deals")}`;
await ada.goto(exUrl); await settle(ada);
const et = await text(ada);
check("expired shown, no actions", /Expired/.test(et) && !/Accept|Decline/.test(et), true);
sql("truncate deals cascade");
for (let i = 0; i < 3; i++) await offer(sponsor, aid, { title: `Offer ${i}` });
check("4th open offer to same athlete blocked", (await offer(sponsor, aid, { title: "Offer 4" })).body, /already have 3 open offers/);
check("a different sponsor-type may still offer", (await offer(booster, aid, { title: "Booster offer" })).url, /deals\/[0-9a-f-]{36}\?msg/);

// ---- dashboards use real data ----
await ada.goto(B + "/dashboard"); await settle(ada);
check("athlete home lists real deals", await text(ada), /Offer 0|Gym promo|Booster offer/);
await ada.goto(B + "/dashboard/deals"); await settle(ada);
check("athlete decline works", await (async () => { await ada.goto(`${B}/dashboard/deals`); await settle(ada); await ada.click("a:has-text('Offer 0')"); await settle(ada); await ada.click("button:has-text('Decline')"); await settle(ada); return sql("select status from deals where title='Offer 0'"); })(), "declined");
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
await br.close();
