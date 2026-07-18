import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";

export interface LocalPharmacyCatalogSourceRow {
  readonly id: string;
  readonly name: string;
  readonly capacity?: string;
  readonly specification?: string;
  readonly category: string;
  readonly recorded_at?: string;
  readonly verification_status?: string;
}

export interface RuntimeRegistryProductName {
  readonly productId: string;
  readonly displayName: string;
}

export type RegulatoryClassCandidate =
  | "medicine"
  | "health_supplement"
  | "cosmetic"
  | "medical_device"
  | "unresolved";

export type ClassificationRoute =
  | "cosmetic"
  | "medical_device"
  | "medicine_or_health_supplement_review"
  | "medicine_or_unresolved_review"
  | "mixed_regulatory_domains_review";

export type OfficialLookupTarget =
  | "mfds_otc"
  | "mfds_health_supplement"
  | "mfds_cosmetic"
  | "mfds_medical_device";

export interface LocalCatalogCandidate {
  readonly candidateGroupId: string;
  readonly displayName: string;
  readonly capacity: string;
  readonly normalizedName: string;
  readonly normalizedCapacity: string;
  readonly sourceCategories: readonly string[];
  readonly sourceSkuIds: readonly string[];
  readonly sourceSkuCount: number;
  readonly sourceRecordedAt: readonly string[];
  readonly sourceVerificationStatuses: readonly string[];
  readonly classification: Readonly<{
    route: ClassificationRoute;
    regulatoryClassCandidates: readonly RegulatoryClassCandidate[];
    officialLookupTargets: readonly OfficialLookupTarget[];
    mfdsOtcScreeningRequired: boolean;
    reviewRequired: true;
  }>;
  readonly runtimeIntersection: Readonly<{
    status: "exact_name" | "near_name_review" | "none";
    productIds: readonly string[];
  }>;
  readonly officialMatch: Readonly<{
    status: "required";
    itemSeq: null;
    permitJoined: false;
    ingredientsJoined: false;
    durJoined: false;
  }>;
  readonly candidateOnly: true;
  readonly clinicalUseProhibited: true;
  readonly formularyEligible: false;
}

export interface LocalCatalogDryRunReport {
  readonly sourceSkuCount: number;
  readonly sourceNameDuplicateGroupCount: number;
  readonly skusInSourceNameDuplicateGroups: number;
  readonly candidateGroupCount: number;
  readonly nameCapacityDuplicateGroupCount: number;
  readonly skusInNameCapacityDuplicateGroups: number;
  readonly classificationRoutes: Readonly<
    Record<
      ClassificationRoute,
      Readonly<{ skuCount: number; groupCount: number }>
    >
  >;
  readonly regulatoryDomainCandidates: Readonly<
    Record<
      RegulatoryClassCandidate,
      Readonly<{ skuCount: number; groupCount: number }>
    >
  >;
  readonly officialMatching: Readonly<{
    confirmedSkuCount: 0;
    confirmedCandidateGroupCount: 0;
    requiredSkuCount: number;
    requiredCandidateGroupCount: number;
    mfdsOtcScreeningSkuCount: number;
    mfdsOtcScreeningCandidateGroupCount: number;
  }>;
  readonly runtimeIntersection: Readonly<{
    runtimeProductCount: number;
    exactSkuCount: number;
    exactCandidateGroupCount: number;
    exactRuntimeProductCount: number;
    nearNameReviewSkuCount: number;
    nearNameReviewGroupCount: number;
    nearNameReviewRuntimeProductCount: number;
    missingCandidateGroupCount: number;
  }>;
}

const SUPPLEMENT_MERCHANDISING_CATEGORIES = new Set([
  "건강보조식품",
  "관절",
  "남성",
  "다이어트",
  "비타민",
  "수면",
  "숙취",
  "여성",
  "영양제",
  "유산균",
  "전립선",
  "키즈",
  "혈행개선",
]);

const LOCAL_CANDIDATE_DIRECTORY = "pharmacy-product-catalog-candidate";

const DOSAGE_FORM_SUFFIXES = [
  "연질캡슐",
  "장용정",
  "츄어블정",
  "현탁액",
  "점안액",
  "외용액",
  "트로키",
  "캡슐",
  "과립",
  "시럽",
  "로션",
  "연고",
  "크림",
  "츄어블",
  "정",
  "액",
] as const;

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, "ko"),
  );

const isWithin = (parent: string, child: string): boolean => {
  const path = relative(resolve(parent), resolve(child));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
};

