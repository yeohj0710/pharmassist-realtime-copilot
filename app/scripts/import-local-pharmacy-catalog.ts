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
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  assertImportSize,
  assertCanonicalLocalCatalogOutputPath,
  assertLocalCatalogOutputPath,
  buildLocalPharmacyCatalogCandidates,
  type LocalPharmacyCatalogSourceRow,
  type RuntimeRegistryProductName,
} from "../tools/ingest/src/index.js";

const asRecord = (
  value: unknown,
): Readonly<Record<string, unknown>> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const requiredText = (
  record: Readonly<Record<string, unknown>>,
  field: string,
  rowNumber: number,
): string => {
  const value = record[field];
  if (typeof value !== "string" || !value.trim())
    throw new Error(`source row ${rowNumber} requires ${field}`);
  return value.trim();
};

const optionalText = (
  record: Readonly<Record<string, unknown>>,
  field: string,
): string | undefined => {
  const value = record[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const parseSourceRows = (
  value: unknown,
): readonly LocalPharmacyCatalogSourceRow[] => {
  if (!Array.isArray(value))
    throw new Error("source data/products.json must contain an array");
  const rows = value.map((item, index) => {
    const record = asRecord(item);
    if (!record) throw new Error(`source row ${index + 1} must be an object`);
    const capacity =
      optionalText(record, "capacity") ?? optionalText(record, "specification");
    if (!capacity) throw new Error(`source row ${index + 1} requires capacity`);
    const recordedAt = optionalText(record, "recorded_at");
    const verificationStatus = optionalText(record, "verification_status");
    return {
      id: requiredText(record, "id", index + 1),
      name: requiredText(record, "name", index + 1),
      capacity,
      category: requiredText(record, "category", index + 1),
      ...(recordedAt ? { recorded_at: recordedAt } : {}),
      ...(verificationStatus
        ? { verification_status: verificationStatus }
        : {}),
    } satisfies LocalPharmacyCatalogSourceRow;
  });
  const ids = new Set(rows.map((row) => row.id));
  if (ids.size !== rows.length)
    throw new Error("source catalog contains duplicate SKU IDs");
  return rows;
};

const parseRuntimeProducts = (
  value: unknown,
): readonly RuntimeRegistryProductName[] => {
  const root = asRecord(value);
  const products = root?.["products"];
  if (!Array.isArray(products))
    throw new Error("research pack products must contain an array");
  const result = products.map((item, index) => {
    const record = asRecord(item);
    if (!record)
      throw new Error(`research pack product ${index + 1} must be an object`);
    return {
      productId: requiredText(record, "product_id", index + 1),
      displayName: requiredText(record, "display_name", index + 1),
    };
  });
  if (result.length === 0)
    throw new Error("research pack contains no runtime products");
  return result;
};

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "ko"),
  );

const readOptionalJson = async (path: string): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error: unknown) {
    const code = asRecord(error)?.["code"];
    if (code === "ENOENT") return undefined;
    throw error;
  }
};

const atomicWrite = async (path: string, body: string): Promise<void> => {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, body, "utf8");
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
};

