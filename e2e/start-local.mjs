import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { B, DATABASE_URL, LOG, ROOT } from "./runtime.mjs";

mkdirSync(dirname(LOG), { recursive: true });
const log = openSync(LOG, "w");
// Never inherit provider credentials: these tests use local mail and the local Stripe mock only.
const env = { ...process.env, DATABASE_URL, APP_URL: B, NODE_ENV: "development", RESEND_API_KEY: "", MFA_ENCRYPTION_KEY: "",
  CRON_SECRET: "test-cron-secret-0123456789abcdef", NEWS_ALLOW_LOCAL: "1", TRUST_PROXY: process.env.E2E_TRUST_PROXY ?? "", UPLOAD_SCANNER: process.env.E2E_UPLOAD_SCANNER ?? "",
  STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", STRIPE_API_BASE: "", PLATFORM_FEE_BPS: "0" };
if (process.env.E2E_PAYMENTS === "1") Object.assign(env, {
  STRIPE_SECRET_KEY: "sk_test_mock", STRIPE_WEBHOOK_SECRET: "whsec_test_secret", STRIPE_API_BASE: "http://localhost:4010",
});
const child = spawn(process.execPath, [resolve(ROOT, "node_modules/next/dist/bin/next"), "dev", "-p", new URL(B).port || "3113", "-H", "127.0.0.1"], { cwd: ROOT, env, stdio: ["ignore", log, log] });
console.log(`Test app: ${B}. Mail and server log: ${LOG}`);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