export function assertLocalCatalogOutputPath(
  workspaceRoot: string,
  sourceRoot: string,
  outputDirectory: string,
): string {
  const output = resolve(outputDirectory);
  const expected = resolve(workspaceRoot, "etc", LOCAL_CANDIDATE_DIRECTORY);
  if (output.toLocaleLowerCase("en-US") !== expected.toLocaleLowerCase("en-US"))
    throw new Error(
      "local catalog output must use the fixed private directory",
    );
  if (isWithin(sourceRoot, output))
    throw new Error(
      "local catalog output must not modify the source repository",
    );
  return output;
}

export function assertCanonicalLocalCatalogOutputPath(input: {
  readonly workspaceRoot: string;
  readonly privateRoot: string;
  readonly sourceRoot: string;
  readonly outputDirectory: string;
}): string {
  const workspace = resolve(input.workspaceRoot);
  const privateRoot = resolve(input.privateRoot);
  const source = resolve(input.sourceRoot);
  const output = resolve(input.outputDirectory);
  const expectedPrivateRoot = resolve(workspace, "etc");
  const expectedOutput = resolve(privateRoot, LOCAL_CANDIDATE_DIRECTORY);
  if (
    privateRoot.toLocaleLowerCase("en-US") !==
      expectedPrivateRoot.toLocaleLowerCase("en-US") ||
    output.toLocaleLowerCase("en-US") !==
      expectedOutput.toLocaleLowerCase("en-US") ||
    !isWithin(privateRoot, output)
  )
    throw new Error("canonical output escaped the canonical private directory");
  if (isWithin(source, output))
    throw new Error("canonical output resolves inside the source repository");
  return output;
}

export const normalizeLocalCatalogText = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]/gu, "");

const nearNameBase = (value: string): string => {
  let base = normalizeLocalCatalogText(
    value.replace(/\([^)]*\)/gu, ""),
  ).replace(/\d+(?:\.\d+)?(?:밀리그램|mg|그램|g|퍼센트)$/gu, "");
  for (const suffix of DOSAGE_FORM_SUFFIXES)
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length);
      break;
    }
  return base.length >= 4 ? base : "";
};

const classificationFor = (
  categories: readonly string[],
): LocalCatalogCandidate["classification"] => {
  const kinds = new Set(
    categories.map((category) =>
      category === "코스메틱"
        ? "cosmetic"
        : category === "의료기기"
          ? "medical_device"
          : SUPPLEMENT_MERCHANDISING_CATEGORIES.has(category)
            ? "medicine_or_health_supplement"
            : "medicine_or_unresolved",
    ),
  );
  if (kinds.size === 1 && kinds.has("cosmetic"))
    return {
      route: "cosmetic",
      regulatoryClassCandidates: ["cosmetic"],
      officialLookupTargets: ["mfds_cosmetic"],
      mfdsOtcScreeningRequired: false,
      reviewRequired: true,
    };
  if (kinds.size === 1 && kinds.has("medical_device"))
    return {
      route: "medical_device",
      regulatoryClassCandidates: ["medical_device"],
      officialLookupTargets: ["mfds_medical_device"],
      mfdsOtcScreeningRequired: false,
      reviewRequired: true,
    };
  if (kinds.size === 1 && kinds.has("medicine_or_health_supplement"))
    return {
      route: "medicine_or_health_supplement_review",
      regulatoryClassCandidates: ["medicine", "health_supplement"],
      officialLookupTargets: ["mfds_otc", "mfds_health_supplement"],
      mfdsOtcScreeningRequired: true,
      reviewRequired: true,
    };
  if (kinds.size === 1)
    return {
      route: "medicine_or_unresolved_review",
      regulatoryClassCandidates: ["medicine", "unresolved"],
      officialLookupTargets: ["mfds_otc"],
      mfdsOtcScreeningRequired: true,
      reviewRequired: true,
    };

  const regulatoryClassCandidates: RegulatoryClassCandidate[] = [];
  const officialLookupTargets: OfficialLookupTarget[] = [];
  const add = <T>(items: T[], value: T): void => {
    if (!items.includes(value)) items.push(value);
  };
  for (const kind of kinds)
    if (kind === "cosmetic") {
      add(regulatoryClassCandidates, "cosmetic");
      add(officialLookupTargets, "mfds_cosmetic");
    } else if (kind === "medical_device") {
      add(regulatoryClassCandidates, "medical_device");
      add(officialLookupTargets, "mfds_medical_device");
    } else if (kind === "medicine_or_health_supplement") {
      add(regulatoryClassCandidates, "medicine");
      add(regulatoryClassCandidates, "health_supplement");
      add(officialLookupTargets, "mfds_otc");
      add(officialLookupTargets, "mfds_health_supplement");
    } else {
      add(regulatoryClassCandidates, "medicine");
      add(regulatoryClassCandidates, "unresolved");
      add(officialLookupTargets, "mfds_otc");
    }
  const classOrder: readonly RegulatoryClassCandidate[] = [
    "medicine",
    "health_supplement",
    "cosmetic",
    "medical_device",
    "unresolved",
  ];
  const targetOrder: readonly OfficialLookupTarget[] = [
    "mfds_otc",
    "mfds_health_supplement",
    "mfds_cosmetic",
    "mfds_medical_device",
  ];
  regulatoryClassCandidates.sort(
    (left, right) => classOrder.indexOf(left) - classOrder.indexOf(right),
  );
  officialLookupTargets.sort(
    (left, right) => targetOrder.indexOf(left) - targetOrder.indexOf(right),
  );
  return {
    route: "mixed_regulatory_domains_review",
    regulatoryClassCandidates,
    officialLookupTargets,
    mfdsOtcScreeningRequired: officialLookupTargets.includes("mfds_otc"),
    reviewRequired: true,
  };
};

