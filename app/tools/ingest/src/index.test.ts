import { describe, expect, it } from "vitest";
import {
  assertHealthKrContract,
  assertImportSize,
  assertProductionAdapter,
  crosswalkPosProducts,
  HEALTH_KR_OPTIONAL_PROVIDER,
  MFDS_PROVIDERS,
  MfdsPagedAdapter,
  parseMfDsPage,
  parsePosCsv,
  secureImportPath,
  selectCoverageCandidates,
  type HttpTransport,
} from "./index.js";

describe("ingest boundary", () => {
  it("rejects traversal and unsafe file types", () => {
    expect(() => secureImportPath("C:/safe", "../secret.json")).toThrow(
      "traversal",
    );
    expect(() => secureImportPath("C:/safe", "payload.zip")).toThrow(
      "unsupported",
    );
  });

  it("bounds import size and rejects patient-identifying POS columns", () => {
    expect(() => assertImportSize(21 * 1024 * 1024)).toThrow("size");
    expect(() =>
      parsePosCsv(
        "tenant_sku,sold_at,units,patient_name\nA,2026-07-13,1,홍길동",
      ),
    ).toThrow("patient-identifying");
  });

  it("requires an official adapter with recorded rights for production", () => {
    expect(() =>
      assertProductionAdapter({
        id: "mock",
        official: false,
        licenseRecorded: false,
        fetch: async () => {
          throw new Error("not called");
        },
      }),
    ).toThrow("official");
  });

  it("parses MFDS JSON and XML page envelopes", () => {
    expect(
      parseMfDsPage(
        JSON.stringify({
          response: {
            header: { resultCode: "00", resultMsg: "NORMAL SERVICE" },
            body: {
              pageNo: 1,
              numOfRows: 1,
              totalCount: 1,
              items: { item: { itemSeq: "1", itemName: "테스트" } },
            },
          },
        }),
      ).items,
    ).toEqual([{ itemSeq: "1", itemName: "테스트" }]);
    expect(
      parseMfDsPage(
        "<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE</resultMsg></header><body><pageNo>1</pageNo><numOfRows>1</numOfRows><totalCount>1</totalCount><items><item><ITEM_SEQ>2</ITEM_SEQ><ITEM_NAME><![CDATA[테스트2]]></ITEM_NAME></item></items></body></response>",
        "application/xml",
      ).items,
    ).toEqual([{ ITEM_SEQ: "2", ITEM_NAME: "테스트2" }]);
  });

  it("paginates with injected mock HTTP and records provenance without retaining raw dumps", async () => {
    const requested: string[] = [];
    const transport: HttpTransport = {
      async request(url) {
        requested.push(url);
        const pageNo = Number(new URL(url).searchParams.get("pageNo"));
        const item = pageNo === 1 ? { itemSeq: "1" } : { itemSeq: "2" };
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            response: {
              header: { resultCode: "00", resultMsg: "NORMAL SERVICE" },
              body: {
                pageNo,
                numOfRows: 1,
                totalCount: 2,
                items: { item },
              },
            },
          }),
        };
      },
    };
    const result = await new MfdsPagedAdapter({
      definition: {
        ...MFDS_PROVIDERS.mfds_easy_drug,
        requestsPerSecond: 1_000,
      },
      serviceKey: "test-only-not-a-real-credential",
      transport,
      now: () => new Date("2026-07-13T00:00:00Z"),
    }).fetch(new AbortController().signal);

    expect(requested).toHaveLength(2);
    expect(result.records).toHaveLength(2);
    expect(result.snapshot.source_id).toBe("SRC-MFDS-EASY-DRUG-15075057");
    expect(result.snapshot.record_count).toBe(2);
    expect(result.snapshot.page_count).toBe(2);
    expect(result.snapshot.raw_retention_policy).toBe("none");
  });

  it("crosswalks official product IDs and computes 85–90% coverage candidates", () => {
    const rows = parsePosCsv(
      "tenant_sku,sold_at,units,item_seq,symptom_category\nA,2026-07-01,80,100,cough\nB,2026-07-02,15,200,cough\nC,2026-07-03,5,300,skin",
    );
    const crosswalk = crosswalkPosProducts(rows, [
      { productId: "PRD-100", itemSeq: "100" },
      { productId: "PRD-200", itemSeq: "200" },
      { productId: "PRD-300", itemSeq: "300" },
    ]);
    expect(crosswalk.every((item) => item.status === "candidate")).toBe(true);

    const selected = selectCoverageCandidates(
      [
        {
          productId: "PRD-100",
          symptomCategory: "cough",
          unitsSold: 80,
          clinicalPriority: 100,
          safetyPriority: 100,
        },
        {
          productId: "PRD-200",
          symptomCategory: "cough",
          unitsSold: 15,
          clinicalPriority: 100,
          safetyPriority: 100,
        },
        {
          productId: "PRD-300",
          symptomCategory: "skin",
          unitsSold: 5,
          clinicalPriority: 100,
          safetyPriority: 100,
        },
      ],
      0.85,
      1,
    );
    expect(selected.some((item) => item.productId === "PRD-300")).toBe(true);
    expect(selected.every((item) => item.clinicalPriority === 100)).toBe(true);
  });

  it("keeps Health.kr disabled until every contract permission is explicit", () => {
    expect(HEALTH_KR_OPTIONAL_PROVIDER.enabledByDefault).toBe(false);
    expect(() => assertHealthKrContract({ agreementId: "AGR-1" })).toThrow(
      "permissions",
    );
    expect(
      assertHealthKrContract({
        agreementId: "AGR-1",
        commercialUse: true,
        cache: true,
        derivedData: true,
        redistribution: true,
        aiContext: true,
      }),
    ).toBe("AGR-1");
  });
});
