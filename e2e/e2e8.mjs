import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
const PHASE = process.argv[2] ?? "1";
const B = "http://localhost:3113", SECRET = "test-cron-secret-0123456789abcdef";
let fails = 0, total = 0;
const rec = (ok, k, extra = "") => { total++; if (!ok) fails++; console.log((ok ? "PASS " : "FAIL ") + k.padEnd(72) + (ok ? "" : String(extra).slice(0, 200))); };
const sql = (q) => execSync(`su postgres -c "psql lin -At -q"`, { input: q }).toString().trim();
const START = readFileSync("/tmp/claude-0/mail.log", "utf8").length;
const mails = () => readFileSync("/tmp/claude-0/mail.log", "utf8").slice(START).split("[mail:dev]").filter((m) => m.includes(" to="));
const mailsTo = (to) => mails().filter((m) => m.includes(`to=${to} `));
const run = async (qs = "", method = "POST", headers = { Authorization: `Bearer ${SECRET}` }) => {
  const r = await fetch(`${B}/api/cron/daily${qs}`, { method, headers }); return { status: r.status, json: await r.json().catch(() => null) };
};
const mkUser = (email, name, role, o = {}) => sql(`insert into users(email,full_name,role,password_hash,email_verified_at,created_at) values ('${email}','${name}','${role}','!x',${o.unverified ? "null" : "now()"},${o.created ?? "now()"}) returning id`);
const mkAthlete = (email, name, birth, created) => { const id = mkUser(email, name, "athlete", { created }); sql(`insert into athlete_profiles(user_id,sport,level,birth_date) values ('${id}','Basketball','college',${birth})`); return id; };
const guard = (athlete, g) => sql(`insert into athlete_relationships(athlete_id,member_id,relationship,can_view_academics,can_view_health,guardian_approved) values ('${athlete}','${g}','parent',true,true,true)`);
const state = (email) => sql(`select (adult_notice_sent_at is not null)::text||':'||adult_notice_attempts from athlete_profiles where user_id=(select id from users where email='${email}')`);
const D = (days) => `(current_date - interval '18 years' - interval '${days} days')::date`;   // turned 18 `days` ago (negative = in the future)

