import { createHash } from "node:crypto";
import { extname, resolve, sep } from "node:path";
import type { SourceSnapshot } from "@pharmassist/contracts";

export * from "./local-pharmacy-catalog.js";
export * from "./healthkr-product-registry.js";

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export function secureImportPath(root: string, candidate: string): string {
  if (candidate.includes("\0")) throw new Error("NUL path rejected");
  const base = resolve(root);
  const target = resolve(base, candidate);
  if (target !== base && !target.startsWith(`${base}${sep}`))
    throw new Error("path traversal rejected");
  if (![".json", ".jsonl", ".csv"].includes(extname(target).toLowerCase()))
    throw new Error("unsupported import type");
  return target;
}
export function assertImportSize(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_IMPORT_BYTES)
    throw new Error("import size rejected");
}

export type ProviderId =
  "mfds_easy_drug" | "mfds_permit" | "mfds_dur_product" | "mfds_dur_ingredient";

export interface ProviderDefinition {
  readonly id: ProviderId;
  readonly sourceId: string;
  readonly official: true;
  readonly portalUrl: string;
  readonly baseUrl: string;
  readonly operationPath: string;
  readonly operationPathEnv: string;
  readonly serviceKeyEnv: string;
  readonly pageSize: number;
  readonly requestsPerSecond: number;
  readonly parserVersion: string;
  readonly termsUrl: string;
  readonly uncertainty: string;
}

/**
 * Operation paths for the permit/DUR services must be compared with the
 * account-visible Swagger immediately before production activation. Their base
 * service versions and portal records are pinned here; env overrides avoid a
 * code release when MFDS changes only an operation path.
 */
export const MFDS_PROVIDERS: Readonly<Record<ProviderId, ProviderDefinition>> =
  {
    mfds_easy_drug: {
      id: "mfds_easy_drug",
      sourceId: "SRC-MFDS-EASY-DRUG-15075057",
      official: true,
      portalUrl: "https://www.data.go.kr/data/15075057/openapi.do",
      baseUrl: "http://apis.data.go.kr/1471000/DrbEasyDrugInfoService",
      operationPath: "getDrbEasyDrugList",
      operationPathEnv: "MFDS_EASY_DRUG_OPERATION_PATH",
      serviceKeyEnv: "MFDS_EASY_DRUG_SERVICE_KEY",
      pageSize: 100,
      requestsPerSecond: 3,
      parserVersion: "mfds-easy-drug-v1",
      termsUrl: "https://www.data.go.kr/ugs/selectPortalPolicyView.do",
      uncertainty:
        "No credentialed response was fetched in this patch; verify current Swagger fields before activation.",
    },
    mfds_permit: {
      id: "mfds_permit",
      sourceId: "SRC-MFDS-PERMIT-15095677",
      official: true,
      portalUrl: "https://www.data.go.kr/data/15095677/openapi.do",
      baseUrl: "https://apis.data.go.kr/1471000/DrugPrdtPrmsnInfoService07",
      operationPath: "getDrugPrdtPrmsnDtlInq07",
      operationPathEnv: "MFDS_PERMIT_OPERATION_PATH",
      serviceKeyEnv: "MFDS_PERMIT_SERVICE_KEY",
      pageSize: 100,
      requestsPerSecond: 3,
      parserVersion: "mfds-permit-07-v1",
      termsUrl: "https://www.data.go.kr/ugs/selectPortalPolicyView.do",
      uncertainty:
        "Operation path is an activation-time setting; confirm current Swagger and the main_item_ingr/TAMT_SEQ revision before production.",
    },
    mfds_dur_product: {
      id: "mfds_dur_product",
      sourceId: "SRC-MFDS-DUR-PRODUCT-15059486",
      official: true,
      portalUrl: "https://www.data.go.kr/data/15059486/openapi.do",
      baseUrl: "https://apis.data.go.kr/1471000/DURPrdlstInfoService03",
      operationPath: "getDurPrdlstInfoList03",
      operationPathEnv: "MFDS_DUR_PRODUCT_OPERATION_PATH",
      serviceKeyEnv: "MFDS_DUR_PRODUCT_SERVICE_KEY",
      pageSize: 100,
      requestsPerSecond: 3,
      parserVersion: "mfds-dur-product-03-v1",
      termsUrl: "https://www.data.go.kr/ugs/selectPortalPolicyView.do",
      uncertainty:
        "No credentialed response was fetched in this patch; operation names and response aliases must be verified in current Swagger.",
    },
    mfds_dur_ingredient: {
      id: "mfds_dur_ingredient",
      sourceId: "SRC-MFDS-DUR-INGREDIENT-15056780",
      official: true,
      portalUrl: "https://www.data.go.kr/data/15056780/openapi.do",
      baseUrl: "https://apis.data.go.kr/1471000/DURIrdntInfoService02",
      operationPath: "getDurIrdntInfoList02",
      operationPathEnv: "MFDS_DUR_INGREDIENT_OPERATION_PATH",
      serviceKeyEnv: "MFDS_DUR_INGREDIENT_SERVICE_KEY",
      pageSize: 100,
      requestsPerSecond: 3,
      parserVersion: "mfds-dur-ingredient-02-v1",
      termsUrl: "https://www.data.go.kr/ugs/selectPortalPolicyView.do",
      uncertainty:
        "No credentialed response was fetched in this patch; operation names and response aliases must be verified in current Swagger.",
    },
  };