const emptyRouteCounts = (): Record<
  ClassificationRoute,
  { skuCount: number; groupCount: number }
> => ({
  cosmetic: { skuCount: 0, groupCount: 0 },
  medical_device: { skuCount: 0, groupCount: 0 },
  medicine_or_health_supplement_review: { skuCount: 0, groupCount: 0 },
  medicine_or_unresolved_review: { skuCount: 0, groupCount: 0 },
  mixed_regulatory_domains_review: { skuCount: 0, groupCount: 0 },
});

const emptyDomainCounts = (): Record<
  RegulatoryClassCandidate,
  { skuCount: number; groupCount: number }
> => ({
  medicine: { skuCount: 0, groupCount: 0 },
  health_supplement: { skuCount: 0, groupCount: 0 },
  cosmetic: { skuCount: 0, groupCount: 0 },
  medical_device: { skuCount: 0, groupCount: 0 },
  unresolved: { skuCount: 0, groupCount: 0 },
});

const duplicateSummary = (
  groups: ReadonlyMap<string, readonly LocalPharmacyCatalogSourceRow[]>,
): Readonly<{ groupCount: number; skuCount: number }> => {
  const duplicates = [...groups.values()].filter((rows) => rows.length > 1);
  return {
    groupCount: duplicates.length,
    skuCount: duplicates.reduce((sum, rows) => sum + rows.length, 0),
  };
};

