import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Windows launcher origin isolation", () => {
  it("uses a dedicated configurable web port instead of Vite's shared preview port", () => {
    const webPackage = read("apps/web/package.json");
    const viteConfig = read("apps/web/vite.config.ts");
    const playwrightConfig = read("playwright.config.ts");
    const compose = read("compose.yaml");

    expect(webPackage).not.toContain("--port 4173");
    expect(viteConfig).toContain("PHARMASSIST_WEB_PORT");
    expect(viteConfig).toContain("14273");
    expect(playwrightConfig).not.toContain("127.0.0.1:4173");
    expect(playwrightConfig).toContain("14373");
    expect(compose).not.toContain(":4173:8080");
  });

  it("opens a port only after the PharmAssist identity endpoint matches", () => {
    const appId = read("apps/web/public/pharmassist-app-id.txt").trim();
    const launcher = read("scripts/PharmAssistLauncher.cs");
    const runner = read("scripts/run-pharmassist.ps1");
    const waiter = read("scripts/wait-and-open.ps1");

    expect(appId).toBe("pharmassist-realtime-copilot:v1");
    for (const source of [launcher, runner, waiter]) {
      expect(source).toContain("pharmassist-app-id.txt");
      expect(source).toContain("pharmassist-realtime-copilot:v1");
    }
  });

  it("does not register the production service worker during local development", () => {
    expect(read("apps/web/src/main.tsx")).toContain("import.meta.env.PROD");
  });
});
