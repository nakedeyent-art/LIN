import { mfaEnroll } from "./mfa-helper.mjs";
import { chromium } from "playwright";
import { execSync, spawnSync } from "node:child_process";
import http from "node:http";
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



const hours = (h) => new Date(Date.now() - h * 3600e3).toUTCString();
const item = (t, link, h, d = "") => `<item><title>${t}</title><link>${link}</link><pubDate>${hours(h)}</pubDate><description><![CDATA[${d}]]></description></item>`;
let feedItems = [
  item("Preseason rankings: high school football top 25 released", "https://ex.com/rank-hs", 2, "<p>Powerhouse programs dominate the <b>top 25</b></p>"),
  item("Four-star guard to reclassify and join the class of 2026", "https://ex.com/reclass", 5, "A basketball prospect makes a surprise move"),
  item("College football senior day: graduating seniors honoured", "https://ex.com/senior", 30, "NCAA seniors say goodbye"),
  item("Star linebacker will redshirt this season", "https://ex.com/red", 50, "College football depth chart news"),
  item("State champion dynasty adds another title", "https://ex.com/power", 1, "High school volleyball"),
  item("Coach announces new training facility", "https://ex.com/general", 3, "Ribbon cutting next week"),
  item("&lt;script&gt;alert(1)&lt;/script&gt; XSS headline test", "https://ex.com/xss", 4, "<img src=x onerror=alert(1)>"),
  `<item><title>Bad link story</title><link>javascript:alert(1)</link><pubDate>${hours(1)}</pubDate></item>`,
];
let hits = 0;
const srv = http.createServer((req, res) => {
  hits++;
  if (req.url === "/feed.xml") { res.setHeader("content-type", "application/rss+xml"); res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>${feedItems.join("")}</channel></rss>`); }
  else if (req.url === "/redirect.xml") { res.statusCode = 302; res.setHeader("location", "/feed.xml"); res.end(); }
  else if (req.url === "/html") { res.end("<html><body>not a feed</body></html>"); }
  else if (req.url === "/big.xml") { res.end("<rss><channel>" + "x".repeat(1_500_000)); }
  else { res.statusCode = 404; res.end("no"); }
}).listen(4020);

sql("truncate users cascade; truncate news_sources cascade; truncate job_runs");
const sam = await made({ name: "Sam Sponsor", email: "sam@x.com", role: "sponsor" });
const jordan = await made({ name: "Jordan Reyes", email: "jordan@x.com", role: "athlete", sport: "Basketball", birth_date: "2010-03-04", guardian_email: "maria@x.com" });
const root = await made({ name: "Root Admin", email: "root@x.com", role: "parent" });
spawnSync("node", ["scripts/make-admin.mjs", "root@x.com"], { cwd: "/home/user/LIN", env: { ...process.env, DATABASE_URL: "postgres://lin:lin@localhost:5432/lin" } });
await mfaEnroll(root, B);
const adminForm = async (p, title, vals, button) => { const c = p.locator("main .card", { has: p.locator(`h3:text-is("${title}")`) });
  for (const [k, v] of Object.entries(vals)) await c.locator(`[name="${k}"]`).fill(v); await c.locator(`button:has-text("${button}")`).click(); await settle(p); };
const news = async (p, qs = "") => { await p.goto(`${B}/dashboard/news${qs}`); await settle(p); return text(p); };

// ===== access =====
rec((await status(sam, "/admin/news")) === 404, "non-admins get 404 on the news admin page");
await news(sam); await see(sam, /Nothing matches[\s\S]*no news sources/i, "empty state mentions that no sources are set up");
rec((await sam.locator(".side nav a:has-text('News')").count()) === 1 && (await jordan.locator(".side nav a:has-text('News')").count()) === 1, "News is in everyone's navigation");

// ===== adding sources =====
await root.goto(B + "/admin/news"); await settle(root);
await adminForm(root, "Add a source", { name: "Mock Prep Report", feed_url: "http://example.com/feed.xml", reason: "Trusted local publisher", password: OLD }, "Add and fetch");
await see(root, /must use https/, "plain http feeds are refused");
await root.locator("main .card", { has: root.locator("h3:text-is('Add a source')") }).locator("[name=reason]").evaluate((i) => i.removeAttribute("minlength"));
await adminForm(root, "Add a source", { name: "Mock Prep Report", feed_url: "http://localhost:4020/feed.xml", reason: "x", password: OLD }, "Add and fetch");
await see(root, /Give a reason/, "a reason is required");
await adminForm(root, "Add a source", { name: "Mock Prep Report", feed_url: "http://localhost:4020/feed.xml", reason: "Trusted local test publisher", password: "wrong-password-x" }, "Add and fetch");
await see(root, /password is incorrect/, "admin password re-checked");
rec(sql("select count(*) from news_sources") === "0", "nothing added by failed attempts");
await adminForm(root, "Add a source", { name: "Mock Prep Report", feed_url: "http://localhost:4020/feed.xml", reason: "Trusted local test publisher", password: OLD }, "Add and fetch");
await see(root, /First fetch found 7 stories \(7 new\)/, "first fetch stores valid stories and drops the javascript: one");
rec(sql("select count(*) from news_items") === "7", "7 items stored");
rec(sql("select count(*) from news_items where url like 'javascript:%'") === "0", "no javascript: links stored");
await adminForm(root, "Add a source", { name: "Dup", feed_url: "http://localhost:4020/feed.xml", reason: "Trying a duplicate feed", password: OLD }, "Add and fetch");
await see(root, /already added/, "duplicate feeds refused");

// ===== tagging =====
const tag = (like) => sql(`select categories::text||'|'||coalesce(level,'-')||'|'||coalesce(sport,'-') from news_items where title like '${like}'`);
rec(/rankings/.test(tag("Preseason%")) && /high_school/.test(tag("Preseason%")) && /football/.test(tag("Preseason%")), "rankings story tagged with level and sport", tag("Preseason%"));
rec(/reclassification/.test(tag("Four-star%")) && /basketball/.test(tag("Four-star%")), "reclassification tagged");
rec(/graduating_seniors/.test(tag("College football senior%")) && /\|college\|/.test(tag("College football senior%")), "graduating seniors tagged, college level");
rec(/redshirt/.test(tag("Star linebacker%")), "redshirt tagged");
rec(/powerhouse/.test(tag("State champion%")) && /volleyball/.test(tag("State champion%")), "powerhouse tagged");
rec(tag("Coach announces%").startsWith("{general}"), "untagged story is general");

// ===== the page =====
let t = await news(sam);
rec(/Preseason rankings/.test(t) && /Coach announces/.test(t) && /7 stories/i.test(t), "everyone sees the stories", t.slice(0, 200));
rec(/Mock Prep Report/.test(t), "source name is shown");
rec((await sam.locator("main a[href='https://ex.com/rank-hs']").getAttribute("rel")) === "noopener noreferrer nofollow" && (await sam.locator("main a[href='https://ex.com/rank-hs']").getAttribute("target")) === "_blank", "external links open safely");
rec((await sam.locator("main script").count()) === 0 && (await sam.locator("main img").count()) === 0 && t.includes("<script>alert(1)</script>"), "markup in headlines/excerpts is shown as text, never run");
rec(!/Bad link story/.test(t), "the javascript: story never appears");
rec(/top 25/i.test(t) && !/<b>/.test(t), "summaries are plain text");
const order = await sam.locator("main li strong").allInnerTexts();
rec(order[0].startsWith("State champion") && order[1].startsWith("Preseason"), "newest first", order.join(" | "));
// filters
t = await news(sam, "?cat=rankings"); rec(/Preseason rankings/.test(t) && !/Coach announces/.test(t), "filter by topic");
t = await news(sam, "?cat=reclassification&cat=redshirt"); rec(/Four-star/.test(t) && /Star linebacker/.test(t) && !/Preseason/.test(t), "multiple topics are ORed");
t = await news(sam, "?level=college"); rec(/senior day/i.test(t) && !/Preseason rankings/.test(t), "filter by level");
t = await news(sam, "?sport=volleyball"); rec(/State champion/.test(t) && !/Preseason/.test(t), "filter by sport");
t = await news(sam, "?q=facility"); rec(/Coach announces/.test(t) && !/Preseason/.test(t), "search headlines");
t = await news(sam, "?q=%25_"); rec(/Nothing matches/.test(t), "wildcard characters are literal in search");
t = await news(sam, "?days=1"); rec(/Preseason rankings/.test(t) && !/Star linebacker/.test(t) && !/senior day/i.test(t), "'Today' keeps only the last 24 hours");
t = await news(sam, "?cat=bogus&level=nope&sport=curling&days=abc"); rec(/7 stories/i.test(t), "unknown filter values are ignored");
t = await news(sam, "?cat=rankings&level=college"); rec(/Nothing matches/.test(t), "combined filters AND together");
// saved filters
await news(sam, "?cat=reclassification&sport=basketball");
await sam.locator("main button:has-text('Save as my default')").click(); await settle(sam);
await see(sam, /These filters are now your default/, "filters saved");
t = await news(sam); rec(/Four-star/.test(t) && !/Preseason/.test(t) && /Showing your saved filters/.test(t), "saved filters apply by default");
rec(sql(`select categories::text||levels::text||sports::text from news_prefs`) === "{reclassification}{}{basketball}", "stored as chosen");
t = await news(sam, "?all=1"); rec(/7 stories/i.test(t), "'Show everything' overrides the saved filters");
t = await news(jordan); rec(/7 stories/i.test(t), "another user's saved filters don't affect me");
await sam.goto(B+"/dashboard/news"); await settle(sam);
await sam.goto(B+"/dashboard/news?cat=rankings"); await settle(sam);
await sam.locator("main button:has-text('Save as my default')").click(); await settle(sam);
await news(sam, "?cat=rankings&sport=football"); await sam.locator("main button:has-text('Forget my saved filters')").click(); await settle(sam);
rec(sql("select count(*) from news_prefs") === "0", "saved filters can be forgotten");
rec((await sam.locator("main button:has-text('Save as my default')").count()) === 1, "form still available");

// ===== dedupe, refetch, cron =====
sql("update news_sources set last_fetched_at = now() - interval '1 hour'");
const r1 = await cron();
rec(r1.jobs?.["news-ingest"] && r1.jobs["news-ingest"].processed === 0 && r1.jobs["news-ingest"].failed === 0, "cron re-fetch adds nothing new (dedupe by link)", JSON.stringify(r1.jobs?.["news-ingest"]));
feedItems.push(item("New high school basketball rankings update", "https://ex.com/new1", 0, "Fresh"));
sql("update news_sources set last_fetched_at = now() - interval '1 hour'");
const r2 = await cron();
rec(r2.jobs["news-ingest"].processed === 1, "…and picks up a new story", JSON.stringify(r2.jobs["news-ingest"]));
feedItems.push(item("Another story that should not be fetched yet", "https://ex.com/new2", 0));
const before = hits; const r3 = await cron();
rec(hits === before && r3.jobs["news-ingest"].processed === 0, "a source isn't fetched again within 30 minutes");

// ===== failing sources =====
await adminForm(root, "Add a source", { name: "Not a feed", feed_url: "http://localhost:4020/html", reason: "Testing a bad feed", password: OLD }, "Add and fetch");
await root.goto(B + "/admin/news"); await settle(root);
rec(/not an RSS or Atom feed|not valid XML/.test(sql("select last_status from news_sources where name='Not a feed'")), "a bad feed's error is recorded briefly", sql("select last_status from news_sources where name='Not a feed'"));
await adminForm(root, "Add a source", { name: "Too big", feed_url: "http://localhost:4020/big.xml", reason: "Testing an oversized feed", password: OLD }, "Add and fetch");
rec(/too large/.test(sql("select last_status from news_sources where name='Too big'")), "oversized responses are refused");
await adminForm(root, "Add a source", { name: "Redirector", feed_url: "http://localhost:4020/redirect.xml", reason: "Testing a redirect source", password: OLD }, "Add and fetch");
rec(sql("select last_status from news_sources where name='Redirector'") === "ok", "redirects are followed");
sql("update news_sources set failures = 9 where name='Not a feed'; update news_sources set last_fetched_at = now() - interval '1 hour' where name='Not a feed'");
const r4 = await cron();
rec(sql("select active::text from news_sources where name='Not a feed'") === "false", "a source that keeps failing is switched off");
rec(r4.status === "ok", "a flaky third-party source doesn't make the job fail", JSON.stringify(r4));
await root.goto(B + "/admin/news"); await settle(root);
await see(root, /Not a feed[\s\S]*off/i, "admin sees it as off");

// ===== editorial + hide =====
await root.goto(B + "/admin/news"); await settle(root);
await root.locator("main .card", { has: root.locator("h3:text-is('Post an editorial item')") }).locator("input[name=cat][value=graduating_seniors]").check();
await adminForm(root, "Post an editorial item", { title: "LIN spotlight: senior class signing day guide", summary: "What families need to know.", reason: "Weekly editorial item", password: OLD }, "Post");
await see(root, /Posted/, "editorial item posted");
t = await news(sam, "?cat=graduating_seniors"); rec(/LIN spotlight/.test(t), "editorial item appears under its topic");
rec((await sam.locator("main a:has-text('LIN spotlight')").count()) === 0, "editorial items have no outbound link");
const eid = sql("select id from news_items where source_name='LIN'");
await root.goto(B + "/admin/news"); await settle(root);
await root.locator("summary", { hasText: "Preseason rankings" }).click();
const det = root.locator("details", { hasText: "Preseason rankings" });
await det.locator("[name=reason]").fill("Inappropriate for the audience"); await det.locator("[name=password]").fill(OLD); await det.locator("button:has-text('Hide')").click(); await settle(root);
t = await news(sam); rec(!/Preseason rankings/.test(t), "a hidden story disappears for users");
rec(sql("select count(*) from admin_audit where action in ('news_source_add','news_editorial','news_hide')") >= "5", "source/editorial/hide actions are audited");

// ===== pagination =====
for (let i = 0; i < 25; i++) sql(`insert into news_items(url,source_name,title,published_at,categories) values ('https://ex.com/p${i}','Bulk','Bulk story number ${i}', now() - interval '${i + 10} minutes','{general}')`);
t = await news(sam, "?q=Bulk"); rec(/Older →/.test(t) && !/← Newer/.test(t), "first page offers Older");
await sam.locator("main a:has-text('Older')").click(); await settle(sam);
rec(/← Newer/.test(await text(sam)) && /Bulk story/.test(await text(sam)), "page 2 works");
t = await news(sam, "?q=Bulk&page=999"); rec(!/Application error/i.test(t), "an absurd page number is clamped");

// ===== deletion =====
srv.close();
console.log(fails ? `\n${fails} FAILED (${total} checks)` : `\nALL PASSED (${total} checks)`);
await br.close(); process.exit(fails ? 1 : 0);
