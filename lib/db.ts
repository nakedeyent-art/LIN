import { Pool } from "pg";

const g = globalThis as unknown as { __pool?: Pool };

export function db(): Pool {
  if (!g.__pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see .env.example)");
    g.__pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return g.__pool;
}