export interface ContractGatedProviderDefinition {
  readonly id: "health_kr";
  readonly portalUrl: string;
  readonly contractInquiryUrl: string;
  readonly enabledByDefault: false;
  readonly permittedUses: Readonly<{
    commercialUse: "unknown";
    cache: "unknown";
    derivedData: "unknown";
    redistribution: "unknown";
    aiContext: "unknown";
  }>;
  readonly activationRequirement: string;
}

/**
 * Health.kr is intentionally not implemented as a scraper. Enable a provider
 * adapter only after a written API/partnership agreement explicitly grants
 * every listed use and bind that agreement/version to SourceSnapshot terms.
 */
export const HEALTH_KR_OPTIONAL_PROVIDER: ContractGatedProviderDefinition = {
  id: "health_kr",
  portalUrl: "https://www.health.kr/",
  contractInquiryUrl: "https://api.health.kr/mail",
  enabledByDefault: false,
  permittedUses: {
    commercialUse: "unknown",
    cache: "unknown",
    derivedData: "unknown",
    redistribution: "unknown",
    aiContext: "unknown",
  },
  activationRequirement:
    "Written terms must authorize commercial use, caching, derived data, redistribution, and AI-context use; public-page bulk crawling is prohibited.",
};

export function assertHealthKrContract(
  input: Readonly<{
    agreementId?: string;
    commercialUse?: boolean;
    cache?: boolean;
    derivedData?: boolean;
    redistribution?: boolean;
    aiContext?: boolean;
  }>,
): string {
  if (
    !input.agreementId?.trim() ||
    !input.commercialUse ||
    !input.cache ||
    !input.derivedData ||
    !input.redistribution ||
    !input.aiContext
  )
    throw new Error("Health.kr provider contract permissions are incomplete");
  return input.agreementId.trim();
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}
export interface HttpTransport {
  request(url: string, signal: AbortSignal): Promise<HttpResponse>;
}
export const fetchTransport: HttpTransport = {
  async request(url, signal) {
    const response = await fetch(url, {
      signal,
      headers: { Accept: "application/json, application/xml;q=0.8" },
    });
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
    };
  },
};

export interface SourceAdapter<T = Readonly<Record<string, unknown>>> {
  readonly id: string;
  readonly official: boolean;
  readonly licenseRecorded: boolean;
  fetch(signal: AbortSignal): Promise<
    Readonly<{
      snapshot: SourceSnapshot;
      records: readonly T[];
    }>
  >;
}
export function assertProductionAdapter(adapter: SourceAdapter): void {
  if (!adapter.official || !adapter.licenseRecorded)
    throw new Error("official source/license gate required");
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolvePromise, reject) => {
    const timer = setTimeout(resolvePromise, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("aborted"));
      },
      { once: true },
    );
  });

