import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { B, sql, browserOptions } from './runtime.mjs';
const q = (s) => "'" + s.replaceAll("'", "''") + "'";
sql('TRUNCATE users CASCADE');
const user = (name, email, role) => sql(`INSERT INTO users(email,full_name,role,password_hash,email_verified_at) VALUES(${q(email)},${q(name)},${q(role)},'fixture',now()) RETURNING id`);
const athlete = user('Jordan Reyes','jordan@example.test','athlete'), guardian = user('Maria Reyes','maria@example.test','parent'), sponsor = user('Sam Sponsor','sam@example.test','sponsor');
sql(`INSERT INTO athlete_profiles(user_id,sport,position,level,birth_date,discoverable,grad_year) VALUES('${athlete}','Basketball','PG','high_school',CURRENT_DATE-INTERVAL '16 years',true,2028)`);
sql(`INSERT INTO athlete_relationships(athlete_id,member_id,relationship,guardian_approved,can_view_academics,can_view_health) VALUES('${athlete}','${guardian}','parent',true,true,true)`);
sql(`INSERT INTO academic_logs(athlete_id,course_name,current_grade) VALUES('${athlete}','Core Math',88),('${athlete}','Chemistry',74)`);
sql(`INSERT INTO study_sessions(athlete_id,subject,minutes,studied_on,verified_at,verified_by) VALUES('${athlete}','Math',60,CURRENT_DATE,now(),'${guardian}')`);
const deal = sql(`INSERT INTO deals(athlete_id,counterparty_id,title,amount_cents,deliverables,status,attested_at,expires_at) VALUES('${athlete}','${sponsor}','Camp appearance',150000,'Two Instagram posts and one in-store appearance in November.','guardian_review',now(),now()+interval '10 days') RETURNING id`);
const ev = sql(`INSERT INTO events(organizer_id,name,starts_on,status) VALUES('${guardian}','Saturday showcase','2027-01-10','published') RETURNING id`);
const venue = sql(`INSERT INTO sports_venues(created_by,name,address) VALUES('${guardian}','Lincoln Fieldhouse','400 Court St, Austin TX') RETURNING id`);
sql(`INSERT INTO sports_event_details(event_id,kind,starts_at,ends_at,venue_id,timezone) VALUES('${ev}','showcase','2027-01-10T20:00Z','2027-01-10T23:00Z','${venue}','America/Chicago')`);
sql(`INSERT INTO sports_attendees(event_id,athlete_id,guardian_consent_by,guardian_consent_at) VALUES('${ev}','${athlete}','${guardian}',now())`);
sql(`INSERT INTO notifications(user_id,kind,title,href) VALUES('${athlete}','deal','New offer: "Camp appearance"','/dashboard/deals/${deal}')`);
const br = await chromium.launch(browserOptions);
async function shots(id, label, paths, width) {
  const ctx = await br.newContext({ viewport: { width, height: 900 } });
  const token = createHash('sha256').update(label + Date.now()).digest('hex'), hash = createHash('sha256').update(token).digest('hex');
  sql(`INSERT INTO sessions(token_hash,user_id,expires_at,mfa_verified_at) VALUES('${hash}','${id}',now()+INTERVAL '1 day',now())`);
  await ctx.addCookies([{ name: 'lin_session', value: token, url: B }]);
  const p = await ctx.newPage();
  for (const [name, path] of paths) { await p.goto(B + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(800); await p.screenshot({ path: `.test-output/design-baseline/${label}-${name}-${width}.png`, fullPage: true }); console.log('shot', label, name, width); }
  await ctx.close();
}
for (const width of [1280, 390]) {
  await shots(athlete, 'athlete', [['home','/dashboard'],['schedule',`/dashboard/schedule?athlete=${athlete}`],['deal',`/dashboard/deals/${deal}`],['feed','/dashboard/feed']], width);
  await shots(guardian, 'parent', [['home','/dashboard'],['deal',`/dashboard/deals/${deal}`],['operations',`/dashboard/operations/${athlete}`]], width);
  await shots(sponsor, 'sponsor', [['home','/dashboard'],['deal',`/dashboard/deals/${deal}`]], width);
}
await br.close();
