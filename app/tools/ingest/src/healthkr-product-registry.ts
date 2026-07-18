import { createHash } from "node:crypto";
import { validateContract } from "@pharmassist/contracts";
import { matchesProductProtocolProfile } from "@pharmassist/domain";

export type HealthKrOfficialMatchStatus =
  "confirmed" | "review_required" | "not_found" | "not_applicable";

export type HealthKrRecommendationExclusionReason =
  | "official_match_not_confirmed"
  | "official_identity_invalid"
  | "not_otc"
  | "permit_cancelled"
  | "source_match_conflict"
  | "active_ingredient_missing"
  | "active_ingredient_unmapped"
  | "protocol_indication_mismatch";

export interface HealthKrRegistryIngredient {
  readonly ingredient_id: string;
  readonly normalized_name: string;
  readonly display_name_en: string;
  readonly display_name_ko: string;
}

export interface HealthKrRegistryProtocolOption {
  readonly option_id: string;
  readonly protocol_id: string;
  readonly ingredient_id: string;
}

export interface HealthKrRegistryPack {
  readonly packId: string;
  readonly version: string;
  readonly ingredients: readonly HealthKrRegistryIngredient[];
  readonly protocolOptions: readonly HealthKrRegistryProtocolOption[];
}

export interface HealthKrRegistryBuildOptions {
  readonly generatedAt: string;
  readonly sourceContentSha256: string;
  readonly sourceByteLength: number;
  readonly mappingContentSha256: string;
}

export interface HealthKrDurSection {
  readonly present: boolean;
  readonly entries: readonly string[];
  readonly raw: string | null;
}

export interface HealthKrIngredientMapping {
  readonly ingredientId: string | null;
  readonly sourceText: string;
}

export type HealthKrContentBlock =
  | Readonly<{ type: "paragraph"; text: string }>
  | Readonly<{
      type: "table";
      headers: readonly string[];
      rows: readonly (readonly string[])[];
    }>;

export interface HealthKrContentSection {
  readonly text: string;
  readonly blocks: readonly HealthKrContentBlock[];
}

export interface HealthKrOfficialContent {
  readonly schemaVersion: "1.0";
  readonly normalizationVersion: string;
  readonly efficacy: HealthKrContentSection | null;
  readonly dosage: HealthKrContentSection | null;
  readonly precautions: HealthKrContentSection | null;
  readonly professionalPrecautions: HealthKrContentSection | null;
  readonly patientGuidance: HealthKrContentSection | null;
  readonly medicationGuide: HealthKrContentSection | null;
}

export interface HealthKrRegistryRecord {
  readonly registryRecordId: string;
  readonly retailOffer: Readonly<{
    skuId: string;
    documentId: string;
    displayName: string;
    normalizedName: string;
    capacity: string;
    normalizedCapacity: string;
    specification: string;
    category: string;
    displayedPriceKrw: number;
    currency: "KRW";
    recordedAt: string;
    priceStatus: string;
    sourceType: string;
    verificationStatus: string;
    image: Readonly<{
      url: string | null;
      sourceUrl: string | null;
      rightsStatus: string | null;
      kind: string | null;
      checkedAt: string | null;
    }>;
  }>;
  readonly officialMatch: Readonly<{
    status: HealthKrOfficialMatchStatus;
    score: number;
    itemSeq: string | null;
    productKey: string | null;
    identityValid: boolean;
    checkedAt: string | null;
    sourceType: string | null;
    sourceUrl: string | null;
    alternatives: readonly Readonly<{
      itemName: string;
      itemSeq: string;
      manufacturer: string | null;
      dosageForm: string | null;
      packUnit: string | null;
      sourceUrl: string | null;
      score: number;
      conflicts: readonly string[];
    }>[];
    evidence: Readonly<{
      detailPageVerified: boolean;
      ajaxPayloadVerified: boolean;
      matchReasons: readonly string[];
      conflicts: readonly string[];
      sourceUrls: readonly string[];
      verifiedFields: readonly string[];
      pipelineVersion: string | null;
    }>;
  }>;
  readonly officialProduct: HealthKrOfficialProduct | null;
  readonly recommendation: Readonly<{
    productId: string;
    ingredientIds: readonly string[];
    ingredientMappings: readonly HealthKrIngredientMapping[];
    unmappedActiveIngredients: readonly string[];
    protocolIds: readonly string[];
    optionIds: readonly string[];
    clinicalGroupKey: string | null;
    eligible: boolean;
    exclusionReasons: readonly HealthKrRecommendationExclusionReason[];
  }>;
}

export interface HealthKrOfficialProduct {
  readonly itemSeq: string;
  readonly productKey: string;
  readonly itemName: string;
  readonly englishName: string | null;
  readonly manufacturer: string;
  readonly manufacturerDetails: Readonly<{
    name: string | null;
    englishName: string | null;
    address: string | null;
    phone: string | null;
    fax: string | null;
    website: string | null;
  }>;
  readonly sourceType: string;
  readonly sourceUrl: string;
  readonly otcStatus: "otc" | "not_otc" | "unknown";
  readonly permit: Readonly<{
    permitDate: string | null;
    cancelled: boolean;
    cancelDate: string | null;
  }>;
  readonly classification: Readonly<{
    category: string | null;
    code: string | null;
    atcCode: string | null;
    kpicAtc: string | null;
  }>;
  readonly dosageForm: string | null;
  readonly route: string | null;
  readonly packUnit: string | null;
  readonly storage: string | null;
  readonly validTerm: string | null;
  readonly appearance: string | null;
  readonly efficacy: string | null;
  readonly dosage: string | null;
  readonly precautions: string | null;
  readonly professionalPrecautions: string | null;
  readonly content: HealthKrOfficialContent;
  readonly ingredients: readonly HealthKrIngredientSource[];
  readonly activeIngredients: readonly HealthKrIngredientSource[];
  readonly additives: readonly string[];
  readonly insurance: Readonly<{
    status: string | null;
    detail: string | null;
    history: readonly Readonly<{
      code: string | null;
      detail: string | null;
    }>[];
    reimbursementCriteria: string | null;
  }>;
  readonly consumerGuidance: Readonly<{
    summary: string | null;
    guide: string | null;
    patientGuidance: string | null;
    medicationGuide: string | null;
    sourceUrl: string | null;
  }>;
  readonly identification: string | null;
  readonly interactions: readonly Readonly<{
    tableIndex: number;
    cells: readonly string[];
  }>[];
  readonly sameIngredientProducts: readonly Readonly<{
    productName: string | null;
    manufacturer: string | null;
    otcStatus: string | null;
    price: string | null;
    bioequivalence: string | null;
    supplied: string | null;
    tableIndex: number | null;
    cells: readonly string[];
  }>[];
  readonly insertPdfUrl: string | null;
  readonly dur: Readonly<{
    contraindications: HealthKrDurSection;
    age: HealthKrDurSection;
    pregnancy: HealthKrDurSection;
    senior: HealthKrDurSection;
    maxDose: HealthKrDurSection;
    maxPeriod: HealthKrDurSection;
    splitDosage: HealthKrDurSection;
    pregnancyCategory: Readonly<{
      code: string;
      description: string | null;
    }> | null;
  }>;
  readonly images: readonly HealthKrMedia[];
  readonly pictograms: readonly HealthKrMedia[];
  readonly contentStatus: string | null;
  readonly upstreamUpdatedAt: string | null;
}