const asRecord = (
  value: unknown,
): Readonly<Record<string, unknown>> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const decodeXml = (value: string): string =>
  value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");

function parseXmlItems(
  body: string,
): readonly Readonly<Record<string, unknown>>[] {
  const items: Record<string, unknown>[] = [];
  for (const match of body.matchAll(/<item>([\s\S]*?)<\/item>/giu)) {
    const row: Record<string, unknown> = {};
    for (const field of match[1]!.matchAll(
      /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/gu,
    ))
      row[field[1]!] = decodeXml(
        field[2]!.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1").trim(),
      );
    items.push(row);
  }
  return items;
}

export interface ParsedPage {
  readonly items: readonly Readonly<Record<string, unknown>>[];
  readonly totalCount: number;
  readonly pageNo: number;
  readonly numOfRows: number;
  readonly resultCode: string;
  readonly resultMessage: string;
}

export function parseMfDsPage(
  body: string,
  contentType = "application/json",
): ParsedPage {
  if (contentType.includes("xml") || body.trimStart().startsWith("<")) {
    const value = (tag: string): string | undefined =>
      body
        .match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "iu"))?.[1]
        ?.trim();
    return {
      items: parseXmlItems(body),
      totalCount: Number(value("totalCount") ?? 0),
      pageNo: Number(value("pageNo") ?? 1),
      numOfRows: Number(value("numOfRows") ?? 0),
      resultCode: value("resultCode") ?? "",
      resultMessage: value("resultMsg") ?? "",
    };
  }
  const root = asRecord(JSON.parse(body));
  const response = asRecord(root?.["response"]) ?? root;
  const header = asRecord(response?.["header"]);
  const responseBody = asRecord(response?.["body"]) ?? response;
  const itemsContainer = responseBody?.["items"];
  const rawItems = Array.isArray(itemsContainer)
    ? itemsContainer
    : asRecord(itemsContainer)?.["item"];
  const items = (
    Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []
  )
    .map(asRecord)
    .filter((item): item is Readonly<Record<string, unknown>> => Boolean(item));
  return {
    items,
    totalCount: Number(responseBody?.["totalCount"] ?? items.length),
    pageNo: Number(responseBody?.["pageNo"] ?? 1),
    numOfRows: Number(responseBody?.["numOfRows"] ?? items.length),
    resultCode: String(header?.["resultCode"] ?? "00"),
    resultMessage: String(header?.["resultMsg"] ?? "NORMAL SERVICE"),
  };
}

export interface MfdsAdapterOptions {
  readonly definition: ProviderDefinition;
  readonly serviceKey: string;
  readonly operationPath?: string;
  readonly transport?: HttpTransport;
  readonly maxPages?: number;
  readonly maxAttempts?: number;
  readonly now?: () => Date;
}

export class MfdsPagedAdapter implements SourceAdapter {
  readonly id: string;
  readonly official = true;
  readonly licenseRecorded = true;
  private readonly transport: HttpTransport;
  constructor(private readonly options: MfdsAdapterOptions) {
    if (!options.serviceKey.trim())
      throw new Error(`${options.definition.serviceKeyEnv} is required`);
    this.id = options.definition.id;
    this.transport = options.transport ?? fetchTransport;
  }

