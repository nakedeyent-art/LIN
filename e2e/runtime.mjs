import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DATABASE_URL = process.env.E2E_DATABASE_URL;
if (!DATABASE_URL) throw new Error("Set E2E_DATABASE_URL to a disposable local database whose name ends in _e2e. These suites delete test data.");
const database = new URL(DATABASE_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || !/^\/[a-z0-9_]+_e2e$/.test(database.pathname)) {
  throw new Error("E2E_DATABASE_URL must point to a local disposable database ending in _e2e.");
}
export const B = process.env.E2E_BASE_URL ?? "http://localhost:3113";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(B).hostname)) throw new Error("E2E_BASE_URL must be local.");
export const LOG = process.env.E2E_MAIL_LOG ?? resolve(ROOT, ".test-output/mail.log");
export const browserOptions = process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {};
export const sql = (q) => execFileSync("psql", [DATABASE_URL, "-X", "-At", "-q", "-v", "ON_ERROR_STOP=1"], { input: q, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
export const dbErr = (q) => {
  const r = spawnSync("psql", [DATABASE_URL, "-X", "-At", "-q", "-v", "ON_ERROR_STOP=1"], { input: q });
  return (r.stderr?.toString() ?? "") + (r.status ? ` [exit ${r.status}]` : "");
};
export const mk = (args) => spawnSync(process.execPath, ["scripts/" + args[0], ...args.slice(1)], { cwd: ROOT, env: { ...process.env, DATABASE_URL } });

/** Wait for the server action's streamed response, including a cold Next.js route compile. */
export async function submitAndWait(page, target) {
  const [response] = await Promise.all([
    page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).origin === new URL(B).origin),
    typeof target === "string" ? page.click(target) : target.click(),
  ]);
  const destination = response.headers()["x-action-redirect"]?.split(";")[0] ?? response.headers().location;
  if (destination) {
    const expected = new URL(destination, B);
    await page.waitForURL(url => url.pathname === expected.pathname && [...expected.searchParams].every(([key, value]) => url.searchParams.get(key) === value));
  }
  // Server action streams can stay open; callers assert the resulting UI state.
}

/**
 * Signs a deal's agreement through Forg3 as the given page's user: generates the agreement from the frozen contract when nobody has yet,
 * otherwise opens the live envelope; then begins signing, fills the signature field and submits. Recipients sign in order (sponsor first,
 * then the athlete side), and every step needs a recent second factor on that session (see mfa-helper.mjs → mfaEnrollAt).
 * Element waits rather than networkidle: the workspace keeps a PDF preview alive.
 */
export async function signDealViaForg3(p, dealUrl, name) {
  await p.goto(dealUrl + "/contract", { waitUntil: "domcontentloaded" });
  const gen = p.locator("main button:has-text('Review and sign with Forg3')"), open = p.locator("main a:has-text('Open Forg3 signing workspace')");
  await Promise.race([gen.waitFor({ timeout: 30000 }), open.waitFor({ timeout: 30000 })]);
  await Promise.all([p.waitForURL(/\/dashboard\/signing\//, { timeout: 60000 }), (await gen.count()) ? gen.click() : open.click()]);
  const begin = p.getByRole("button", { name: "Begin signing" }); await begin.waitFor({ timeout: 30000 }); await begin.click();
  await p.getByRole("heading", { name: "Complete your fields" }).waitFor({ timeout: 60000 });
  await p.locator("input[name^=field_]").fill(name); await p.locator("[name=consent]").check();
  await p.getByRole("button", { name: "Sign agreement", exact: true }).click();
  await p.getByText(/signed|completed/i).first().waitFor({ timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1000);
}
