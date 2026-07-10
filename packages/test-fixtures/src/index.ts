import type { KnowledgeCard } from "@pharmassist/retrieval";

const expiresAt = "2099-12-31T23:59:59Z";
const make = (
  card: Omit<KnowledgeCard, "approved" | "synthetic" | "expiresAt" | "domain">,
): KnowledgeCard => ({
  ...card,
  domain: "human_otc",
  approved: true,
  synthetic: true,
  expiresAt,
});

export const syntheticCards: readonly KnowledgeCard[] = [
  make({
    cardId: "CARD-SYN-COUGH",
    intent: "cough_general",
    title: "기침 확인",
    anchors: ["기침", "가래"],
    aliases: ["기침약", "기침약 주세요", "기침이 나요", "밤에 기침"],
    keywords: ["기침 기간 가래 호흡"],
    sayNow: ["먼저 호흡 곤란 같은 위험 신호와 기침 기간을 확인하겠습니다."],
    askNext: {
      question: "기침은 언제부터 시작됐나요?",
      reason: "지속 기간 확인",
      priority: 1,
      slot: "duration",
    },
    avoid: ["증상만으로 원인을 확정하지 않습니다."],
  }),
  make({
    cardId: "CARD-SYN-NASAL",
    intent: "nasal_symptom_general",
    title: "콧물·코막힘 확인",
    anchors: ["콧물", "코막힘", "코가 막", "재채기"],
    aliases: ["콧물", "콧물약 주세요", "코가 막혀요", "재채기하고 콧물"],
    keywords: ["콧물 코막힘 재채기 기간"],
    sayNow: ["먼저 증상 기간과 호흡 관련 위험 신호를 확인하겠습니다."],
    askNext: {
      question: "콧물과 코막힘은 언제부터 시작됐나요?",
      reason: "기간 확인",
      priority: 1,
      slot: "duration",
    },
    avoid: ["콧물 색만으로 원인을 단정하지 않습니다."],
  }),
  make({
    cardId: "CARD-SYN-THROAT",
    intent: "sore_throat",
    title: "인후통 확인",
    anchors: ["목", "인후", "삼키"],
    aliases: ["목이 따끔", "목이 아파요", "인후통약"],
    keywords: ["목 통증 삼킴 호흡 기간"],
    sayNow: ["먼저 삼키기 어렵거나 숨쉬기 힘든 신호가 있는지 확인하겠습니다."],
    askNext: {
      question: "목 통증은 언제부터 있었나요?",
      reason: "기간 확인",
      priority: 1,
      slot: "duration",
    },
    avoid: ["검사 없이 질환을 확정하지 않습니다."],
  }),
  make({
    cardId: "CARD-SYN-DYSPEPSIA",
    intent: "dyspepsia_general",
    title: "소화 불편 확인",
    anchors: ["소화", "더부룩", "명치", "체했", "속쓰림"],
    aliases: ["속이 더부룩", "소화가 안 돼요", "소화제 주세요", "체했어요"],
    keywords: ["더부룩 소화 명치 기간 통증"],
    sayNow: [
      "먼저 통증 위치와 지속 기간, 출혈 같은 위험 신호를 확인하겠습니다.",
    ],
    askNext: {
      question: "불편한 위치와 시작 시점을 알려주세요.",
      reason: "증상 범위 확인",
      priority: 1,
      slot: "body_site",
    },
    avoid: ["복통 원인을 임의로 진단하지 않습니다."],
  }),
  make({
    cardId: "CARD-SYN-ABDOMINAL",
    intent: "abdominal_pain_general",
    title: "복통 확인",
    anchors: ["배", "복통", "아랫배", "윗배", "배꼽"],
    aliases: [
      "배가 아파요",
      "복통이 있어요",
      "아랫배가 아파요",
      "윗배가 아파요",
    ],
    keywords: ["배 복통 윗배 아랫배 위치 양상 기간"],
    sayNow: ["배의 어느 위치가 어떻게 아픈지 빠르게 확인하겠습니다."],
    askNext: {
      question:
        "윗배·아랫배 중 어디가, 쓰리거나 쥐어짜는 느낌 중 어떻게 아픈가요?",
      reason: "통증 위치와 양상 확인",
      priority: 1,
      slot: "body_site",
    },
    avoid: ["통증 위치와 양상만으로 원인을 확정하지 않습니다."],
  }),
  make({
    cardId: "CARD-SYN-SKIN",
    intent: "skin_general",
    title: "피부 증상 확인",
    anchors: ["피부", "가려", "습진", "연고", "발진"],
    aliases: ["피부가 가려워요", "습진약", "연고"],
    keywords: ["피부 부위 범위 점막 진물 통증"],
    sayNow: ["먼저 부위와 범위, 점막·진물·통증 여부를 확인하겠습니다."],
    askNext: {
      question: "어느 부위에 언제부터 증상이 있었나요?",
      reason: "부위와 기간 확인",
      priority: 1,
      slot: "body_site",
    },
    avoid: ["사진이나 진찰 없이 피부질환을 확정하지 않습니다."],
  }),
  make({
    cardId: "CARD-SYN-FEVER",
    intent: "fever_general",
    title: "발열 확인",
    anchors: ["열", "발열", "몸살", "체온"],
    aliases: ["열나요", "열이 나요", "몸살에 열"],
    keywords: ["발열 연령 측정 체온 기간"],
    sayNow: ["연령과 측정한 체온, 시작 시점을 먼저 확인하겠습니다."],
    askNext: {
      question: "연령과 실제로 잰 체온은 어떻게 되나요?",
      reason: "연령과 측정값 확인",
      priority: 1,
      slot: "age_years",
    },
    avoid: ["연령과 제품 확인 없이 용량을 말하지 않습니다."],
  }),
];

export const syntheticPack = {
  version: "0.1.0-synthetic-dev",
  domain: "human_otc" as const,
  synthetic: true,
  clinicalUseProhibited: true,
  verified: false,
  cards: syntheticCards,
};