export interface HealthKrIngredientSource {
  readonly sourceText: string;
  readonly sourceIngredientCode: string | null;
  readonly sourceUrl: string | null;
  readonly ingredientId: string | null;
}

export interface HealthKrMedia {
  readonly url: string;
  readonly kind: string | null;
  readonly sourceUrl: string | null;
  readonly sourceDatasetId: string | null;
  readonly license: string | null;
  readonly fetchedAt: string | null;
}

export interface HealthKrProductRegistry {
  readonly schemaVersion: "1.0.0";
  readonly generatedAt: string;
  readonly source: Readonly<{
    logicalName: "pharmacy-product-catalog-portable-v1";
    contentSha256: string;
    byteLength: number;
    recordCount: number;
  }>;
  readonly pack: Readonly<{
    packId: string;
    version: string;
    mappingContentSha256: string;
    ingredientCount: number;
    protocolOptionCount: number;
  }>;
  readonly records: readonly HealthKrRegistryRecord[];
}

const ALL_EXCLUSION_REASONS: readonly HealthKrRecommendationExclusionReason[] =
  [
    "official_match_not_confirmed",
    "official_identity_invalid",
    "not_otc",
    "permit_cancelled",
    "source_match_conflict",
    "active_ingredient_missing",
    "active_ingredient_unmapped",
    "protocol_indication_mismatch",
  ];

const MAPPING_FAILURE_REASONS = [
  "active_ingredient_missing",
  "active_ingredient_unmapped",
  "official_identity_invalid",
  "protocol_indication_mismatch",
] as const;

const asRecord = (
  value: unknown,
): Readonly<Record<string, unknown>> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const requiredText = (
  record: Readonly<Record<string, unknown>>,
  field: string,
  rowNumber: number,
): string => {
  const value = text(record[field]);
  if (!value) throw new Error(`source row ${rowNumber} requires ${field}`);
  return value;
};

const stringArray = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const parseContentSection = (
  value: unknown,
  field: string,
  rowNumber: number,
): HealthKrContentSection | null => {
  if (value === null || value === undefined) return null;
  const section = asRecord(value);
  if (!section) throw new Error(`source row ${rowNumber} has invalid ${field}`);
  const sectionText = requiredText(section, "text", rowNumber);
  if (!Array.isArray(section["blocks"]))
    throw new Error(`source row ${rowNumber} has invalid ${field}.blocks`);
  const blocks = section["blocks"].map((value, index): HealthKrContentBlock => {
    const block = asRecord(value);
    if (!block)
      throw new Error(
        `source row ${rowNumber} has invalid ${field}.blocks[${index}]`,
      );
    if (block["type"] === "paragraph")
      return {
        type: "paragraph",
        text: requiredText(block, "text", rowNumber),
      };
    if (block["type"] === "table") {
      if (!Array.isArray(block["headers"]) || !Array.isArray(block["rows"]))
        throw new Error(
          `source row ${rowNumber} has invalid ${field}.blocks[${index}] table`,
        );
      const headers = block["headers"].map((header) => String(header));
      const rows = block["rows"].map((row) => {
        if (!Array.isArray(row))
          throw new Error(
            `source row ${rowNumber} has invalid ${field}.blocks[${index}] row`,
          );
        return row.map((cell) => String(cell));
      });
      return { type: "table", headers, rows };
    }
    throw new Error(
      `source row ${rowNumber} has unsupported ${field}.blocks[${index}] type`,
    );
  });
  return { text: sectionText, blocks };
};

const parseOfficialContent = (
  value: unknown,
  rowNumber: number,
): HealthKrOfficialContent => {
  const content = asRecord(value);
  if (!content || content["schema_version"] !== "1.0")
    throw new Error(`source row ${rowNumber} requires official_content v1.0`);
  return {
    schemaVersion: "1.0",
    normalizationVersion: requiredText(
      content,
      "normalization_version",
      rowNumber,
    ),
    efficacy: parseContentSection(content["efficacy"], "efficacy", rowNumber),
    dosage: parseContentSection(content["dosage"], "dosage", rowNumber),
    precautions: parseContentSection(
      content["precautions"],
      "precautions",
      rowNumber,
    ),
    professionalPrecautions: parseContentSection(
      content["professional_precautions"],
      "professional_precautions",
      rowNumber,
    ),
    patientGuidance: parseContentSection(
      content["patient_guidance"],
      "patient_guidance",
      rowNumber,
    ),
    medicationGuide: parseContentSection(
      content["medication_guide"],
      "medication_guide",
      rowNumber,
    ),
  };
};

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));

const sha256Id = (prefix: string, value: string): string =>
  `${prefix}${createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase()}`;

