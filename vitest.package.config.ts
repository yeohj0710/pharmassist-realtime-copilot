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
    },
  },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 10_000,
    reporters: ["default"],
  },
});
