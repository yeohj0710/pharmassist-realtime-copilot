import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createMfDsAdapterFromEnv,
  normalizeMfDsCandidate,
} from "../tools/ingest/src/index.js";

async function main(): Promise<void> {
  try {
    process.loadEnvFile(resolve(import.meta.dirname, "../.env"));
  } catch {
    // Environment variables may be supplied by the invoking process.
  }

  const outputDirectory = resolve(
    import.meta.dirname,
    "../data/mfds-otc-candidate",
  );
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort(new Error("interrupted")));

  const adapter = createMfDsAdapterFromEnv("mfds_easy_drug");
  const fetched = await adapter.fetch(controller.signal);
  const byItemSeq = new Map<
    string,
    ReturnType<typeof normalizeMfDsCandidate>
  >();

  for (const record of fetched.records) {
    const candidate = normalizeMfDsCandidate("mfds_easy_drug", record);
    if (!candidate.itemSeq || !candidate.productName) continue;
    byItemSeq.set(candidate.itemSeq, candidate);
  }

  const catalog = [...byItemSeq.values()].sort((left, right) =>
    left.itemSeq!.localeCompare(right.itemSeq!),
  );
  if (catalog.length === 0)
    throw new Error("MFDS OTC sync returned no usable products");

  await mkdir(outputDirectory, { recursive: true });
  const catalogBody = `${catalog.map((item) => JSON.stringify(item)).join("\n")}\n`;
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    candidateOnly: true,
    clinicalUseProhibited: true,
    provider: "mfds_easy_drug",
    sourceSnapshot: fetched.snapshot,
    productCount: catalog.length,
    catalogSha256: createHash("sha256").update(catalogBody).digest("hex"),
  };

  const catalogTemporary = resolve(outputDirectory, "catalog.jsonl.tmp");
  const manifestTemporary = resolve(outputDirectory, "manifest.json.tmp");
  await writeFile(catalogTemporary, catalogBody, "utf8");
  await writeFile(
    manifestTemporary,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await rename(catalogTemporary, resolve(outputDirectory, "catalog.jsonl"));
  await rename(manifestTemporary, resolve(outputDirectory, "manifest.json"));

  console.log(
    `MFDS OTC candidate catalog synced: ${catalog.length} products (${fetched.snapshot.page_count} pages)`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`MFDS OTC sync failed: ${message}\n`);
  process.exitCode = 1;
});
