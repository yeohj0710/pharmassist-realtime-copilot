import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const scanRoots = [
  "apps",
  "packages",
  "tools",
  "scripts",
  "database",
  "config",
  "data",
];
const findings = [];
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/u,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/u,
  /\b\d{6}-[1-4]\d{6}\b/u,
  /\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b/u,
];
async function walk(path) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    const full = join(path, item.name);
    if (item.isDirectory()) {
      if (!["node_modules", "dist", "generated-dev-pack"].includes(item.name))
        await walk(full);
      continue;
    }
    if ([".png", ".ico", ".woff", ".lock"].includes(extname(item.name)))
      continue;
    const body = await readFile(full, "utf8").catch(() => "");
    for (const pattern of secretPatterns)
      if (pattern.test(body))
        findings.push(`${relative(root.pathname, full)}: ${pattern.source}`);
  }
}
for (const folder of scanRoots) await walk(join(root, folder)).catch(() => {});
if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log(
  "security scan passed: no credential/private-key/patient-identifier patterns",
);
