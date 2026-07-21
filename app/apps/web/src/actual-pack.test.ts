import { describe, expect, it } from "vitest";
import type { RuntimeInput } from "@pharmassist/contracts";
import { validateContract } from "@pharmassist/contracts";
import { productProtocolProfileIds } from "@pharmassist/domain";
import type { RuntimePack } from "@pharmassist/runtime";
import { LocalClinicalEngine } from "@pharmassist/runtime";
import actualPackJson from "../../../data/actual-candidate-pack/pack.json" with { type: "json" };
import dialogueSeedReport from "../../../data/actual-candidate-pack/dialogue-seed-report.json" with { type: "json" };
import productEnrichment from "../../../data/actual-candidate-pack/product-enrichment.json" with { type: "json" };
import healthKrLegacyMatchReport from "../../../data/actual-candidate-pack/healthkr-legacy-match-report.json" with { type: "json" };
import clinicalPathwayMappings from "../../../data/clinical-pathways/product-mappings.json" with { type: "json" };
import { buildResearchPreviewFormulary } from "./preview-formulary.js";

const validated = validateContract<RuntimePack>("runtimePack", actualPackJson);
if (!validated.ok || !validated.value)
  throw new Error(JSON.stringify(validated.errors));
const actualPack = validated.value;
const previewFormulary = buildResearchPreviewFormulary(actualPack);

