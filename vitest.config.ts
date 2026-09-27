import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/behavior/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    maxWorkers: 1,
    sequence: { concurrent: false },
  },
});
