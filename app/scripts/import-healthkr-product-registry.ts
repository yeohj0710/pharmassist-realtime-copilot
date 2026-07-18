import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  buildHealthKrProductRegistry,
  mergePortableHealthKrCatalog,
  parseHealthKrRegistryPack,
} from "../tools/ingest/src/healthkr-product-registry.js";

const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
const OUTPUT_DIRECTORY_NAME = "healthkr-product-registry";
const SOURCE_LOGICAL_NAME = "pharmacy-product-catalog-portable-v1";

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const isWithin = (parent: string, child: string): boolean => {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
};

const assertCanonicalOutput = (input: {
  readonly canonicalAppRoot: string;
  readonly canonicalDataRoot: string;
  readonly canonicalSourceRoot: string;
  readonly canonicalOutputDirectory: string;
}): void => {
  const expected = resolve(
    input.canonicalDataRoot,
    OUTPUT_DIRECTORY_NAME,
  ).toLocaleLowerCase("en-US");
  if (
    input.canonicalOutputDirectory.toLocaleLowerCase("en-US") !== expected ||
    !isWithin(input.canonicalAppRoot, input.canonicalOutputDirectory)
  )
    throw new Error("healthkr registry output escaped the fixed app data path");
  if (isWithin(input.canonicalSourceRoot, input.canonicalOutputDirectory))
    throw new Error("healthkr registry output resolves inside the source path");
};