const assertSha256 = (value: string, field: string): void => {
  if (!/^[a-f0-9]{64}$/u.test(value))
    throw new Error(`${field} must be a lowercase SHA-256 digest`);
};

const normalizeAlias = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\bpeg\b/gu, "폴리에틸렌글리콜")
    .replace(/[·_\-/]+/gu, " ")
    .replace(/[^0-9a-z가-힣\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const ingredientLabelAliases = (label: string): readonly string[] => {
  const normalized = label
    .normalize("NFKC")
    .trim()
    .replace(/\s*\/\s*$/u, "");
  const koreanIndex = normalized.search(/[가-힣]/u);
  const aliases: string[] = [];
  if (koreanIndex >= 0) {
    const english = normalized.slice(0, koreanIndex).trim();
    aliases.push(english);
    aliases.push(
      english.replace(/^([a-z]+)([\s\S]*?)\s+\1-?$/iu, "$1$2").trim(),
    );
    aliases.push(
      normalized
        .slice(koreanIndex)
        .replace(/\s+\d[\s\S]*$/u, "")
        .trim(),
    );
  } else {
    aliases.push(normalized.replace(/\s+\d[\s\S]*$/u, "").trim());
  }
  return uniqueSorted(aliases.map(normalizeAlias).filter(Boolean));
};

const buildIngredientAliasMap = (
  ingredients: readonly HealthKrRegistryIngredient[],
): ReadonlyMap<string, string> => {
  const aliases = new Map<string, string>();
  for (const ingredient of ingredients) {
    if (!ingredient.ingredient_id.trim())
      throw new Error("pack ingredient requires ingredient_id");
    for (const alias of uniqueSorted(
      [
        ingredient.normalized_name,
        ingredient.display_name_en,
        ingredient.display_name_ko,
      ]
        .map(normalizeAlias)
        .filter(Boolean),
    )) {
      const existing = aliases.get(alias);
      if (existing && existing !== ingredient.ingredient_id)
        throw new Error(`pack ingredient alias collision: ${alias}`);
      aliases.set(alias, ingredient.ingredient_id);
    }
  }
  return aliases;
};

export function matchHealthKrIngredient(
  sourceText: string,
  ingredients: readonly HealthKrRegistryIngredient[],
): string | null {
  const aliases = buildIngredientAliasMap(ingredients);
  const matches = uniqueSorted(
    ingredientLabelAliases(sourceText)
      .map((alias) => aliases.get(alias) ?? "")
      .filter(Boolean),
  );
  return matches.length === 1 ? matches[0]! : null;
}

const matchIngredientWithMap = (
  sourceText: string,
  aliases: ReadonlyMap<string, string>,
): string | null => {
  const matches = uniqueSorted(
    ingredientLabelAliases(sourceText)
      .map((alias) => aliases.get(alias) ?? "")
      .filter(Boolean),
  );
  return matches.length === 1 ? matches[0]! : null;
};

const sectionEvidence = (
  row: Readonly<Record<string, unknown>>,
): HealthKrRegistryRecord["officialMatch"]["evidence"] => {
  const evidence = asRecord(row["official_section_evidence"]);
  return {
    detailPageVerified: evidence?.["detail_page_verified"] === true,
    ajaxPayloadVerified: evidence?.["ajax_payload_verified"] === true,
    matchReasons: stringArray(evidence?.["match_reasons"]),
    conflicts: stringArray(evidence?.["conflicts"]),
    sourceUrls: stringArray(evidence?.["source_urls"]),
    verifiedFields: stringArray(evidence?.["verified_fields"]),
    pipelineVersion: text(evidence?.["pipeline_version"]),
  };
};

const healthKrRaw = (
  row: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> =>
  asRecord(asRecord(row["official_additional_data"])?.["health_kr_raw"]) ?? {};

const cancelDate = (raw: Readonly<Record<string, unknown>>): string | null => {
  const value = text(raw["cancel_date"]);
  return !value || ["0", "00000000"].includes(value) ? null : value;
};

const otcStatus = (
  raw: Readonly<Record<string, unknown>>,
): HealthKrOfficialProduct["otcStatus"] => {
  const value = text(raw["drug_cls"]);
  return value === "2" ? "otc" : value ? "not_otc" : "unknown";
};

const durSection = (value: unknown): HealthKrDurSection => {
  const raw = text(value);
  if (!raw) return { present: false, entries: [], raw: null };
  return {
    present: true,
    entries: raw
      .split(/(?:\r?\n)+|\s*;\s*/gu)
      .map((entry) => entry.trim())
      .filter(Boolean),
    raw,
  };
};

const ingredientDetails = (
  raw: Readonly<Record<string, unknown>>,
): ReadonlyMap<string, Readonly<Record<string, unknown>>> => {
  const details = Array.isArray(raw["ingredient_details"])
    ? raw["ingredient_details"]
    : [];
  const result = new Map<string, Readonly<Record<string, unknown>>>();
  for (const item of details) {
    const detail = asRecord(item);
    const label = text(detail?.["label"]);
    if (detail && label) result.set(label, detail);
  }
  return result;
};

const ingredientSources = (
  sourceValues: unknown,
  details: ReadonlyMap<string, Readonly<Record<string, unknown>>>,
  aliases: ReadonlyMap<string, string>,
): readonly HealthKrIngredientSource[] =>
  stringArray(sourceValues).map((sourceText) => {
    const detail = details.get(sourceText);
    return {
      sourceText,
      sourceIngredientCode: text(detail?.["ingredient_code"]),
      sourceUrl: text(detail?.["source_url"]),
      ingredientId: matchIngredientWithMap(sourceText, aliases),
    };
  });

const normalizeInteractions = (
  value: unknown,
): HealthKrOfficialProduct["interactions"] =>
  (Array.isArray(value) ? value : [])
    .map(asRecord)
    .filter(
      (item): item is Readonly<Record<string, unknown>> => item !== undefined,
    )
    .map((item) => ({
      tableIndex: Number.isInteger(item["table_index"])
        ? Number(item["table_index"])
        : 0,
      cells: stringArray(item["cells"]),
    }));

const normalizeSameIngredientProducts = (
  value: unknown,
): HealthKrOfficialProduct["sameIngredientProducts"] =>
  (Array.isArray(value) ? value : [])
    .map(asRecord)
    .filter(
      (item): item is Readonly<Record<string, unknown>> => item !== undefined,
    )
    .map((item) => ({
      productName: text(item["제품명"]),
      manufacturer: text(item["제조/수입사"]),
      otcStatus: text(item["전문/일반"]),
      price: text(item["약가"]),
      bioequivalence: text(item["대조/생동"]),
      supplied: text(item["공급유무"]),
      tableIndex: Number.isInteger(item["table_index"])
        ? Number(item["table_index"])
        : null,
      cells: stringArray(item["cells"]),
    }));

const normalizeHistory = (
  value: unknown,
): HealthKrOfficialProduct["insurance"]["history"] =>
  (Array.isArray(value) ? value : [])
    .map(asRecord)
    .filter(
      (item): item is Readonly<Record<string, unknown>> => item !== undefined,
    )
    .map((item) => ({
      code: text(item["code"]),
      detail: text(item["detail"]),
    }));

const normalizeMedia = (value: unknown): readonly HealthKrMedia[] =>
  (Array.isArray(value) ? value : [])
    .map(asRecord)
    .filter(
      (item): item is Readonly<Record<string, unknown>> =>
        item !== undefined && text(item["url"]) !== null,
    )
    .map((item) => ({
      url: text(item["url"])!,
      kind: text(item["kind"]),
      sourceUrl: text(item["source_url"]),
      sourceDatasetId: text(item["source_dataset_id"]),
      license: text(item["license"]),
      fetchedAt: text(item["fetched_at"]),
    }));

const normalizeMatchAlternatives = (
  value: unknown,
): HealthKrRegistryRecord["officialMatch"]["alternatives"] =>
  (Array.isArray(value) ? value : [])
    .map(asRecord)
    .filter(
      (item): item is Readonly<Record<string, unknown>> =>
        item !== undefined &&
        text(item["official_item_name"]) !== null &&
        text(item["official_item_seq"]) !== null,
    )
    .map((item) => ({
      itemName: text(item["official_item_name"])!,
      itemSeq: text(item["official_item_seq"])!,
      manufacturer: text(item["official_manufacturer"]),
      dosageForm: text(item["official_dosage_form"]),
      packUnit: text(item["official_pack_unit"]),
      sourceUrl: text(item["official_source_url"]),
      score: Number.isFinite(Number(item["match_score"]))
        ? Number(item["match_score"])
        : 0,
      conflicts: stringArray(item["conflicts"]),
    }));

const parseMatchStatus = (
  value: unknown,
  rowNumber: number,
): HealthKrOfficialMatchStatus => {
  if (
    value === "confirmed" ||
    value === "review_required" ||
    value === "not_found" ||
    value === "not_applicable"
  )
    return value;
  throw new Error(`source row ${rowNumber} has invalid official_match_status`);
};

const sourceUrlMatchesIdentity = (
  sourceUrl: string | null,
  itemSeq: string | null,
): boolean => {
  if (!sourceUrl || !itemSeq) return false;
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.toLowerCase() === "health.kr" &&
      parsed.pathname === "/searchDrug/result_drug.asp" &&
      parsed.searchParams.get("drug_cd") === itemSeq
    );
  } catch {
    return false;
  }
};

const buildOfficialProduct = (
  row: Readonly<Record<string, unknown>>,
  officialMatch: HealthKrRegistryRecord["officialMatch"],
  aliases: ReadonlyMap<string, string>,
  rowNumber: number,
): HealthKrOfficialProduct | null => {
  if (!officialMatch.identityValid) return null;
  const raw = healthKrRaw(row);
  const details = ingredientDetails(raw);
  const manufacturer = asRecord(row["official_manufacturer_details"]);
  const guidance = asRecord(row["official_consumer_guidance"]);
  const categoryCode = text(raw["fdacode"]);
  return {
    itemSeq: officialMatch.itemSeq!,
    productKey: officialMatch.productKey!,
    itemName: requiredText(row, "official_item_name", rowNumber),
    englishName: text(row["official_english_name"]),
    manufacturer: requiredText(row, "official_manufacturer", rowNumber),
    manufacturerDetails: {
      name: text(manufacturer?.["name"]),
      englishName: text(manufacturer?.["english_name"]),
      address: text(manufacturer?.["address"]),
      phone: text(manufacturer?.["phone"]),
      fax: text(manufacturer?.["fax"]),
      website: text(manufacturer?.["website"]),
    },
    sourceType: requiredText(row, "official_source_type", rowNumber),
    sourceUrl: requiredText(row, "official_source_url", rowNumber),
    otcStatus: otcStatus(raw),
    permit: {
      permitDate: text(row["official_permit_date"]),
      cancelled: cancelDate(raw) !== null,
      cancelDate: cancelDate(raw),
    },
    classification: {
      category: text(row["official_category"]),
      code: text(row["official_classification_code"]),
      atcCode: text(row["official_atc_code"]),
      kpicAtc: text(row["official_kpic_atc"]),
    },
    dosageForm: text(row["official_dosage_form"]),
    route: text(row["official_route"]),
    packUnit: text(row["official_pack_unit"]),
    storage: text(row["official_storage"]),
    validTerm: text(row["official_valid_term"]),
    appearance: text(row["official_appearance"]),
    efficacy: text(row["official_efficacy"]),
    dosage: text(row["official_dosage"]),
    precautions: text(row["official_precautions"]),
    professionalPrecautions: text(row["official_professional_precautions"]),
    content: parseOfficialContent(row["official_content"], rowNumber),
    ingredients: ingredientSources(
      row["official_ingredients"],
      details,
      aliases,
    ),
    activeIngredients: ingredientSources(
      row["official_active_ingredients"],
      details,
      aliases,
    ),
    additives: stringArray(row["official_additives"]),
    insurance: {
      status: text(row["official_insurance"]),
      detail: text(row["official_insurance_detail"]),
      history: normalizeHistory(row["official_insurance_history"]),
      reimbursementCriteria: text(row["official_reimbursement_criteria"]),
    },
    consumerGuidance: {
      summary:
        text(guidance?.["summary"]) ?? text(row["official_medication_summary"]),
      guide: text(guidance?.["guide"]),
      patientGuidance: text(row["official_patient_guidance"]),
      medicationGuide: text(row["official_medication_guide"]),
      sourceUrl: text(guidance?.["source_url"]),
    },
    identification: text(row["official_identification"]),
    interactions: normalizeInteractions(row["official_interactions"]),
    sameIngredientProducts: normalizeSameIngredientProducts(
      row["official_same_ingredient_products"],
    ),
    insertPdfUrl: text(row["official_insert_pdf_url"]),
    dur: {
      contraindications: durSection(row["official_dur_contraindications"]),
      age: durSection(row["official_dur_age"]),
      pregnancy: durSection(row["official_dur_pregnancy"]),
      senior: durSection(row["official_dur_senior"]),
      maxDose: durSection(row["official_dur_max_dose"]),
      maxPeriod: durSection(row["official_dur_max_period"]),
      splitDosage: durSection(row["official_dur_split_dosage"]),
      pregnancyCategory: categoryCode
        ? {
            code: categoryCode,
            description: text(raw["fdacontent"]),
          }
        : null,
    },
    images: normalizeMedia(row["official_images"]),
    pictograms: normalizeMedia(row["official_pictograms"]),
    contentStatus: text(row["official_content_status"]),
    upstreamUpdatedAt: text(row["official_upstream_updated_at"]),
  };
};

const protocolSelection = (
  ingredientIds: readonly string[],
  efficacy: string | null,
  dosageForm: string | null,
  route: string | null,
  options: readonly HealthKrRegistryProtocolOption[],
): Readonly<{
  protocolIds: readonly string[];
  optionIds: readonly string[];
}> => {
  if (ingredientIds.length === 0 || !efficacy)
    return { protocolIds: [], optionIds: [] };
  const optionSets = ingredientIds.map(
    (ingredientId) =>
      new Set(
        options
          .filter((option) => option.ingredient_id === ingredientId)
          .map((option) => option.protocol_id),
      ),
  );
  const commonProtocols = [...(optionSets[0] ?? new Set<string>())].filter(
    (protocolId) => optionSets.every((set) => set.has(protocolId)),
  );
  const protocolIds = uniqueSorted(
    commonProtocols.filter((protocolId) => {
      return matchesProductProtocolProfile(
        protocolId,
        efficacy,
        route,
        dosageForm,
      );
    }),
  );
  const optionIds = uniqueSorted(
    options
      .filter(
        (option) =>
          ingredientIds.includes(option.ingredient_id) &&
          protocolIds.includes(option.protocol_id),
      )
      .map((option) => option.option_id),
  );
  return { protocolIds, optionIds };
};

export function parseHealthKrRegistryPack(
  value: unknown,
): HealthKrRegistryPack {
  const root = asRecord(value);
  if (!root) throw new Error("research pack must be an object");
  const ingredients = Array.isArray(root["ingredients"])
    ? root["ingredients"]
    : [];
  const protocolOptions = Array.isArray(root["protocolOptions"])
    ? root["protocolOptions"]
    : [];
  if (ingredients.length === 0 || protocolOptions.length === 0)
    throw new Error("research pack requires ingredients and protocolOptions");
  return {
    packId: requiredText(root, "packId", 0),
    version: requiredText(root, "version", 0),
    ingredients: ingredients.map((item, index) => {
      const ingredient = asRecord(item);
      if (!ingredient)
        throw new Error(`pack ingredient ${index + 1} must be an object`);
      return {
        ingredient_id: requiredText(ingredient, "ingredient_id", index + 1),
        normalized_name: requiredText(ingredient, "normalized_name", index + 1),
        display_name_en: requiredText(ingredient, "display_name_en", index + 1),
        display_name_ko: requiredText(ingredient, "display_name_ko", index + 1),
      };
    }),
    protocolOptions: protocolOptions.map((item, index) => {
      const option = asRecord(item);
      if (!option)
        throw new Error(`pack option ${index + 1} must be an object`);
      return {
        option_id: requiredText(option, "option_id", index + 1),
        protocol_id: requiredText(option, "protocol_id", index + 1),
        ingredient_id: requiredText(option, "ingredient_id", index + 1),
      };
    }),
  };
}

export function parseHealthKrSourceRows(
  value: unknown,
): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value))
    throw new Error("healthkr enrichment queue must contain an array");
  const rows = value.map((item, index) => {
    const row = asRecord(item);
    if (!row) throw new Error(`source row ${index + 1} must be an object`);
    requiredText(row, "id", index + 1);
    requiredText(row, "document_id", index + 1);
    requiredText(row, "name", index + 1);
    requiredText(row, "specification", index + 1);
    parseMatchStatus(row["official_match_status"], index + 1);
    return row;
  });
  const skuIds = new Set(rows.map((row) => text(row["id"])));
  if (skuIds.size !== rows.length)
    throw new Error("healthkr enrichment queue contains duplicate SKU IDs");
  return rows;
}

