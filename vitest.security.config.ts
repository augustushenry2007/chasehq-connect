import { defineConfig } from "vitest/config";

// Separate Vitest config for security contract tests so the main `test`
// script (unit tests) doesn't pull in the slower, network-dependent suite
// and so CI can run it on its own schedule.
export default defineConfig({
  test: {
    include: ["tests/security/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks", // contract tests share no state; isolate processes
    reporters: "default",
  },
});
