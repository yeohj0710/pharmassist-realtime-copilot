import { describe, expect, it } from "vitest";
import type { RuntimeInput } from "@pharmassist/contracts";
import { LocalClinicalEngine, type RuntimePack } from "@pharmassist/runtime";
import actualPack from "../../../data/actual-candidate-pack/pack.json" with { type: "json" };
import guidanceReport from "../../../data/actual-candidate-pack/field-practice-guidance-report.json" with { type: "json" };
import fieldPracticeProtocols from "../../../data/clinical-pathways/field-practice-protocols.json" with { type: "json" };
import { buildResearchPreviewFormulary } from "./preview-formulary.js";

const runtimePack = actualPack as unknown as RuntimePack;
const previewFormulary = buildResearchPreviewFormulary(runtimePack);

const profileFor = (productName: string, protocolId: string) => {
  const product = actualPack.products.find(
    (candidate) => candidate.display_name === productName,
  );
  return product?.selection_profiles?.find(
    (profile) => profile.protocol_id === protocolId,
  );
};

const productsFor = (protocolId: string) =>
  actualPack.products.filter((product) =>
    product.selection_profiles?.some(
      (profile) => profile.protocol_id === protocolId,
    ),
  );

describe("field-practice evidence layer", () => {
  it("registers the exact PDF snapshot without promoting it to official evidence", () => {
    expect(
      actualPack.sources.find(
        (source) => source.source_id === "SRC-CENTRALPARK-OTC-PRACTICE",
      ),
    ).toMatchObject({
      official: false,
      content_sha256:
        "779e353077ad73871c97ce2cf7656a2b067c848a14d7abbf485d76992c36d9df",
      page_count: 12,
      usage_rights: "unknown",
      commercial_use: "unknown",
      redistribution: "unknown",
    });
  });

  it.each([
    ["배가 아파요", ["PTC-ABDOMINAL_PAIN_VOMITING"]],
    ["신물이 올라와요", ["PTC-ACID_REFLUX", "PTC-HEARTBURN"]],
    ["알레르기 비염이에요", ["PTC-ALLERGIC_RHINITIS"]],
    ["배가 더부룩해요", ["PTC-BLOATING"]],
    ["변비예요", ["PTC-CONSTIPATION"]],
    ["설사해요", ["PTC-DIARRHEA"]],
    ["마른기침해요", ["PTC-DRY_COUGH"]],
    ["눈이 건조해요", ["PTC-DRY_EYE"]],
    ["열이 나요", ["PTC-FEVER"]],
    ["가스가 차요", ["PTC-GAS"]],
    ["머리가 아파요", ["PTC-HEADACHE"]],
    ["속이 쓰려요", ["PTC-HEARTBURN"]],
    ["소화가 안 돼요", ["PTC-INDIGESTION"]],
    ["벌레에 물렸어요", ["PTC-INSECT_BITE"]],
    ["관절이 아파요", ["PTC-JOINT_PAIN"]],
    ["생리통이에요", ["PTC-MENSTRUAL_PAIN"]],
    ["습진이 생겼어요", ["PTC-MILD_DERMATITIS"]],
    ["상처가 났어요", ["PTC-MINOR_WOUND"]],
    ["멀미가 나요", ["PTC-MOTION_SICKNESS"]],
    ["근육통이 있어요", ["PTC-MUSCLE_PAIN"]],
    ["코가 막혀요", ["PTC-NASAL_CONGESTION"]],
    ["가래 끓는 기침이에요", ["PTC-PRODUCTIVE_COUGH"]],
    ["콧물이 나요", ["PTC-RUNNY_NOSE"]],
    ["목이 아파요", ["PTC-SORE_THROAT"]],
    ["입안이 헐었어요", ["PTC-STOMATITIS"]],
    ["두드러기가 가려워요", ["PTC-URTICARIA_ITCH"]],
    ["무좀약 주세요", ["PTC-ANTIFUNGAL_SKIN"]],
    ["여드름약 주세요", ["PTC-ACNE"]],
    ["치질약 주세요", ["PTC-HEMORRHOID"]],
    ["살짝 데었어요", ["PTC-MINOR_BURN"]],
    ["비듬약 주세요", ["PTC-SCALP_DANDRUFF"]],
    ["땀이 너무 많이 나요", ["PTC-HYPERHIDROSIS"]],
    ["잠이 안 와요", ["PTC-SLEEP_AID"]],
    ["질염약 주세요", ["PTC-VAGINAL_ANTIFUNGAL"]],
    ["금연약 주세요", ["PTC-SMOKING_CESSATION"]],
    ["흉터약 주세요", ["PTC-SCAR_CARE"]],
    ["멍약 주세요", ["PTC-BRUISE"]],
    ["피임약 주세요", ["PTC-ORAL_CONTRACEPTION"]],
    ["잇몸약 주세요", ["PTC-GUM_INFLAMMATION"]],
  ])(
    "routes a vague patient phrase without an unsafe referral: %s",
    (text, protocols) => {
      const engine = new LocalClinicalEngine(runtimePack);
      const input: RuntimeInput = {
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
      };
      const result = engine.run(input, {
        tenantId: "local-research-preview",
        formulary: previewFormulary,
      });

      expect(protocols).toContain(result.output.decision.protocol_id);
      expect(result.output.decision.status).not.toBe("refer");
      if (result.output.decision.status === "recommend")
        expect(
          result.output.decision.product_candidates.length,
        ).toBeGreaterThan(0);
      else expect(result.output.ask_next.length).toBeGreaterThan(0);
    },
  );

  it("applies every curated rule and leaves no silent unmatched entry", () => {
    expect(guidanceReport).toMatchObject({
      ruleCount: 26,
      appliedRuleCount: 26,
      unmatchedRuleIds: [],
    });
    expect(guidanceReport.applicationCount).toBeGreaterThan(30);
  });

  it("ships every PDF protocol and invents no product for the ones the registry lacks", () => {
    const activeIds = fieldPracticeProtocols.protocols
      .filter(
        (protocol) => protocol.activationStatus !== "no_registered_product",
      )
      .map((protocol) => protocol.protocolId);
    const gapIds = fieldPracticeProtocols.protocols
      .filter(
        (protocol) => protocol.activationStatus === "no_registered_product",
      )
      .map((protocol) => protocol.protocolId);

    expect(activeIds).toHaveLength(13);
    expect(gapIds).toHaveLength(5);
    for (const protocolId of activeIds) {
      expect(
        actualPack.protocols.some(
          (protocol) => protocol.protocol_id === protocolId,
        ),
        protocolId,
      ).toBe(true);
      expect(productsFor(protocolId).length, protocolId).toBeGreaterThan(0);
    }
    // A protocol the official registry has no product for still ships. It has
    // to be present so it can claim its own utterances, and it has to stay
    // empty so nothing gets recommended for it.
    for (const protocolId of gapIds) {
      const packProtocol = actualPack.protocols.find(
        (protocol) => protocol.protocol_id === protocolId,
      );
      expect(packProtocol, protocolId).toBeDefined();
      expect(packProtocol?.option_ids ?? [], protocolId).toEqual([]);
      expect(productsFor(protocolId), protocolId).toEqual([]);
    }
  });

  it.each([
    ["입술에 물집이 났어요", "PTC-ORAL_HERPES"],
    ["구순포진이에요", "PTC-ORAL_HERPES"],
    ["각질이 두꺼워요", "PTC-DRY_SKIN"],
    ["피부가 너무 건조해요", "PTC-DRY_SKIN"],
    ["눈이 가렵고 빨개요", "PTC-EYE_ALLERGY"],
    ["알레르기 안약 주세요", "PTC-EYE_ALLERGY"],
    ["기미약 주세요", "PTC-PIGMENTATION"],
    ["얼굴에 색소침착이 있어요", "PTC-PIGMENTATION"],
    ["티눈약 주세요", "PTC-CORN_WART"],
    ["사마귀약 주세요", "PTC-CORN_WART"],
  ])(
    // Before these protocols shipped, 입술에 물집 matched PTC-MINOR_BURN and
    // drew 후시딘·포비돈요오드 for a viral cold sore, and 각질이 두꺼워요
    // matched PTC-SCALP_DANDRUFF. Absence routed the patient to a neighbouring
    // protocol's products rather than to nothing.
    "keeps an unregistered condition on its own protocol with no product: %s",
    (text, protocolId) => {
      const engine = new LocalClinicalEngine(runtimePack);
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
        { tenantId: "local-research-preview", formulary: previewFormulary },
      );

      expect(result.output.decision.protocol_id).toBe(protocolId);
      expect(result.output.decision.status).not.toBe("recommend");
      expect(result.output.decision.product_candidates).toEqual([]);
      expect(result.output.provisional_candidates).toEqual([]);
    },
  );

  it.each([
    ["당뇨발에 무좀이 생겼어요", "PTC-ANTIFUNGAL_SKIN"],
    ["얼굴 전체에 결절 여드름이 심해요", "PTC-ACNE"],
    ["치질인데 출혈이 많아요", "PTC-HEMORRHOID"],
    ["넓은 화상을 입었어요", "PTC-MINOR_BURN"],
    ["두피 비듬에 고름이 나요", "PTC-SCALP_DANDRUFF"],
    ["식은땀과 흉통이 있어요", "PTC-HYPERHIDROSIS"],
    ["자해 생각이 들고 잠이 안 와요", "PTC-SLEEP_AID"],
    ["임신 중인데 질염약 주세요", "PTC-VAGINAL_ANTIFUNGAL"],
    ["최근 흉통이 있는데 금연약 주세요", "PTC-SMOKING_CESSATION"],
    ["열린 상처에 흉터약 주세요", "PTC-SCAR_CARE"],
    ["머리를 다치고 멍이 들었어요", "PTC-BRUISE"],
    ["전조 편두통이 있는데 피임약 주세요", "PTC-ORAL_CONTRACEPTION"],
    ["잇몸에서 고름 나고 고열이 있어요", "PTC-GUM_INFLAMMATION"],
  ])("returns no product for a field-practice red flag: %s", (text) => {
    const engine = new LocalClinicalEngine(runtimePack);
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

    expect(["refer", "escalate"]).toContain(result.output.decision.status);
    expect(result.output.decision.product_candidates).toEqual([]);
    expect(result.output.provisional_candidates).toEqual([]);
  });

  it("gives every active product profile a concrete use case and differentiators", () => {
    const profiles = actualPack.products.flatMap((product) =>
      (product.selection_profiles ?? []).map((profile) => ({
        product: product.display_name,
        profile,
      })),
    );
    expect(profiles.length).toBeGreaterThan(400);
    expect(
      profiles.filter(({ profile }) =>
        /공식 효능|현재 증상|직접 맞/u.test(profile.choose_when),
      ),
    ).toEqual([]);
    expect(
      profiles.filter(
        ({ profile }) =>
          profile.choose_when.length < 12 ||
          profile.differentiators.length < 2 ||
          profile.comparison_note.length < 12,
      ),
    ).toEqual([]);
  });

  it("does not reintroduce cold combinations into standalone pain pathways", () => {
    const coldMarkers =
      /클로르페니라민|덱스트로메토르판|구아이페네신|슈도에페드린|메틸에페드린|티페피딘|디펜히드라민/u;
    for (const protocolId of [
      "PTC-HEADACHE",
      "PTC-MENSTRUAL_PAIN",
      "PTC-JOINT_PAIN",
      "PTC-MUSCLE_PAIN",
    ]) {
      const contaminated = productsFor(protocolId).filter((product) =>
        coldMarkers.test(
          product.active_ingredients?.map((item) => item.name).join(" ") ?? "",
        ),
      );
      expect(contaminated, protocolId).toEqual([]);
    }
  });

  it("does not treat decongestant cold combinations as urticaria products", () => {
    const coldMarkers =
      /아세트아미노펜|슈도에페드린|메틸에페드린|덱스트로메토르판|구아이페네신|티페피딘/u;
    expect(
      productsFor("PTC-URTICARIA_ITCH").filter((product) =>
        coldMarkers.test(
          product.active_ingredients?.map((item) => item.name).join(" ") ?? "",
        ),
      ),
    ).toEqual([]);
  });

  it("does not classify stimulant laxatives as gas or indigestion treatments", () => {
    const laxativeNames = /메이킨|엠티|듀오그린|비사코딜/u;
    for (const protocolId of ["PTC-GAS", "PTC-INDIGESTION"])
      expect(
        productsFor(protocolId)
          .map((product) => product.display_name)
          .filter((name) => laxativeNames.test(name)),
        protocolId,
      ).toEqual([]);
  });

  it("removes legacy cross-symptom links from profiles and the formulary", () => {
    expect(
      productsFor("PTC-ABDOMINAL_PAIN_VOMITING").map(
        (product) => product.display_name,
      ),
    ).not.toContain("보나링에이정");
    expect(
      productsFor("PTC-MILD_DERMATITIS").map((product) => product.display_name),
    ).not.toContain("지르텍정");

    const abdominalCategory = actualPack.protocols.find(
      (protocol) => protocol.protocol_id === "PTC-ABDOMINAL_PAIN_VOMITING",
    )?.symptom_category;
    const dermatitisCategory = actualPack.protocols.find(
      (protocol) => protocol.protocol_id === "PTC-MILD_DERMATITIS",
    )?.symptom_category;
    expect(
      previewFormulary.entries.some(
        (entry) =>
          entry.product_id === "PRD-BONALING_A_197000076" &&
          entry.symptom_category === abdominalCategory,
      ),
    ).toBe(false);
    expect(
      previewFormulary.entries.some(
        (entry) =>
          entry.product_id === "PRD-ZYRTEC_200610765" &&
          entry.symptom_category === dermatitisCategory,
      ),
    ).toBe(false);
  });

  it("distinguishes short, chewable, and long-duration motion-sickness products", () => {
    const tablet = profileFor("보나링에이정", "PTC-MOTION_SICKNESS");
    const chewable = profileFor("보나링츄어블정", "PTC-MOTION_SICKNESS");
    const film = profileFor("멀스토구강용해필름", "PTC-MOTION_SICKNESS");

    expect(tablet?.choose_when).toContain("4~6시간");
    expect(chewable?.choose_when).toContain("씹어 먹는");
    expect(film?.choose_when).toContain("12~24시간");
    expect(film?.differentiators.join(" ")).toContain("구강용해필름");
    expect(
      productsFor("PTC-MOTION_SICKNESS").some((product) =>
        product.selection_profiles?.some(
          (profile) =>
            profile.protocol_id === "PTC-MOTION_SICKNESS" &&
            /알레르기성 콧물|재채기|가려움/u.test(profile.choose_when),
        ),
      ),
    ).toBe(false);
  });

  it("encodes practical product differences instead of one shared sentence", () => {
    expect(
      profileFor("이지엔6애니연질캡슐", "PTC-HEADACHE")?.choose_when,
    ).toContain("긴장성 두통");
    expect(
      profileFor("이지엔6이브(병)", "PTC-MENSTRUAL_PAIN")?.choose_when,
    ).toContain("붓기");
    expect(profileFor("탁센(나프록센)", "PTC-HEADACHE")?.choose_when).toContain(
      "편두통",
    );
    expect(
      profileFor("개비스콘더블액션", "PTC-ACID_REFLUX")?.choose_when,
    ).toContain("역류");
    expect(profileFor("파미딘", "PTC-HEARTBURN")?.choose_when).toContain(
      "위산 분비",
    );
    expect(
      profileFor("겔포스엠현탁액", "PTC-HEARTBURN")?.choose_when,
    ).toContain("가스");
    expect(
      profileFor("겔포스엘현탁액", "PTC-HEARTBURN")?.choose_when,
    ).toContain("지방 소화");
    expect(
      profileFor("니코레트껌2mg", "PTC-SMOKING_CESSATION")?.choose_when,
    ).toContain("20개비 이하");
    expect(
      profileFor("니코레트껌4mg", "PTC-SMOKING_CESSATION")?.choose_when,
    ).toContain("20개비를 초과");
    expect(
      profileFor("니코틴엘TTS10", "PTC-SMOKING_CESSATION")?.choose_when,
    ).toContain("마지막 단계");
    expect(
      profileFor("니코틴엘TTS30", "PTC-SMOKING_CESSATION")?.choose_when,
    ).toContain("20개비 이상");
    expect(
      profileFor("디어미순", "PTC-ORAL_CONTRACEPTION")?.choose_when,
    ).toContain("24일 활성약+4일 위약");
    expect(
      profileFor("마이보라", "PTC-ORAL_CONTRACEPTION")?.choose_when,
    ).toContain("0.03mg");
    expect(
      profileFor("지노베타딘질세정액", "PTC-VAGINAL_ANTIFUNGAL")?.choose_when,
    ).toContain("혼합 질염");
    expect(profileFor("치젤연고", "PTC-HEMORRHOID")?.choose_when).toContain(
      "국소 마취",
    );
    expect(profileFor("한미치쏙", "PTC-HEMORRHOID")?.choose_when).toContain(
      "정맥 울혈",
    );
  });

  it("keeps each practical statement anchored to the PDF page", () => {
    expect(
      profileFor("보나링에이정", "PTC-MOTION_SICKNESS")?.evidence_source,
    ).toBe("SRC-CENTRALPARK-OTC-PRACTICE#page=4");
    expect(profileFor("스타빅현탁액", "PTC-DIARRHEA")?.evidence_source).toBe(
      "SRC-CENTRALPARK-OTC-PRACTICE#page=5",
    );
    expect(profileFor("오라메디연고", "PTC-STOMATITIS")?.evidence_source).toBe(
      "SRC-CENTRALPARK-OTC-PRACTICE#page=8",
    );
  });
});
