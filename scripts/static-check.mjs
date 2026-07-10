import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const roots = ["apps", "packages", "tools", "scripts", "database", "tests"];
const violations = [];
async function walk(path) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    const full = join(path, item.name);
    if (item.isDirectory()) {
      if (!["node_modules", "dist"].includes(item.name)) await walk(full);
      continue;
    }
    if (![".ts", ".tsx", ".js", ".mjs", ".sql"].includes(extname(item.name)))
      continue;
    const text = await readFile(full, "utf8");
    const name = relative(root.pathname, full).replaceAll("\\", "/");
    if (/\b(?:TODO|FIXME)\b/u.test(text))
      violations.push(`${name}: unfinished marker`);
    if (/:\s*any\b|\bas\s+any\b/u.test(text))
      violations.push(`${name}: explicit any`);
  }
}
for (const folder of roots) {
  await walk(join(root, folder)).catch(() => {});
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log(
  "static check passed: no TODO/FIXME or explicit any in implementation roots",
);
