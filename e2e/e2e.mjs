import { chromium } from "playwright";
const B = "http://localhost:3112";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
const log = (k, v) => console.log(k.padEnd(34), v);
const text = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 110);

async function signup(page, f) {
  await page.goto(B + "/signup");
  await page.fill("[name=name]", f.name); await page.fill("[name=email]", f.email); await page.fill("[name=password]", f.password ?? "longenoughpw1");
  await page.check(`[name=role][value=${f.role}]`);
  for (const k of ["sport","position","birth_date","guardian_email"]) if (f[k]) await page.fill(`[name=${k}]`, f[k]);
  if (f.declared) await page.selectOption("[name=declared_role]", f.declared);
  await page.click("button[type=submit]");
  await page.waitForLoadState("networkidle");
}
const ctx = () => br.newContext();

// 1. unauthenticated redirect
let c = await ctx(), p = await c.newPage();
await p.goto(B + "/dashboard"); log("unauth /dashboard ->", new URL(p.url()).pathname);

// 2. minor athlete without guardian email is rejected
await signup(p, { name: "Kid", email: "kid@x.com", role: "athlete", sport: "Basketball", birth_date: "2012-01-01" });
log("minor w/o guardian", decodeURIComponent(new URL(p.url()).search));

// 3. valid minor athlete signup lands in athlete dashboard
await signup(p, { name: "Jordan Reyes", email: "jordan@x.com", role: "athlete", sport: "Basketball", position: "PG", birth_date: "2010-03-04", guardian_email: "mom@x.com" });
log("athlete signup ->", new URL(p.url()).pathname + " | " + await text(p));
await p.goto(B + "/dashboard/training"); log("athlete /training", (await text(p)).slice(0, 40));

// 4. cookie is httpOnly, token not stored raw
const ck = (await c.cookies()).find((x) => x.name === "lin_session");
log("cookie httpOnly/sameSite", `${ck.httpOnly}/${ck.sameSite}`);

// 5. logout invalidates the server-side session
const old = ck.value;
await p.click("text=Log out"); await p.waitForLoadState("networkidle"); log("after logout ->", new URL(p.url()).pathname);
const c2 = await ctx(); await c2.addCookies([{ name: "lin_session", value: old, url: B }]);
const p2 = await c2.newPage(); await p2.goto(B + "/dashboard"); log("replay old token ->", new URL(p2.url()).pathname);

// 6. duplicate email; manager needs declaration; parent can't open training
await signup(p, { name: "Dup", email: "JORDAN@x.com", role: "parent" }); log("duplicate email (case)", decodeURIComponent(new URL(p.url()).search));
await signup(p, { name: "Mgr", email: "mgr@x.com", role: "manager" }); log("manager w/o declaration", decodeURIComponent(new URL(p.url()).search));
await signup(p, { name: "Mgr", email: "mgr@x.com", role: "manager", declared: "marketing_agent" }); log("manager signup ->", new URL(p.url()).pathname);
await p.click("text=Log out"); await p.waitForLoadState("networkidle");
await signup(p, { name: "Pat", email: "pat@x.com", role: "parent" });
const r = await p.goto(B + "/dashboard/training"); log("parent /training status", r.status());
await p.click("text=Log out").catch(()=>{}); 

// 7. login: wrong pw message identical for unknown vs known; lockout after 5
async function login(email, pw) { await p.goto(B + "/login"); await p.fill("[name=email]", email); await p.fill("[name=password]", pw); await p.click("button[type=submit]"); await p.waitForLoadState("networkidle"); return decodeURIComponent(new URL(p.url()).search) || new URL(p.url()).pathname; }
log("unknown email", await login("nobody@x.com", "whateverpass1"));
log("wrong pw", await login("jordan@x.com", "wrongpassword1"));
for (let i = 0; i < 4; i++) await login("jordan@x.com", "wrongpassword1");
log("correct pw while locked", await login("jordan@x.com", "longenoughpw1"));
await br.close();