  private async page(
    pageNo: number,
    signal: AbortSignal,
  ): Promise<HttpResponse> {
    const definition = this.options.definition;
    const path = this.options.operationPath ?? definition.operationPath;
    const url = new URL(`${definition.baseUrl.replace(/\/$/u, "")}/${path}`);
    url.searchParams.set("ServiceKey", this.options.serviceKey);
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", String(definition.pageSize));
    url.searchParams.set("type", "json");
    const attempts = this.options.maxAttempts ?? 4;
    let last: HttpResponse | undefined;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      last = await this.transport.request(url.toString(), signal);
      if (last.status >= 200 && last.status < 300) return last;
      if (![408, 425, 429, 500, 502, 503, 504].includes(last.status)) break;
      const retryAfter = Number(last.headers["retry-after"] ?? 0);
      const backoff =
        retryAfter > 0
          ? retryAfter * 1_000
          : Math.min(8_000, 250 * 2 ** (attempt - 1));
      await sleep(backoff, signal);
    }
    throw new Error(
      `MFDS ${definition.id} request failed with HTTP ${last?.status ?? 0}`,
    );
  }

  async fetch(signal: AbortSignal): Promise<
    Readonly<{
      snapshot: SourceSnapshot;
      records: readonly Readonly<Record<string, unknown>>[];
    }>
  > {
    const pages: string[] = [];
    const records: Readonly<Record<string, unknown>>[] = [];
    const maxPages = this.options.maxPages ?? 10_000;
    let pageNo = 1;
    let totalCount = Number.POSITIVE_INFINITY;
    while (records.length < totalCount && pageNo <= maxPages) {
      const response = await this.page(pageNo, signal);
      const parsed = parseMfDsPage(
        response.body,
        response.headers["content-type"] ?? "",
      );
      if (!["00", "0", "NORMAL_CODE"].includes(parsed.resultCode))
        throw new Error(
          `MFDS ${this.id} API error ${parsed.resultCode}: ${parsed.resultMessage}`,
        );
      pages.push(response.body);
      records.push(...parsed.items);
      totalCount = parsed.totalCount;
      if (parsed.items.length === 0 || records.length >= totalCount) break;
      pageNo += 1;
      await sleep(
        Math.ceil(1_000 / this.options.definition.requestsPerSecond),
        signal,
      );
    }
    if (pageNo > maxPages && records.length < totalCount)
      throw new Error(`MFDS ${this.id} pagination limit exceeded`);
    const fetchedAt = (this.options.now ?? (() => new Date()))().toISOString();
    const digest = sha256(pages.join("\n--PAGE--\n"));
    return {
      records,
      snapshot: {
        source_snapshot_id: `SNAP-${this.id.toUpperCase().replaceAll("_", "-")}-${digest.slice(0, 16).toUpperCase()}`,
        source_id: this.options.definition.sourceId,
        provider: this.options.definition.id,
        official: true,
        source_url: `${this.options.definition.baseUrl}/${this.options.operationPath ?? this.options.definition.operationPath}`,
        fetched_at: fetchedAt,
        effective_at: null,
        terms_url: this.options.definition.termsUrl,
        // Portal Type-0 permissions are recorded below, but individual records
        // can still contain third-party rights. Keep the aggregate rights gate
        // unresolved until the activation review explicitly clears that risk.
        usage_rights: "unknown",
        commercial_use: "allowed",
        cache_policy: "allowed",
        redistribution: "allowed",
        ai_context_use: "allowed",
        http_status: 200,
        content_sha256: digest,
        content_type: "application/json",
        parser_version: this.options.definition.parserVersion,
        record_count: records.length,
        page_count: pages.length,
        next_cursor: null,
        status: "parsed",
        raw_retention_policy: "none",
        uncertainty: `${this.options.definition.uncertainty} Portal Type-0 terms were recorded, but record-level third-party rights remain unresolved until activation review.`,
      },
    };
  }
}

const boundedInteger = (
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
};

export function createMfDsAdapterFromEnv(
  id: ProviderId,
  env: Readonly<Record<string, string | undefined>> = process.env,
  transport?: HttpTransport,
): MfdsPagedAdapter {
  const definition = MFDS_PROVIDERS[id];
  const serviceKey = env[definition.serviceKeyEnv] ?? "";
  return new MfdsPagedAdapter({
    definition,
    serviceKey,
    operationPath: env[definition.operationPathEnv] ?? definition.operationPath,
    maxAttempts: boundedInteger(env["MFDS_HTTP_MAX_ATTEMPTS"], 4, 1, 8),
    ...(transport ? { transport } : {}),
  });
}

