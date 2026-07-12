import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const packageSource = (name: string) =>
  resolve(import.meta.dirname, "packages", name, "src", "index.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@pharmassist/domain": packageSource("domain"),
      "@pharmassist/normalizer": packageSource("normalizer"),
      "@pharmassist/observability": packageSource("observability"),
    },
  },
  test: {
    include: ["tests/security/**/*.test.ts"],
    reporters: ["default", "json"],
    outputFile: { json: "reports/security-vitest-results.json" },
  },
});
