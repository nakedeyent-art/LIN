import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

// Next.js refuses to compile a "use server" file that exports anything but async functions
// (e.g. a shared constant) — and `tsc` doesn't notice. Keep such values in lib/.
describe('"use server" files', () => {
  const files = walk("app").filter((f) => /\.(ts|tsx)$/.test(f) && /^\s*["']use server["']/.test(readFileSync(f, "utf8")));
  it("finds the server-action files", () => expect(files.length).toBeGreaterThan(5));
  for (const f of files) {
    it(`${f} exports only async functions`, () => {
      const bad = readFileSync(f, "utf8").split("\n").filter((l) => /^export\s/.test(l) && !/^export\s+async\s+function\s/.test(l));
      expect(bad).toEqual([]);
    });
  }
});
