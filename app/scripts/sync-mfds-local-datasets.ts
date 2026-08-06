import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertProductionAdapter,
  createMfDsAdapterFromEnv,
  normalizeMfDsCandidate,
  type MfdsPagedAdapter,
  type ProviderId,
} from "../tools/ingest/src/index.js";

type JsonObject = Record<string, unknown>;
type NormalizedRecord = ReturnType<typeof normalizeMfDsCandidate>;

const dataRoot = resolve(
  process.env["KR_DRUG_DATA_DIR"] ?? "C:\\dev\\kr-drug-data",
);
const outputRoot = resolve(dataRoot);
const stateDirectory = resolve(outputRoot, "etc", "logs");
const statePath = resolve(stateDirectory, "state.json");
const knownItemsPath = resolve(stateDirectory, "known_items.txt");
const appRoot = resolve(import.meta.dirname, "..");

const ingredientSources = [
  {
    file: "usjnt-taboo.jsonl",
    operationPath: "getUsjntTabooInfoList02",
    label: "병용금기",
  },
  {
    file: "pwnm-taboo.jsonl",
    operationPath: "getPwnmTabooInfoList02",
    label: "임부금기",
  },
  {
    file: "cpcty-atent.jsonl",
    operationPath: "getCpctyAtentInfoList02",
    label: "용량주의",
  },
  {
    file: "mdctn-pd-atent.jsonl",
    operationPath: "getMdctnPdAtentInfoList02",
    label: "투여기간주의",
  },
  {
    file: "odsn-atent.jsonl",
    operationPath: "getOdsnAtentInfoList02",
    label: "노인주의",
  },
  {
    file: "spcify-agrde-taboo.jsonl",
    operationPath: "getSpcifyAgrdeTabooInfoList02",
    label: "특정연령대금기",
  },
  {
    file: "efcy-dplct.jsonl",
    operationPath: "getEfcyDplctInfoList02",
    label: "효능군중복",
  },
] as const;

interface WrittenDataset {
  readonly directory: string;
  readonly file: string;
  readonly operationPath: string;
  readonly label: string;
  readonly records: number;
  readonly pages: number;
  readonly catalogSha256: string;
  readonly snapshot: JsonObject;
}

function envFilePath(): string {
  return resolve(appRoot, ".env");
}

function assertResponseContract(
  provider: ProviderId,
  records: readonly NormalizedRecord[],
): void {
  if (records.length === 0)
    throw new Error(`MFDS ${provider} returned no records`);

  const identifiers = records.filter(
    (record) => record.itemSeq || record.ingredientCode,
  ).length;
  if (identifiers === 0)
    throw new Error(`MFDS ${provider} response has no recognized identifier`);

  if (
    (provider === "mfds_permit" || provider === "mfds_dur_product") &&
    identifiers < records.length
  )
    throw new Error(
      `MFDS ${provider} response has records without item sequence identifiers`,
    );
}

