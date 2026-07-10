import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const packageSource = (name: string) =>
  resolve(import.meta.dirname, "packages", name, "src", "index.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@pharmassist/contracts": packageSource("contracts"),
      "@pharmassist/domain": packageSource("domain"),
      "@pharmassist/normalizer": packageSource("normalizer"),
      "@pharmassist/safety": packageSource("safety"),
      "@pharmassist/retrieval": packageSource("retrieval"),
      "@pharmassist/runtime": packageSource("runtime"),
      "@pharmassist/test-fixtures": packageSource("test-fixtures"),
      "@pharmassist/observability": packageSource("observability"),
    },
  },
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    sequence: { concurrent: false },
    reporters: ["default", "json"],
    outputFile: { json: "reports/vitest-results.json" },
    coverage: { provider: "v8", reportsDirectory: "coverage" },
  },
});