export interface CandidateSourceRecord {
  readonly provider: ProviderId;
  readonly itemSeq?: string;
  readonly ingredientCode?: string;
  readonly productName?: string;
  readonly manufacturer?: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly candidateOnly: true;
}
const text = (
  record: Readonly<Record<string, unknown>>,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
};

export function normalizeMfDsCandidate(
  provider: ProviderId,
  record: Readonly<Record<string, unknown>>,
): CandidateSourceRecord {
  const itemSeq = text(record, "itemSeq", "ITEM_SEQ", "item_seq");
  const ingredientCode = text(
    record,
    "INGR_CODE",
    "ingrCode",
    "MIXTURE_INGR_CODE",
  );
  const productName = text(record, "itemName", "ITEM_NAME", "PRDUCT");
  const manufacturer = text(record, "entpName", "ENTP_NAME", "ENTRPS");
  return {
    provider,
    ...(itemSeq ? { itemSeq } : {}),
    ...(ingredientCode ? { ingredientCode } : {}),
    ...(productName ? { productName } : {}),
    ...(manufacturer ? { manufacturer } : {}),
    fields: record,
    candidateOnly: true,
  };
}

export interface PosRow {
  readonly tenantSku: string;
  readonly soldAt: string;
  readonly units: number;
  readonly itemSeq?: string;
  readonly productId?: string;
  readonly symptomCategory?: string;
}

function csvRows(input: string): readonly string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((item) => item.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("unterminated CSV quote");
  row.push(field);
  if (row.some((item) => item.length > 0)) rows.push(row);
  return rows;
}

export function parsePosCsv(input: string): readonly PosRow[] {
  assertImportSize(Buffer.byteLength(input, "utf8"));
  const rows = csvRows(input);
  const header = rows[0]?.map((item) => item.trim().toLowerCase()) ?? [];
  if (
    header.some((name) =>
      /patient|환자|phone|전화|name|성명|address|주소/u.test(name),
    )
  )
    throw new Error("patient-identifying POS columns are prohibited");
  const required = ["tenant_sku", "sold_at", "units"];
  for (const name of required)
    if (!header.includes(name)) throw new Error(`missing POS column: ${name}`);
  const index = (name: string): number => header.indexOf(name);
  return rows.slice(1).map((values, rowIndex) => {
    const units = Number(values[index("units")]);
    const soldAt = values[index("sold_at")]?.trim() ?? "";
    if (
      !Number.isFinite(units) ||
      units < 0 ||
      !Number.isFinite(Date.parse(soldAt))
    )
      throw new Error(`invalid POS row ${rowIndex + 2}`);
    const itemSeq =
      index("item_seq") >= 0 ? values[index("item_seq")]?.trim() : undefined;
    const productId =
      index("product_id") >= 0
        ? values[index("product_id")]?.trim()
        : undefined;
    const symptomCategory =
      index("symptom_category") >= 0
        ? values[index("symptom_category")]?.trim()
        : undefined;
    return {
      tenantSku: values[index("tenant_sku")]!.trim(),
      soldAt: new Date(soldAt).toISOString(),
      units,
      ...(itemSeq ? { itemSeq } : {}),
      ...(productId ? { productId } : {}),
      ...(symptomCategory ? { symptomCategory } : {}),
    };
  });
}

