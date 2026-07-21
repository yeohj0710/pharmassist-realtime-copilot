import { createHash } from "node:crypto";

export interface ClinicalPathwayDefinition {
  readonly pathwayId: string;
  readonly protocolId: string;
  readonly efficacyAny: readonly string[];
  readonly efficacyNone?: readonly string[];
  readonly routeFormAny: readonly string[];
  readonly mechanisms: readonly string[];
  readonly combinationRole: string;
  readonly compatibleRoles?: readonly string[];
  readonly priority: number;
  readonly source: string;
}

export interface SupportiveClassificationDefinition {
  readonly pathwayId: string;
  readonly officialCategoryAny: readonly string[];
  readonly priority: number;
}

export interface SupportiveDirectRuleDefinition {
  readonly ruleId: string;
  readonly pathwayIds?: readonly string[];
  readonly officialCategoryAny?: readonly string[];
  readonly itemNameAny?: readonly string[];
  readonly kpicAny?: readonly string[];
  readonly routeFormAny?: readonly string[];
  readonly ingredientMarkerAny?: readonly string[];
  readonly ingredientMarkerRatio?: number;
  readonly supportMechanism: string;
  readonly scoreAdjustment: number;
}

export interface ClinicalPathwayDataset {
  readonly schemaVersion: "1.0.0";
  readonly researchOnly: true;
  readonly mechanismEvidence: Readonly<Record<string, readonly string[]>>;
  readonly pathways: readonly ClinicalPathwayDefinition[];
  readonly supportiveClassifications: readonly SupportiveClassificationDefinition[];
  readonly supportiveDirectRules?: readonly SupportiveDirectRuleDefinition[];
}

export interface ProductClinicalPathwayMatch {
  readonly pathwayId: string;
  readonly protocolId: string | null;
  readonly matchType: "direct" | "supportive";
  readonly score: number;
  readonly matchedTerms: readonly string[];
  readonly mechanisms: readonly string[];
  readonly combinationRole: string | null;
  readonly compatibleRoles: readonly string[];
  readonly source: string | null;
}

const normalized = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/gu, "");

const includesTerm = (haystack: string, term: string): boolean => {
  const needle = normalized(term);
  return needle.length >= 2 && haystack.includes(needle);
};

export function parseClinicalPathwayDataset(
  value: unknown,
): ClinicalPathwayDataset {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("clinical pathway dataset must be an object");
  const root = value as Record<string, unknown>;
  if (root["schemaVersion"] !== "1.0.0" || root["researchOnly"] !== true)
    throw new Error("clinical pathway dataset version or mode is invalid");
  if (!Array.isArray(root["pathways"]) || !root["pathways"].length)
    throw new Error("clinical pathway dataset requires direct pathways");
  if (
    !root["mechanismEvidence"] ||
    typeof root["mechanismEvidence"] !== "object" ||
    Array.isArray(root["mechanismEvidence"])
  )
    throw new Error("clinical pathway dataset requires mechanism evidence");
  if (!Array.isArray(root["supportiveClassifications"]))
    throw new Error(
      "clinical pathway dataset requires supportive classifications",
    );

  const pathways = root["pathways"] as ClinicalPathwayDefinition[];
  const mechanismEvidence = root["mechanismEvidence"] as Record<
    string,
    readonly string[]
  >;
  const supportive = root[
    "supportiveClassifications"
  ] as SupportiveClassificationDefinition[];
  const ids = new Set<string>();
  for (const pathway of [...pathways, ...supportive]) {
    if (!pathway.pathwayId || ids.has(pathway.pathwayId))
      throw new Error("clinical pathway IDs must be non-empty and unique");
    ids.add(pathway.pathwayId);
  }
  for (const pathway of pathways)
    if (
      !pathway.protocolId ||
      !pathway.efficacyAny?.length ||
      !pathway.routeFormAny?.length ||
      !pathway.mechanisms?.length ||
      !pathway.combinationRole ||
      !pathway.source ||
      !Number.isFinite(pathway.priority)
    )
      throw new Error(`invalid direct clinical pathway: ${pathway.pathwayId}`);
  for (const pathway of pathways.filter(
    (candidate) => candidate.mechanisms.length > 1,
  ))
    for (const mechanism of pathway.mechanisms)
      if (!mechanismEvidence[mechanism]?.length)
        throw new Error(`missing mechanism evidence: ${mechanism}`);
  for (const pathway of supportive)
    if (
      !pathway.officialCategoryAny?.length ||
      !Number.isFinite(pathway.priority)
    )
      throw new Error(
        `invalid supportive clinical pathway: ${pathway.pathwayId}`,
      );
  for (const rule of (root["supportiveDirectRules"] ??
    []) as SupportiveDirectRuleDefinition[])
    if (
      !rule.ruleId ||
      !rule.supportMechanism ||
      !Number.isFinite(rule.scoreAdjustment)
    )
      throw new Error(`invalid supportive direct rule: ${rule.ruleId}`);
  return {
    schemaVersion: "1.0.0",
    researchOnly: true,
    mechanismEvidence,
    pathways,
    supportiveClassifications: supportive,
    supportiveDirectRules: Array.isArray(root["supportiveDirectRules"])
      ? (root["supportiveDirectRules"] as SupportiveDirectRuleDefinition[])
      : [],
  };
}

