import { describe, expect, it } from "vitest";
import {
  buildHealthKrProductRegistry,
  matchHealthKrIngredient,
  mergePortableHealthKrCatalog,
  type HealthKrRegistryPack,
} from "./healthkr-product-registry.js";

const pack: HealthKrRegistryPack = {
  packId: "PACK-TEST",
  version: "1.0.0-test",
  ingredients: [
    {
      ingredient_id: "ING-ACETAMINOPHEN",
      normalized_name: "acetaminophen",
      display_name_en: "Acetaminophen",
      display_name_ko: "아세트아미노펜",
    },
    {
      ingredient_id: "ING-IBUPROFEN",
      normalized_name: "ibuprofen",
      display_name_en: "Ibuprofen",
      display_name_ko: "이부프로펜",
    },
  ],
  protocolOptions: [
    {
      option_id: "OPT-FEVER-ACETAMINOPHEN",
      protocol_id: "PTC-FEVER",
      ingredient_id: "ING-ACETAMINOPHEN",
    },
    {
      option_id: "OPT-HEADACHE-ACETAMINOPHEN",
      protocol_id: "PTC-HEADACHE",
      ingredient_id: "ING-ACETAMINOPHEN",
    },
    {
      option_id: "OPT-FEVER-IBUPROFEN",
      protocol_id: "PTC-FEVER",
      ingredient_id: "ING-IBUPROFEN",
    },
  ],
};

