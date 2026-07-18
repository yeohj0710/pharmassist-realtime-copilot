import { cpSync, existsSync, rmSync } from "node:fs";
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

rmSync(path.join(distDir, ".env.local"), { force: true });
run(["vercel", "deploy", "--prod", "--yes"], distDir);