async function writeJsonAtomically(
  path: string,
  value: unknown,
): Promise<void> {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function checkpoint(
  status: "running" | "complete" | "failed",
  dataset: string | null,
  page: number,
  records: number,
  detail?: string,
): Promise<void> {
  await mkdir(stateDirectory, { recursive: true });
  await writeJsonAtomically(statePath, {
    schemaVersion: 1,
    status,
    updatedAt: new Date().toISOString(),
    dataset,
    page,
    records,
    detail: detail ?? null,
    queue: [
      "permit",
      "dur-product",
      "dur-ingredient:usjnt-taboo",
      "dur-ingredient:pwnm-taboo",
      "dur-ingredient:cpcty-atent",
      "dur-ingredient:mdctn-pd-atent",
      "dur-ingredient:odsn-atent",
      "dur-ingredient:spcify-agrde-taboo",
      "dur-ingredient:efcy-dplct",
    ],
  });
}

async function appendProcessedItems(
  dataset: string,
  records: readonly NormalizedRecord[],
): Promise<void> {
  const lines = records
    .map((record) => {
      const identifier = record.itemSeq ?? record.ingredientCode ?? "unknown";
      return `${dataset}:${identifier}\n`;
    })
    .join("");
  if (lines) await appendFile(knownItemsPath, lines, "utf8");
}

async function writeCatalog(
  directory: string,
  file: string,
  operationPath: string,
  label: string,
  adapter: MfdsPagedAdapter,
  expectedRecordCount?: number,
): Promise<WrittenDataset> {
  const directoryPath = resolve(outputRoot, directory);
  const catalogPath = resolve(directoryPath, file);
  if (expectedRecordCount !== undefined) {
    try {
      const manifest = JSON.parse(
        await readFile(resolve(directoryPath, "manifest.json"), "utf8"),
      ) as JsonObject;
      const snapshot = manifest["sourceSnapshot"] as JsonObject | undefined;
      const catalogSha256 = manifest["catalogSha256"];
      const recordCount = Number(manifest["recordCount"] ?? 0);
      const catalog = await open(catalogPath, "r");
      await catalog.close();
      if (
        recordCount === expectedRecordCount &&
        snapshot &&
        typeof catalogSha256 === "string"
      ) {
        console.log(`${directory}/${file}: reusing complete local catalog`);
        return {
          directory,
          file,
          operationPath,
          label,
          records: recordCount,
          pages: Number(snapshot["page_count"] ?? 0),
          catalogSha256,
          snapshot,
        };
      }
    } catch {
      // Missing or incomplete local output is recollected below.
    }
  }
  await mkdir(directoryPath, { recursive: true });
  const temporary = `${catalogPath}.tmp-${process.pid}`;
  const output = await open(temporary, "w");
  const catalogDigest = createHash("sha256");
  let recordCount = 0;
  try {
    await checkpoint("running", `${directory}/${file}`, 0, 0);
    const snapshot = await adapter.fetchPages(async ({ pageNo, items }) => {
      const normalized = items.map((record) =>
        normalizeMfDsCandidate(adapter.id as ProviderId, record),
      );
      assertResponseContract(adapter.id as ProviderId, normalized);
      const body = `${normalized.map((record) => JSON.stringify(record)).join("\n")}\n`;
      await output.write(body);
      catalogDigest.update(body);
      recordCount += normalized.length;
      await appendProcessedItems(`${directory}/${file}`, normalized);
      await checkpoint("running", `${directory}/${file}`, pageNo, recordCount);
      if (pageNo === 1 || pageNo % 25 === 0)
        console.log(`${directory}/${file}: page ${pageNo}`);
    }, new AbortController().signal);
    await output.close();
    if (recordCount === 0)
      throw new Error(`MFDS ${adapter.id} returned no records`);
    await rename(temporary, catalogPath);
    return {
      directory,
      file,
      operationPath,
      label,
      records: recordCount,
      pages: Number(snapshot.page_count ?? 0),
      catalogSha256: catalogDigest.digest("hex"),
      snapshot: snapshot as JsonObject,
    };
  } catch (error) {
    await output.close().catch(() => undefined);
    const partialDirectory = resolve(outputRoot, "etc", "partials");
    await mkdir(partialDirectory, { recursive: true });
    const partialPath = resolve(
      partialDirectory,
      `${directory.replaceAll("/", "-")}-${file}-${process.pid}-${Date.now()}.partial.jsonl`,
    );
    await rename(temporary, partialPath).catch(async () => {
      await unlink(temporary).catch(() => undefined);
    });
    throw error;
  }
}

function createAdapter(
  provider: ProviderId,
  operationPath?: string,
): MfdsPagedAdapter {
  const configured = operationPath
    ? createMfDsAdapterFromEnv(
        provider,
        { ...process.env, MFDS_DUR_INGREDIENT_OPERATION_PATH: operationPath },
        undefined,
      )
    : createMfDsAdapterFromEnv(provider, process.env, undefined);
  assertProductionAdapter(configured);
  return configured;
}

async function readRootManifest(): Promise<JsonObject> {
  try {
    return JSON.parse(
      await readFile(resolve(outputRoot, "manifest.json"), "utf8"),
    ) as JsonObject;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return {
      schemaVersion: 1,
      purpose:
        "식약처 공식 오픈API에서 일괄 수집한 원문 데이터. 여러 프로젝트가 공유해서 읽는다.",
      candidateOnly: true,
      clinicalUseProhibited: true,
      datasets: {},
    };
  }
}

function datasetManifest(entry: WrittenDataset): JsonObject {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    candidateOnly: true,
    clinicalUseProhibited: true,
    provider: entry.snapshot["provider"],
    operation: entry.operationPath,
    sourceSnapshot: entry.snapshot,
    recordCount: entry.records,
    catalogSha256: entry.catalogSha256,
  };
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(envFilePath());
  } catch {
    // Environment variables may be supplied by the invoking process.
  }

  await mkdir(outputRoot, { recursive: true });
  await mkdir(stateDirectory, { recursive: true });
  await checkpoint("running", null, 0, 0, "collection started");
  const written: WrittenDataset[] = [];

  const permit = await writeCatalog(
    "permit",
    "catalog.jsonl",
    "getDrugPrdtPrmsnDtlInq06",
    "허가 상세",
    createAdapter("mfds_permit"),
    42971,
  );
  await writeJsonAtomically(resolve(outputRoot, "permit", "manifest.json"), {
    ...datasetManifest(permit),
    expectedRecordCount: 42971,
  });
  written.push(permit);

  const durProduct = await writeCatalog(
    "dur-product",
    "catalog.jsonl",
    "getDurPrdlstInfoList03",
    "DUR 품목정보",
    createAdapter("mfds_dur_product"),
    23463,
  );
  await writeJsonAtomically(
    resolve(outputRoot, "dur-product", "manifest.json"),
    {
      ...datasetManifest(durProduct),
      expectedRecordCount: 23463,
    },
  );
  written.push(durProduct);

  const ingredientWritten: WrittenDataset[] = [];
  for (const source of ingredientSources) {
    const entry = await writeCatalog(
      "dur-ingredient",
      source.file,
      source.operationPath,
      source.label,
      createAdapter("mfds_dur_ingredient", source.operationPath),
    );
    ingredientWritten.push(entry);
    written.push(entry);
  }
  await writeJsonAtomically(
    resolve(outputRoot, "dur-ingredient", "manifest.json"),
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      candidateOnly: true,
      clinicalUseProhibited: true,
      provider: "mfds_dur_ingredient",
      sourceSnapshots: ingredientWritten.map((entry) => ({
        file: entry.file,
        label: entry.label,
        operation: entry.operationPath,
        sourceSnapshot: entry.snapshot,
        recordCount: entry.records,
        catalogSha256: entry.catalogSha256,
      })),
      recordCount: ingredientWritten.reduce(
        (total, entry) => total + entry.records,
        0,
      ),
    },
  );

  const rootManifest = await readRootManifest();
  const datasets = (rootManifest["datasets"] ?? {}) as JsonObject;
  datasets["permit"] = {
    status: "complete",
    records: permit.records,
    fetchedAt: permit.snapshot["fetched_at"],
    sha256: permit.catalogSha256,
    contentSha256: permit.snapshot["content_sha256"],
    operation: permit.operationPath,
    sourceSnapshot: permit.snapshot,
    expected: 42971,
  };
  datasets["dur-product"] = {
    status: "complete",
    records: durProduct.records,
    fetchedAt: durProduct.snapshot["fetched_at"],
    sha256: durProduct.catalogSha256,
    contentSha256: durProduct.snapshot["content_sha256"],
    operation: durProduct.operationPath,
    sourceSnapshot: durProduct.snapshot,
    expected: 23463,
  };
  datasets["dur-ingredient"] = {
    status: "complete",
    records: ingredientWritten.reduce(
      (total, entry) => total + entry.records,
      0,
    ),
    fetchedAt: ingredientWritten.at(-1)?.snapshot["fetched_at"],
    files: ingredientWritten.map((entry) => ({
      file: entry.file,
      label: entry.label,
      operation: entry.operationPath,
      records: entry.records,
      sha256: entry.catalogSha256,
      contentSha256: entry.snapshot["content_sha256"],
      sourceSnapshot: entry.snapshot,
    })),
  };
  rootManifest["datasets"] = datasets;
  await writeJsonAtomically(resolve(outputRoot, "manifest.json"), rootManifest);

  for (const entry of written)
    console.log(
      `${entry.directory}/${entry.file}: ${entry.records} records, ${entry.pages} pages`,
    );
  await checkpoint(
    "complete",
    null,
    0,
    written.reduce((total, entry) => total + entry.records, 0),
  );
}

void main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  await checkpoint("failed", null, 0, 0, message).catch(() => undefined);
  process.stderr.write(`MFDS local dataset sync failed: ${message}\n`);
  process.exitCode = 1;
});