const confirmedRow = (
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> => ({
  document_id: "document-1",
  id: "retail-1",
  app_id: "retail-1",
  name: "해열정",
  app_name: "해열정",
  normalized_name: "해열정",
  normalized_capacity: "10정",
  capacity: "10정",
  category: "진통",
  specification: "10정",
  displayed_price_krw: 3_000,
  recorded_at: "2026-07-15",
  price_status: "2026-07-15 조회 당시 앱 데이터값",
  source_type: "공개 Firestore products 컬렉션",
  verification_status: "Firestore 원본 확인",
  image_url: "",
  image_source_url: "",
  image_rights_status: "미확인",
  official_match_status: "confirmed",
  official_match_score: 100,
  official_item_seq: "A11ATEST00001",
  official_product_key: "A11ATEST00001",
  official_item_name: "해열정",
  official_manufacturer: "테스트제약",
  official_source_type: "약학정보원 의약품 상세정보",
  official_source_url:
    "https://health.kr/searchDrug/result_drug.asp?drug_cd=A11ATEST00001",
  official_checked_at: "2026-07-16T13:51:42+09:00",
  official_english_name: "Test Tablet",
  official_category: "해열, 진통, 소염제",
  official_classification_code: "114",
  official_dosage_form: "정제",
  official_route: "경구(내용고형)",
  official_atc_code: "N02BE01|PARACETAMOL",
  official_kpic_atc: "Acetaminophen : 해열진통제",
  official_pack_unit: "10정",
  official_storage: "기밀용기, 실온보관",
  official_valid_term: "",
  official_appearance: "흰색 정제",
  official_permit_date: "20200101",
  official_insurance: "비급여",
  official_insurance_detail: "",
  official_insurance_history: [],
  official_reimbursement_criteria: "",
  official_efficacy: "감기로 인한 발열 및 동통의 완화",
  official_dosage: "성인 1회 1정",
  official_precautions: "과량 투여하지 마세요.",
  official_professional_precautions: "",
  official_ingredients: ["Acetaminophen 아세트아미노펜 500mg /"],
  official_active_ingredients: ["Acetaminophen 아세트아미노펜 500mg /"],
  official_additives: ["미결정셀룰로오스"],
  official_consumer_guidance: {
    summary: "발열을 낮추는 약입니다.",
    guide: "정해진 용량을 지키세요.",
    source_url:
      "https://health.kr/searchDrug/result_take.asp?drug_cd=A11ATEST00001",
    full_text: "복약안내문 원문",
  },
  official_medication_guide: "정해진 용량을 지키세요.",
  official_medication_summary: "발열을 낮추는 약입니다.",
  official_patient_guidance: "정해진 용량을 지키세요.",
  official_identification: "",
  official_interactions: [],
  official_same_ingredient_products: [],
  official_manufacturer_details: {
    name: "테스트제약",
    english_name: "Test Pharma",
    address: "서울",
    phone: "02-0000-0000",
    fax: "",
    website: "https://example.com",
  },
  official_insert_pdf_url: "",
  official_dur_contraindications: "Acetaminophen : 중증 간장애 환자",
  official_dur_age: "Acetaminophen : 만 12세 미만 주의",
  official_dur_pregnancy: "Acetaminophen : 임부는 전문가와 상의",
  official_dur_senior: "",
  official_dur_max_dose: "Acetaminophen : 1일 최대용량 주의",
  official_dur_max_period: "",
  official_dur_split_dosage: "",
  official_images: [],
  official_pictograms: [],
  official_content_status: "complete",
  official_content: {
    schema_version: "1.0",
    normalization_version: "catalog-text-v1",
    efficacy: {
      text: "감기로 인한 발열 및 동통의 완화",
      blocks: [{ type: "paragraph", text: "감기로 인한 발열 및 동통의 완화" }],
    },
    dosage: {
      text: "성인 1회 1정",
      blocks: [{ type: "paragraph", text: "성인 1회 1정" }],
    },
    precautions: {
      text: "과량 투여하지 마세요.",
      blocks: [{ type: "paragraph", text: "과량 투여하지 마세요." }],
    },
  },
  official_upstream_updated_at: "2026-07-16T13:51:42+09:00",
  official_section_evidence: {
    detail_page_verified: true,
    ajax_payload_verified: true,
    match_reasons: ["핵심 제품명 일치"],
    conflicts: [],
    source_urls: [
      "https://health.kr/searchDrug/result_drug.asp?drug_cd=A11ATEST00001",
    ],
    verified_fields: ["ingredients", "efficacy"],
    pipeline_version: "health-kr-test-v1",
  },
  // These source fields contain FDA pregnancy categories, not identity codes.
  official_report_number: "C",
  official_standard_codes: ["C"],
  official_barcode: "",
  official_udi_di: "",
  official_additional_data: {
    health_kr_raw: {
      drug_cls: "2",
      cancel_date: "0",
      fdacode: "C",
      fdacontent: "C 등급 설명",
      ingredient_details: [
        {
          label: "Acetaminophen 아세트아미노펜 500mg /",
          ingredient_code: "I002817",
          source_url:
            "https://health.kr/searchIngredient/detail.asp?ingd_code=I002817",
        },
      ],
    },
  },
  ...overrides,
});

const build = (rows: readonly Readonly<Record<string, unknown>>[]) =>
  buildHealthKrProductRegistry(rows, pack, {
    generatedAt: "2026-07-16T10:00:00.000Z",
    sourceContentSha256: "a".repeat(64),
    sourceByteLength: 12_345,
    mappingContentSha256: "b".repeat(64),
  });

describe("Health.kr product registry import", () => {
  it("uses portable corrected display and structured medicine fields over app audit text", () => {
    const enrichment = confirmedRow({
      name: "교정된 해열정",
      app_name: "고정전 해열졍",
      normalized_name: "교정된 해열정",
    });
    const merged = mergePortableHealthKrCatalog(
      [
        {
          schema_version: "1.0",
          product_id: "retail-1",
          display: {
            name: "교정된 해열정",
            specification: "10정",
            category: "진통",
            price_krw: 3_000,
            notes: null,
            source_order: 1,
          },
          media: {
            primary_image: {
              url: "https://images.example/product.jpg",
              source_url: "https://images.example/product",
              kind: "package",
              rights_status: "verified",
              checked_at: "2026-07-16T16:18:00+09:00",
            },
          },
          medicine: {
            identity: {
              item_name: "해열정",
              item_code: "A11ATEST00001",
              manufacturer: "테스트제약",
              english_name: "Test Tablet",
              category: "해열, 진통, 소염제",
              classification_code: "114",
              dosage_form: "정제",
              route: "경구(내용고형)",
              pack_unit: "10정",
              atc_code: "N02BE01",
            },
            content: enrichment["official_content"],
            ingredients: {
              active: enrichment["official_active_ingredients"],
              all: enrichment["official_ingredients"],
              additives: enrichment["official_additives"],
            },
            storage: "기밀용기, 실온보관",
            appearance: "흰색 정제",
            source: {
              type: "약학정보원 의약품 상세정보",
              url: "https://health.kr/searchDrug/result_drug.asp?drug_cd=A11ATEST00001",
              checked_at: "2026-07-16T13:51:42+09:00",
            },
          },
          quality: {
            verification_status: "Firestore 원본 확인",
            official_match_status: "confirmed",
            official_content_status: "complete",
            image_rights_status: "verified",
          },
          provenance: {
            catalog_source_type: "공개 Firestore products 컬렉션",
            catalog_recorded_at: "2026-07-15",
            catalog_document_updated_at: "2026-07-16T00:00:00Z",
          },
          ai_context: "상품명: 교정된 해열정",
        },
      ],
      [enrichment],
    );

    expect(merged[0]).toMatchObject({
      name: "교정된 해열정",
      image_kind: "package",
      image_checked_at: "2026-07-16T16:18:00+09:00",
      official_efficacy: "감기로 인한 발열 및 동통의 완화",
    });
    expect(JSON.stringify(build(merged).registry)).not.toContain(
      "고정전 해열졍",
    );
  });

  it("maps ingredient labels by exact pack aliases without fuzzy matching", () => {
    expect(
      matchHealthKrIngredient(
        "Acetaminophen 아세트아미노펜 500mg /",
        pack.ingredients,
      ),
    ).toBe("ING-ACETAMINOPHEN");
    expect(
      matchHealthKrIngredient(
        "Acetaminophenate 아세트아미노페네이트 500mg /",
        pack.ingredients,
      ),
    ).toBeNull();
  });

  it("preserves each retail offer while sharing a stable official identity", () => {
    const result = build([
      confirmedRow(),
      confirmedRow({
        document_id: "document-2",
        id: "retail-2",
        app_id: "retail-2",
        specification: "20정",
        capacity: "20정",
        displayed_price_krw: 5_000,
      }),
    ]);

    expect(result.registry.records).toHaveLength(2);
    expect(result.registry.records.map((row) => row.retailOffer.skuId)).toEqual(
      ["retail-1", "retail-2"],
    );
    expect(
      result.registry.records.map((row) => row.officialProduct?.itemSeq),
    ).toEqual(["A11ATEST00001", "A11ATEST00001"]);
    expect(result.registry.records[0]?.registryRecordId).not.toBe(
      result.registry.records[1]?.registryRecordId,
    );
  });

  it("uses only official item sequence and product key as product identity", () => {
    const row = build([confirmedRow()]).registry.records[0]!;

    expect(row.officialProduct?.itemSeq).toBe("A11ATEST00001");
    expect(row.officialProduct?.productKey).toBe("A11ATEST00001");
    expect(JSON.stringify(row.officialProduct)).not.toContain(
      "official_report_number",
    );
    expect(JSON.stringify(row.officialProduct)).not.toContain(
      "official_standard_codes",
    );
    expect(row.officialProduct?.dur.pregnancyCategory).toEqual({
      code: "C",
      description: "C 등급 설명",
    });
  });

  it("rejects a confirmed identity when the official URL is not the Health.kr drug page", () => {
    for (const official_source_url of [
      "javascript:alert(1)?drug_cd=A11ATEST00001",
      "https://evil.example/searchDrug/result_drug.asp?drug_cd=A11ATEST00001",
      "http://health.kr/searchDrug/result_drug.asp?drug_cd=A11ATEST00001",
      "https://health.kr/other?drug_cd=A11ATEST00001",
    ]) {
      const record = build([confirmedRow({ official_source_url })]).registry
        .records[0]!;
      expect(record.officialMatch.identityValid).toBe(false);
      expect(record.officialProduct).toBeNull();
      expect(record.recommendation.eligible).toBe(false);
    }
  });

  it("rejects a derived registry that violates the canonical schema", () => {
    expect(() => build([confirmedRow({ recorded_at: "not-a-date" })])).toThrow(
      /canonical schema/u,
    );
  });

  it("structures DUR source text without turning it into an unsafe decision", () => {
    const dur = build([confirmedRow()]).registry.records[0]!.officialProduct!
      .dur;

    expect(dur.age).toEqual({
      present: true,
      entries: ["Acetaminophen : 만 12세 미만 주의"],
      raw: "Acetaminophen : 만 12세 미만 주의",
    });
    expect(dur.pregnancy.present).toBe(true);
    expect(dur.senior).toEqual({ present: false, entries: [], raw: null });
  });

  it("requires indication-matched routes for route-specific protocols", () => {
    const povidonePack: HealthKrRegistryPack = {
      ...pack,
      ingredients: [
        ...pack.ingredients,
        {
          ingredient_id: "ING-POVIDONE_IODINE",
          normalized_name: "povidone iodine",
          display_name_en: "Povidone-iodine",
          display_name_ko: "포비돈요오드",
        },
      ],
      protocolOptions: [
        ...pack.protocolOptions,
        {
          option_id: "OPT-MINOR_WOUND-POVIDONE_IODINE",
          protocol_id: "PTC-MINOR_WOUND",
          ingredient_id: "ING-POVIDONE_IODINE",
        },
      ],
    };
    const sourceIngredient = "Povidone Iodine 포비돈요오드 100mg/mL /";
    const row = confirmedRow({
      official_efficacy: "상처의 살균소독",
      official_dosage_form: "액제",
      official_route: "질",
      official_ingredients: [sourceIngredient],
      official_active_ingredients: [sourceIngredient],
      official_additional_data: {
        health_kr_raw: {
          drug_cls: "2",
          cancel_date: "0",
          ingredient_details: [
            {
              label: sourceIngredient,
              ingredient_code: "I003461",
              source_url: "https://health.kr/ingredient/I003461",
            },
          ],
        },
      },
    });
    const result = buildHealthKrProductRegistry([row], povidonePack, {
      generatedAt: "2026-07-16T10:00:00.000Z",
      sourceContentSha256: "a".repeat(64),
      sourceByteLength: 12_345,
      mappingContentSha256: "b".repeat(64),
    });

    expect(result.registry.records[0]?.recommendation.eligible).toBe(false);
    expect(
      result.registry.records[0]?.recommendation.exclusionReasons,
    ).toContain("protocol_indication_mismatch");
  });

  it("requires an allowed route for protocols that are not topical", () => {
    const result = build([
      confirmedRow({
        official_efficacy: "해열",
        official_dosage_form: "액제",
        official_route: "피부",
      }),
    ]);

    expect(result.registry.records[0]?.recommendation.eligible).toBe(false);
    expect(
      result.registry.records[0]?.recommendation.exclusionReasons,
    ).toContain("protocol_indication_mismatch");
  });

  it("allows only confirmed active OTC rows with exact ingredients and an indication-matched protocol", () => {
    const rows = [
      confirmedRow(),
      confirmedRow({
        document_id: "document-review",
        id: "retail-review",
        app_id: "retail-review",
        official_match_status: "review_required",
        official_item_seq: "",
        official_product_key: "",
        match_alternatives: [
          {
            official_item_name: "검토후보정",
            official_item_seq: "A11AREVIEW001",
            official_manufacturer: "검토제약",
            official_dosage_form: "정제",
            official_pack_unit: "10정",
            official_source_url:
              "https://health.kr/searchDrug/result_drug.asp?drug_cd=A11AREVIEW001",
            match_score: 75,
            conflicts: ["규격 확인 필요"],
          },
        ],
      }),
      confirmedRow({
        document_id: "document-cancelled",
        id: "retail-cancelled",
        app_id: "retail-cancelled",
        official_additional_data: {
          health_kr_raw: {
            drug_cls: "2",
            cancel_date: "20250101",
            ingredient_details: [
              {
                label: "Acetaminophen 아세트아미노펜 500mg /",
                ingredient_code: "I002817",
                source_url: "https://health.kr/ingredient/I002817",
              },
            ],
          },
        },
      }),
      confirmedRow({
        document_id: "document-conflict",
        id: "retail-conflict",
        app_id: "retail-conflict",
        official_section_evidence: {
          detail_page_verified: true,
          ajax_payload_verified: true,
          match_reasons: ["핵심 제품명 일치"],
          conflicts: ["제형 충돌"],
          source_urls: [],
          verified_fields: [],
          pipeline_version: "health-kr-test-v1",
        },
      }),
      confirmedRow({
        document_id: "document-unmapped",
        id: "retail-unmapped",
        app_id: "retail-unmapped",
        official_active_ingredients: ["Unknownine 미확인성분 10mg /"],
        official_ingredients: ["Unknownine 미확인성분 10mg /"],
        official_additional_data: {
          health_kr_raw: {
            drug_cls: "2",
            cancel_date: "0",
            ingredient_details: [
              {
                label: "Unknownine 미확인성분 10mg /",
                ingredient_code: "I999999",
                source_url: "https://health.kr/ingredient/I999999",
              },
            ],
          },
        },
      }),
      confirmedRow({
        document_id: "document-indication",
        id: "retail-indication",
        app_id: "retail-indication",
        official_efficacy: "비타민 보급",
      }),
      confirmedRow({
        document_id: "document-rx",
        id: "retail-rx",
        app_id: "retail-rx",
        official_additional_data: {
          health_kr_raw: {
            drug_cls: "1",
            cancel_date: "0",
            ingredient_details: [
              {
                label: "Acetaminophen 아세트아미노펜 500mg /",
                ingredient_code: "I002817",
                source_url: "https://health.kr/ingredient/I002817",
              },
            ],
          },
        },
      }),
    ];

    const result = build(rows);

    expect(result.report.sourceRecordCount).toBe(7);
    expect(result.report.importedRecordCount).toBe(7);
    expect(result.report.eligibleRetailSkuCount).toBe(1);
    expect(result.report.eligibleOfficialProductCount).toBe(1);
    expect(
      result.registry.records.filter((row) => row.recommendation.eligible),
    ).toEqual([
      expect.objectContaining({
        retailOffer: expect.objectContaining({ skuId: "retail-1" }),
        officialMatch: expect.objectContaining({ status: "confirmed" }),
        recommendation: expect.objectContaining({
          productId: expect.stringMatching(/^PRD-HEALTHKR-[A-F0-9]{16}$/u),
          ingredientIds: ["ING-ACETAMINOPHEN"],
          ingredientMappings: [
            {
              ingredientId: "ING-ACETAMINOPHEN",
              sourceText: "Acetaminophen 아세트아미노펜 500mg /",
            },
          ],
          protocolIds: ["PTC-FEVER"],
          optionIds: ["OPT-FEVER-ACETAMINOPHEN"],
          clinicalGroupKey: expect.stringMatching(
            /^CLINICAL-HEALTHKR-[A-F0-9]{16}$/u,
          ),
        }),
      }),
    ]);
    expect(
      result.registry.records.find(
        (row) => row.retailOffer.skuId === "retail-review",
      )?.officialProduct,
    ).toBeNull();
    expect(
      result.registry.records.find(
        (row) => row.retailOffer.skuId === "retail-review",
      )?.officialMatch.alternatives,
    ).toEqual([
      expect.objectContaining({
        itemName: "검토후보정",
        itemSeq: "A11AREVIEW001",
        score: 75,
        conflicts: ["규격 확인 필요"],
      }),
    ]);
    expect(result.report.exclusionReasonCounts).toMatchObject({
      official_match_not_confirmed: 1,
      permit_cancelled: 1,
      source_match_conflict: 1,
      active_ingredient_unmapped: 1,
      protocol_indication_mismatch: 1,
      not_otc: 1,
    });
    expect(result.report.mappingFailureReasonCounts).toEqual({
      active_ingredient_missing: 0,
      active_ingredient_unmapped: 1,
      official_identity_invalid: 0,
      protocol_indication_mismatch: 1,
    });
  });
});
