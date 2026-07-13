import { describe, expect, it } from "vitest";
import type { NormalizedInput } from "@pharmassist/domain";
import {
  buildDecisionIndex,
  buildIndex,
  retrieve,
  retrieveProtocols,
  selectStable,
  type KnowledgeCard,
} from "./index.js";

const cards: KnowledgeCard[] = [
  {
    cardId: "CARD-COUGH",
    intent: "cough",
    domain: "human_otc",
    title: "기침 확인",
    anchors: ["기침"],
    aliases: ["기침약 주세요", "기침"],
    keywords: ["기침 기간 호흡"],
    sayNow: ["먼저 위험 신호를 확인하겠습니다."],
    askNext: {
      question: "언제부터 기침했나요?",
      reason: "기간",
      priority: 1,
      slot: "duration",
    },
    avoid: [],
    approved: true,
    synthetic: true,
    expiresAt: "2099-01-01T00:00:00Z",
  },
  {
    cardId: "CARD-ABDOMINAL",
    intent: "abdominal_pain",
    domain: "human_otc",
    title: "복통",
    anchors: ["배", "복통"],
    aliases: ["배가 아파요"],
    keywords: ["배 복통 위치"],
    sayNow: ["배의 위치를 확인합니다."],
    askNext: {
      question: "배의 어느 위치가 아픈가요?",
      reason: "위치",
      priority: 1,
      slot: "body_site",
    },
    avoid: [],
    approved: true,
    synthetic: true,
    expiresAt: "2099-01-01T00:00:00Z",
  },
  {
    cardId: "CARD-THROAT",
    intent: "sore_throat",
    domain: "human_otc",
    title: "목 통증",
    anchors: ["목", "인후"],
    aliases: ["목이 아파요"],
    keywords: ["목 통증"],
    sayNow: ["목 증상을 확인합니다."],
    askNext: {
      question: "목은 언제부터 아팠나요?",
      reason: "기간",
      priority: 1,
      slot: "duration",
    },
    avoid: [],
    approved: true,
    synthetic: true,
    expiresAt: "2099-01-01T00:00:00Z",
  },
];
const input = (text: string): NormalizedInput => ({
  displayText: text,
  normalizedText: text,
  redactedText: text,
  safeForExternal: true,
  findings: [],
  alternatives: [],
  tokens: text.split(" "),
  slots: {},
  personScope: "unknown",
  temporality: "current",
});

describe("local retrieval", () => {
  it("provides exact, trie, BM25 and trigram features", () => {
    const index = buildIndex(cards);
    expect(
      retrieve(input("기침약 주세요"), "human_otc", index)[0]?.features.some(
        (item) => item.kind === "exact",
      ),
    ).toBe(true);
    expect(
      retrieve(input("기침약"), "human_otc", index)[0]?.features.some(
        (item) => item.kind === "trigram" || item.kind === "bm25",
      ),
    ).toBe(true);
  });

  it("uses deterministic hysteresis and freeze", () => {
    const first = { cardId: "A", intent: "a", score: 0.8, features: [] };
    const weak = { cardId: "B", intent: "b", score: 0.85, features: [] };
    expect(
      selectStable(
        { current: first, frozen: false, criticalLocked: false, sequence: 1 },
        weak,
        2,
      ).current?.cardId,
    ).toBe("A");
    expect(
      selectStable(
        { current: first, frozen: true, criticalLocked: false, sequence: 1 },
        { ...weak, score: 1 },
        2,
      ).current?.cardId,
    ).toBe("A");
  });

  it("does not route an anchored body site to a different site", () => {
    const index = buildIndex(cards);
    const result = retrieve(input("배가 아파요"), "human_otc", index);
    expect(result[0]?.cardId).toBe("CARD-ABDOMINAL");
    expect(result.some((candidate) => candidate.cardId === "CARD-THROAT")).toBe(
      false,
    );
  });

  it("retrieves only published, reviewed, unexpired OTC protocols", () => {
    const review = {
      pharmacist_approved: true,
      official_source_verified: true,
      reviewer_ids: ["reviewer"],
      reviewed_at: "2026-07-13T00:00:00Z",
      expires_at: "2099-01-01T00:00:00Z",
      notes: "test",
    };
    const sourceRef = {
      claim_id: "CLM-COUGH",
      source_id: "SRC-MFDS",
      source_snapshot_id: "SNAP-MFDS",
      locator: "official://cough",
      verified_at: "2026-07-13T00:00:00Z",
    };
    const decisionIndex = buildDecisionIndex(
      {
        protocols: [
          {
            protocol_id: "PTC-COUGH",
            pack_id: "PACK-1",
            version: "1.0.0",
            domain: "human_otc",
            intent: "cough_general",
            symptom_category: "cough",
            display_name: "기침",
            status: "published",
            triggers: {
              anchors: ["기침"],
              aliases: ["기침약"],
              keywords: ["기침 기간"],
              negative: [],
            },
            option_ids: ["OPT-COUGH"],
            rule_ids: [],
            source_refs: [sourceRef],
            review,
            expires_at: "2099-01-01T00:00:00Z",
          },
          {
            protocol_id: "PTC-EXPIRED",
            pack_id: "PACK-1",
            version: "1.0.0",
            domain: "human_otc",
            intent: "expired",
            symptom_category: "cough",
            display_name: "expired",
            status: "published",
            triggers: {
              anchors: ["기침"],
              aliases: [],
              keywords: [],
              negative: [],
            },
            option_ids: ["OPT-X"],
            rule_ids: [],
            source_refs: [sourceRef],
            review,
            expires_at: "2020-01-01T00:00:00Z",
          },
        ],
        ingredients: [],
        products: [],
      },
      new Date("2026-07-13T00:00:00Z"),
    );
    const results = retrieveProtocols(
      input("기침약 주세요"),
      "human_otc",
      decisionIndex,
    );
    expect(results.map((item) => item.protocolId)).toEqual(["PTC-COUGH"]);
  });
});
