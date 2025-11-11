import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup-test-env.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["app/utils/**/*.ts"]
    }
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "app")
    }
  }
});
