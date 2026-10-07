import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const B = "http://localhost:3113";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fails = 0, total = 0;
const rec = (ok, k, extra = "") => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + k.padEnd(60) + (ok ? "" : extra)); };
const sql = (q) => execSync(`su postgres -c "psql lin -At -q"`, { input: q }).toString().trim();
const settle = async (p) => { await p.waitForLoadState("networkidle"); await p.waitForTimeout(1500); await p.waitForLoadState("networkidle"); };
const mainText = async (p) => (await p.locator("main, .center").first().innerText().catch(() => "")).replace(/\s+/g, " ");
// poll until the page text matches (dev-mode compiles make fixed sleeps flaky)
const ci = (re) => new RegExp(re.source, re.flags.includes("i") ? re.flags : re.flags + "i");
async function see(p, re0, k) { const re = ci(re0); let t = ""; for (let i = 0; i < 40; i++) { t = await mainText(p); if (re.test(t)) return rec(true, k); await p.waitForTimeout(500); } rec(false, k, `got=${t.slice(0, 160)}`); }
async function notSee(p, re0, k) { const re = ci(re0); await settle(p); const t = await mainText(p); rec(!re.test(t), k, `unexpected match in: ${t.slice(0, 160)}`); }
const status = async (p, path) => { const r = await p.goto(B + path); await settle(p); return r.status(); };
const mails = () => readFileSync("/tmp/claude-0/mail.log", "utf8");
const link = (to, re) => { const m = mails().split("[mail:dev]").filter((x) => x.includes(`to=${to} `)).map((x) => x.match(re)?.[0]).filter(Boolean); return m.at(-1); };
const newPage = async () => (await br.newContext()).newPage();
const today = new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);

async function signup(f) {
  const p = await newPage();
  await p.goto(B + "/signup"); await p.waitForSelector("[name=name]");
  await p.fill("[name=name]", f.name); await p.fill("[name=email]", f.email); await p.fill("[name=password]", "longenoughpw1");
  await p.check(`[name=role][value=${f.role}]`);
  for (const k of ["sport", "position", "birth_date", "guardian_email", "credential_type"]) if (f[k]) await p.fill(`[name=${k}]`, f[k]);
  if (f.declared) await p.selectOption("[name=declared_role]", f.declared);
  await p.click("button[type=submit]"); await settle(p);
  return p;
}
async function made(f) { const p = await signup(f); sql(`update users set email_verified_at=now() where email='${f.email}'`); await p.goto(B + "/dashboard"); await settle(p); return p; }
// fill a form inside <main> and press a button
async function submit(p, vals, button) {
  for (const [k, v] of Object.entries(vals)) {
    const el = p.locator(`main [name="${k}"]`).first();
    const tag = await el.evaluate((e) => e.tagName + ":" + (e.type || ""));
    if (tag === "SELECT:select-one") await el.selectOption(String(v));
    else if (tag === "INPUT:checkbox") { v ? await el.check() : await el.uncheck(); }
    else await el.fill(String(v));
  }
  await p.locator(`main button:has-text("${button}")`).first().click(); await settle(p);
}
const id = (email) => sql(`select id from users where email='${email}'`);

sql("truncate users cascade");
// ---------- signup rules ----------
{ const p = await signup({ name: "No Cred", email: "nc@x.com", role: "trainer" }); await see(p, /certification/i, "trainer signup requires a certification");
  const q = await signup({ name: "No Cred", email: "nc2@x.com", role: "manager", declared: "certified_strength_coach" }); await see(q, /certification/i, "certified-coach manager requires a certification"); }

