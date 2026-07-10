import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const schemaDir = join(root, "packages", "contracts", "schemas");
const generatedDir = join(root, "packages", "contracts", "src", "generated");
const manifest = JSON.parse(
  await readFile(join(generatedDir, "manifest.json"), "utf8"),
);
const schemaHash = createHash("sha256");
for (const filename of (await readdir(schemaDir))
  .filter((name) => name.endsWith(".schema.json"))
  .sort())
  schemaHash.update(await readFile(join(schemaDir, filename)));
const actualSchemaHash = schemaHash.digest("hex");
if (actualSchemaHash !== manifest.schemaHash)
  throw new Error("Generated contract schema hash drift");
for (const item of manifest.generated) {
  const hash = createHash("sha256")
    .update(await readFile(join(generatedDir, item.file)))
    .digest("hex");
  if (hash !== item.sha256)
    throw new Error(`Generated contract file drift: ${item.file}`);
}
const openapiDir = join(root, "packages", "contracts", "openapi");
const openapi = await readFile(join(openapiDir, "openapi.json"), "utf8");
const openapiManifest = JSON.parse(
  await readFile(join(openapiDir, "manifest.json"), "utf8"),
);
if (
  createHash("sha256").update(openapi).digest("hex") !== openapiManifest.sha256
)
  throw new Error("Generated OpenAPI hash drift");
if (actualSchemaHash !== openapiManifest.sourceSchemaHash)
  throw new Error("Generated OpenAPI source-schema drift");
console.log(
  "Generated contracts and OpenAPI are present and match source schemas.",
);