export interface ProductCrosswalkCandidate {
  readonly tenantSku: string;
  readonly productId: string | null;
  readonly itemSeq: string | null;
  readonly confidence: number;
  readonly status: "candidate" | "unmatched";
}
export function crosswalkPosProducts(
  rows: readonly PosRow[],
  products: readonly Readonly<{ productId: string; itemSeq: string }>[],
): readonly ProductCrosswalkCandidate[] {
  const byItemSeq = new Map(
    products.map((item) => [item.itemSeq, item.productId] as const),
  );
  const direct = new Map(
    rows
      .filter((item) => item.productId)
      .map((item) => [item.tenantSku, item.productId!] as const),
  );
  const result = new Map<string, ProductCrosswalkCandidate>();
  for (const row of rows) {
    const productId =
      direct.get(row.tenantSku) ??
      (row.itemSeq ? byItemSeq.get(row.itemSeq) : undefined);
    result.set(row.tenantSku, {
      tenantSku: row.tenantSku,
      productId: productId ?? null,
      itemSeq: row.itemSeq ?? null,
      confidence: productId ? (direct.has(row.tenantSku) ? 1 : 0.99) : 0,
      status: productId ? "candidate" : "unmatched",
    });
  }
  return [...result.values()];
}

export interface SalesCandidate {
  readonly productId: string;
  readonly symptomCategory: string;
  readonly unitsSold: number;
  readonly clinicalPriority: number;
  readonly safetyPriority: number;
}
export interface CoverageCandidate extends SalesCandidate {
  readonly salesRank: number;
  readonly cumulativeCoverage: number;
  readonly selectedBy: "coverage" | "category_floor";
}

/**
 * Selects a pharmacist-review candidate set. It does not score clinical fit:
 * callers must pre-filter to active, supplied OTC products that survived DUR
 * blocking and map them to an already eligible protocol option.
 */
export function selectCoverageCandidates(
  candidates: readonly SalesCandidate[],
  coverageTarget = 0.85,
  minimumPerCategory = 1,
): readonly CoverageCandidate[] {
  if (coverageTarget < 0.85 || coverageTarget > 0.9)
    throw new Error("coverage target must be between 0.85 and 0.90");
  if (!Number.isInteger(minimumPerCategory) || minimumPerCategory < 1)
    throw new Error("minimum per category must be a positive integer");
  const sorted = [...candidates].sort(
    (left, right) =>
      right.unitsSold - left.unitsSold ||
      left.productId.localeCompare(right.productId),
  );
  const total = sorted.reduce((sum, item) => sum + item.unitsSold, 0);
  let cumulative = 0;
  const selected = new Map<string, CoverageCandidate>();
  sorted.forEach((item, index) => {
    cumulative += item.unitsSold;
    const cumulativeCoverage = total > 0 ? cumulative / total : 0;
    if (
      cumulativeCoverage - (total > 0 ? item.unitsSold / total : 0) <
      coverageTarget
    )
      selected.set(item.productId, {
        ...item,
        salesRank: index + 1,
        cumulativeCoverage,
        selectedBy: "coverage",
      });
  });
  const byCategory = new Map<string, SalesCandidate[]>();
  for (const item of sorted)
    byCategory.set(item.symptomCategory, [
      ...(byCategory.get(item.symptomCategory) ?? []),
      item,
    ]);
  for (const [category, items] of byCategory) {
    const already = [...selected.values()].filter(
      (item) => item.symptomCategory === category,
    ).length;
    for (const item of items.slice(
      0,
      Math.max(0, minimumPerCategory - already),
    )) {
      const rank =
        sorted.findIndex(
          (candidate) => candidate.productId === item.productId,
        ) + 1;
      selected.set(item.productId, {
        ...item,
        salesRank: rank,
        cumulativeCoverage:
          total > 0
            ? sorted
                .slice(0, rank)
                .reduce((sum, candidate) => sum + candidate.unitsSold, 0) /
              total
            : 0,
        selectedBy: "category_floor",
      });
    }
  }
  return [...selected.values()].sort(
    (left, right) =>
      // Clinical and safety priorities remain the first runtime ordering keys;
      // sales rank is metadata for the final tie-break only.
      right.clinicalPriority - left.clinicalPriority ||
      right.safetyPriority - left.safetyPriority ||
      left.salesRank - right.salesRank ||
      left.productId.localeCompare(right.productId),
  );
}
