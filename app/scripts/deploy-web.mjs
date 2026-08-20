import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
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
const deployState = path.join(appRoot, "etc", "codex-deploy-state", "pharmassist.sha256");
const checkOnly = process.argv.includes("--check");

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

const filesUnder = (dir) => {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) files.push(...filesUnder(file));
    else files.push(file);
  }
  return files;
};

const hashFiles = (files) => {
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(path.relative(distDir, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return hash.digest("hex");
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

// Deploy stamp for long-lived tabs: the SPA keeps its loaded bundle until a
// reload, so the app polls this file at safe moments (new consultation, tab
// re-focus while idle) and reloads itself when the stamp changes. The stamp is
// derived from the deploy payload, so an unchanged payload does not create a
// new deployment merely because the clock moved.
const payloadFiles = filesUnder(distDir).filter(
  (file) => path.basename(file) !== "version.json",
);
const payloadHash = hashFiles(payloadFiles);
writeFileSync(
  path.join(distDir, "version.json"),
  `${JSON.stringify({ deployedAt: payloadHash })}\n`,
);

const currentHash = hashFiles(filesUnder(distDir));
const previousHash = existsSync(deployState)
  ? readFileSync(deployState, "utf8").trim()
  : "";
if (currentHash === previousHash) {
  console.log("배포할 변경 없음 — Vercel 배포를 건너뛴다.");
  process.exit(0);
}
if (checkOnly) {
  console.log("배포 산출물이 바뀌었다 — 실제 배포는 실행하지 않았다.");
  process.exit(0);
}

// Build locally and upload the prebuilt output so Vercel does not run a second
// remote build for the same already-generated SPA payload.
run(["vercel", "build", "--prod", "--yes"], webDir);
run(["vercel", "deploy", "--prebuilt", "--prod", "--yes"], webDir);
mkdirSync(path.dirname(deployState), { recursive: true });
writeFileSync(deployState, `${currentHash}\n`, "utf8");
