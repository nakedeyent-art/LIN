import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["lib/**/*.test.ts"], maxWorkers: 4 } });