const jsonBody = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      source: { type: "string" },
    },
    allowPositionals: false,
  });
  const sourceValue =
    values.source ?? process.env["HEALTHKR_CATALOG_SOURCE_DIR"];
  if (!sourceValue)
    throw new Error("--source or HEALTHKR_CATALOG_SOURCE_DIR is required");

  const appRoot = resolve(import.meta.dirname, "..");
  const sourceRoot = resolve(sourceValue);
  const sourcePath = resolve(sourceRoot, "data/portable/v1/products.json");
  const sourceSchemaPath = resolve(sourceRoot, "data/portable/v1/schema.json");
  const sourceManifestPath = resolve(
    sourceRoot,
    "data/portable/v1/manifest.json",
  );
  const enrichmentPath = resolve(sourceRoot, "data/enrichment-queue.json");
  const contractPath = resolve(sourceRoot, "docs/catalog-data-contract.md");
  const correctionsPath = resolve(
    sourceRoot,
    "data/catalog-text-corrections.json",
  );
  const packPath = resolve(appRoot, "data/actual-candidate-pack/pack.json");
  const outputDirectory = resolve(appRoot, "data", OUTPUT_DIRECTORY_NAME);
  const inputPaths = [
    sourcePath,
    sourceSchemaPath,
    sourceManifestPath,
    enrichmentPath,
    contractPath,
    correctionsPath,
  ];
  const inputStats = await Promise.all(inputPaths.map((path) => stat(path)));
  if (
    inputStats.some(
      (input) =>
        !input.isFile() || input.size < 1 || input.size > MAX_SOURCE_BYTES,
    )
  )
    throw new Error("catalog input size is outside the 1-64 MiB limit");

  const [
    sourceBytes,
    sourceSchemaBytes,
    sourceManifestBytes,
    enrichmentBytes,
    contractBytes,
    correctionsBytes,
    packBytes,
  ] = await Promise.all([
    readFile(sourcePath),
    readFile(sourceSchemaPath),
    readFile(sourceManifestPath),
    readFile(enrichmentPath),
    readFile(contractPath),
    readFile(correctionsPath),
    readFile(packPath),
  ]);
  const portableValue = JSON.parse(sourceBytes.toString("utf8")) as unknown;
  const sourceSchema = JSON.parse(sourceSchemaBytes.toString("utf8")) as object;
  const sourceManifest = JSON.parse(sourceManifestBytes.toString("utf8")) as {
    readonly product_count?: number;
    readonly official_confirmed_count?: number;
    readonly files?: Readonly<Record<string, Readonly<{ sha256?: string }>>>;
  };
  const sourceContentSha256 = sha256(sourceBytes);
  const sourceSchemaSha256 = sha256(sourceSchemaBytes);
  if (
    sourceManifest.files?.["products.json"]?.sha256 !== sourceContentSha256 ||
    sourceManifest.files?.["schema.json"]?.sha256 !== sourceSchemaSha256
  )
    throw new Error("portable manifest hashes do not match source files");
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validatePortable = ajv.compile(sourceSchema);
  if (!Array.isArray(portableValue))
    throw new Error("portable products must contain an array");
  for (const [index, value] of portableValue.entries()) {
    if (!validatePortable(value))
      throw new Error(
        `portable product ${index + 1} violates schema: ${ajv.errorsText(
          validatePortable.errors,
        )}`,
      );
  }
  if (sourceManifest.product_count !== portableValue.length)
    throw new Error("portable manifest product count does not match source");
  const enrichmentValue = JSON.parse(
    enrichmentBytes.toString("utf8"),
  ) as unknown;
  const sourceRows = mergePortableHealthKrCatalog(
    portableValue,
    enrichmentValue,
  );
  const confirmedCount = sourceRows.filter(
    (row) => row["official_match_status"] === "confirmed",
  ).length;
  if (sourceManifest.official_confirmed_count !== confirmedCount)
    throw new Error(
      "portable manifest confirmed count does not match source products",
    );
  const pack = parseHealthKrRegistryPack(
    JSON.parse(packBytes.toString("utf8")) as unknown,
  );
  const generatedAt = new Date().toISOString();
  const enrichmentContentSha256 = sha256(enrichmentBytes);
  const contractContentSha256 = sha256(contractBytes);
  const correctionsContentSha256 = sha256(correctionsBytes);
  const sourceManifestContentSha256 = sha256(sourceManifestBytes);
  const mappingContentSha256 = sha256(jsonBody(pack));
  const derived = buildHealthKrProductRegistry(sourceRows, pack, {
    generatedAt,
    sourceContentSha256,
    sourceByteLength: sourceBytes.byteLength,
    mappingContentSha256,
  });
  const registryBody = jsonBody(derived.registry);
  const reportBody = jsonBody(derived.report);
  const registrySha256 = sha256(registryBody);
  const reportSha256 = sha256(reportBody);
  const generationId = `GEN-HEALTHKR-${sha256(
    `${sourceContentSha256}|${enrichmentContentSha256}|${mappingContentSha256}|${generatedAt}`,
  )
    .slice(0, 16)
    .toUpperCase()}`;
  const manifest = {
    schemaVersion: "1.0.0",
    generationId,
    generatedAt,
    source: {
      logicalName: SOURCE_LOGICAL_NAME,
      contentSha256: sourceContentSha256,
      byteLength: sourceBytes.byteLength,
      recordCount: sourceRows.length,
    },
    enrichmentSource: {
      logicalName: "pharmacy-product-catalog-enrichment-queue",
      contentSha256: enrichmentContentSha256,
      byteLength: enrichmentBytes.byteLength,
      recordCount: sourceRows.length,
    },
    portableSchema: {
      logicalName: "portable/v1/schema.json",
      contentSha256: sourceSchemaSha256,
    },
    portableManifest: {
      logicalName: "portable/v1/manifest.json",
      contentSha256: sourceManifestContentSha256,
    },
    reuseContract: {
      logicalName: "docs/catalog-data-contract.md",
      contentSha256: contractContentSha256,
    },
    textCorrections: {
      logicalName: "data/catalog-text-corrections.json",
      contentSha256: correctionsContentSha256,
    },
    pack: derived.registry.pack,
    outputs: {
      registry: {
        logicalName: "registry.json",
        contentSha256: registrySha256,
        recordCount: derived.registry.records.length,
      },
      report: {
        logicalName: "report.json",
        contentSha256: reportSha256,
      },
    },
    counts: {
      importedRecordCount: derived.report.importedRecordCount,
      confirmed: derived.report.matchStatusCounts.confirmed,
      reviewRequired: derived.report.matchStatusCounts.review_required,
      notFound: derived.report.matchStatusCounts.not_found,
      notApplicable: derived.report.matchStatusCounts.not_applicable,
      eligibleRetailSkuCount: derived.report.eligibleRetailSkuCount,
      eligibleOfficialProductCount: derived.report.eligibleOfficialProductCount,
      confirmedWithOfficialContentCount:
        derived.report.confirmedWithOfficialContentCount,
      imageCount: derived.report.imageCount,
      correctedRetailTextCount: derived.report.correctedRetailTextCount,
      multiSkuOfficialProductCount: derived.report.multiSkuOfficialProductCount,
      multiSkuRetailSkuCount: derived.report.multiSkuRetailSkuCount,
    },
  };
  const manifestBody = jsonBody(manifest);

  await mkdir(resolve(appRoot, "data"), { recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  const [canonicalAppRoot, canonicalDataRoot, canonicalSourceRoot] =
    await Promise.all([
      realpath(appRoot),
      realpath(resolve(appRoot, "data")),
      realpath(sourceRoot),
    ]);
  const validateOutput = async (): Promise<void> =>
    assertCanonicalOutput({
      canonicalAppRoot,
      canonicalDataRoot,
      canonicalSourceRoot,
      canonicalOutputDirectory: await realpath(outputDirectory),
    });
  await validateOutput();

  const registryPath = resolve(outputDirectory, "registry.json");
  const reportPath = resolve(outputDirectory, "report.json");
  const manifestPath = resolve(outputDirectory, "manifest.json");
  const nonce = `${process.pid}.${Date.now()}`;
  const temporary = {
    registry: `${registryPath}.${nonce}.tmp`,
    report: `${reportPath}.${nonce}.tmp`,
    manifest: `${manifestPath}.${nonce}.tmp`,
  };
  try {
    await Promise.all([
      writeFile(temporary.registry, registryBody, "utf8"),
      writeFile(temporary.report, reportBody, "utf8"),
      writeFile(temporary.manifest, manifestBody, "utf8"),
    ]);
    await validateOutput();

    // An absent manifest marks any interrupted replacement as untrusted.
    await rm(manifestPath, { force: true });
    await rm(registryPath, { force: true });
    await rename(temporary.registry, registryPath);
    await rm(reportPath, { force: true });
    await rename(temporary.report, reportPath);
    await rename(temporary.manifest, manifestPath);
  } finally {
    await Promise.all(
      Object.values(temporary).map((path) => rm(path, { force: true })),
    );
  }

  process.stdout.write(reportBody);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `Health.kr product registry import failed: ${message}\n`,
  );
  process.exitCode = 1;
});