export function buildLocalPharmacyCatalogCandidates(
  sourceRows: readonly LocalPharmacyCatalogSourceRow[],
  runtimeProducts: readonly RuntimeRegistryProductName[],
): Readonly<{
  candidates: readonly LocalCatalogCandidate[];
  report: LocalCatalogDryRunReport;
}> {
  const groups = new Map<string, LocalPharmacyCatalogSourceRow[]>();
  const nameGroups = new Map<string, LocalPharmacyCatalogSourceRow[]>();
  for (const row of sourceRows) {
    const normalizedName = normalizeLocalCatalogText(row.name);
    const normalizedCapacity = normalizeLocalCatalogText(
      row.capacity ?? row.specification ?? "",
    );
    if (!row.id.trim() || !normalizedName || !normalizedCapacity)
      throw new Error("local catalog row requires id, name, and capacity");
    const groupKey = `${normalizedName}|${normalizedCapacity}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
    nameGroups.set(normalizedName, [
      ...(nameGroups.get(normalizedName) ?? []),
      row,
    ]);
  }

  const exactRuntime = new Map<string, string[]>();
  const nearRuntime = new Map<string, string[]>();
  for (const product of runtimeProducts) {
    const exact = normalizeLocalCatalogText(product.displayName);
    exactRuntime.set(exact, [
      ...(exactRuntime.get(exact) ?? []),
      product.productId,
    ]);
    const near = nearNameBase(product.displayName);
    if (near)
      nearRuntime.set(near, [
        ...(nearRuntime.get(near) ?? []),
        product.productId,
      ]);
  }

  const candidates = [...groups.entries()]
    .map(([groupKey, groupRows]): LocalCatalogCandidate => {
      const rows = [...groupRows].sort((left, right) =>
        left.id.localeCompare(right.id),
      );
      const first = rows[0]!;
      const normalizedName = normalizeLocalCatalogText(first.name);
      const normalizedCapacity = normalizeLocalCatalogText(
        first.capacity ?? first.specification ?? "",
      );
      const categories = uniqueSorted(rows.map((row) => row.category));
      const exactIds = uniqueSorted(exactRuntime.get(normalizedName) ?? []);
      const nearIds =
        exactIds.length > 0
          ? []
          : uniqueSorted(nearRuntime.get(nearNameBase(first.name)) ?? []);
      return {
        candidateGroupId: `LOCAL-RETAIL-${createHash("sha256")
          .update(groupKey)
          .digest("hex")
          .slice(0, 16)
          .toUpperCase()}`,
        displayName: first.name.trim(),
        capacity: (first.capacity ?? first.specification ?? "").trim(),
        normalizedName,
        normalizedCapacity,
        sourceCategories: categories,
        sourceSkuIds: uniqueSorted(rows.map((row) => row.id)),
        sourceSkuCount: rows.length,
        sourceRecordedAt: uniqueSorted(
          rows.map((row) => row.recorded_at ?? ""),
        ),
        sourceVerificationStatuses: uniqueSorted(
          rows.map((row) => row.verification_status ?? ""),
        ),
        classification: classificationFor(categories),
        runtimeIntersection: {
          status:
            exactIds.length > 0
              ? "exact_name"
              : nearIds.length > 0
                ? "near_name_review"
                : "none",
          productIds: exactIds.length > 0 ? exactIds : nearIds,
        },
        officialMatch: {
          status: "required",
          itemSeq: null,
          permitJoined: false,
          ingredientsJoined: false,
          durJoined: false,
        },
        candidateOnly: true,
        clinicalUseProhibited: true,
        formularyEligible: false,
      };
    })
    .sort(
      (left, right) =>
        left.normalizedName.localeCompare(right.normalizedName, "ko") ||
        left.normalizedCapacity.localeCompare(right.normalizedCapacity, "ko"),
    );

  const sourceDuplicates = duplicateSummary(nameGroups);
  const candidateDuplicates = duplicateSummary(groups);
  const routeCounts = emptyRouteCounts();
  const domainCounts = emptyDomainCounts();
  for (const candidate of candidates) {
    const route = routeCounts[candidate.classification.route];
    route.skuCount += candidate.sourceSkuCount;
    route.groupCount += 1;
    for (const domain of candidate.classification.regulatoryClassCandidates) {
      domainCounts[domain].skuCount += candidate.sourceSkuCount;
      domainCounts[domain].groupCount += 1;
    }
  }

  const exact = candidates.filter(
    (candidate) => candidate.runtimeIntersection.status === "exact_name",
  );
  const near = candidates.filter(
    (candidate) => candidate.runtimeIntersection.status === "near_name_review",
  );
  const runtimeProductIds = (items: readonly LocalCatalogCandidate[]) =>
    new Set(
      items.flatMap((candidate) => candidate.runtimeIntersection.productIds),
    ).size;
  const medicineCandidates = candidates.filter(
    (candidate) => candidate.classification.mfdsOtcScreeningRequired,
  );

  return {
    candidates,
    report: {
      sourceSkuCount: sourceRows.length,
      sourceNameDuplicateGroupCount: sourceDuplicates.groupCount,
      skusInSourceNameDuplicateGroups: sourceDuplicates.skuCount,
      candidateGroupCount: candidates.length,
      nameCapacityDuplicateGroupCount: candidateDuplicates.groupCount,
      skusInNameCapacityDuplicateGroups: candidateDuplicates.skuCount,
      classificationRoutes: routeCounts,
      regulatoryDomainCandidates: domainCounts,
      officialMatching: {
        confirmedSkuCount: 0,
        confirmedCandidateGroupCount: 0,
        requiredSkuCount: sourceRows.length,
        requiredCandidateGroupCount: candidates.length,
        mfdsOtcScreeningSkuCount: medicineCandidates.reduce(
          (sum, candidate) => sum + candidate.sourceSkuCount,
          0,
        ),
        mfdsOtcScreeningCandidateGroupCount: medicineCandidates.length,
      },
      runtimeIntersection: {
        runtimeProductCount: runtimeProducts.length,
        exactSkuCount: exact.reduce(
          (sum, candidate) => sum + candidate.sourceSkuCount,
          0,
        ),
        exactCandidateGroupCount: exact.length,
        exactRuntimeProductCount: runtimeProductIds(exact),
        nearNameReviewSkuCount: near.reduce(
          (sum, candidate) => sum + candidate.sourceSkuCount,
          0,
        ),
        nearNameReviewGroupCount: near.length,
        nearNameReviewRuntimeProductCount: runtimeProductIds(near),
        missingCandidateGroupCount: candidates.length - exact.length,
      },
    },
  };
}
