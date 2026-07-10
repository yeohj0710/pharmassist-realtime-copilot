import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { compile } from "json-schema-to-typescript";

const root = resolve(import.meta.dirname, "..");
const schemaDir = join(root, "packages", "contracts", "schemas");
const outputDir = join(root, "packages", "contracts", "src", "generated");
await mkdir(outputDir, { recursive: true });

const schemaFiles = (await readdir(schemaDir))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const generated = [];
for (const filename of schemaFiles) {
  const raw = await readFile(join(schemaDir, filename), "utf8");
  const schema = JSON.parse(raw);
  const outputName = filename.replace(".schema.json", ".ts");
  const source = await compile(schema, schema.title ?? basename(filename), {
    cwd: schemaDir,
    bannerComment: `/* Generated from ${filename}. Do not edit. */`,
    additionalProperties: false,
    style: { singleQuote: false, semi: true, tabWidth: 2 },
  });
  await writeFile(join(outputDir, outputName), source, "utf8");
  generated.push({
    file: outputName,
    title: schema.title ?? basename(filename),
    sha256: createHash("sha256").update(source).digest("hex"),
  });
}
const index =
  generated
    .map(
      ({ file, title }) =>
        `export type { ${title} } from "./${file.replace(".ts", ".js")}";`,
    )
    .join("\n") + "\n";
await writeFile(join(outputDir, "index.ts"), index, "utf8");
const schemaHash = createHash("sha256");
for (const filename of schemaFiles)
  schemaHash.update(await readFile(join(schemaDir, filename)));
await writeFile(
  join(outputDir, "manifest.json"),
  JSON.stringify({ schemaHash: schemaHash.digest("hex"), generated }, null, 2) +
    "\n",
  "utf8",
);
console.log(`Generated ${generated.length} contract modules.`);
