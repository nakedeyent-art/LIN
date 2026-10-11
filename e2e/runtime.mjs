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
