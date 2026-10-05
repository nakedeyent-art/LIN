// Minimal forward-only migration runner. Usage: npm run db:migrate
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())");
const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(f)) continue;
  console.log("applying", f);
  try {
    await client.query("BEGIN");
    await client.query(readFileSync(join(dir, f), "utf8"));
    await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [f]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); console.error(e.message); process.exit(1); }
}
await client.end();
console.log("migrations up to date");