export function classifyOfficialProduct(
  product: Readonly<{
    efficacy: string | null;
    route: string | null;
    dosageForm: string | null;
    officialCategory: string | null;
    itemName?: string | null;
    kpicAtc?: string | null;
    activeIngredientTexts?: readonly string[];
  }>,
  dataset: ClinicalPathwayDataset,
): readonly ProductClinicalPathwayMatch[] {
  const efficacy = normalized(product.efficacy ?? "");
  const routeForm = normalized(
    `${product.route ?? ""} ${product.dosageForm ?? ""}`,
  );
  const category = normalized(product.officialCategory ?? "");
  const itemName = normalized(product.itemName ?? "");
  const kpic = normalized(product.kpicAtc ?? "");
  const ingredientTexts = (product.activeIngredientTexts ?? []).map(normalized);
  const mechanismEvidenceText = normalized(
    [
      product.itemName ?? "",
      product.officialCategory ?? "",
      product.kpicAtc ?? "",
      product.route ?? "",
      product.dosageForm ?? "",
      ...(product.activeIngredientTexts ?? []),
    ].join(" "),
  );
  const direct = dataset.pathways
    .flatMap((pathway): ProductClinicalPathwayMatch[] => {
      const matchedTerms = pathway.efficacyAny.filter((term) =>
        includesTerm(efficacy, term),
      );
      if (
        matchedTerms.length === 0 ||
        !pathway.routeFormAny.some((term) => includesTerm(routeForm, term)) ||
        (pathway.efficacyNone ?? []).some((term) =>
          includesTerm(efficacy, term),
        )
      )
        return [];
      const specificity = Math.max(
        ...matchedTerms.map((term) => normalized(term).length),
      );
      const supportedMechanisms =
        pathway.mechanisms.length === 1
          ? pathway.mechanisms
          : pathway.mechanisms.filter((mechanism) =>
              dataset.mechanismEvidence[mechanism]?.some((term) =>
                includesTerm(mechanismEvidenceText, term),
              ),
            );
      const resolvedMechanisms =
        supportedMechanisms.length > 0
          ? supportedMechanisms
          : ["official_indication_match"];
      const supportiveRule = (dataset.supportiveDirectRules ?? []).find(
        (rule) => {
          if (
            rule.pathwayIds?.length &&
            !rule.pathwayIds.includes(pathway.pathwayId)
          )
            return false;
          const categoryMatch = rule.officialCategoryAny?.some((term) =>
            includesTerm(category, term),
          );
          const itemNameMatch = rule.itemNameAny?.some((term) =>
            itemName.includes(normalized(term)),
          );
          const kpicMatch = rule.kpicAny?.some((term) =>
            includesTerm(kpic, term),
          );
          const routeMatch = rule.routeFormAny?.some((term) =>
            includesTerm(routeForm, term),
          );
          const markedIngredients = ingredientTexts.filter((text) =>
            rule.ingredientMarkerAny?.some((term) => includesTerm(text, term)),
          ).length;
          const ingredientMatch =
            ingredientTexts.length > 0 &&
            markedIngredients / ingredientTexts.length >=
              (rule.ingredientMarkerRatio ?? 1);
          return (
            categoryMatch ||
            itemNameMatch ||
            kpicMatch ||
            routeMatch ||
            ingredientMatch
          );
        },
      );
      return [
        {
          pathwayId: pathway.pathwayId,
          protocolId: pathway.protocolId,
          matchType: "direct",
          score: Math.max(
            1,
            Math.min(
              100,
              pathway.priority +
                specificity +
                (supportiveRule?.scoreAdjustment ?? 0),
            ),
          ),
          matchedTerms,
          mechanisms: supportiveRule
            ? [
                ...new Set([
                  ...resolvedMechanisms,
                  supportiveRule.supportMechanism,
                ]),
              ]
            : resolvedMechanisms,
          combinationRole: supportiveRule
            ? "supportive"
            : pathway.combinationRole,
          compatibleRoles: supportiveRule
            ? ["primary"]
            : (pathway.compatibleRoles ?? []),
          source: pathway.source,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.pathwayId.localeCompare(right.pathwayId),
    );
  if (direct.length > 0) return direct;

  return dataset.supportiveClassifications
    .flatMap((pathway): ProductClinicalPathwayMatch[] => {
      const matchedTerms = pathway.officialCategoryAny.filter((term) =>
        includesTerm(category, term),
      );
      return matchedTerms.length
        ? [
            {
              pathwayId: pathway.pathwayId,
              protocolId: null,
              matchType: "supportive",
              score: pathway.priority,
              matchedTerms,
              mechanisms: [],
              combinationRole: null,
              compatibleRoles: [],
              source: null,
            },
          ]
        : [];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.pathwayId.localeCompare(right.pathwayId),
    );
}

const canonicalIngredientName = (sourceText: string): string => {
  const text = sourceText.normalize("NFKC").trim();
  const amount = text.search(/\s\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|μg|mL|%)/iu);
  return (amount >= 0 ? text.slice(0, amount) : text).trim();
};

export function canonicalIngredientId(sourceText: string): string {
  const identity = normalized(canonicalIngredientName(sourceText));
  if (!identity)
    throw new Error("official active ingredient identity is empty");
  return `ING-HEALTHKR-${createHash("sha256")
    .update(identity)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase()}`;
}
