import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import {
  type Clock,
  type Domain,
  PharmassistError,
  systemClock,
} from "@pharmassist/domain";
import { normalizeKorean } from "@pharmassist/normalizer";
import {
  buildIndex,
  retrieve,
  type KnowledgeCard,
  type RetrievalIndex,
} from "@pharmassist/retrieval";
import { evaluateSafety } from "@pharmassist/safety";

export interface RuntimePack {
  readonly version: string;
  readonly domain: Domain;
  readonly synthetic: boolean;
  readonly clinicalUseProhibited: boolean;
  readonly verified: boolean;
  readonly cards: readonly KnowledgeCard[];
}

export interface EngineResult {
  readonly output: RuntimeOutput;
  readonly ruleIds: readonly string[];
  readonly externalRefinementAllowed: boolean;
  readonly bypassedDebounce: boolean;
}

export type AppProfile = "local-demo" | "local-live" | "staging" | "production";

export class LocalClinicalEngine {
  readonly index: RetrievalIndex;
  constructor(
    readonly pack: RuntimePack,
    readonly profile: AppProfile = "local-demo",
    readonly clock: Clock = systemClock,
  ) {
    if (
      profile === "production" &&
      (pack.synthetic || pack.clinicalUseProhibited || !pack.verified)
    ) {
      throw new PharmassistError(
        "KNOWLEDGE_STALE",
        "Production profile requires a current official signed pack.",
        false,
        "previous_pack",
      );
    }
    this.index = buildIndex(pack.cards, clock.now());
  }

  run(input: RuntimeInput): EngineResult {
    const started = this.clock.monotonicMs();
    const normalizeStart = this.clock.monotonicMs();
    const normalized = normalizeKorean(
      input.text,
      input.asr?.alternatives ?? [],
    );
    const normalizeMs = this.clock.monotonicMs() - normalizeStart;
    const safetyStart = this.clock.monotonicMs();
    let safety = evaluateSafety(normalized, input.domain);
    if (input.input_type === "voice_partial" && safety.mode === "continue") {
      safety = {
        mode: "clarify",
        ruleIds: ["PARTIAL_PROVISIONAL"],
        redFlags: [],
        missingSlots: ["symptom_concepts"],
        sayNow: [
          "듣는 중입니다. 현재 표현만으로는 구체 안내를 확정하지 않겠습니다.",
        ],
        askNext: {
          question: "증상을 조금 더 말씀해 주세요.",
          reason: "안정된 입력 확인",
          priority: 1,
          slot: "symptom_concepts",
        },
        lockCritical: false,
      };
    }
    const safetyMs = this.clock.monotonicMs() - safetyStart;
    const retrievalStart = this.clock.monotonicMs();
    const candidates =
      safety.mode === "continue"
        ? retrieve(normalized, input.domain, this.index)
        : [];
    const retrieveMs = this.clock.monotonicMs() - retrievalStart;
    const top = candidates[0];
    const card = top ? this.index.cards.get(top.cardId) : undefined;
    const genericRule = safety.mode === "continue" ? "ASK_ONE" : undefined;
    const mode: RuntimeOutput["mode"] =
      safety.mode === "continue" ? "clarify" : safety.mode;
    const status: RuntimeOutput["status"] =
      input.is_partial || input.input_type === "voice_partial"
        ? "provisional"
        : safety.mode === "escalate" || safety.mode === "clarify" || !card
          ? "blocked"
          : "stable";
    const sayNow = (
      safety.sayNow.length
        ? [...safety.sayNow]
        : card?.sayNow
          ? [...card.sayNow]
          : ["먼저 증상과 위험 신호를 한 가지씩 확인하겠습니다."]
    ).slice(0, 3) as RuntimeOutput["say_now"];
    const ask = safety.askNext ??
      card?.askNext ?? {
        question: "가장 불편한 증상은 언제 시작됐나요?",
        reason: "증상과 기간 확인",
        priority: 1,
        slot: "duration",
      };
    const totalMs = this.clock.monotonicMs() - started;
    const output: RuntimeOutput = {
      request_id: input.request_id,
      session_id: input.session_id,
      sequence: input.sequence,
      mode,
      status,
      intent: card?.intent ?? null,
      say_now: sayNow,
      ask_next: mode === "escalate" ? [] : [ask],
      red_flags: [...safety.redFlags],
      actions:
        mode === "escalate"
          ? [
              {
                type: "refer",
                text: "일반약 안내를 중단하고 표시된 의뢰 행동을 확인한다.",
                requires_confirmation: true,
              },
            ]
          : safety.missingSlots.length
            ? [
                {
                  type: "verify",
                  text: "필수 정보를 확인한 뒤 구체 안내를 다시 평가한다.",
                  requires_confirmation: true,
                },
              ]
            : [],
      avoid: card?.avoid
        ? [...card.avoid]
        : ["필수정보 없이 진단·제품·용량을 단정하지 않습니다."],
      missing_slots: [...safety.missingSlots],
      confidence: top?.score ?? (mode === "escalate" ? 1 : 0.5),
      candidate_intents: candidates.slice(0, 3).map((candidate) => ({
        intent: candidate.intent,
        score: candidate.score,
      })) as NonNullable<RuntimeOutput["candidate_intents"]>,
      source_refs: [],
      latency: {
        total_ms: totalMs,
        normalize_ms: normalizeMs,
        safety_ms: safetyMs,
        retrieve_ms: retrieveMs,
        refine_ms: 0,
      },
      knowledge_version: this.pack.version,
      model: null,
      generated_at: this.clock.now().toISOString(),
      stale_response_dropped: false,
    };
    return {
      output,
      ruleIds: genericRule ? [...safety.ruleIds, genericRule] : safety.ruleIds,
      externalRefinementAllowed:
        normalized.safeForExternal &&
        mode !== "escalate" &&
        !safety.missingSlots.length &&
        Boolean(card),
      bypassedDebounce: safety.mode === "escalate",
    };
  }
}