export function mergePortableHealthKrCatalog(
  portableValue: unknown,
  enrichmentValue: unknown,
): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(portableValue))
    throw new Error("portable products must contain an array");
  const enrichmentRows = parseHealthKrSourceRows(enrichmentValue);
  const enrichmentBySku = new Map(
    enrichmentRows.map((row) => [requiredText(row, "id", 0), row] as const),
  );
  if (portableValue.length !== enrichmentRows.length)
    throw new Error("portable and enrichment product counts differ");

  const seen = new Set<string>();
  const merged = portableValue.map((value, index) => {
    const rowNumber = index + 1;
    const portable = asRecord(value);
    if (!portable || portable["schema_version"] !== "1.0")
      throw new Error(`portable row ${rowNumber} is not schema v1.0`);
    const skuId = requiredText(portable, "product_id", rowNumber);
    if (seen.has(skuId))
      throw new Error("portable products contain duplicate IDs");
    seen.add(skuId);
    const enrichment = enrichmentBySku.get(skuId);
    if (!enrichment)
      throw new Error(`portable product ${skuId} is missing enrichment data`);

    const display = asRecord(portable["display"]);
    const media = asRecord(portable["media"]);
    const quality = asRecord(portable["quality"]);
    const provenance = asRecord(portable["provenance"]);
    if (!display || !media || !quality || !provenance)
      throw new Error(`portable row ${rowNumber} is incomplete`);
    const displayName = requiredText(display, "name", rowNumber);
    const specification = requiredText(display, "specification", rowNumber);
    const status = parseMatchStatus(
      quality["official_match_status"],
      rowNumber,
    );
    const portablePrice = Number(display["price_krw"]);
    if (!Number.isSafeInteger(portablePrice) || portablePrice < 0)
      throw new Error(`portable row ${rowNumber} has invalid price_krw`);
    if (
      displayName !== requiredText(enrichment, "name", rowNumber) ||
      specification !== requiredText(enrichment, "specification", rowNumber) ||
      portablePrice !== Number(enrichment["displayed_price_krw"]) ||
      status !== enrichment["official_match_status"]
    )
      throw new Error(`portable product ${skuId} disagrees with enrichment`);

    const primaryImage =
      media["primary_image"] === null ? null : asRecord(media["primary_image"]);
    if (media["primary_image"] !== null && !primaryImage)
      throw new Error(`portable product ${skuId} has invalid primary image`);

    const medicine =
      portable["medicine"] === null ? null : asRecord(portable["medicine"]);
    if ((status === "confirmed") !== Boolean(medicine))
      throw new Error(
        `portable product ${skuId} has inconsistent official medicine state`,
      );
    const identity = medicine ? asRecord(medicine["identity"]) : null;
    const source = medicine ? asRecord(medicine["source"]) : null;
    const ingredients = medicine ? asRecord(medicine["ingredients"]) : null;
    const officialContent = medicine ? asRecord(medicine["content"]) : null;
    if (medicine && (!identity || !source || !ingredients || !officialContent))
      throw new Error(`portable product ${skuId} has incomplete medicine data`);

    const portableItemSeq = identity ? text(identity["item_code"]) : null;
    const enrichmentItemSeq = text(enrichment["official_item_seq"]);
    const productKey = text(enrichment["official_product_key"]);
    if (
      status === "confirmed" &&
      (!portableItemSeq ||
        portableItemSeq !== enrichmentItemSeq ||
        portableItemSeq !== productKey)
    )
      throw new Error(`portable product ${skuId} has inconsistent identity`);

    const contentSectionText = (field: string): string | null => {
      const section = officialContent
        ? asRecord(officialContent[field])
        : undefined;
      return section ? text(section["text"]) : null;
    };

    return {
      ...enrichment,
      id: skuId,
      name: displayName,
      capacity: requiredText(enrichment, "capacity", rowNumber),
      specification,
      normalized_name: requiredText(enrichment, "normalized_name", rowNumber),
      normalized_capacity: requiredText(
        enrichment,
        "normalized_capacity",
        rowNumber,
      ),
      category: requiredText(display, "category", rowNumber),
      displayed_price_krw: portablePrice,
      recorded_at: requiredText(provenance, "catalog_recorded_at", rowNumber),
      source_type: requiredText(provenance, "catalog_source_type", rowNumber),
      verification_status: text(quality["verification_status"]) ?? "unknown",
      image_url: primaryImage
        ? requiredText(primaryImage, "url", rowNumber)
        : "",
      image_source_url: primaryImage ? text(primaryImage["source_url"]) : "",
      image_rights_status: primaryImage
        ? text(primaryImage["rights_status"])
        : text(quality["image_rights_status"]),
      image_kind: primaryImage ? text(primaryImage["kind"]) : null,
      image_checked_at: primaryImage ? text(primaryImage["checked_at"]) : null,
      official_match_status: status,
      official_item_name: identity ? text(identity["item_name"]) : null,
      official_item_seq: portableItemSeq,
      official_product_key: productKey,
      official_manufacturer: identity ? text(identity["manufacturer"]) : null,
      official_source_type: source ? text(source["type"]) : null,
      official_source_url: source ? text(source["url"]) : null,
      official_checked_at: source ? text(source["checked_at"]) : null,
      official_english_name: identity ? text(identity["english_name"]) : null,
      official_category: identity ? text(identity["category"]) : null,
      official_classification_code: identity
        ? text(identity["classification_code"])
        : null,
      official_dosage_form: identity ? text(identity["dosage_form"]) : null,
      official_route: identity ? text(identity["route"]) : null,
      official_atc_code: identity ? text(identity["atc_code"]) : null,
      official_pack_unit: identity ? text(identity["pack_unit"]) : null,
      official_storage: medicine ? text(medicine["storage"]) : null,
      official_appearance: medicine ? text(medicine["appearance"]) : null,
      official_efficacy: contentSectionText("efficacy"),
      official_dosage: contentSectionText("dosage"),
      official_precautions: contentSectionText("precautions"),
      official_professional_precautions: contentSectionText(
        "professional_precautions",
      ),
      official_patient_guidance: contentSectionText("patient_guidance"),
      official_medication_guide: contentSectionText("medication_guide"),
      official_ingredients: ingredients ? stringArray(ingredients["all"]) : [],
      official_active_ingredients: ingredients
        ? stringArray(ingredients["active"])
        : [],
      official_additives: ingredients
        ? stringArray(ingredients["additives"])
        : [],
      official_content: officialContent,
      official_content_status: text(quality["official_content_status"]),
    };
  });

  if (seen.size !== enrichmentBySku.size)
    throw new Error("enrichment contains products missing from portable data");
  return merged;
}