describe("actual research preview pack", () => {
  it("keeps a useful follow-up open while showing current musculoskeletal candidates", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const result = engine.run(
      {
        request_id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        sequence: 1,
        input_type: "typed",
        text: "근육통약",
        is_partial: false,
        locale: "ko-KR",
        domain: "human_otc",
        patient_context: {},
        client_timestamp: new Date().toISOString(),
      },
      {
        tenantId: "local-research-preview",
        formulary: previewFormulary,
      },
    );

    expect(
      result.output.decision.status,
      JSON.stringify(result.output.decision),
    ).toBe("recommend");
    expect(result.output.decision.ingredient_options.length).toBeGreaterThan(0);
    expect(
      result.output.decision.ingredient_options
        .slice(0, 2)
        .map((item) => item.ingredient_name),
    ).toEqual(["이부프로펜", "아세트아미노펜"]);
    expect(
      result.output.decision.product_candidates
        .slice(0, 2)
        .map((item) => item.display_name),
    ).toEqual(["이지엔6애니연질캡슐", "게보린브이정(아세트아미노펜)"]);
    expect(result.output.say_now.join(" ")).not.toContain("아세트아미노펜");
    expect(result.output.ask_next).toHaveLength(1);
  });

  it("uses the customer's actual pain site in the counselor question", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const result = engine.run(
      {
        request_id: crypto.randomUUID(),
        session_id: sessionId,
        sequence: 1,
        input_type: "typed",
        text: "무릎이 아파요",
        intent_hint: "musculoskeletal_pain",
        is_partial: false,
        locale: "ko-KR",
        domain: "human_otc",
        patient_context: {},
        client_timestamp: new Date().toISOString(),
      },
      {
        tenantId: "local-research-preview",
        formulary: previewFormulary,
      },
    );

    expect(result.output.ask_next).toHaveLength(1);
    expect(result.output.ask_next[0]?.question).toContain("무릎");
    expect(result.output.ask_next[0]?.question).not.toContain("어깨");

    const followUp = engine.run(
      {
        request_id: crypto.randomUUID(),
        session_id: sessionId,
        sequence: 2,
        input_type: "typed",
        text: "움직일 때 더 아파요",
        intent_hint: "musculoskeletal_pain",
        is_partial: false,
        locale: "ko-KR",
        domain: "human_otc",
        patient_context: {},
        client_timestamp: new Date().toISOString(),
      },
      {
        tenantId: "local-research-preview",
        formulary: previewFormulary,
        consultationState: result.consultationState,
      },
    );

    expect(followUp.output.decision.protocol_id).toBe("PTC-JOINT_PAIN");
    expect(followUp.output.ask_next).toEqual([]);
    expect(followUp.output.decision.product_candidates.length).toBeGreaterThan(
      0,
    );
  });

  it("keeps sore-throat candidates provisional while asking one useful question at a time", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });

    const first = engine.run(input("목이 아파요", 1), {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
    });
    expect(first.output.decision.status).toBe("recommend");
    expect(first.output.status).toBe("provisional");
    expect(first.output.decision.ingredient_options.length).toBeGreaterThan(0);
    expect(first.output.decision.ingredient_options[0]?.ingredient_name).toBe(
      "플루르비프로펜",
    );
    expect(first.output.decision.product_candidates[0]?.display_name).toBe(
      "스트렙실허니앤레몬트로키(플루르비프로펜)",
    );
    expect(first.output.say_now.join(" ")).not.toContain("아세트아미노펜");
    expect(first.output.ask_next).toHaveLength(1);
    expect(first.output.ask_next[0]?.question).toBe(
      "침이나 물을 삼키기 힘들 정도인가요, 아니면 따갑고 아픈 정도인가요?",
    );

    const second = engine.run(input("따갑고 아픈 정도예요", 2), {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
      consultationState: first.consultationState,
    });
    expect(second.output.decision.status).toBe("recommend");
    expect(second.output.status).toBe("provisional");
    expect(second.output.decision.ingredient_options.length).toBeGreaterThan(0);
    expect(second.output.ask_next).toHaveLength(1);
    expect(second.output.ask_next[0]?.question).toBe(
      "목 통증은 언제부터 시작됐나요?",
    );
  });

  it("keeps separate results for every symptom mentioned in one consultation", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });

    const soreThroat = engine.run(input("목이 아파요", 1), {
      tenantId: "preview",
    });
    const combined = engine.run(input("그리고 속쓰림이 있어요", 2), {
      tenantId: "preview",
      consultationState: soreThroat.consultationState,
    });
    const topicResults = (
      combined.output as typeof combined.output & {
        topic_results?: readonly { protocol_id: string }[];
      }
    ).topic_results;
    const topics = (
      combined.consultationState as typeof combined.consultationState & {
        topics?: readonly { protocol_id: string }[];
      }
    ).topics;

    expect(topicResults?.map((item) => item.protocol_id)).toEqual([
      "PTC-HEARTBURN",
      "PTC-SORE_THROAT",
    ]);
    expect(topics?.map((item) => item.protocol_id)).toEqual([
      "PTC-SORE_THROAT",
      "PTC-HEARTBURN",
    ]);
    expect(combined.output.ask_next[0]?.question).toContain("삼키기");
    expect(combined.output.say_now.join(" ")).toContain("인산알루미늄겔");
    expect(combined.output.say_now.join(" ")).toContain("플루르비프로펜");
    expect(combined.output.say_now.join(" ")).not.toContain("아세트아미노펜");
    expect(combined.output.say_now.join(" ")).toContain(
      "말씀하신 증상들을 같이 볼게요.",
    );
    expect(combined.output.say_now.join(" ")).not.toMatch(
      /현재 .* 증상을 함께 보고 있습니다|제품 후보는|성분 후보는/u,
    );
    expect(validateContract("runtimeOutput", combined.output).errors).toEqual(
      [],
    );
    expect(
      topicResults?.every(
        (item) =>
          item.protocol_id.length > 0 &&
          combined.output.topic_results.find(
            (topic) => topic.protocol_id === item.protocol_id,
          )?.decision.status === "recommend",
      ),
    ).toBe(true);

    const answered = engine.run(input("따갑고 아픈 정도예요", 3), {
      tenantId: "preview",
      consultationState: combined.consultationState,
    });
    expect(
      new Set(answered.output.topic_results.map((item) => item.protocol_id)),
    ).toEqual(new Set(["PTC-SORE_THROAT", "PTC-HEARTBURN"]));
    expect(answered.output.ask_next[0]?.question).toContain("언제부터");
    const answeredTopics = answered.consultationState.topics;
    expect(
      answeredTopics.find((item) => item.protocol_id === "PTC-SORE_THROAT")
        ?.answered_slots["symptom.swallowing_severity"],
    ).toBe("따갑고 아픈 정도예요");
    expect(
      answeredTopics.find((item) => item.protocol_id === "PTC-HEARTBURN")
        ?.answered_slots["symptom.swallowing_severity"],
    ).toBeUndefined();
  });

  it("recognizes multiple supported symptoms from the same utterance", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const result = engine.run(
      {
        request_id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        sequence: 1,
        input_type: "typed",
        text: "인후통이 있고 속쓰림도 있어요",
        is_partial: false,
        locale: "ko-KR",
        domain: "human_otc",
        patient_context: {},
        client_timestamp: new Date().toISOString(),
      },
      { tenantId: "preview" },
    );

    expect(
      new Set(result.output.topic_results.map((item) => item.protocol_id)),
    ).toEqual(new Set(["PTC-SORE_THROAT", "PTC-HEARTBURN"]));
  });

  it("keeps a provisional dry-cough product visible while resolving safety context", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    const tenant = {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
    } as const;

    const first = engine.run(input("기침나요", 1), tenant);

    expect(first.output.ask_next[0]?.slot).toBe("symptom.cough_pattern");
    expect(first.output.ask_next[0]?.question).toContain("마른기침");
    expect(first.output.decision.status).toBe("recommend");
    expect(first.output.decision.product_candidates[0]?.display_name).toBe(
      "해소코푸에스시럽",
    );
    expect(first.output.decision.combination_candidates?.[0]).toMatchObject({
      primary_product_name: "해소코푸에스시럽",
      supportive_product_name: "쎄파렉신연조엑스",
      supportive_mechanisms: ["herbal_support"],
    });

    const second = engine.run(input("가래는 없는거 같아요", 2), {
      ...tenant,
      consultationState: first.consultationState,
    });

    expect(second.output.status).toBe("provisional");
    expect(second.output.ask_next[0]?.slot).toBe("pregnancy_status");
    expect(second.output.decision.product_candidates[0]?.display_name).toBe(
      "해소코푸에스시럽",
    );

    const completed = engine.run(input("임신은 아니에요", 3), {
      ...tenant,
      consultationState: second.consultationState,
    });

    expect(completed.output.ask_next).toEqual([]);
    expect(completed.output.decision.product_candidates[0]?.display_name).toBe(
      "해소코푸에스시럽",
    );
    expect(completed.output.topic_results[0]?.decision).toBe(
      completed.output.decision,
    );
  });

  it("keeps official alternatives visible behind the curated first choice", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const result = engine.run(
      {
        request_id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        sequence: 1,
        input_type: "typed",
        text: "근육통이 있어요",
        is_partial: false,
        locale: "ko-KR",
        domain: "human_otc",
        patient_context: {},
        client_timestamp: new Date().toISOString(),
      },
      {
        tenantId: "local-research-preview",
        formulary: previewFormulary,
      },
    );

    const names = result.output.decision.product_candidates.map(
      (item) => item.display_name,
    );
    expect(names.slice(0, 2)).toEqual([
      "이지엔6애니연질캡슐",
      "게보린브이정(아세트아미노펜)",
    ]);
    // Officially linked products must appear as alternatives instead of being
    // filtered down to the curated pair.
    expect(names.length).toBeGreaterThan(2);
    // Without a known age or a child context, pediatric-labelled products may
    // not outrank adult candidates.
    expect(names.join(" ")).not.toMatch(/키즈|어린이/u);
  });

  it.each([
    ["가래 끓는 기침이에요", "PTC-PRODUCTIVE_COUGH"],
    ["코가 막혀요", "PTC-NASAL_CONGESTION"],
    ["입안이 헐었어요", "PTC-STOMATITIS"],
    ["속이 더부룩해요", "PTC-BLOATING"],
    ["목아파요", "PTC-SORE_THROAT"],
    ["그냥 목이 따가움", "PTC-SORE_THROAT"],
    ["눈이 건조해요", "PTC-DRY_EYE"],
    ["상처가 났어요", "PTC-MINOR_WOUND"],
    ["손목이 아파요", "PTC-JOINT_PAIN"],
    ["발목이 아파요", "PTC-JOINT_PAIN"],
  ])(
    "routes colloquial symptom wording to its own pathway: %s",
    (text, protocolId) => {
      const engine = new LocalClinicalEngine(actualPack);
      const result = engine.run(
        {
          request_id: crypto.randomUUID(),
          session_id: crypto.randomUUID(),
          sequence: 1,
          input_type: "typed",
          text,
          is_partial: false,
          locale: "ko-KR",
          domain: "human_otc",
          patient_context: {},
          client_timestamp: new Date().toISOString(),
        },
        {
          tenantId: "local-research-preview",
          formulary: previewFormulary,
        },
      );

      expect(
        result.output.decision.protocol_id,
        JSON.stringify(result.output.decision),
      ).toBe(protocolId);
      expect(result.output.decision.status).toBe("recommend");
      expect(result.output.decision.product_candidates.length).toBeGreaterThan(
        0,
      );
    },
  );

  it.each(["잇몸에서 피나요", "하루종일 졸려요"])(
    "asks for the symptom in plain words instead of borrowing an unrelated card: %s",
    (text) => {
      const engine = new LocalClinicalEngine(actualPack);
      const result = engine.run(
        {
          request_id: crypto.randomUUID(),
          session_id: crypto.randomUUID(),
          sequence: 1,
          input_type: "typed",
          text,
          is_partial: false,
          locale: "ko-KR",
          domain: "human_otc",
          patient_context: {},
          client_timestamp: new Date().toISOString(),
        },
        {
          tenantId: "local-research-preview",
          formulary: previewFormulary,
        },
      );

      expect(result.output.decision.status).toBe("ask");
      expect(result.output.decision.reason_codes).toContain(
        "SYMPTOM_NOT_MATCHED_ASK",
      );
      // An ungrounded best-scoring card must not name a category (치통, 발열,
      // 외용제 …) the customer never mentioned.
      expect(result.output.say_now.join(" ")).not.toMatch(
        /치통|발열|외용제|콧물|기침/u,
      );
      expect(result.output.decision.product_candidates).toEqual([]);
    },
  );

  it("drops the active topic on a retraction instead of storing it as a fact", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    const tenant = {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
    } as const;

    const symptom = engine.run(input("어깨가아파요", 1), tenant);
    expect(symptom.output.decision.status).toBe("recommend");

    const retracted = engine.run(input("아 취소", 2), {
      ...tenant,
      consultationState: symptom.consultationState,
    });
    expect(retracted.output.decision.reason_codes).toContain("RETRACT_TURN");
    expect(retracted.output.say_now.join(" ")).toContain("지웠어요");
    expect(retracted.output.ask_next).toEqual([]);
    expect(retracted.output.decision.product_candidates).toEqual([]);
    expect(retracted.consultationState.topics).toHaveLength(0);
    expect(retracted.consultationState.active_protocol_id).toBeNull();

    const fresh = engine.run(input("속이 쓰려요", 3), {
      ...tenant,
      consultationState: retracted.consultationState,
    });
    expect(fresh.output.decision.status).toBe("recommend");
    expect(fresh.output.decision.protocol_id).toBe("PTC-HEARTBURN");
  });

  it("stops repeating a triage question once the answer anchors a same-cluster topic", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    const tenant = {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
    } as const;

    const first = engine.run(input("배가 아파요", 1), tenant);
    expect(first.output.ask_next[0]?.question).toContain("배가 어떻게");

    const second = engine.run(input("가스찬느낌", 2), {
      ...tenant,
      consultationState: first.consultationState,
    });
    expect(second.output.decision.status).toBe("recommend");
    expect(
      second.output.ask_next.map((question) => question.question).join(" "),
    ).not.toContain("배가 어떻게");
    expect(
      second.consultationState.topics.find(
        (topic) => topic.protocol_id === "PTC-ABDOMINAL_PAIN_VOMITING",
      )?.pending_question,
    ).toBeNull();

    const third = engine.run(input("그니까 가스가 찬 느낌이라고요", 3), {
      ...tenant,
      consultationState: second.consultationState,
    });
    expect(
      third.output.ask_next.map((question) => question.question).join(" "),
    ).not.toContain("배가 어떻게");
  });

  it("still uses a dialogue card that shares a discriminative term", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const result = engine.run({
      request_id: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
      sequence: 1,
      input_type: "typed",
      text: "감기 기운이 있어요",
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });

    expect(result.output.decision.status).toBe("ask");
    expect(result.output.decision.reason_codes).toContain(
      "LEGACY_CARD_COMPATIBILITY_ASK",
    );
    expect(result.output.say_now.join(" ")).toContain("감기");
  });

  it("returns no product for generic cough with a chest-pain red flag", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const result = engine.run(
      {
        request_id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        sequence: 1,
        input_type: "typed",
        text: "기침나요 흉통이 있어요",
        is_partial: false,
        locale: "ko-KR",
        domain: "human_otc",
        patient_context: {},
        client_timestamp: new Date().toISOString(),
      },
      {
        tenantId: "local-research-preview",
        formulary: previewFormulary,
      },
    );

    expect(result.output.decision.status).toBe("refer");
    expect(result.output.decision.product_candidates).toEqual([]);
    expect(result.output.red_flags).not.toHaveLength(0);
  });

  it("handles a greeting as conversation instead of an insufficient clinical result", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const result = engine.run({
      request_id: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
      sequence: 1,
      input_type: "typed",
      text: "어이",
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    expect(result.output.say_now[0]).toBe(
      "네, 말씀하세요. 증상이나 찾는 약을 편하게 말씀해 주세요.",
    );
    expect(result.output.decision.reason_codes).toContain("CONVERSATION_TURN");
    expect(result.output.decision.product_candidates).toEqual([]);
  });

  it("is structurally valid and contains named official candidates", () => {
    const result = validateContract("runtimePack", actualPackJson);
    expect(result.ok, JSON.stringify(result.errors)).toBe(true);
    expect(actualPack.synthetic).toBe(false);
    expect(actualPack.clinicalUseProhibited).toBe(true);
    expect(actualPack.verified).toBe(false);
    expect(
      [
        ...actualPack.ingredients,
        ...actualPack.claims,
        ...actualPack.protocols,
        ...actualPack.protocolOptions,
        ...actualPack.protocolRules,
      ].every((item) => item.review.pharmacist_approved === false),
    ).toBe(true);
    expect(
      previewFormulary.entries.every(
        (entry) => entry.pharmacist_approved === false,
      ),
    ).toBe(true);
    const expectedImportedProducts = clinicalPathwayMappings.records.filter(
      (record) =>
        record.mappingStatus === "direct" &&
        !record.exclusionReasons.some((reason) =>
          ["not_otc", "permit_cancelled", "source_match_conflict"].includes(
            reason,
          ),
        ),
    ).length;
    expect(actualPack.ingredients.length).toBeGreaterThan(31);
    expect(actualPack.products).toHaveLength(27 + expectedImportedProducts);
    const healthKrProducts = actualPack.products.filter((product) =>
      product.product_id.startsWith("PRD-HEALTHKR-"),
    );
    expect(healthKrProducts).toHaveLength(expectedImportedProducts);
    expect(healthKrLegacyMatchReport).toMatchObject({
      total: 27,
      matched: 6,
      failed: 21,
      ambiguous: 0,
    });
    expect(
      healthKrProducts.every(
        (product) =>
          product.official_match_status === "confirmed" &&
          product.otc_status === "otc" &&
          product.status === "active" &&
          product.permit_cancelled === false &&
          (product.protocol_ids?.length ?? 0) > 0 &&
          product.official_source_url?.startsWith("https://health.kr/"),
      ),
    ).toBe(true);
    expect(
      healthKrProducts.every(
        (product) =>
          product.retail_offer &&
          "image_url" in product.retail_offer &&
          "image_source_url" in product.retail_offer &&
          "image_rights_status" in product.retail_offer &&
          "image_kind" in product.retail_offer &&
          "image_checked_at" in product.retail_offer,
      ),
    ).toBe(true);
    expect(
      healthKrProducts.every(
        (product) =>
          !/<[^>]+>|(?:^|\s)br(?:\s|$)|�/iu.test(
            `${product.indication_summary ?? ""} ${product.dosage_summary ?? ""} ${product.precaution_summary ?? ""}`,
          ),
      ),
    ).toBe(true);
    expect(productEnrichment).toHaveLength(27);
    expect(
      productEnrichment.every(
        (item) =>
          (item.image_url === null ||
            item.image_url.startsWith("/product-images/")) &&
          item.healthkr_url.startsWith("https://www.health.kr/searchDrug/") &&
          item.healthkr_url !==
            "https://www.health.kr/searchDrug/search_detail.asp",
      ),
    ).toBe(true);
    expect(
      productEnrichment.find((item) => item.item_seq === "202107495"),
    ).toMatchObject({
      healthkr_url:
        "https://www.health.kr/searchDrug/result_drug.asp?drug_cd=2021111700001",
      image_url: "/product-images/202107495.jpg",
    });
    expect(actualPack.protocols).toHaveLength(26);
    expect(productProtocolProfileIds).toEqual(
      actualPack.protocols.map((protocol) => protocol.protocol_id).sort(),
    );
    expect(actualPack.protocolOptions.length).toBeGreaterThan(47);
    expect(
      actualPack.protocolOptions.every(
        (option) =>
          "therapeutic_role" in option &&
          "evidence_scope" in option &&
          "fit_rationale" in option,
      ),
    ).toBe(true);
    expect(
      actualPack.ingredients.map((item) => item.display_name_ko),
    ).toContain("아세트아미노펜");
    expect(actualPack.products.map((item) => item.display_name)).toContain(
      "액티피드정",
    );
    expect(actualPack.sources.every((item) => item.official)).toBe(true);
  });

  it("uses the same therapeutic-role rule across unrelated protocols", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const run = (text: string) =>
      engine.run(
        {
          request_id: crypto.randomUUID(),
          session_id: crypto.randomUUID(),
          sequence: 1,
          input_type: "typed" as const,
          text,
          is_partial: false,
          locale: "ko-KR" as const,
          domain: "human_otc" as const,
          patient_context: {},
          client_timestamp: new Date().toISOString(),
        },
        {
          tenantId: "local-research-preview",
          formulary: previewFormulary,
        },
      );

    const congestion = run("코가 막힘");
    expect(congestion.output.decision.protocol_id).toBe("PTC-NASAL_CONGESTION");
    expect(
      congestion.output.decision.ingredient_options
        .slice(0, 1)
        .map((item) => item.ingredient_name),
    ).toEqual(["슈도에페드린염산염"]);
    expect(congestion.output.decision.product_candidates[0]?.display_name).toBe(
      "액티피드정",
    );

    const insectBite = run("벌레에 물렸어요");
    expect(insectBite.output.decision.protocol_id).toBe("PTC-INSECT_BITE");
    expect(
      insectBite.output.decision.ingredient_options.map(
        (item) => item.ingredient_name,
      ),
    ).toEqual(["히드로코르티손"]);

    const jointPain = run("관절이 쑤심");
    expect(jointPain.output.decision.protocol_id).toBe("PTC-JOINT_PAIN");
    expect(
      jointPain.output.decision.ingredient_options
        .slice(0, 2)
        .map((item) => item.ingredient_name),
    ).toEqual(["이부프로펜", "아세트아미노펜"]);
  });

  it("creates preview formulary entries only from product-level indication evidence", () => {
    const protocolByOptionId = new Map(
      actualPack.protocols.flatMap((protocol) =>
        protocol.option_ids.map((optionId) => [optionId, protocol] as const),
      ),
    );
    const claimById = new Map(
      actualPack.claims.map((claim) => [claim.claim_id, claim] as const),
    );

    for (const entry of previewFormulary.entries) {
      const product = actualPack.products.find(
        (candidate) => candidate.product_id === entry.product_id,
      );
      const importedSupport =
        product?.product_id.startsWith("PRD-HEALTHKR-") === true &&
        product.official_match_status === "confirmed" &&
        product.protocol_ids?.some((protocolId) => {
          const protocol = actualPack.protocols.find(
            (candidate) => candidate.protocol_id === protocolId,
          );
          return (
            protocol?.symptom_category === entry.symptom_category &&
            product.active_ingredients?.some(
              (ingredient) => ingredient.ingredient_id === entry.ingredient_id,
            )
          );
        }) === true;
      const legacySupport = actualPack.protocolOptions.some((option) => {
        const protocol = protocolByOptionId.get(option.option_id);
        if (
          protocol?.symptom_category !== entry.symptom_category ||
          option.ingredient_id !== entry.ingredient_id
        )
          return false;
        return option.claim_ids.some((claimId) => {
          const claim = claimById.get(claimId);
          if (
            claim?.claim_type !== "indication" ||
            typeof claim.object !== "object" ||
            claim.object === null ||
            Array.isArray(claim.object)
          )
            return false;
          const productIds = (claim.object as Record<string, unknown>)[
            "candidate_product_ids"
          ];
          return (
            Array.isArray(productIds) && productIds.includes(entry.product_id)
          );
        });
      });
      expect(importedSupport || legacySupport, JSON.stringify(entry)).toBe(
        true,
      );
    }
  });

  it("activates the complete pharmacist-material dialogue seed catalog", () => {
    expect(actualPack.cards).toHaveLength(74);
    expect(
      actualPack.cards.reduce((total, card) => total + card.aliases.length, 0),
    ).toBe(222);
    expect(dialogueSeedReport.intentCount).toBe(74);
    expect(dialogueSeedReport.aliasCount).toBe(222);
    expect(dialogueSeedReport.mappedIntentIds).toHaveLength(29);
    expect(dialogueSeedReport.conversationOnlyIntentIds).toHaveLength(45);
    expect(
      actualPack.cards.find((card) => card.intent === "tinea_foot")?.aliases,
    ).toContain("무좀약 주세요");
  });

  it("uses an unsupported seed as a natural conversation branch without inventing products", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const result = engine.run({
      request_id: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
      sequence: 1,
      input_type: "typed",
      text: "무좀약 주세요",
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    expect(result.output.intent).toBe("tinea_foot");
    expect(result.output.decision.status).toBe("ask");
    expect(result.output.say_now[0]).toBe("무좀 문의로 확인해 볼게요.");
    expect(result.output.ask_next).toHaveLength(1);
    expect(result.output.decision.product_candidates).toEqual([]);
  });

  it("keeps the research preview blocked in production", () => {
    expect(() => new LocalClinicalEngine(actualPack, "production")).toThrow(
      /Knowledge pack activation blocked/u,
    );
  });

  it("routes common Korean abdominal wording into the actual protocol", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const result = engine.run({
      request_id: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
      sequence: 1,
      input_type: "typed",
      text: "배아파요",
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    expect(result.output.decision.intent).toContain("복통");
    expect(
      result.output.decision.status,
      JSON.stringify(result.output.decision),
    ).toBe("ask");
    expect(result.output.status).toBe("blocked");
    expect(result.output.ask_next).toHaveLength(1);
    expect(result.output.ask_next[0]?.slot).toBe("symptom.phenotype");
    expect(result.output.decision.ingredient_options).toEqual([]);
    expect(result.output.decision.product_candidates).toEqual([]);
  });

  it("routes a colloquial abdominal expression into the same protocol", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const result = engine.run({
      request_id: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
      sequence: 1,
      input_type: "typed",
      text: "배아프노",
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    expect(result.output.decision.protocol_id).toBe(
      "PTC-ABDOMINAL_PAIN_VOMITING",
    );
    expect(
      result.output.decision.status,
      JSON.stringify(result.output.decision),
    ).toBe("ask");
    expect(result.output.ask_next[0]?.slot).toBe("symptom.phenotype");
    expect(result.output.decision.ingredient_options).toEqual([]);
  });

  it("shows the matching abdominal product after the phenotype is known", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });

    const first = engine.run(input("배아파요", 1), {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
    });
    const second = engine.run(input("속쓰림도 있어요", 2), {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
      consultationState: first.consultationState,
    });

    expect(first.output.decision.product_candidates).toEqual([]);
    expect(second.output.decision.status).toBe("recommend");
    expect(second.output.decision.protocol_id).toBe("PTC-HEARTBURN");
    expect(
      second.output.decision.ingredient_options.map(
        (option) => option.ingredient_id,
      ),
    ).toContain("ING-ALUMINUM_PHOSPHATE_GEL");
    // The curated first choice stays on top while officially linked
    // alternatives remain visible behind it.
    expect(second.output.decision.product_candidates.length).toBeGreaterThan(1);
    expect(second.output.decision.product_candidates[0]?.display_name).toBe(
      "겔포스엠",
    );
  });

  it("routes a colloquial bowel-urgency correction instead of repeating an abdominal question", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });

    const first = engine.run(input("배아파요", 1), {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
    });
    const second = engine.run(input("아니 똥마려운 배아픔", 2), {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
      consultationState: first.consultationState,
    });

    expect(first.output.decision.product_candidates).toEqual([]);
    expect(second.output.intent).toBe("bowel_urgency_context");
    expect(second.output.decision.status).toBe("ask");
    expect(second.output.ask_next[0]?.question).toBe(
      "배도 아프신가요, 아니면 변이 마려운 느낌만 있으신가요?",
    );
    expect(second.output.decision.ingredient_options).toEqual([]);
    expect(second.output.decision.product_candidates).toEqual([]);
  });

  it("routes a semantic bowel-urgency correction to conversation before medicine", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });

    const first = engine.run(input("배아파요", 1));
    const interpreted = engine.run(input("똥마려요 화장실이 급해요", 2), {
      consultationState: first.consultationState,
    });

    expect(interpreted.output.intent).toBe("bowel_urgency_context");
    expect(interpreted.output.decision.status).toBe("ask");
    expect(interpreted.output.ask_next[0]?.question).toBe(
      "배도 아프신가요, 아니면 변이 마려운 느낌만 있으신가요?",
    );
    expect(interpreted.output.decision.ingredient_options).toEqual([]);
    expect(interpreted.output.decision.product_candidates).toEqual([]);
  });

  it("routes allergic rhinitis wording instead of treating it as allergy history", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const result = engine.run({
      request_id: crypto.randomUUID(),
      session_id: crypto.randomUUID(),
      sequence: 1,
      input_type: "typed",
      text: "알레르기 비염",
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    expect(result.output.decision.protocol_id).toBe("PTC-ALLERGIC_RHINITIS");
    expect(result.output.decision.status).toBe("recommend");
  });

  it("asks one cough-pattern question before routing generic cough", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    const first = engine.run(input("기침나요", 1), { tenantId: "preview" });
    expect(first.output.decision.status).toBe("recommend");
    expect(first.output.decision.protocol_id).toBe("PTC-DRY_COUGH");
    expect(first.output.ask_next[0]?.question).toContain("마른기침");

    const second = engine.run(input("마른기침이에요", 2), {
      tenantId: "preview",
      consultationState: first.consultationState,
    });
    expect(second.output.decision.protocol_id).toBe("PTC-DRY_COUGH");
    expect(second.output.decision.status).toBe("recommend");
    expect(
      second.output.decision.ingredient_options.map(
        (item) => item.ingredient_name,
      ),
    ).toContain("덱스트로메토르판브롬화수소산염수화물");
  });

  it("switches from a completed result to a new generic cough topic", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    const completed = engine.run(input("알레르기 비염", 1), {
      tenantId: "preview",
    });
    expect(completed.output.decision.status).toBe("recommend");

    const cough = engine.run(input("그리고 기침도 나요", 2), {
      tenantId: "preview",
      consultationState: completed.consultationState,
    });
    expect(cough.output.decision.status).toBe("recommend");
    expect(cough.output.decision.protocol_id).toBe("PTC-DRY_COUGH");
    expect(cough.output.ask_next[0]?.slot).toBe("symptom.cough_pattern");
  });

  it("accepts answers to imported dotted slots instead of ending early", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed" as const,
      text,
      is_partial: false,
      locale: "ko-KR" as const,
      domain: "human_otc" as const,
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    const first = engine.run(input("마른기침이에요", 1), {
      tenantId: "preview",
    });
    const second = engine.run(input("30대이고 오늘부터, 특이사항 없어요", 2), {
      tenantId: "preview",
      consultationState: first.consultationState,
    });
    expect(second.output.decision.status).toBe("recommend");
    expect(second.output.decision.reason_codes).not.toContain(
      "QUESTION_ALREADY_ASKED",
    );
  });

  it("carries patient safety facts into a newly added symptom topic", () => {
    const engine = new LocalClinicalEngine(actualPack);
    const sessionId = crypto.randomUUID();
    const input = (text: string, sequence: number): RuntimeInput => ({
      request_id: crypto.randomUUID(),
      session_id: sessionId,
      sequence,
      input_type: "typed",
      text,
      is_partial: false,
      locale: "ko-KR",
      domain: "human_otc",
      patient_context: {},
      client_timestamp: new Date().toISOString(),
    });
    const rhinitis = engine.run(
      input("35살이고 임신은 아니고 알레르기 비염이 있어요", 1),
      {
        tenantId: "local-research-preview",
        formulary: previewFormulary,
      },
    );
    const cough = engine.run(input("그리고 기침도 나요", 2), {
      tenantId: "local-research-preview",
      formulary: previewFormulary,
      consultationState: rhinitis.consultationState,
    });

    expect(cough.consultationState.answered_slots["age_years"]).toBe(35);
    expect(cough.consultationState.answered_slots["pregnancy_status"]).toBe(
      "not_pregnant",
    );
    expect(cough.output.topic_results.map((item) => item.protocol_id)).toEqual(
      expect.arrayContaining(["PTC-ALLERGIC_RHINITIS", "PTC-DRY_COUGH"]),
    );
    expect(
      cough.output.topic_results.every(
        (item) => item.decision.product_candidates.length > 0,
      ),
    ).toBe(true);
  });
});
