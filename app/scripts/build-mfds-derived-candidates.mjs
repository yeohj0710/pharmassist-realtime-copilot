import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  readKrDrugManifest,
  streamKrDrugDataset,
} from "./lib/kr-drug-data-reader.mjs";

const appRoot = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(appRoot, "data", "actual-candidate-source");
const outputRoot = resolve(appRoot, "data", "actual-candidate-pack");
const packPath = resolve(outputRoot, "pack.json");
const worklistPath = resolve(outputRoot, "mfds-ingredient-worklist.json");
const pathwayCatalogPath = resolve(
  appRoot,
  "data",
  "clinical-pathways",
  "pathways.json",
);

const durIngredientDatasets = [
  "dur-ingredient:usjnt-taboo",
  "dur-ingredient:pwnm-taboo",
  "dur-ingredient:cpcty-atent",
  "dur-ingredient:mdctn-pd-atent",
  "dur-ingredient:odsn-atent",
  "dur-ingredient:spcify-agrde-taboo",
  "dur-ingredient:efcy-dplct",
];

const durIngredientFiles = new Map([
  ["dur-ingredient:usjnt-taboo", "usjnt-taboo.jsonl"],
  ["dur-ingredient:pwnm-taboo", "pwnm-taboo.jsonl"],
  ["dur-ingredient:cpcty-atent", "cpcty-atent.jsonl"],
  ["dur-ingredient:mdctn-pd-atent", "mdctn-pd-atent.jsonl"],
  ["dur-ingredient:odsn-atent", "odsn-atent.jsonl"],
  ["dur-ingredient:spcify-agrde-taboo", "spcify-agrde-taboo.jsonl"],
  ["dur-ingredient:efcy-dplct", "efcy-dplct.jsonl"],
]);

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readJsonl = async (name) =>
  (await readFile(resolve(sourceRoot, name), "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const normalized = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/<[^>]*>/gu, " ")
    .replace(
      /\d+(?:\.\d+)?\s*(?:mg|g|kg|mcg|μg|ug|ml|mL|iu|%|정|캡슐|포|포장|병|mL|밀리그램|그램|밀리리터)/giu,
      " ",
    )
    .replace(/[^0-9a-z\uac00-\ud7a3]+/giu, "");

const nameAliases = (value) => {
  const text = String(value ?? "")
    .normalize("NFKC")
    .replace(/<[^>]*>/gu, " ")
    .replace(
      /\d+(?:\.\d+)?\s*(?:mg|g|kg|mcg|μg|ug|ml|mL|iu|%|정|캡슐|포|포장|병|밀리그램|그램|밀리리터)/giu,
      " ",
    );
  const values = new Set();
  const full = normalized(text);
  if (full.length >= 4) values.add(full);
  const korean = normalized((text.match(/[\uac00-\ud7a3]+/gu) ?? []).join(""));
  if (korean.length >= 4) values.add(korean);
  const latin = normalized(
    (text.match(/[A-Za-z][A-Za-z -]*/gu) ?? []).join(" "),
  );
  if (latin.length >= 4) values.add(latin);
  return [...values];
};

const flattenedStrings = (value) => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenedStrings);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(flattenedStrings);
  return [];
};

const materialIngredientNames = (value) =>
  flattenedStrings(value).flatMap((text) =>
    [...text.matchAll(/성분명\s*:\s*([^|;]+)/gu)]
      .map((match) => match[1].trim())
      .filter(Boolean),
  );

