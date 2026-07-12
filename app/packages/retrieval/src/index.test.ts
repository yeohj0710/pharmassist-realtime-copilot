import { describe, expect, it } from "vitest";
import type { NormalizedInput } from "@pharmassist/domain";
import {
  buildIndex,
  retrieve,
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
});