const jordan = await made({ name: "Jordan Reyes", email: "jordan@x.com", role: "athlete", sport: "Basketball", position: "PG", birth_date: "2010-03-04", guardian_email: "maria@x.com" });
const maria = await made({ name: "Maria Reyes", email: "maria@x.com", role: "parent" });
const other = await made({ name: "Other Parent", email: "other@x.com", role: "parent" });
const ada = await made({ name: "Ada Adult", email: "ada@x.com", role: "athlete", sport: "Soccer", birth_date: "2000-01-01" });
const tina = await made({ name: "Tina Trainer", email: "tina@x.com", role: "trainer", credential_type: "CSCS" });
const mkt = await made({ name: "Mark Marketer", email: "mkt@x.com", role: "manager", declared: "marketing_agent" });
const cert = await made({ name: "Cora Coachmgr", email: "cert@x.com", role: "manager", declared: "certified_strength_coach", credential_type: "CSCS" });
const cody = await made({ name: "Cody Coach", email: "cody@x.com", role: "coach" });
const rex = await made({ name: "Rex Recruiter", email: "rex@x.com", role: "recruiter" });
const sam = await made({ name: "Sam Sponsor", email: "sam@x.com", role: "sponsor" });
const tm = await made({ name: "Tori Tournament", email: "tm@x.com", role: "tournament_manager" });
const gia = await made({ name: "Gia Gym", email: "gia@x.com", role: "gym_owner" });
sql("insert into athlete_relationships(athlete_id,member_id,relationship,can_view_academics,can_view_health,guardian_approved) select a.id,m.id,'parent',true,true,true from users a, users m where a.email='jordan@x.com' and m.email='maria@x.com'");
sql("delete from guardian_invites");
sql("select 1");
const jid = id("jordan@x.com");

// ---------- 1. no mock data anywhere ----------
const MOCK = /18\.4K|12,500|Dre Walker|Spring Hoops|Local Dealership|\$85K|Showcase Series|Maya Okafor|Eli Brandt|Lincoln High|Sneaker Brand/;
for (const [n, p] of Object.entries({ jordan, maria, ada, tina, mkt, cody, rex, sam, tm, gia })) {
  await p.goto(B + "/dashboard"); await settle(p);
  const t = await mainText(p); rec(!MOCK.test(t) && !/Application error|Internal Server Error/.test(t), `home (${n}) renders with no mock content`, t.slice(0, 120));
}
await see(await (async () => { await cody.goto(B + "/dashboard"); return cody; })(), /No athletes have added you yet/, "coach with no athletes sees honest empty state");
await see(await (async () => { await tm.goto(B + "/dashboard"); return tm; })(), /No upcoming events/, "tournament manager empty state");

// ---------- 2. academics ----------
await jordan.goto(B + "/dashboard/academics"); await settle(jordan);
await submit(jordan, { course: "Core Math", grade: "83" }, "Save grade");
await submit(jordan, { course: "core  math", grade: "74" }, "Save grade");
await submit(jordan, { course: "Chemistry", grade: "65" }, "Save grade");
await submit(jordan, { course: "English", grade: "101" }, "Save grade");
await see(jordan, /between 0 and 100/, "grade >100 rejected");
await see(jordan, /core math 74% -9/i, "course trend: latest vs previous (case-insens.)");
await see(jordan, /yellow Core Math dropped to 74%/i, "yellow alert at 74%");
await see(jordan, /red Chemistry at 65%/i, "red alert at 65%");
await submit(jordan, { subject: "Math", minutes: "60" }, "Log session");
await see(jordan, /Unverified/, "study session logged as unverified");
await see(jordan, /Not cleared/, "gate not cleared (no verified minutes)");
rec(await jordan.locator("main button:has-text('Verify')").count() === 0, "athlete has no Verify button on own sessions");
await maria.goto(B + "/dashboard/academics"); await settle(maria);
await see(maria, /Viewing Jordan Reyes/, "guardian sees linked athlete");
await notSee(maria, /Save grade|Log session/, "guardian can't enter grades/study");
await maria.locator("main button:has-text('Verify')").first().click(); await settle(maria);
await see(maria, /Verified by Maria Reyes/, "guardian verifies study session");
await jordan.goto(B + "/dashboard/academics"); await settle(jordan);
await submit(jordan, { subject: "Chem", minutes: "45" }, "Log session");
await maria.goto(B + "/dashboard/academics"); await settle(maria); await maria.locator("main button:has-text('Verify')").first().click(); await settle(maria);
await see(maria, /105/, "verified minutes = 105");
await see(maria, /Not cleared/, "still not cleared with a red alert");
await jordan.goto(B + "/dashboard/academics"); await settle(jordan);
await submit(jordan, { course: "Chemistry", grade: "82" }, "Save grade");
await see(jordan, /Cleared/, "cleared: verified minutes ≥ 90 and no red alerts");
await other.goto(B + `/dashboard/academics?athlete=${jid}`); await settle(other);
await see(other, /No athletes have shared academics with you/, "unlinked parent can't see academics via ?athlete=");

