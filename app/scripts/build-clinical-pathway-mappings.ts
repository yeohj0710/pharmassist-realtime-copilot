import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  canonicalIngredientId,
  classifyOfficialProduct,
  parseClinicalPathwayDataset,
} from "../tools/ingest/src/clinical-pathway-classifier.js";
import type { HealthKrProductRegistry } from "../tools/ingest/src/healthkr-product-registry.js";

const appRoot = resolve(import.meta.dirname, "..");
const registryPath = resolve(
  appRoot,
  "data/healthkr-product-registry/registry.json",
);
const pathwayPath = resolve(appRoot, "data/clinical-pathways/pathways.json");
const outputPath = resolve(
  appRoot,
  "data/clinical-pathways/product-mappings.json",
);
const reportPath = resolve(
  appRoot,
  "data/clinical-pathways/coverage-report.json",
);

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

async function main(): Promise<void> {
  const [registryBytes, pathwayBytes] = await Promise.all([
    readFile(registryPath),
    readFile(pathwayPath),
  ]);
  const registry = JSON.parse(
    registryBytes.toString("utf8"),
  ) as HealthKrProductRegistry;
  const dataset = parseClinicalPathwayDataset(
    JSON.parse(pathwayBytes.toString("utf8")) as unknown,
  );

  const records = registry.records.map((record) => {
    const official = record.officialProduct;
    const base = {
      registryRecordId: record.registryRecordId,
      skuId: record.retailOffer.skuId,
      productId: record.recommendation.productId,
      officialMatchStatus: record.officialMatch.status,
      officialProductKey: record.officialMatch.productKey,
    };
    if (record.officialMatch.status !== "confirmed" || !official)
      return {
        ...base,
        mappingStatus: "not_confirmed" as const,
        pathways: [],
        ingredientMappings: [],
        exclusionReasons: ["official_match_not_confirmed"],
      };

    const pathways = classifyOfficialProduct(
      {
        efficacy: official.efficacy,
        route: official.route,
        dosageForm: official.dosageForm,
        officialCategory: official.classification.category,
        itemName: official.itemName,
        kpicAtc: official.classification.kpicAtc,
        activeIngredientTexts: official.activeIngredients.map(
          (ingredient) => ingredient.sourceText,
        ),
      },
      dataset,
    );
    const ingredientMappings = official.activeIngredients.map((ingredient) => ({
      sourceText: ingredient.sourceText,
      ingredientId:
        ingredient.ingredientId ?? canonicalIngredientId(ingredient.sourceText),
      identitySource:
        ingredient.ingredientId === null ? "official_text_hash" : "pack_alias",
    }));
    const direct = pathways.some((pathway) => pathway.matchType === "direct");
    const supportive = pathways.some(
      (pathway) => pathway.matchType === "supportive",
    );
    const exclusionReasons = [
      ...(official.otcStatus !== "otc" ? ["not_otc"] : []),
      ...(official.permit.cancelled ? ["permit_cancelled"] : []),
      ...(record.officialMatch.evidence.conflicts.length
        ? ["source_match_conflict"]
        : []),
      ...(official.activeIngredients.length === 0
        ? ["active_ingredient_missing"]
        : []),
      ...(!direct
        ? [supportive ? "supportive_only" : "pathway_not_found"]
        : []),
    ];
    return {
      ...base,
      mappingStatus: direct
        ? ("direct" as const)
        : supportive
          ? ("supportive" as const)
          : ("unmapped" as const),
      pathways,
      ingredientMappings,
      exclusionReasons,
    };
  });

  const confirmed = records.filter(
    (record) => record.officialMatchStatus === "confirmed",
  );
  const direct = confirmed.filter(
    (record) => record.mappingStatus === "direct",
  );
  const supportive = confirmed.filter(
    (record) => record.mappingStatus === "supportive",
  );
  const unmapped = confirmed.filter(
    (record) => record.mappingStatus === "unmapped",
  );
  if (confirmed.length !== 458)
    throw new Error(
      `expected 458 confirmed SKUs, received ${confirmed.length}`,
    );
  if (direct.length + supportive.length + unmapped.length !== confirmed.length)
    throw new Error("confirmed pathway coverage is not exhaustive");

  const pathwayCounts = Object.fromEntries(
    [
      ...new Set(
        confirmed.flatMap((record) => record.pathways.map((p) => p.pathwayId)),
      ),
    ]
      .sort()
      .map((pathwayId) => [
        pathwayId,
        confirmed.filter((record) =>
          record.pathways.some((pathway) => pathway.pathwayId === pathwayId),
        ).length,
      ]),
  );
  const mapping = {
    schemaVersion: "1.0.0",
    generatedAt: registry.generatedAt,
    researchOnly: true,
    source: {
      registrySha256: sha256(registryBytes),
      pathwaysSha256: sha256(pathwayBytes),
    },
    records,
  };
  const report = {
    schemaVersion: "1.0.0",
    generatedAt: registry.generatedAt,
    totalSkuCount: records.length,
    confirmedSkuCount: confirmed.length,
    directMappedSkuCount: direct.length,
    supportiveMappedSkuCount: supportive.length,
    unmappedConfirmedSkuCount: unmapped.length,
    exhaustiveCoverage:
      direct.length + supportive.length + unmapped.length === confirmed.length,
    uniqueDirectOfficialProductCount: new Set(
      direct.map((record) => record.officialProductKey),
    ).size,
    generatedIngredientIdentityCount: new Set(
      direct.flatMap((record) =>
        record.ingredientMappings
          .filter((mapping) => mapping.identitySource === "official_text_hash")
          .map((mapping) => mapping.ingredientId),
      ),
    ).size,
    pathwayCounts,
    unmappedConfirmed: unmapped.map((record) => ({
      skuId: record.skuId,
      officialProductKey: record.officialProductKey,
      exclusionReasons: record.exclusionReasons,
    })),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await Promise.all([
    writeFile(outputPath, `${JSON.stringify(mapping, null, 2)}\n`, "utf8"),
    writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  ]);
  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