const officialIngredientValues = (record) => {
  const values = [];
  if (typeof record.ingredientName === "string")
    values.push(record.ingredientName);
  for (const [key, value] of Object.entries(record.fields ?? {})) {
    if (key === "MATERIAL_NAME") {
      values.push(...materialIngredientNames(value));
      continue;
    }
    if (
      /(?:INGR|INGREDIENT|SUBSTANCE|MATERIAL|ACTIVE[_ ]?COMPONENT)/iu.test(
        key,
      ) &&
      !/(?:CODE|SEQ|COUNT|UNIT)/iu.test(key)
    )
      values.push(...flattenedStrings(value));
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
};

const ingredientCode = (record) => {
  if (record.ingredientCode) return String(record.ingredientCode);
  for (const [key, value] of Object.entries(record.fields ?? {})) {
    if (
      /(?:INGR|INGREDIENT).*(?:CODE|SEQ)|(?:CODE|SEQ).*(?:INGR|INGREDIENT)/iu.test(
        key,
      )
    ) {
      const text = flattenedStrings(value).find(Boolean);
      if (text) return text;
    }
  }
  return null;
};

const bestNameMatch = (sourceNames, officialNames) => {
  const matches = [];
  for (const sourceName of sourceNames) {
    for (const sourceAlias of nameAliases(sourceName)) {
      for (const officialName of officialNames) {
        for (const officialAlias of nameAliases(officialName)) {
          if (sourceAlias !== officialAlias) continue;
          matches.push({
            score:
              sourceAlias === normalized(sourceName)
                ? 100
                : sourceAlias.length >= 6
                  ? 90
                  : 80,
            sourceName,
            officialName,
          });
        }
      }
    }
  }
  return (
    matches.sort(
      (left, right) =>
        right.score - left.score ||
        left.officialName.length - right.officialName.length,
    )[0] ?? null
  );
};

const sourceSnapshotFor = (dataset, manifests) => {
  if (dataset.startsWith("dur-ingredient:")) {
    const file = durIngredientFiles.get(dataset);
    return manifests.durIngredient.sourceSnapshots.find(
      (entry) => entry.file === file,
    )?.sourceSnapshot;
  }
  return manifests[dataset].sourceSnapshot;
};

const snapshotSource = (snapshot) => {
  if (!snapshot) return null;
  return {
    source_snapshot_id: snapshot.source_snapshot_id,
    source_id: snapshot.source_id,
    provider: snapshot.provider,
    official: snapshot.official,
    source_url: snapshot.source_url,
    fetched_at: snapshot.fetched_at,
    effective_at: snapshot.effective_at,
    terms_url: snapshot.terms_url,
    usage_rights: snapshot.usage_rights,
    commercial_use: snapshot.commercial_use,
    cache_policy: snapshot.cache_policy,
    redistribution: snapshot.redistribution,
    ai_context_use: snapshot.ai_context_use,
    http_status: snapshot.http_status,
    content_sha256: snapshot.content_sha256,
    content_type: snapshot.content_type,
    parser_version: snapshot.parser_version,
    record_count: snapshot.record_count,
    page_count: snapshot.page_count,
    next_cursor: snapshot.next_cursor,
    status: snapshot.status,
    raw_retention_policy: snapshot.raw_retention_policy,
    uncertainty: snapshot.uncertainty,
  };
};

const sourceRefFor = (
  snapshot,
  ingredientId,
  field,
  sourceLabel = "ingredient",
) => ({
  claim_id: `REG-MFDS-ING-${ingredientId}`,
  source_id: snapshot.source_id,
  source_snapshot_id: snapshot.source_snapshot_id,
  locator: `MFDS official ${sourceLabel} field: ${field}`,
  verified_at: snapshot.fetched_at,
});

const createWorklist = (pack) => {
  const registered = new Set(
    (pack.ingredients ?? []).map((item) => item.ingredient_id),
  );
  const byId = new Map();
  for (const product of pack.products ?? []) {
    for (const ingredient of product.active_ingredients ?? []) {
      if (registered.has(ingredient.ingredient_id)) continue;
      const item = byId.get(ingredient.ingredient_id) ?? {
        ingredientId: ingredient.ingredient_id,
        sourceNames: new Set(),
        strengths: new Set(),
        itemSeqs: new Set(),
        productIds: new Set(),
        productNames: new Set(),
      };
      item.sourceNames.add(ingredient.name ?? "");
      item.strengths.add(ingredient.strength_text ?? "");
      item.itemSeqs.add(String(product.item_seq ?? ""));
      item.productIds.add(product.product_id);
      item.productNames.add(product.display_name);
      byId.set(ingredient.ingredient_id, item);
    }
  }
  return {
    schemaVersion: "1.0.0",
    candidateOnly: true,
    clinicalUseProhibited: true,
    generatedAt: new Date().toISOString(),
    entries: [...byId.values()].map((item) => ({
      ingredientId: item.ingredientId,
      sourceNames: [...item.sourceNames].filter(Boolean),
      strengths: [...item.strengths].filter(Boolean),
      itemSeqs: [...item.itemSeqs].filter(Boolean),
      productIds: [...item.productIds],
      productNames: [...item.productNames],
    })),
  };
};

const recordIdentifier = (record) =>
  String(
    record.itemSeq ??
      record.ingredientCode ??
      record.fields?.ITEM_SEQ ??
      record.fields?.ITEM_SEQ_NO ??
      record.fields?.INGR_CODE ??
      "",
  );

const nonEmpty = (value) =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const permitIngredientRows = (permit) => {
  const materialName = flattenedStrings(permit.fields?.MATERIAL_NAME).join("|");
  const rows = [
    ...materialName.matchAll(
      /성분명\s*:\s*([^|]+)(?:\|분량\s*:\s*([^|]+))?(?:\|단위\s*:\s*([^|]+))?/gu,
    ),
  ]
    .map((match) => {
      return {
        ingredient: match[1].trim(),
        strength:
          [match[2]?.trim(), match[3]?.trim()].filter(Boolean).join(" ") ||
          null,
      };
    })
    .filter((row) => row.ingredient.length > 0)
    .filter((row, index, values) => {
      const key = `${row.ingredient}|${row.strength ?? ""}`;
      return (
        values.findIndex(
          (candidate) =>
            `${candidate.ingredient}|${candidate.strength ?? ""}` === key,
        ) === index
      );
    });
  if (rows.length > 0) return rows;
  const mainIngredient = nonEmpty(permit.fields?.MAIN_ITEM_INGR);
  return mainIngredient ? [{ ingredient: mainIngredient, strength: null }] : [];
};

const permitDosageForm = (permit, product) =>
  nonEmpty(permit.fields?.DOSAGE_FORM) ??
  nonEmpty(permit.fields?.FORM_NAME) ??
  nonEmpty(product.dosage_form);

const main = async () => {
  const pack = await readJson(packPath);
  const pathwayCatalog = await readJson(pathwayCatalogPath);
  const pathwayIdByProtocolId = new Map(
    (pathwayCatalog.pathways ?? []).map((pathway) => [
      String(pathway.protocolId ?? ""),
      String(pathway.pathwayId ?? ""),
    ]),
  );
  const pathwayIdsByProductId = new Map();
  for (const product of pack.products ?? []) {
    const productId = String(product.product_id ?? "");
    if (!productId) continue;
    const pathwayIds = pathwayIdsByProductId.get(productId) ?? new Set();
    for (const profile of [
      ...(product.selection_profiles ?? []),
      ...(product.pathway_profiles ?? []),
    ]) {
      const protocolId = String(
        profile.protocol_id ?? profile.protocolId ?? "",
      );
      const pathwayId =
        profile.pathway_id ??
        profile.pathwayId ??
        pathwayIdByProtocolId.get(protocolId);
      if (pathwayId) pathwayIds.add(String(pathwayId));
    }
    if (pathwayIds.size > 0) pathwayIdsByProductId.set(productId, pathwayIds);
  }
  let worklist;
  try {
    worklist = await readJson(worklistPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    worklist = createWorklist(pack);
    await writeFile(
      worklistPath,
      `${JSON.stringify(worklist, null, 2)}\n`,
      "utf8",
    );
  }

  const manifests = {
    easy: await readKrDrugManifest("easy-drug"),
    permit: await readKrDrugManifest("permit"),
    "dur-product": await readKrDrugManifest("dur-product"),
    durIngredient: await readKrDrugManifest("dur-ingredient"),
  };
  for (const [name, manifest] of Object.entries(manifests)) {
    if (manifest.schemaVersion !== 1 || manifest.candidateOnly !== true)
      throw new Error(`MFDS local manifest contract failed: ${name}`);
  }

  const sourceProducts = await readJsonl("drug_products.jsonl");
  const sourceByItemSeq = new Map(
    sourceProducts.map((product) => [String(product.item_seq), product]),
  );
  const indicationProductsByItemSeq = new Map(sourceByItemSeq);
  let previousIndicationCandidates = { entries: [] };
  try {
    previousIndicationCandidates = await readJson(
      resolve(outputRoot, "mfds-indication-candidates.json"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const packProductsByItemSeq = new Map(
    (pack.products ?? []).map((product) => [String(product.item_seq), product]),
  );
  for (const entry of previousIndicationCandidates.entries ?? []) {
    const itemSeq = String(entry.itemSeq ?? "");
    const product = packProductsByItemSeq.get(itemSeq);
    if (itemSeq && product && !indicationProductsByItemSeq.has(itemSeq))
      indicationProductsByItemSeq.set(itemSeq, {
        item_seq: itemSeq,
        product_id: product.product_id,
      });
  }
  for (const product of pack.products ?? []) {
    const itemSeq = String(product.item_seq ?? "");
    if (
      itemSeq &&
      !nonEmpty(product.indication_summary) &&
      !indicationProductsByItemSeq.has(itemSeq)
    )
      indicationProductsByItemSeq.set(itemSeq, {
        item_seq: itemSeq,
        product_id: product.product_id,
      });
  }
  const indicationTargets = new Set(indicationProductsByItemSeq.keys());
  const easyByItemSeq = new Map();
  for await (const record of streamKrDrugDataset("easy-drug")) {
    if (indicationTargets.has(String(record.itemSeq)))
      easyByItemSeq.set(String(record.itemSeq), record);
  }

  const permitTargets = new Set([
    ...indicationTargets,
    ...worklist.entries.flatMap((entry) => entry.itemSeqs),
    ...(pack.products ?? [])
      .filter((product) => pathwayIdsByProductId.has(product.product_id))
      .map((product) => String(product.item_seq)),
  ]);
  const permitByItemSeq = new Map();
  for await (const record of streamKrDrugDataset("permit")) {
    if (permitTargets.has(String(record.itemSeq)))
      permitByItemSeq.set(String(record.itemSeq), record);
  }

  const durRecords = [];
  for (const dataset of durIngredientDatasets) {
    for await (const record of streamKrDrugDataset(dataset))
      durRecords.push({ dataset, record });
  }

  const ingredientMatches = new Map();
  for (const entry of worklist.entries) {
    const candidates = [];
    for (const itemSeq of entry.itemSeqs) {
      const permit = permitByItemSeq.get(String(itemSeq));
      if (!permit) continue;
      const match = bestNameMatch(
        entry.sourceNames,
        officialIngredientValues(permit),
      );
      if (match)
        candidates.push({
          ...match,
          dataset: "permit",
          record: permit,
          field: "MATERIAL_NAME/성분명",
        });
    }
    for (const { dataset, record } of durRecords) {
      const match = bestNameMatch(
        entry.sourceNames,
        officialIngredientValues(record),
      );
      if (match)
        candidates.push({
          ...match,
          dataset,
          record,
          field: "ingredient name field",
        });
    }
    const unique = new Map();
    for (const candidate of candidates) {
      const snapshot = sourceSnapshotFor(candidate.dataset, manifests);
      const key = `${normalized(candidate.officialName)}|${snapshot?.source_snapshot_id}`;
      if (!unique.has(key)) unique.set(key, { ...candidate, snapshot });
    }
    ingredientMatches.set(entry.ingredientId, [...unique.values()]);
  }

  const ingredientEntries = [];
  const skippedIngredients = [];
  const ingredientSources = new Map();
  for (const entry of worklist.entries) {
    const matches = ingredientMatches.get(entry.ingredientId) ?? [];
    if (matches.length === 0) {
      skippedIngredients.push({
        ingredientId: entry.ingredientId,
        sourceNames: entry.sourceNames,
        itemSeqs: entry.itemSeqs,
        reason: "not_found_in_official_permit_or_dur_ingredient",
      });
      continue;
    }
    const topScore = Math.max(...matches.map((match) => match.score));
    const top = matches.filter((match) => match.score === topScore);
    const names = new Set(top.map((match) => normalized(match.officialName)));
    if (names.size !== 1) {
      skippedIngredients.push({
        ingredientId: entry.ingredientId,
        sourceNames: entry.sourceNames,
        itemSeqs: entry.itemSeqs,
        reason: "ambiguous_official_ingredient_name",
        candidates: top.map((match) => ({
          name: match.officialName,
          dataset: match.dataset,
          sourceSnapshotId: match.snapshot?.source_snapshot_id,
        })),
      });
      continue;
    }
    const selected = top[0];
    const snapshot = selected.snapshot;
    const source = snapshotSource(snapshot);
    if (!source?.source_snapshot_id)
      throw new Error(
        `MFDS ingredient match has no source snapshot: ${entry.ingredientId}`,
      );
    ingredientSources.set(source.source_snapshot_id, source);
    const code = ingredientCode(selected.record);
    ingredientEntries.push({
      ingredient_id: entry.ingredientId,
      display_name_ko: selected.officialName,
      display_name_en: selected.officialName,
      normalized_name: normalized(selected.officialName),
      mfds_ingredient_code: code,
      status: "active",
      candidateOnly: true,
      clinicalUseProhibited: true,
      source_snapshot_ids: [source.source_snapshot_id],
      source_refs: [sourceRefFor(snapshot, entry.ingredientId, selected.field)],
      source_names: entry.sourceNames,
      review: {
        expires_at: null,
        notes:
          "MFDS official ingredient name candidate; pharmacist review pending.",
        official_source_verified: true,
        pharmacist_approved: false,
        reviewed_at: null,
        reviewer_ids: [],
      },
    });
  }

  const indicationEntries = [];
  const indicationSkipped = [];
  const indicationSources = new Map();
  for (const product of indicationProductsByItemSeq.values()) {
    const itemSeq = String(product.item_seq);
    const easy = easyByItemSeq.get(itemSeq);
    const permit = permitByItemSeq.get(itemSeq);
    const easyText = nonEmpty(easy?.fields?.efcyQesitm);
    const permitText = nonEmpty(permit?.fields?.EE_DOC_DATA);
    const selected = easyText
      ? { dataset: "easy", record: easy, field: "efcyQesitm", text: easyText }
      : permitText
        ? {
            dataset: "permit",
            record: permit,
            field: "EE_DOC_DATA",
            text: permitText,
          }
        : null;
    if (!selected) {
      indicationSkipped.push({
        productId: product.product_id,
        itemSeq,
        reason: "official_indication_field_not_found",
      });
      continue;
    }
    const snapshot = sourceSnapshotFor(selected.dataset, manifests);
    const source = snapshotSource(snapshot);
    indicationSources.set(source.source_snapshot_id, source);
    indicationEntries.push({
      productId: product.product_id,
      itemSeq,
      indicationSummary: selected.text,
      sourceDataset: selected.dataset,
      sourceField: selected.field,
      source_snapshot_id: source.source_snapshot_id,
      source_ref: sourceRefFor(
        snapshot,
        product.product_id,
        selected.field,
        "indication",
      ),
    });
  }

  const productTargets = new Map();
  for (const product of pack.products ?? []) {
    if ((product.dur_flags ?? []).length !== 0) continue;
    const itemSeq = String(product.item_seq ?? "");
    if (!itemSeq) continue;
    const target = productTargets.get(itemSeq) ?? {
      itemSeq,
      products: [],
    };
    target.products.push(product);
    productTargets.set(itemSeq, target);
  }
  const durProductEntries = [];
  const durProductMatchedItemSeqs = new Set();
  for await (const record of streamKrDrugDataset("dur-product")) {
    const itemSeq = String(record.itemSeq);
    const target = productTargets.get(itemSeq);
    if (!target) continue;
    durProductMatchedItemSeqs.add(itemSeq);
    const snapshot = sourceSnapshotFor("dur-product", manifests);
    const productIds = target.products.map((product) => product.product_id);
    const productNames = target.products.map((product) => product.display_name);
    durProductEntries.push({
      candidateOnly: true,
      clinicalUseProhibited: true,
      candidateType: "product",
      itemSeq,
      productId: productIds[0],
      productIds,
      productNames,
      durRecordId: recordIdentifier(record),
      matchMode: "itemSeq-exact",
      fields: record.fields,
      source_snapshot_id: snapshot.source_snapshot_id,
      source: snapshotSource(snapshot),
    });
  }
  const durProductSkipped = [...productTargets.keys()]
    .filter((itemSeq) => !durProductMatchedItemSeqs.has(itemSeq))
    .map((itemSeq) => {
      const productIds = productTargets
        .get(itemSeq)
        .products.map((product) => product.product_id);
      return {
        itemSeq,
        productId: productIds[0],
        productIds,
        reason: "not_found_in_official_dur_product",
      };
    });

  const durIngredientTargets = new Map();
  for (const productTarget of productTargets.values()) {
    for (const product of productTarget.products) {
      for (const ingredient of product.active_ingredients ?? []) {
        const ingredientId = ingredient.ingredient_id;
        if (!ingredientId) continue;
        const target = durIngredientTargets.get(ingredientId) ?? {
          ingredientId,
          sourceNames: new Set(),
          productIds: new Set(),
          productNames: new Set(),
        };
        target.sourceNames.add(ingredient.name ?? "");
        target.productIds.add(product.product_id);
        target.productNames.add(product.display_name);
        durIngredientTargets.set(ingredientId, target);
      }
    }
  }
  const durIngredientMatches = new Map();
  for (const target of durIngredientTargets.values()) {
    const candidates = [];
    for (const { dataset, record } of durRecords) {
      const match = bestNameMatch(
        [...target.sourceNames],
        officialIngredientValues(record),
      );
      if (match)
        candidates.push({
          ...match,
          dataset,
          record,
          field: "ingredient name field",
        });
    }
    const unique = new Map();
    for (const candidate of candidates) {
      const snapshot = sourceSnapshotFor(candidate.dataset, manifests);
      const key = `${candidate.dataset}|${normalized(candidate.officialName)}|${recordIdentifier(candidate.record)}|${snapshot?.source_snapshot_id}`;
      if (!unique.has(key)) unique.set(key, { ...candidate, snapshot });
    }
    durIngredientMatches.set(target.ingredientId, [...unique.values()]);
  }

  const durIngredientEntriesByKey = new Map();
  const appendDurIngredientEntry = (ingredientId, target, match) => {
    if (!match.dataset.startsWith("dur-ingredient:")) return;
    const snapshot = match.snapshot;
    const key = `${ingredientId}|${match.dataset}|${recordIdentifier(match.record)}|${snapshot?.source_snapshot_id}`;
    const entry = durIngredientEntriesByKey.get(key) ?? {
      candidateOnly: true,
      clinicalUseProhibited: true,
      candidateType: "ingredient",
      ingredientId,
      sourceName: match.sourceName,
      officialName: match.officialName,
      dataset: match.dataset,
      durRecordId: recordIdentifier(match.record),
      matchMode: "official-name-exact",
      fields: match.record.fields,
      source_snapshot_id: snapshot.source_snapshot_id,
      source: snapshotSource(snapshot),
      productIds: new Set(),
      productNames: new Set(),
    };
    for (const productId of target.productIds ?? [])
      entry.productIds.add(productId);
    for (const productName of target.productNames ?? [])
      entry.productNames.add(productName);
    durIngredientEntriesByKey.set(key, entry);
  };
  for (const entry of worklist.entries) {
    for (const match of ingredientMatches.get(entry.ingredientId) ?? []) {
      appendDurIngredientEntry(entry.ingredientId, entry, match);
    }
  }
  for (const target of durIngredientTargets.values())
    for (const match of durIngredientMatches.get(target.ingredientId) ?? [])
      appendDurIngredientEntry(target.ingredientId, target, match);
  const durIngredientEntries = [...durIngredientEntriesByKey.values()].map(
    (entry) => ({
      ...entry,
      productIds: [...entry.productIds],
      productNames: [...entry.productNames],
    }),
  );
  const durIngredientSkipped = [...durIngredientTargets.values()]
    .filter(
      (target) => !(durIngredientMatches.get(target.ingredientId)?.length ?? 0),
    )
    .map((target) => ({
      ingredientId: target.ingredientId,
      sourceNames: [...target.sourceNames].filter(Boolean),
      productIds: [...target.productIds],
      productNames: [...target.productNames],
      reason: "not_found_in_official_dur_ingredient",
    }));

  const healthKrRegistry = await readJson(
    resolve(appRoot, "data", "healthkr-product-registry", "registry.json"),
  );
  const legacyReport = await readJson(
    resolve(outputRoot, "healthkr-legacy-match-report.json"),
  );
  const registryByProductId = new Map(
    healthKrRegistry.records
      .map((record) => [record.recommendation?.productId, record])
      .filter(([productId]) => productId),
  );
  const permitCrosswalkCandidates = legacyReport.records
    .filter((record) => record.status === "failed")
    .map((record) => {
      const product = sourceProducts.find(
        (item) => item.product_id === record.productId,
      );
      const registry = registryByProductId.get(record.productId);
      const official = registry?.officialProduct ?? null;
      const permit = official?.itemSeq
        ? permitByItemSeq.get(String(official.itemSeq))
        : null;
      const permitSnapshot = manifests.permit.sourceSnapshot;
      return {
        candidateOnly: true,
        clinicalUseProhibited: true,
        productId: record.productId,
        itemSeq: product?.item_seq ?? official?.itemSeq ?? null,
        officialProductKey: official?.productKey ?? null,
        matchStatus: registry?.officialMatch?.status ?? null,
        evidence: {
          manufacturer: {
            local: product?.manufacturer ?? null,
            official:
              official?.manufacturer ?? permit?.fields?.ENTP_NAME ?? null,
          },
          ingredient: {
            local: product?.active_ingredients?.map((item) => item.name) ?? [],
            official:
              official?.activeIngredients?.map((item) => item.sourceText) ?? [],
            permit:
              permit?.fields?.MAIN_ITEM_INGR ??
              permit?.fields?.INGR_NAME ??
              null,
          },
          dosageForm: {
            local: product?.dosage_form ?? null,
            official:
              official?.dosageForm ?? permit?.fields?.DOSAGE_FORM ?? null,
          },
          permit: {
            itemSeq: permit?.itemSeq ?? null,
            itemName: permit?.fields?.ITEM_NAME ?? null,
            permitStatus: permit?.fields?.CANCEL_NAME ?? null,
          },
        },
        permitSource: snapshotSource(permitSnapshot),
      };
    });

  const sameItemSeqGroups = new Map();
  for (const record of healthKrRegistry.records) {
    const itemSeq = record.officialProduct?.itemSeq;
    const productId = record.recommendation?.productId;
    if (!itemSeq || !productId) continue;
    const group = sameItemSeqGroups.get(String(itemSeq)) ?? [];
    group.push({ productId, registryRecordId: record.registryRecordId });
    sameItemSeqGroups.set(String(itemSeq), group);
  }
  const sameItemSeqPairs = [];
  for (const [itemSeq, group] of sameItemSeqGroups) {
    if (group.length < 2) continue;
    const [left, right, ...additional] = group;
    const permit = permitByItemSeq.get(itemSeq);
    const permitSnapshot = manifests.permit.sourceSnapshot;
    const permitSource = snapshotSource(permitSnapshot);
    const localProducts = [left, right, ...additional].map((member) =>
      sourceProducts.find((product) => product.product_id === member.productId),
    );
    sameItemSeqPairs.push({
      candidateOnly: true,
      clinicalUseProhibited: true,
      itemSeq,
      left,
      right,
      ...(additional.length > 0 ? { additional } : {}),
      evidence: {
        manufacturer: {
          local: localProducts.map((product) => product?.manufacturer ?? null),
          official: permit?.fields?.ENTP_NAME ?? null,
        },
        ingredient: {
          local: localProducts.map(
            (product) =>
              product?.active_ingredients?.map(
                (ingredient) => ingredient.name,
              ) ?? [],
          ),
          official:
            permit?.fields?.MAIN_ITEM_INGR ?? permit?.fields?.INGR_NAME ?? null,
        },
        dosageForm: {
          local: localProducts.map((product) => product?.dosage_form ?? null),
          official: permit?.fields?.DOSAGE_FORM ?? null,
        },
        permit: {
          itemSeq: permit?.itemSeq ?? itemSeq,
          itemName: permit?.fields?.ITEM_NAME ?? null,
          permitStatus: permit?.fields?.CANCEL_NAME ?? null,
        },
      },
      permitSource,
    });
  }

  const differenceTargets = [];
  for (const product of pack.products ?? []) {
    for (const pathwayId of [
      ...(pathwayIdsByProductId.get(product.product_id) ?? []),
    ])
      differenceTargets.push({ pathwayId, product });
  }
  differenceTargets.sort(
    (left, right) =>
      left.pathwayId.localeCompare(right.pathwayId) ||
      String(left.product.item_seq).localeCompare(
        String(right.product.item_seq),
      ) ||
      left.product.product_id.localeCompare(right.product.product_id),
  );
  const differenceRows = [];
  for (const { pathwayId, product } of differenceTargets) {
    const permit = permitByItemSeq.get(String(product.item_seq));
    if (!permit) continue;
    const permitSnapshot = manifests.permit.sourceSnapshot;
    const ingredients = permitIngredientRows(permit);
    differenceRows.push({
      candidateOnly: true,
      clinicalUseProhibited: true,
      pathwayId,
      productName: permit.fields?.ITEM_NAME ?? product.display_name,
      productId: product.product_id,
      itemSeq: product.item_seq,
      ingredient: ingredients.map((entry) => entry.ingredient),
      strength: ingredients.map((entry) => entry.strength),
      dosageForm: permitDosageForm(permit, product),
      dosageFormOfficialRaw: permit.fields?.CHART ?? null,
      indication: permit.fields?.EE_DOC_DATA ?? null,
      permitSource: snapshotSource(permitSnapshot),
    });
  }

  const write = async (name, value) =>
    writeFile(
      resolve(outputRoot, name),
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    );
  await write("mfds-indication-candidates.json", {
    schemaVersion: "1.0.0",
    candidateOnly: true,
    clinicalUseProhibited: true,
    entries: indicationEntries,
    skipped: indicationSkipped,
    sources: [...indicationSources.values()],
  });
  await write("mfds-ingredient-candidates.json", {
    schemaVersion: "1.0.0",
    candidateOnly: true,
    clinicalUseProhibited: true,
    worklistCount: worklist.entries.length,
    registeredCount: ingredientEntries.length,
    skippedCount: skippedIngredients.length,
    entries: ingredientEntries,
    skipped: skippedIngredients,
    sources: [...ingredientSources.values()],
  });
  await write("mfds-dur-candidates.json", {
    schemaVersion: "1.0.0",
    candidateOnly: true,
    clinicalUseProhibited: true,
    ingredientDatasetCount: durIngredientDatasets.length,
    productTargetCount: productTargets.size,
    productTargetProductCount: [...productTargets.values()].reduce(
      (count, target) => count + target.products.length,
      0,
    ),
    productEntries: durProductEntries,
    productSkipped: durProductSkipped,
    ingredientTargetCount: durIngredientTargets.size,
    ingredientEntries: durIngredientEntries,
    ingredientSkipped: durIngredientSkipped,
  });
  await write("mfds-permit-crosswalk-candidates.json", {
    schemaVersion: "1.0.0",
    candidateOnly: true,
    clinicalUseProhibited: true,
    failedLegacyCount: permitCrosswalkCandidates.length,
    failedLegacy: permitCrosswalkCandidates,
    sameItemSeqPairs,
  });
  await write("mfds-permit-difference-table.json", {
    schemaVersion: "1.0.0",
    candidateOnly: true,
    clinicalUseProhibited: true,
    columns: [
      "pathwayId",
      "itemSeq",
      "productId",
      "productName",
      "ingredient",
      "strength",
      "dosageForm",
      "dosageFormOfficialRaw",
      "indication",
      "permitSource",
    ],
    rows: differenceRows,
  });

  console.log(
    JSON.stringify(
      {
        indicationResolved: indicationEntries.length,
        indicationSkipped: indicationSkipped.length,
        ingredientWorklist: worklist.entries.length,
        ingredientRegistered: ingredientEntries.length,
        ingredientSkipped: skippedIngredients.length,
        durProductTargets: productTargets.size,
        durProductTargetProducts: [...productTargets.values()].reduce(
          (count, target) => count + target.products.length,
          0,
        ),
        durProductCandidates: durProductEntries.length,
        durProductSkipped: durProductSkipped.length,
        durIngredientTargets: durIngredientTargets.size,
        durIngredientCandidates: durIngredientEntries.length,
        durIngredientSkipped: durIngredientSkipped.length,
        failedLegacyCrosswalkCandidates: permitCrosswalkCandidates.length,
        sameItemSeqPairs: sameItemSeqPairs.length,
        permitDifferenceRows: differenceRows.length,
        sourceSnapshots: [
          ...ingredientSources.values(),
          ...indicationSources.values(),
        ].length,
        worklistSha256: createHash("sha256")
          .update(JSON.stringify(worklist))
          .digest("hex"),
      },
      null,
      2,
    ),
  );
};

await main();