// ---------- 3. team connections ----------
await jordan.goto(B + "/dashboard/team"); await settle(jordan);
await see(jordan, /under 18, so your parent\/guardian manages/, "minor sees read-only team page");
await notSee(jordan, /Send invite/, "minor has no invite form");
await maria.goto(B + "/dashboard/team"); await settle(maria);
const invite = async (email, role, academics, health) => {
  await maria.goto(B + "/dashboard/team"); await settle(maria);
  const c = maria.locator("main .card", { has: maria.locator('h3:text-is("Invite someone")') });   // the Guardians panel has its own email field now
  await c.locator('[name="email"]').fill(email); await c.locator('[name="role"]').selectOption(role);
  academics ? await c.locator('[name="academics"]').check() : await c.locator('[name="academics"]').uncheck();
  health ? await c.locator('[name="health"]').check() : await c.locator('[name="health"]').uncheck();
  await c.locator('button:has-text("Send invite")').click(); await settle(maria);
};
await invite("cody@x.com", "coach", true, false);
await see(maria, /Invite sent to cody@x.com/, "guardian invites a coach (academics only)");
await invite("x@x.com", "coach", false, false); await see(maria, /at least one thing/, "invite needs something to share");
await invite("cody@x.com", "coach", true, false); await see(maria, /already a pending invite/, "duplicate pending invite blocked");
const codyLink = link("cody@x.com", /\/connect\/accept\?token=[\w-]+/);
rec(!!codyLink, "invite email contains accept link");
await sam.goto(B + codyLink); await settle(sam); await see(sam, /different account|for a coach/i, "wrong role can't use the invite");
await rex.goto(B + codyLink); await settle(rex); await see(rex, /different account|for a coach/i, "wrong person (recruiter) can't use it");
await cody.goto(B + codyLink); await settle(cody); await cody.locator("button:has-text('Accept')").click(); await settle(cody);
await see(cody, /now on this athlete's team/, "coach accepts invite");
await see(cody, /Jordan Reyes/, "coach roster shows Jordan");
rec(!/Training \(14d\)|Nutrition \(14d\)/.test(await mainText(cody)), "coach roster shows academics only (no health columns)");
await see(cody, /1 yellow|clear/, "coach sees alert summary");
rec((await status(cody, "/dashboard/nutrition")) === 404, "coach can't open nutrition (404)");
await cody.goto(B + "/dashboard/training"); await see(cody, /No athletes have shared training with you/, "coach sees no training without health consent");
const re1 = await newPage(); await re1.context().addCookies(await cody.context().cookies()); await re1.goto(B + codyLink); await see(re1, /invalid, expired or already used/, "invite link is single-use");

await invite("tina@x.com", "trainer", false, true); await invite("cert@x.com", "manager", true, true); await invite("mkt@x.com", "manager", false, true); await invite("rex@x.com", "recruiter", true, false);
for (const [p, e] of [[tina, "tina@x.com"], [cert, "cert@x.com"], [mkt, "mkt@x.com"], [rex, "rex@x.com"]]) {
  await p.goto(B + link(e, /\/connect\/accept\?token=[\w-]+/)); await settle(p); await p.locator("button:has-text('Accept')").click(); await settle(p);
}
rec(sql("select count(*) from athlete_relationships where athlete_id='" + jid + "' and relationship<>'parent'") === "5", "five team relationships created");

// ---------- 4. training ----------
await maria.goto(B + `/dashboard/training?athlete=${jid}`); await settle(maria);
await see(maria, /Season mode/, "guardian sees season control");
await maria.locator("main button:has-text('Switch to in-season')").click(); await settle(maria);
await tina.goto(B + `/dashboard/training?athlete=${jid}`); await settle(tina);
await see(tina, /Allowed phases right now: .*Dynamic Warmup.*Sport-Specific Skill/, "prescriber sees allowed phases");
rec(!/Plyometrics/.test((await mainText(tina)).match(/Allowed phases right now: [^.]*\./)?.[0] ?? ""), "in-season HS: plyometrics not allowed");
const workout = { title: "Deceleration day", focus: "First-step power", scheduled_date: today, ex0_phase: "strength", ex0_name: "Hex bar deadlift", ex0_sets: "4", ex0_reps: "5", ex0_intensity: "80% 1RM", ex0_tempo: "2-0-X-1", ex0_rest: "90", ex0_cue: "Drive through heels" };
await submit(tina, workout, "Assign workout");
await see(tina, /in-season high-school athletes are limited/, "in-season strength prescription REJECTED server-side");
rec(sql("select count(*) from athlete_workouts") === "0", "no workout row created when rejected");
await maria.goto(B + `/dashboard/training?athlete=${jid}`); await settle(maria);
await maria.locator("main button:has-text('Switch to off-season')").click(); await settle(maria);
await tina.goto(B + `/dashboard/training?athlete=${jid}`); await settle(tina);
await submit(tina, { ...workout, ex0_sets: "0" }, "Assign workout"); await see(tina, /sets must be 1–10/, "bad sets rejected");
await tina.goto(B + `/dashboard/training?athlete=${jid}`); await settle(tina);
await submit(tina, { ...workout, ex1_phase: "warmup", ex1_name: "Worlds greatest stretch", ex1_sets: "2", ex1_reps: "8", ex2_phase: "plyometrics", ex2_name: "Box jump", ex2_sets: "3", ex2_reps: "5", ex3_phase: "skill", ex3_name: "Pull-up threes", ex3_sets: "3", ex3_reps: "10" }, "Assign workout");
await see(tina, /Workout assigned/, "trainer assigns a workout off-season");
await tina.goto(B + `/dashboard/training?athlete=${jid}`); await settle(tina);
await submit(tina, { ...workout, title: "Tomorrow session", scheduled_date: addDays(today, 1) }, "Assign workout"); await see(tina, /Workout assigned/, "trainer schedules a future workout");
await mkt.goto(B + `/dashboard/training?athlete=${jid}`); await settle(mkt);
await notSee(mkt, /Prescribe a workout/, "marketing-agent manager can't prescribe");
await cert.goto(B + `/dashboard/training?athlete=${jid}`); await settle(cert); await see(cert, /Prescribe a workout/, "certified-coach manager can prescribe");
await jordan.goto(B + "/dashboard/training"); await settle(jordan);
await see(jordan, /Deceleration day/, "athlete sees the assigned workout");
const cards = jordan.locator("main .card", { hasText: "Deceleration day" });
await cards.locator("input[type=checkbox]").nth(0).check(); await cards.locator("input[type=checkbox]").nth(1).check();
await cards.locator("button:has-text('Complete workout')").click(); await settle(jordan);
await see(jordan, /50% of the plan completed/, "athlete completes 2 of 4 exercises → 50%");
rec(sql("select status||':'||adherence_score from athlete_workouts where title='Deceleration day'") === "completed:50.00", "adherence stored as 50.00");
await notSee(jordan, /Complete workout.*Tomorrow session|Tomorrow session.*Complete workout/, "future workout can't be completed early");
sql(`insert into athlete_workouts(athlete_id,prescribed_by,sport,workout_json,scheduled_date,title) select '${jid}', (select id from users where email='tina@x.com'),'Basketball','{\"exercises\":[{\"phase\":\"skill\",\"name\":\"x\",\"sets\":1,\"reps\":1}]}','${addDays(today, -2)}','Missed A'`);
sql(`insert into athlete_workouts(athlete_id,prescribed_by,sport,workout_json,scheduled_date,title) select '${jid}', (select id from users where email='tina@x.com'),'Basketball','{\"exercises\":[{\"phase\":\"skill\",\"name\":\"x\",\"sets\":1,\"reps\":1}]}','${addDays(today, -3)}','Missed B'`);
await tina.goto(B + `/dashboard/training?athlete=${jid}`); await settle(tina);
await see(tina, /2\+ sessions missed this week/, "two unfinished past workouts → missed alert");
await see(tina, /17% Average adherence 1 completed · 2 missed/, "adherence = mean over due workouts (50/3)");

// ---------- 5. nutrition ----------
await tina.goto(B + `/dashboard/nutrition?athlete=${jid}`); await settle(tina);
await submit(tina, { profile: "hypertrophy_power" }, "Create targets"); await see(tina, /Add height, weight and sex first/, "plan needs body details first");
await notSee(tina, /Save details/, "trainer can't edit body details");
await jordan.goto(B + "/dashboard/nutrition"); await settle(jordan);
await submit(jordan, { height_cm: "185", weight_kg: "80", sex: "male", activity_factor: "1.55" }, "Save details"); await see(jordan, /Details saved/, "athlete saves body details");
await submit(jordan, { profile: "lean_fast_twitch" }, "Create targets");
await see(jordan, /Plan updated/, "athlete creates a plan");
const age = Math.floor((Date.now() - Date.parse("2010-03-04")) / 31557600000);
const bmr = Math.round(10 * 80 + 6.25 * 185 - 5 * age + 5);
rec(sql("select bmr_kcal||':'||target_calories from nutrition_plans where active_until is null") === `${bmr}:${Math.round(bmr * 1.55)}`, `plan = formula (BMR ${bmr}, ×1.55)`, sql("select bmr_kcal||':'||target_calories from nutrition_plans"));
await tina.goto(B + `/dashboard/nutrition?athlete=${jid}`); await settle(tina);
await submit(tina, { profile: "hypertrophy_power" }, "Update targets"); await see(tina, /Plan updated/, "credentialed trainer sets the profile");
rec(sql("select count(*)||':'||count(*) filter (where active_until is null) from nutrition_plans") === "2:1", "old plan closed, one active plan");
await mkt.goto(B + `/dashboard/nutrition?athlete=${jid}`); await settle(mkt);
rec(await mkt.locator("main select[name=profile]").count() === 0, "marketing-agent manager can't set a plan");
const plan = sql("select target_calories||'/'||protein_grams from nutrition_plans where active_until is null").split("/");
sql(`update nutrition_plans set created_at = now() - interval '5 days' where active_until is null`);
const kcal = +plan[0], prot = +plan[1];
await jordan.goto(B + "/dashboard/nutrition"); await settle(jordan);
await submit(jordan, { meal_name: "Mega meal", calories: "9999", protein: "10", carbs: "10", fats: "10" }, "Log meal"); await see(jordan, /whole numbers/, "absurd calories rejected");
for (const back of [1, 2, 3]) {
  await jordan.goto(B + "/dashboard/nutrition"); await settle(jordan);
  await submit(jordan, { meal_name: `Full day ${back}`, calories: String(kcal), protein: String(prot), carbs: "300", fats: "80", logged_on: addDays(today, -back) }, "Log meal");
}
await jordan.goto(B + "/dashboard/nutrition"); await settle(jordan);
await see(jordan, /60%/, "compliance = 3 of 5 completed days = 60%");
await see(jordan, /3 of 5 completed days/, "compliance detail text");
await maria.goto(B + `/dashboard/nutrition?athlete=${jid}`); await settle(maria); await see(maria, /60%/, "guardian sees the same compliance");
rec((await status(cody, "/dashboard/nutrition")) === 404, "coach has no nutrition access");

// ---------- 6. dashboards on real data ----------
await jordan.goto(B + "/dashboard"); await settle(jordan);
await see(jordan, /Tomorrow session/, "athlete home: next workout is real");
await see(jordan, /Verified study minutes \(7d\) 105/, "athlete home: verified minutes");
await see(jordan, /Nutrition on target \(14d\) 60%/, "athlete home: nutrition compliance");
await see(jordan, /✅ Add body details/, "athlete checklist reflects real progress");
await maria.goto(B + "/dashboard"); await settle(maria); await see(maria, /Jordan Reyes.*Cleared/, "parent home: athlete row with gate");
await see(maria, /2\+ missed/, "parent home flags missed sessions");
await tina.goto(B + "/dashboard"); await settle(tina); await see(tina, /Jordan Reyes.*60%/, "trainer home: client row");
await see(tina, /Jordan Reyes missed 2\+ sessions this week/, "trainer home: needs-attention");
await see(tina, /CSCS.*self-declared/, "trainer credential shown as unverified");
await cert.goto(B + "/dashboard"); await settle(cert); await see(cert, /missed 2\+ sessions this week — intervene/, "manager home: intervene alert");
await see(cert, /certified strength coach/i, "manager home: declared role from DB");

// ---------- 7. recruiter board ----------
await jordan.goto(B + "/dashboard/deals"); await settle(jordan); await jordan.locator("main button:has-text('List me to sponsors')").click(); await settle(jordan);
await rex.goto(B + "/dashboard/athletes"); await settle(rex); await see(rex, /Jordan R\./, "recruiter directory abbreviates a minor");
await rex.locator("main button:has-text('Track')").click(); await settle(rex);
await see(rex, /Jordan Reyes|Jordan R\./, "recruiter board shows tracked athlete");
await see(rex, /Eligible|At risk/, "recruiter sees academics (shared via invite)");
rec(/Jordan Reyes/.test(await mainText(rex)), "full name shown because the family invited this recruiter");
await rex.locator("main select[name=stage]").selectOption("evaluating"); await rex.locator("main button:has-text('Save')").click(); await settle(rex);
rec(sql("select stage from recruiting_board") === "evaluating", "recruiter updates stage");
rec((await status(rex, "/dashboard/training")) === 404, "recruiter has no training access");

// ---------- 8. removing access ----------
await maria.goto(B + "/dashboard/team"); await settle(maria);
await maria.locator("main tr", { hasText: "cody@x.com" }).locator("button:has-text('Remove access')").click(); await settle(maria);
await see(maria, /Access removed/, "guardian removes the coach's access");
await cody.goto(B + "/dashboard"); await see(cody, /No athletes have added you yet/, "coach loses roster access immediately");
await cody.goto(B + `/dashboard/academics?athlete=${jid}`); await see(cody, /No athletes have shared academics/, "coach can't read academics after removal");
await jordan.goto(B + "/dashboard/team"); await settle(jordan);
rec(await jordan.locator("main button:has-text('Remove access')").count() === 0, "minor athlete can't remove team members themself");

// ---------- 9. other roles ----------
await tm.goto(B + "/dashboard/events"); await settle(tm);
await submit(tm, { name: "Fall Hoops Classic", sport: "Basketball", location: "Dallas", starts_on: addDays(today, 20) }, "Create draft"); await see(tm, /Fall Hoops Classic/, "tournament manager creates an event");
await tm.goto(B + "/dashboard/events"); await settle(tm);
await tm.locator("main select[name=status]").selectOption("published"); await tm.locator("main button:has-text('Update')").click(); await settle(tm);
await tm.goto(B + "/dashboard"); await see(tm, /Fall Hoops Classic.*published/, "tournament home lists the published event");
await sam.goto(B + "/dashboard"); await see(sam, /Open offers 0/, "sponsor pipeline computed from real deals");
await gia.goto(B + "/dashboard"); await see(gia, /Your offers/, "gym owner dashboard is the real pipeline");
rec((await status(ada, "/dashboard/team")) === 200, "adult athlete can open Team");
await ada.goto(B + "/dashboard/team"); await see(ada, /Send invite/, "adult athlete manages their own team");
console.log(`\n${fails ? fails + " FAILED" : "ALL PASSED"} (${total} checks)`);
await br.close();
