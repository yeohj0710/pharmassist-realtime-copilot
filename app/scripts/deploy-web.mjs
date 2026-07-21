import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const appRoot = process.cwd();
const webDir = path.join(appRoot, "apps", "web");
const distDir = path.join(webDir, "dist");
const linkDir = path.join(webDir, ".vercel");
const distLinkDir = path.join(distDir, ".vercel");

if (!existsSync(path.join(distDir, "index.html"))) {
  console.error(
    "apps/web/dist/index.html not found. Run `pnpm turbo build --filter=@pharmassist/web...` first.",
  );
  process.exit(1);
}

const run = (args, cwd) => {
  const result =
    process.platform === "win32"
      ? spawnSync(["npx", ...args].join(" "), {
          cwd,
          stdio: "inherit",
          shell: true,
        })
      : spawnSync("npx", args, { cwd, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (existsSync(linkDir)) {
  rmSync(distLinkDir, { recursive: true, force: true });
  cpSync(linkDir, distLinkDir, { recursive: true });
} else {
  run(
    [
      "vercel",
      "link",
      "--yes",
      "--project",
      "pharmassist-realtime-copilot",
      "--scope",
      "yeohj0710s-projects",
    ],
    distDir,
  );
  cpSync(distLinkDir, linkDir, { recursive: true });
}

// Ship the same-origin AI interpretation functions with the static bundle.
// The intent catalog is generated from the audited research-preview pack so
// the model can only map to intents the deterministic engine already knows.
const functionsSource = path.join(webDir, "api-functions");
const functionsTarget = path.join(distDir, "api");
rmSync(functionsTarget, { recursive: true, force: true });
cpSync(functionsSource, functionsTarget, { recursive: true });
const pack = JSON.parse(
  readFileSync(
    path.join(appRoot, "data", "actual-candidate-pack", "pack.json"),
  ),
);
const intentCatalog = (pack.cards ?? [])
  .filter((card) => Array.isArray(card.aliases) && card.aliases.length > 0)
  .map((card) => ({
    intent: card.intent,
    title: card.title,
    aliases: card.aliases,
  }));
if (intentCatalog.length === 0) {
  console.error("intent catalog is empty; refusing to deploy AI functions");
  process.exit(1);
}
mkdirSync(path.join(functionsTarget, "_lib"), { recursive: true });
writeFileSync(
  path.join(functionsTarget, "_lib", "intent-catalog.mjs"),
  `export const intentCatalog = ${JSON.stringify(intentCatalog)};\n`,
);
cpSync(path.join(webDir, "vercel.json"), path.join(distDir, "vercel.json"));

rmSync(path.join(distDir, ".env.local"), { force: true });
run(["vercel", "deploy", "--prod", "--yes"], distDir);