export function buildHealthKrProductRegistry(
  sourceRows: readonly Readonly<Record<string, unknown>>[],
  pack: HealthKrRegistryPack,
  options: HealthKrRegistryBuildOptions,
): Readonly<{
  registry: HealthKrProductRegistry;
  report: Readonly<{
    schemaVersion: "1.0.0";
    generatedAt: string;
    source: HealthKrProductRegistry["source"];
    pack: HealthKrProductRegistry["pack"];
    sourceRecordCount: number;
    importedRecordCount: number;
    droppedRecordCount: number;
    officialProductCount: number;
    uniqueOfficialProductCount: number;
    confirmedWithOfficialContentCount: number;
    confirmedMissingItemSeqCount: number;
    confirmedMissingSourceUrlCount: number;
    confirmedMissingOfficialContentCount: number;
    imageCount: number;
    correctedRetailTextCount: number;
    multiSkuOfficialProductCount: number;
    multiSkuRetailSkuCount: number;
    matchStatusCounts: Readonly<Record<HealthKrOfficialMatchStatus, number>>;
    eligibleRetailSkuCount: number;
    eligibleOfficialProductCount: number;
    exclusionReasonCounts: Readonly<
      Record<HealthKrRecommendationExclusionReason, number>
    >;
    mappingFailureReasonCounts: Readonly<
      Record<(typeof MAPPING_FAILURE_REASONS)[number], number>
    >;
    ignoredPseudoIdentityFieldCounts: Readonly<{
      officialReportNumber: number;
      officialStandardCodes: number;
    }>;
  }>;
}> {
  assertSha256(options.sourceContentSha256, "sourceContentSha256");
  assertSha256(options.mappingContentSha256, "mappingContentSha256");
  if (
    !Number.isSafeInteger(options.sourceByteLength) ||
    options.sourceByteLength < 1
  )
    throw new Error("sourceByteLength must be a positive safe integer");
  if (Number.isNaN(Date.parse(options.generatedAt)))
    throw new Error("generatedAt must be a date-time");
  if (pack.ingredients.length === 0 || pack.protocolOptions.length === 0)
    throw new Error("registry pack requires ingredients and protocol options");

  const rows = parseHealthKrSourceRows(sourceRows);
  const ingredientAliases = buildIngredientAliasMap(pack.ingredients);
  const skuIds = new Set<string>();
  const records = rows.map((row, index): HealthKrRegistryRecord => {
    const rowNumber = index + 1;
    const skuId = requiredText(row, "id", rowNumber);
    if (skuIds.has(skuId))
      throw new Error("healthkr enrichment queue contains duplicate SKU IDs");
    skuIds.add(skuId);
    const status = parseMatchStatus(row["official_match_status"], rowNumber);
    const itemSeq = text(row["official_item_seq"]);
    const productKey = text(row["official_product_key"]);
    const sourceUrl = text(row["official_source_url"]);
    const identityValid =
      status === "confirmed" &&
      itemSeq !== null &&
      productKey !== null &&
      itemSeq === productKey &&
      sourceUrlMatchesIdentity(sourceUrl, itemSeq);
    const evidence = sectionEvidence(row);
    const score = Number(row["official_match_score"] ?? 0);
    if (!Number.isFinite(score) || score < 0 || score > 100)
      throw new Error(
        `source row ${rowNumber} has invalid official_match_score`,
      );
    const officialMatch: HealthKrRegistryRecord["officialMatch"] = {
      status,
      score,
      itemSeq,
      productKey,
      identityValid,
      checkedAt: text(row["official_checked_at"]),
      sourceType: text(row["official_source_type"]),
      sourceUrl,
      alternatives: normalizeMatchAlternatives(row["match_alternatives"]),
      evidence,
    };
    const officialProduct = buildOfficialProduct(
      row,
      officialMatch,
      ingredientAliases,
      rowNumber,
    );
    const activeIngredients = officialProduct?.activeIngredients ?? [];
    const ingredientMappings = activeIngredients.map(
      ({ ingredientId, sourceText }): HealthKrIngredientMapping => ({
        ingredientId,
        sourceText,
      }),
    );
    const ingredientIds = uniqueSorted(
      activeIngredients
        .map((ingredient) => ingredient.ingredientId ?? "")
        .filter(Boolean),
    );
    const unmappedActiveIngredients = activeIngredients
      .filter((ingredient) => ingredient.ingredientId === null)
      .map((ingredient) => ingredient.sourceText);
    const selection = protocolSelection(
      ingredientIds,
      officialProduct?.efficacy ?? null,
      officialProduct?.dosageForm ?? null,
      officialProduct?.route ?? null,
      pack.protocolOptions,
    );
    const exclusionReasons: HealthKrRecommendationExclusionReason[] = [];
    if (status !== "confirmed")
      exclusionReasons.push("official_match_not_confirmed");
    else if (!identityValid) exclusionReasons.push("official_identity_invalid");
    if (officialProduct) {
      if (officialProduct.otcStatus !== "otc") exclusionReasons.push("not_otc");
      if (officialProduct.permit.cancelled)
        exclusionReasons.push("permit_cancelled");
      if (evidence.conflicts.length > 0)
        exclusionReasons.push("source_match_conflict");
      if (activeIngredients.length === 0)
        exclusionReasons.push("active_ingredient_missing");
      else if (unmappedActiveIngredients.length > 0)
        exclusionReasons.push("active_ingredient_unmapped");
      else if (selection.protocolIds.length === 0)
        exclusionReasons.push("protocol_indication_mismatch");
    }
    const clinicalGroupKey =
      officialProduct && ingredientIds.length > 0
        ? sha256Id(
            "CLINICAL-HEALTHKR-",
            `${ingredientIds.join("|")}|${normalizeAlias(
              officialProduct.dosageForm ?? "unknown",
            )}|${normalizeAlias(officialProduct.route ?? "unknown")}`,
          )
        : null;
    const price = Number(row["displayed_price_krw"]);
    if (!Number.isSafeInteger(price) || price < 0)
      throw new Error(
        `source row ${rowNumber} has invalid displayed_price_krw`,
      );
    return {
      registryRecordId: sha256Id("REG-HEALTHKR-", skuId),
      retailOffer: {
        skuId,
        documentId: requiredText(row, "document_id", rowNumber),
        displayName: requiredText(row, "name", rowNumber),
        normalizedName: requiredText(row, "normalized_name", rowNumber),
        capacity: requiredText(row, "capacity", rowNumber),
        normalizedCapacity: requiredText(row, "normalized_capacity", rowNumber),
        specification: requiredText(row, "specification", rowNumber),
        category: requiredText(row, "category", rowNumber),
        displayedPriceKrw: price,
        currency: "KRW",
        recordedAt: requiredText(row, "recorded_at", rowNumber),
        priceStatus: requiredText(row, "price_status", rowNumber),
        sourceType: requiredText(row, "source_type", rowNumber),
        verificationStatus: requiredText(row, "verification_status", rowNumber),
        image: {
          url: text(row["image_url"]),
          sourceUrl: text(row["image_source_url"]),
          rightsStatus: text(row["image_rights_status"]),
          kind: text(row["image_kind"]),
          checkedAt: text(row["image_checked_at"]),
        },
      },
      officialMatch,
      officialProduct,
      recommendation: {
        productId: sha256Id(
          "PRD-HEALTHKR-",
          `${productKey ?? "unmatched"}|${skuId}`,
        ),
        ingredientIds,
        ingredientMappings,
        unmappedActiveIngredients,
        protocolIds: selection.protocolIds,
        optionIds: selection.optionIds,
        clinicalGroupKey,
        eligible: exclusionReasons.length === 0,
        exclusionReasons,
      },
    };
  });

  const source = {
    logicalName: "pharmacy-product-catalog-portable-v1" as const,
    contentSha256: options.sourceContentSha256,
    byteLength: options.sourceByteLength,
    recordCount: rows.length,
  };
  const packSummary = {
    packId: pack.packId,
    version: pack.version,
    mappingContentSha256: options.mappingContentSha256,
    ingredientCount: pack.ingredients.length,
    protocolOptionCount: pack.protocolOptions.length,
  };
  const registry: HealthKrProductRegistry = {
    schemaVersion: "1.0.0",
    generatedAt: options.generatedAt,
    source,
    pack: packSummary,
    records,
  };
  const registryValidation = validateContract<HealthKrProductRegistry>(
    "pharmacyProductRegistry",
    registry,
  );
  if (!registryValidation.ok)
    throw new Error(
      `generated Health.kr registry violates the canonical schema: ${registryValidation.errors
        .map((error) => `${error.instancePath} ${error.message ?? "invalid"}`)
        .join("; ")}`,
    );
  const matchStatusCounts: Record<HealthKrOfficialMatchStatus, number> = {
    confirmed: 0,
    review_required: 0,
    not_found: 0,
    not_applicable: 0,
  };
  const exclusionReasonCounts = Object.fromEntries(
    ALL_EXCLUSION_REASONS.map((reason) => [reason, 0]),
  ) as Record<HealthKrRecommendationExclusionReason, number>;
  for (const record of records) {
    matchStatusCounts[record.officialMatch.status] += 1;
    for (const reason of record.recommendation.exclusionReasons)
      exclusionReasonCounts[reason] += 1;
  }
  const eligible = records.filter((record) => record.recommendation.eligible);
  const officialProducts = records.filter(
    (
      record,
    ): record is HealthKrRegistryRecord & {
      officialProduct: HealthKrOfficialProduct;
    } => record.officialProduct !== null,
  );
  const mappingFailureReasonCounts = Object.fromEntries(
    MAPPING_FAILURE_REASONS.map((reason) => [
      reason,
      exclusionReasonCounts[reason],
    ]),
  ) as Record<(typeof MAPPING_FAILURE_REASONS)[number], number>;
  const confirmedRows = rows.filter(
    (row) => row["official_match_status"] === "confirmed",
  );
  const officialSkuCounts = new Map<string, number>();
  for (const record of officialProducts)
    officialSkuCounts.set(
      record.officialProduct.productKey,
      (officialSkuCounts.get(record.officialProduct.productKey) ?? 0) + 1,
    );
  const multiSkuCounts = [...officialSkuCounts.values()].filter(
    (count) => count > 1,
  );
  return {
    registry,
    report: {
      schemaVersion: "1.0.0",
      generatedAt: options.generatedAt,
      source,
      pack: packSummary,
      sourceRecordCount: rows.length,
      importedRecordCount: records.length,
      droppedRecordCount: rows.length - records.length,
      officialProductCount: officialProducts.length,
      uniqueOfficialProductCount: new Set(
        officialProducts.map((record) => record.officialProduct.productKey),
      ).size,
      confirmedWithOfficialContentCount: confirmedRows.filter((row) =>
        asRecord(row["official_content"]),
      ).length,
      confirmedMissingItemSeqCount: confirmedRows.filter(
        (row) => !text(row["official_item_seq"]),
      ).length,
      confirmedMissingSourceUrlCount: confirmedRows.filter(
        (row) => !text(row["official_source_url"]),
      ).length,
      confirmedMissingOfficialContentCount: confirmedRows.filter(
        (row) => !asRecord(row["official_content"]),
      ).length,
      imageCount: rows.filter((row) => text(row["image_url"])).length,
      correctedRetailTextCount: rows.filter(
        (row) =>
          text(row["name"]) !== text(row["app_name"]) ||
          text(row["capacity"]) !== text(row["app_capacity"]),
      ).length,
      multiSkuOfficialProductCount: multiSkuCounts.length,
      multiSkuRetailSkuCount: multiSkuCounts.reduce(
        (total, count) => total + count,
        0,
      ),
      matchStatusCounts,
      eligibleRetailSkuCount: eligible.length,
      eligibleOfficialProductCount: new Set(
        eligible
          .map((record) => record.officialProduct?.productKey ?? "")
          .filter(Boolean),
      ).size,
      exclusionReasonCounts,
      mappingFailureReasonCounts,
      ignoredPseudoIdentityFieldCounts: {
        officialReportNumber: rows.filter((row) =>
          text(row["official_report_number"]),
        ).length,
        officialStandardCodes: rows.filter(
          (row) => stringArray(row["official_standard_codes"]).length > 0,
        ).length,
      },
    },
  };
}