async function main(): Promise<void> {
  try {
    process.loadEnvFile(resolve(import.meta.dirname, "../.env"));
  } catch {
    // Environment variables may be supplied by the invoking process.
  }

  const { values } = parseArgs({
    options: {
      source: { type: "string" },
      write: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  const sourceValue =
    values.source ?? process.env["PHARMACY_CATALOG_SOURCE_DIR"];
  if (!sourceValue)
    throw new Error("--source or PHARMACY_CATALOG_SOURCE_DIR is required");

  const appRoot = resolve(import.meta.dirname, "..");
  const workspaceRoot = resolve(appRoot, "..");
  const sourceRoot = resolve(sourceValue);
  const outputDirectory = assertLocalCatalogOutputPath(
    workspaceRoot,
    sourceRoot,
    resolve(workspaceRoot, "etc/pharmacy-product-catalog-candidate"),
  );
  const sourcePath = resolve(sourceRoot, "data/products.json");
  const sourceStats = await stat(sourcePath);
  assertImportSize(sourceStats.size);
  const sourceBody = await readFile(sourcePath, "utf8");
  const sourceRows = parseSourceRows(JSON.parse(sourceBody) as unknown);
  const runtimeProducts = parseRuntimeProducts(
    JSON.parse(
      await readFile(
        resolve(appRoot, "data/actual-candidate-pack/pack.json"),
        "utf8",
      ),
    ) as unknown,
  );
  const derived = buildLocalPharmacyCatalogCandidates(
    sourceRows,
    runtimeProducts,
  );

  const officialSummary = asRecord(
    await readOptionalJson(
      resolve(sourceRoot, "data/official-data-summary.json"),
    ),
  );
  const officialMatches = await readOptionalJson(
    resolve(sourceRoot, "data/product-official-matches.json"),
  );
  const officialProducts = await readOptionalJson(
    resolve(sourceRoot, "data/official-product-details.json"),
  );
  const generatedAt = new Date().toISOString();
  const sourceSha256 = createHash("sha256").update(sourceBody).digest("hex");
  const report = {
    schemaVersion: 1,
    generatedAt,
    mode: values.write ? "local_candidate_write" : "dry_run",
    source: {
      repositoryId: "pharmacy-product-catalog",
      file: "data/products.json",
      contentSha256: sourceSha256,
      byteLength: sourceStats.size,
      recordedAt: uniqueSorted(sourceRows.map((row) => row.recorded_at ?? "")),
      verificationStatuses: uniqueSorted(
        sourceRows.map((row) => row.verification_status ?? ""),
      ),
    },
    ...derived.report,
    classificationInterpretation: {
      routeCountsAreMutuallyExclusive: true,
      regulatoryDomainCandidateCountsMayOverlap: true,
      sourceCategoryIsNotAnOfficialRegulatoryClassification: true,
    },
    officialSourceState: {
      status:
        typeof officialSummary?.["status"] === "string"
          ? officialSummary["status"]
          : "unknown",
      processedCount: Number(officialSummary?.["processed_count"] ?? 0),
      remainingCount: Number(
        officialSummary?.["remaining_count"] ?? sourceRows.length,
      ),
      officialMatchRecordCount: Array.isArray(officialMatches)
        ? officialMatches.length
        : 0,
      officialProductRecordCount: Array.isArray(officialProducts)
        ? officialProducts.length
        : 0,
      requiredEnvironmentVariable:
        typeof officialSummary?.["required_environment_variable"] === "string"
          ? officialSummary["required_environment_variable"]
          : null,
    },
  };

  const candidateBody = `${derived.candidates
    .map((candidate) => JSON.stringify(candidate))
    .join("\n")}\n`;
  const reportBody = `${JSON.stringify(report, null, 2)}\n`;
  const manifest = {
    schemaVersion: 1,
    generatedAt,
    candidateOnly: true,
    clinicalUseProhibited: true,
    source: report.source,
    sourceSkuCount: derived.report.sourceSkuCount,
    candidateGroupCount: derived.report.candidateGroupCount,
    officialMatchConfirmedCount: 0,
    formularyEligibleCount: 0,
    catalogSha256: createHash("sha256").update(candidateBody).digest("hex"),
    reportSha256: createHash("sha256").update(reportBody).digest("hex"),
    reportFile: "dry-run-report.json",
    catalogFile: "candidates.jsonl",
  };

  if (values.write) {
    const privateRoot = resolve(workspaceRoot, "etc");
    await mkdir(privateRoot, { recursive: true });
    const canonicalWorkspace = await realpath(workspaceRoot);
    const canonicalPrivateRoot = await realpath(privateRoot);
    const canonicalSourceRoot = await realpath(sourceRoot);
    assertCanonicalLocalCatalogOutputPath({
      workspaceRoot: canonicalWorkspace,
      privateRoot: canonicalPrivateRoot,
      sourceRoot: canonicalSourceRoot,
      outputDirectory: resolve(
        canonicalPrivateRoot,
        "pharmacy-product-catalog-candidate",
      ),
    });
    await mkdir(outputDirectory, { recursive: true });
    const validateOutputPath = async (): Promise<void> => {
      assertCanonicalLocalCatalogOutputPath({
        workspaceRoot: canonicalWorkspace,
        privateRoot: canonicalPrivateRoot,
        sourceRoot: canonicalSourceRoot,
        outputDirectory: await realpath(outputDirectory),
      });
    };
    await validateOutputPath();
    await atomicWrite(
      resolve(outputDirectory, "candidates.jsonl"),
      candidateBody,
    );
    await validateOutputPath();
    await atomicWrite(
      resolve(outputDirectory, "dry-run-report.json"),
      reportBody,
    );
    await validateOutputPath();
    await atomicWrite(
      resolve(outputDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  process.stdout.write(reportBody);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Local pharmacy catalog import failed: ${message}\n`);
  process.exitCode = 1;
});
