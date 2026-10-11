import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const url = process.env.E2E_DATABASE_URL;
if (!url) throw new Error("E2E_DATABASE_URL is required: integration tests clear the disposable test database.");
const database = new URL(url);
if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || !/^\/[a-z0-9_]+_e2e$/.test(database.pathname)) {
  throw new Error("Integration tests require a local database ending in _e2e.");
}
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["tests/**/*.integration.test.ts"], maxWorkers: 1,
  env: { DATABASE_URL: url, MFA_ENCRYPTION_KEY: "", RESEND_API_KEY: "", STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "" } } });