if (PHASE === "1") {
  sql("truncate users cascade; truncate job_runs");
  const sam = mkUser("sam@x.com", "Sam Sponsor", "sponsor");
  // --- Jordan: the one who should get emails ---
  const jordan = mkAthlete("jordan@x.com", "Jordan Reyes", D(3), "now() - interval '400 days'");
  const maria = mkUser("maria@x.com", "Maria Reyes", "parent"), dan = mkUser("dan@x.com", "Dan Reyes", "parent"), ursula = mkUser("ursula@x.com", "Ursula Unverified", "parent", { unverified: true });
  guard(jordan, maria); guard(jordan, dan); guard(jordan, ursula);
  sql(`insert into guardian_invites(athlete_id,guardian_email,status,token_hash,expires_at) values ('${jordan}','later@x.com','pending','tokhash1', now()+interval '5 days')`);
  for (const t of ["Deal A", "Deal B"]) sql(`insert into deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at) values ('${jordan}','${sam}','${t}',100000,'Two posts and an appearance in November','guardian_review',now(), now()+interval '10 days')`);
  // --- people who must NOT be emailed ---
  const stale = mkAthlete("stale@x.com", "Stale Athlete", D(90), "now() - interval '3 years'"); guard(stale, mkUser("zed@x.com", "Zed Parent", "parent"));
  mkAthlete("joinedadult@x.com", "Joined Adult", `(current_date - interval '20 years')::date`, "now() - interval '1 day'");
  const noguard = mkAthlete("noguard@x.com", "No Guardian", D(2), "now() - interval '1 year'");
  sql(`insert into guardian_invites(athlete_id,guardian_email,status,token_hash,expires_at) values ('${noguard}','old@x.com','pending','tokhash2', now()+interval '5 days')`);
  mkAthlete("tomorrow@x.com", "Turns Tomorrow", D(-1), "now() - interval '1 year'");
  mkAthlete("minor@x.com", "Still Minor", `(current_date - interval '15 years')::date`, "now() - interval '1 year'");
  const del = mkAthlete("deleted@x.com", "Deleted One", D(1), "now() - interval '1 year'"); sql(`update users set deleted_at=now() where id='${del}'`);

  // ---- auth ----
  rec((await run("", "POST", {})).status === 401, "no Authorization header → 401");
  rec((await run("", "POST", { Authorization: "Bearer wrong-secret-wrong-secret-1" })).status === 401, "wrong secret → 401");
  rec((await run("", "POST", { Authorization: SECRET })).status === 401, "secret without 'Bearer' → 401");
  rec(sql("select count(*) from job_runs") === "0" && mails().length === 0, "denied calls did nothing");

  // ---- dry run ----
  const dry = await run("?dry=1");
  rec(dry.status === 200 && dry.json?.dry === true, "dry run is accepted", JSON.stringify(dry));
  rec(JSON.stringify(dry.json?.jobs?.["adult-transition"]) === JSON.stringify({ processed: 1, skipped: 3, failed: 0 }), "dry run reports 1 to process, 3 to skip", JSON.stringify(dry.json));
  await new Promise((r) => setTimeout(r, 800));
  rec(mails().length === 0, "dry run sent no email");
  rec(sql("select count(*) from athlete_profiles where adult_notice_sent_at is not null and user_id in (select id from users where email like '%@x.com')") === "0", "dry run marked nobody");
  rec(sql("select count(*) from job_runs") === "0" && sql("select count(*) from guardian_events") === "0", "dry run wrote no run log or audit rows");
  rec(sql("select count(*) from guardian_invites where status='pending'") === "2", "dry run revoked no invites");

  // ---- real run ----
  const r1 = await run();
  rec(r1.status === 200 && r1.json?.status === "ok", "real run succeeds", JSON.stringify(r1));
  rec(JSON.stringify(r1.json?.jobs?.["adult-transition"]) === JSON.stringify({ processed: 1, skipped: 3, failed: 0 }), "1 processed, 3 skipped", JSON.stringify(r1.json));
  await new Promise((r) => setTimeout(r, 800));
  const jm = mailsTo("jordan@x.com"), mm = mailsTo("maria@x.com"), dm = mailsTo("dan@x.com");
  rec(jm.length === 1 && /You're 18/.test(jm[0]) && /2 deals were waiting/.test(jm[0]), "athlete gets one email mentioning the 2 pending deals", jm[0]?.slice(0, 200));
  rec(mm.length === 1 && dm.length === 1 && /Jordan Reyes turned 18/.test(mm[0]) && /guardian role on LIN has ended/.test(dm[0]), "each verified guardian gets one email");
  rec(mailsTo("ursula@x.com").length === 0, "unverified guardian is not emailed");
  rec(["stale", "joinedadult", "noguard", "tomorrow", "minor", "deleted", "zed", "later", "old"].every((n) => mailsTo(`${n}@x.com`).length === 0), "nobody else was emailed (stale / joined-as-adult / no guardian / not yet 18 / minor / deleted)");
  rec(!mails().some((m) => /\$\d|100000/.test(m)), "no amounts in any email");
  rec(state("jordan@x.com") === "true:1", "Jordan marked processed (1 attempt)", state("jordan@x.com"));
  rec(["stale@x.com", "joinedadult@x.com", "noguard@x.com"].every((e) => state(e).startsWith("true:0")), "skipped athletes are marked done without attempts");
  rec(["tomorrow@x.com", "minor@x.com", "deleted@x.com"].every((e) => state(e).startsWith("false")), "not-yet-18, minors and deleted accounts are left untouched");
  rec(sql("select count(*) from guardian_invites where status='pending'") === "0", "pending guardian invites for newly-adult athletes were revoked");
  rec(sql("select count(*)||':'||min(detail) from guardian_events where action='adult_transition'") === "1:turned 18; guardian authority ended", "one audit entry for the transition");
  rec(sql("select status||':'||processed||':'||skipped||':'||failed from job_runs where job='adult-transition'") === "ok:1:3:0", "run recorded in job_runs", sql("select * from job_runs"));
  rec(sql("select count(*) from deals where status='guardian_review'") === "2", "deals are left for the athlete to decide (job doesn't touch them)");

  // ---- idempotent ----
  const before = mails().length;
  const r2 = await run("", "GET");
  await new Promise((r) => setTimeout(r, 800));
  rec(JSON.stringify(r2.json?.jobs?.["adult-transition"]) === JSON.stringify({ processed: 0, skipped: 0, failed: 0 }), "second run (GET) finds nothing to do", JSON.stringify(r2.json));
  rec(mails().length === before, "second run sent no email");

  // ---- overlapping triggers can't double-send ----
  const racers = [];
  for (let i = 0; i < 12; i++) { const a = mkAthlete(`racer${i}@x.com`, `Racer ${i}`, D(1), "now() - interval '1 year'"); guard(a, mkUser(`rp${i}@x.com`, `Racer Parent ${i}`, "parent")); racers.push(i); }
  const base = mails().length;
  const [x, y, z] = await Promise.all([run(), run(), run()]);
  await new Promise((r) => setTimeout(r, 1200));
  const statuses = [x, y, z].map((r) => r.json?.status);
  rec(statuses.filter((s) => s === "ok").length >= 1, "at least one overlapping run did the work", JSON.stringify(statuses));
  const dup = racers.some((i) => mailsTo(`racer${i}@x.com`).length !== 1 || mailsTo(`rp${i}@x.com`).length !== 1);
  rec(!dup, "three simultaneous triggers still sent exactly one email per person", racers.map((i) => mailsTo(`racer${i}@x.com`).length + "/" + mailsTo(`rp${i}@x.com`).length).join(" "));
  rec(statuses.includes("skipped_locked") || statuses.filter((s) => s === "ok").length === 3, `overlap handled via lock (statuses: ${statuses.join(",")})`);
  rec(mails().length - base === 24, "exactly 24 emails for 12 athletes + 12 guardians", mails().length - base);
  rec(racers.every((i) => state(`racer${i}@x.com`) === "true:1"), "every racer marked done with exactly 1 attempt");
  rec(sql("select count(*) from guardian_events where action='adult_transition'") === "13", "one audit entry per athlete (13)");
}

if (PHASE === "2") {   // server running with a RESEND_API_KEY that can't deliver → every send fails
  sql("truncate users cascade; truncate job_runs");
  const flaky = mkAthlete("flaky@x.com", "Flaky Athlete", D(2), "now() - interval '1 year'"); guard(flaky, mkUser("fp@x.com", "Flaky Parent", "parent"));
  const r1 = await run();
  rec(JSON.stringify(r1.json?.jobs?.["adult-transition"]) === JSON.stringify({ processed: 0, skipped: 0, failed: 1 }) && r1.json?.status === "failed", "failed delivery is reported as failed", JSON.stringify(r1.json));
  rec(state("flaky@x.com") === "false:1", "athlete stays unmarked with attempts=1 (will retry)", state("flaky@x.com"));
  rec(sql("select count(*) from guardian_events where action='adult_transition'") === "1", "audit entry written once");
  rec(sql("select status||':'||failed from job_runs where job='adult-transition' order by started_at limit 1") === "failed:1", "failure recorded in job_runs");
  const r2 = await run();
  rec(state("flaky@x.com") === "false:2", "second run retries (attempts=2)", state("flaky@x.com"));
  rec(sql("select count(*) from guardian_events where action='adult_transition'") === "1", "retry does not duplicate the audit entry");
  sql("update athlete_profiles set adult_notice_attempts = 4 where user_id=(select id from users where email='flaky@x.com')");
  const r3 = await run();
  rec(JSON.stringify(r3.json?.jobs?.["adult-transition"]?.failed) === "1" && state("flaky@x.com") === "true:5", "after the 5th failure the job gives up and marks it done", state("flaky@x.com"));
  const r4 = await run();
  rec(JSON.stringify(r4.json?.jobs?.["adult-transition"]) === JSON.stringify({ processed: 0, skipped: 0, failed: 0 }), "given-up athletes are not retried forever", JSON.stringify(r4.json));
  rec(!/flaky@x\.com|fp@x\.com/.test(sql("select coalesce(string_agg(coalesce(error,''),','),'') from job_runs")), "job_runs contains no email addresses");
}
console.log(`\n${fails ? fails + " FAILED" : "ALL PASSED"} (${total} checks)`);
