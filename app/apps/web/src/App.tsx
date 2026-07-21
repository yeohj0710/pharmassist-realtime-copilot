import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import {
  buildCustomerSummary,
  customerTurn,
  upsertCounselorTurn,
  withoutRetractedTurns,
  type DialogueTurn,
} from "@pharmassist/dialogue";
import {
  reduceSession,
  type SessionEvent,
  type SessionState,
} from "@pharmassist/domain";
import { useEffect, useRef, useState } from "react";
import {
  connectTranscriptionPeer,
  type TranscriptionPeer,
} from "./realtime.js";
import {
  requestAiFallback,
  requestAiInterpretation,
  requestAiReadiness,
  shouldInterpretWithAi,
  shouldRequestAiRefinement,
} from "./ai-fallback.js";
import { outputText, patientVisibleLines } from "./consult-memory.js";
import productEnrichmentJson from "../../../data/actual-candidate-pack/product-enrichment.json" with { type: "json" };

interface EngineMessage {
  output: RuntimeOutput;
  ruleIds: readonly string[];
  externalRefinementAllowed: boolean;
}
type WorkerMessage = EngineMessage | { readonly error: string };

interface BrowserSpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}
interface BrowserSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const newInput = (
  text: string,
  sequence: number,
  sessionId: string,
  inputType: RuntimeInput["input_type"] = "typed",
  intentHint?: string,
): RuntimeInput => ({
  request_id: crypto.randomUUID(),
  session_id: sessionId,
  sequence,
  input_type: inputType,
  text,
  ...(intentHint ? { intent_hint: intentHint } : {}),
  is_partial: inputType === "voice_partial",
  locale: "ko-KR",
  domain: "human_otc",
  patient_context: {},
  client_timestamp: new Date().toISOString(),
});

const decisionLabel: Readonly<
  Record<RuntimeOutput["decision"]["status"], string>
> = {
  recommend: "현재 후보",
  ask: "한 가지 확인",
  refer: "직접 평가 우선",
  insufficient: "근거 부족",
};

const isSyntheticDecision = (decision: RuntimeOutput["decision"]): boolean =>
  decision.ingredient_options.some((item) =>
    /^(검토용|합성|synthetic)/iu.test(item.ingredient_name),
  ) ||
  decision.product_candidates.some((item) =>
    /^(검토용|합성|synthetic)/iu.test(item.display_name),
  );

interface ProductEnrichment {
  readonly product_id: string;
  readonly item_seq: string;
  readonly display_name: string;
  readonly manufacturer: string;
  readonly mfds_url: string;
  readonly healthkr_url: string;
  readonly image_url: string | null;
  readonly image_rights: "unknown" | string;
  readonly retail_sales_rank_90d: number | null;
  readonly popularity_source: string;
}

type ProductCandidate = RuntimeOutput["decision"]["product_candidates"][number];
type OfficialMatchStatus =
  "confirmed" | "review_required" | "not_found" | "not_applicable";
type ProductCandidateDetails = ProductCandidate &
  Readonly<{
    manufacturer?: string | null;
    specification?: string;
    displayed_price_krw?: number | null;
    price_recorded_at?: string | null;
    image_url?: string | null;
    image_source_url?: string | null;
    image_rights_status?: string | null;
    image_kind?: string | null;
    image_checked_at?: string | null;
    official_match_status?: OfficialMatchStatus;
    official_source_url?: string | null;
    indication_summary?: string;
    dosage_summary?: string;
    precaution_summary?: string;
    dosage_form?: string | null;
    route?: string | null;
    clinical_group_key?: string;
    same_group_product_count?: number;
  }>;

const officialMatchCopy: Readonly<
  Record<
    OfficialMatchStatus,
    Readonly<{
      label: string;
      sourceLabel: string;
    }>
  >
> = {
  confirmed: {
    label: "약학정보원 공식 연결",
    sourceLabel: "약학정보원 공식 정보",
  },
  review_required: {
    label: "약학정보원 연결 검토 중",
    sourceLabel: "약학정보원에서 확인",
  },
  not_found: {
    label: "약학정보원 연결 없음",
    sourceLabel: "약학정보원에서 검색",
  },
  not_applicable: {
    label: "의약품 정보 연결 대상 아님",
    sourceLabel: "",
  },
};

const productEnrichment = new Map(
  (productEnrichmentJson as ProductEnrichment[]).map((item) => [
    item.product_id,
    item,
  ]),
);

const fallbackHealthKrUrl = (productId: string, displayName: string): string =>
  productEnrichment.get(productId)?.healthkr_url ??
  `https://www.health.kr/searchDrug/search_total_result.asp?search_word=${encodeURIComponent(displayName)}`;

const inferredOfficialMatchStatus = (
  product: ProductCandidateDetails,
  enriched: ProductEnrichment | undefined,
): OfficialMatchStatus => {
  if (product.official_match_status) return product.official_match_status;
  if (enriched?.healthkr_url.includes("/result_drug.asp")) return "confirmed";
  return enriched ? "review_required" : "not_found";
};

const formatPrice = (value: number | null | undefined): string | null =>
  value === null || value === undefined
    ? null
    : `${new Intl.NumberFormat("ko-KR").format(value)}원`;

const formatRecordedDate = (
  value: string | null | undefined,
): string | null => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? `${year}. ${month}. ${day}. 기록` : value;
};

const cleanSummary = (value: string | undefined): string | null => {
  const cleaned = value
    ?.replace(/<br\s*\/?>/giu, " ")
    .replace(/br(?=\s|$)/giu, " ")
    .replace(/(?:\r?\n)+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return cleaned || null;
};

const routeAndForm = (product: ProductCandidateDetails): string | null => {
  const values = [product.dosage_form, product.route].filter(
    (value): value is string => Boolean(value),
  );
  return values.length > 0 ? [...new Set(values)].join(" · ") : null;
};

function ProductSnapshotDetails({
  product: rawProduct,
  compact = false,
}: Readonly<{
  product: ProductCandidate;
  compact?: boolean;
}>) {
  const product = rawProduct as ProductCandidateDetails;
  const enriched = productEnrichment.get(product.product_id);
  const matchStatus = inferredOfficialMatchStatus(product, enriched);
  const statusCopy = officialMatchCopy[matchStatus];
  const sourceUrl =
    matchStatus === "not_applicable"
      ? null
      : (product.official_source_url ??
        fallbackHealthKrUrl(product.product_id, product.display_name));
  const price = formatPrice(product.displayed_price_krw);
  const recordedAt = formatRecordedDate(product.price_recorded_at);
  const formAndRoute = routeAndForm(product);
  const manufacturer = product.manufacturer?.trim() || enriched?.manufacturer;
  // The card stays scannable: indication and dosage only. Full precautions
  // and image provenance live behind the single official source link.
  const clinicalDetails = [
    ["주요 적응증", cleanSummary(product.indication_summary)],
    ["용법", cleanSummary(product.dosage_summary)],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <div className={compact ? "product-detail compact" : "product-detail"}>
      <div className="product-match-row">
        <span
          className={`official-match official-match-${matchStatus}`}
          data-official-match-status={matchStatus}
        >
          {statusCopy.label}
        </span>
        {product.same_group_product_count &&
          product.same_group_product_count > 1 && (
            <span className="same-product-group">
              같은 성분·제형 {product.same_group_product_count}개
            </span>
          )}
      </div>
      {(manufacturer || product.specification || formAndRoute) && (
        <div className="product-metadata">
          {manufacturer && <span>{manufacturer}</span>}
          {product.specification && <span>{product.specification}</span>}
          {formAndRoute && <span>{formAndRoute}</span>}
        </div>
      )}
      {price && (
        <p className="product-price-snapshot">
          <span>가격 스냅샷</span>
          <strong>{price}</strong>
          <small>{recordedAt ?? "표시 가격 기록"}</small>
        </p>
      )}
      {clinicalDetails.length > 0 && (
        <dl className="product-clinical-details">
          {clinicalDetails.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {sourceUrl && (
        <a
          className="product-source-link"
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {statusCopy.sourceLabel} <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}

// Internal taxonomy suffixes (…트리아지) never reach the counter UI.
const topicLabel = (symptomCategory: string): string =>
  (symptomCategory.split("/").at(-1) ?? symptomCategory).replace(
    /\s*트리아지$/u,
    "",
  );

function TopicDecisionBlock({
  topic,
  multiple,
}: Readonly<{
  topic: RuntimeOutput["topic_results"][number];
  multiple: boolean;
}>) {
  const synthetic = isSyntheticDecision(topic.decision);
  const ingredients = topic.decision.ingredient_options;
  const products = topic.decision.product_candidates;
  const combinations = topic.decision.combination_candidates ?? [];
  const hasCandidateDetails =
    !synthetic &&
    (ingredients.length > 0 || products.length > 0 || combinations.length > 0);
  return (
    <section className="topic-decision">
      {multiple && (
        <div className="topic-decision-heading">
          <h2>{topicLabel(topic.symptom_category)}</h2>
          <span>{decisionLabel[topic.decision.status]}</span>
        </div>
      )}
      {hasCandidateDetails && (
        <div className="decision-block decision-candidates">
          <div className="candidate-group-heading">
            <div>
              <h2>
                {products.length > 0 ? "현재 제품 후보" : "현재 검토 성분"}
              </h2>
              <p className="product-ranking-note">
                {products.length === 0
                  ? "지금 말씀해 주신 증상에 맞춰 살펴볼 성분이에요."
                  : products.every((product) => product.sales_rank === null)
                    ? "지금 말씀해 주신 증상에 맞춰 살펴볼 제품이에요."
                    : "임상·안전 조건이 같은 경우에만 약국 판매 정보를 참고했어요."}
              </p>
            </div>
            {products.length > 0 && (
              <span className="candidate-count">{products.length}개</span>
            )}
          </div>
          {products.length > 0 && (
            <div className="product-candidates">
              {products.map((product, index) => {
                const productDetails = product as ProductCandidateDetails;
                const enriched = productEnrichment.get(product.product_id);
                const imageUrl =
                  productDetails.image_url ?? enriched?.image_url;
                const ingredient = ingredients.find(
                  (option) => option.ingredient_id === product.ingredient_id,
                );
                return (
                  <article
                    className={`product-card${index === 0 ? " product-card-primary" : ""}`}
                    key={product.product_id}
                  >
                    <div className="product-media">
                      {imageUrl ? (
                        <img
                          className="product-image"
                          src={imageUrl}
                          alt={`${product.display_name} 제품 이미지`}
                          width={112}
                          height={112}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div
                          className="product-image-placeholder"
                          aria-hidden="true"
                        >
                          <span>약</span>
                        </div>
                      )}
                    </div>
                    <div className="product-card-body">
                      <div className="product-card-labels">
                        <span className="product-priority">
                          {index === 0 ? "우선 후보" : "대안 후보"}
                        </span>
                        {ingredient && (
                          <span className="product-ingredient">
                            {ingredient.ingredient_name}
                          </span>
                        )}
                      </div>
                      <strong className="product-name">
                        {product.display_name}
                      </strong>
                      <ProductSnapshotDetails product={product} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {combinations.length > 0 && (
            <div className="combination-summary">
              <div>
                <p className="combination-label">함께 검토할 조합</p>
                <small>
                  같은 성분을 겹치지 않고 서로 다른 역할을 보완한 조합이에요.
                </small>
              </div>
              <div className="combination-list">
                {combinations.map((combination) => (
                  <article
                    key={`${combination.primary_product_id}-${combination.supportive_product_id}`}
                    className="combination-card"
                  >
                    <p>
                      <strong>{combination.primary_product_name}</strong>
                      <span aria-hidden="true">+</span>
                      <strong>{combination.supportive_product_name}</strong>
                    </p>
                    <small>{combination.rationale}</small>
                  </article>
                ))}
              </div>
            </div>
          )}
          {ingredients.length > 0 && (
            <div className="ingredient-summary">
              <p>연결 성분</p>
              <ul className="ingredient-options">
                {ingredients.map((option, index) => (
                  <li key={option.option_id}>
                    <span>{index === 0 ? "우선" : "대안"}</span>
                    <strong>{option.ingredient_name}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {topic.decision.status === "refer" && topic.decision.referral && (
        <div className="decision-block decision-referral">
          <h2>제품 없이 전환</h2>
          <p>{topic.decision.referral.reason}</p>
          <small>{topic.decision.referral.action}</small>
        </div>
      )}
    </section>
  );
}

function ProvisionalCandidateSidebar({
  topics,
}: Readonly<{
  topics: readonly RuntimeOutput["topic_results"][number][];
}>) {
  return (
    <aside className="candidate-sidebar" aria-label="현재 제품 후보">
      <div className="sidebar-candidate-heading">
        <h2>현재 무난한 후보</h2>
        <span>임시</span>
      </div>
      <p className="sidebar-candidate-copy">
        지금까지 확인한 내용으로 먼저 볼 수 있는 제품이에요.
      </p>
      <div className="sidebar-candidate-list">
        {topics.map((topic) => {
          const product = topic.decision.product_candidates[0];
          if (!product) return null;
          const productDetails = product as ProductCandidateDetails;
          const enriched = productEnrichment.get(product.product_id);
          const imageUrl = productDetails.image_url ?? enriched?.image_url;
          const label =
            topic.ask_next.some(
              (question) => question.slot === "symptom_pattern",
            ) && topic.symptom_category.includes("기침")
              ? "기침"
              : topicLabel(topic.symptom_category);
          return (
            <section
              key={topic.protocol_id}
              className="sidebar-candidate-topic"
            >
              <p>{label}</p>
              <article className="sidebar-product">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`${product.display_name} 제품 이미지`}
                    width={62}
                    height={62}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    className="sidebar-product-placeholder"
                    aria-hidden="true"
                  >
                    약
                  </div>
                )}
                <div className="sidebar-product-body">
                  <strong>{product.display_name}</strong>
                </div>
                <ProductSnapshotDetails product={product} compact />
              </article>
            </section>
          );
        })}
      </div>
      <small>
        판매순위가 아니며, 대답에 따라 더 맞는 제품으로 바뀔 수 있어요.
      </small>
    </aside>
  );
}

export function App() {
  const [accessGranted, setAccessGranted] = useState(
    sessionStorage.getItem("pharmassist_access") === "0903",
  );
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<readonly DialogueTurn[]>([]);
  const [result, setResult] = useState<RuntimeOutput>();
  const [online, setOnline] = useState(navigator.onLine);
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [microphones, setMicrophones] = useState<readonly MediaDeviceInfo[]>(
    [],
  );
  const [microphoneId, setMicrophoneId] = useState("");
  const [confirmedCritical, setConfirmedCritical] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [aiInterpreting, setAiInterpreting] = useState(false);
  const [aiStatus, setAiStatus] = useState<
    "checking" | "ready" | "unavailable"
  >("checking");
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingWorkerInputsRef = useRef<RuntimeInput[]>([]);
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef(0);
  const inputsRef = useRef(new Map<number, RuntimeInput>());
  const historyRef = useRef<readonly DialogueTurn[]>([]);
  const aiAbortRef = useRef<AbortController | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<RuntimeOutput["status"] | undefined>(undefined);
  const realtimeAbortRef = useRef<AbortController | null>(null);
  const transcriptionPeerRef = useRef<TranscriptionPeer | null>(null);
  const browserSpeechRef = useRef<BrowserSpeechRecognition | null>(null);
  const pttReleasedRef = useRef(false);
  const finalizationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const sessionIdRef = useRef(crypto.randomUUID());
  const initialSession: SessionState = {
    sessionId: sessionIdRef.current,
    sequence: 0,
    frozen: false,
    criticalLocked: false,
    acknowledged: false,
  };
  const sessionRef = useRef<SessionState>(initialSession);
  const [session, setSession] = useState<SessionState>(initialSession);

  const applySession = (event: SessionEvent) => {
    const next = reduceSession(sessionRef.current, event);
    sessionRef.current = next;
    setSession(next);
  };

  const submitText = async (
    text: string,
    inputType: RuntimeInput["input_type"] = "typed",
  ): Promise<void> => {
    const normalized = text.trim();
    if (
      !normalized ||
      (sessionRef.current.criticalLocked && !sessionRef.current.acknowledged)
    )
      return;
    sequenceRef.current += 1;
    const submittedSequence = sequenceRef.current;
    const submittedSession = sessionIdRef.current;
    const priorHistory = historyRef.current;
    const nextHistory = [
      ...priorHistory,
      customerTurn(normalized, submittedSequence),
    ];
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    setQuery("");
    setEngineError("");
    setProcessing(true);
    if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
    processingTimerRef.current = setTimeout(() => {
      setProcessing(false);
      setEngineError(
        "상담 엔진 응답이 지연되고 있어요. 잠시 후 다시 입력해 주세요.",
      );
    }, 8_000);
    applySession({ type: "INPUT", sequence: submittedSequence });
    const immediateInput = newInput(
      normalized,
      submittedSequence,
      submittedSession,
      inputType,
    );
    inputsRef.current.set(immediateInput.sequence, immediateInput);
    if (workerRef.current) workerRef.current.postMessage(immediateInput);
    else pendingWorkerInputsRef.current.push(immediateInput);

    if (
      shouldInterpretWithAi(aiStatus === "ready", navigator.onLine, normalized)
    ) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_500);
      try {
        const interpretation = await requestAiInterpretation(
          normalized,
          priorHistory,
          result?.intent ?? null,
          controller.signal,
        );
        if (
          interpretation &&
          interpretation.disposition === "clinical_intent" &&
          interpretation.intent &&
          interpretation.confidence >= 0.45 &&
          submittedSequence === sequenceRef.current &&
          submittedSession === sessionIdRef.current &&
          !(
            sessionRef.current.criticalLocked &&
            !sessionRef.current.acknowledged
          )
        ) {
          const interpretedInput = newInput(
            normalized,
            submittedSequence,
            submittedSession,
            inputType,
            interpretation.intent,
          );
          inputsRef.current.set(interpretedInput.sequence, interpretedInput);
          if (workerRef.current)
            workerRef.current.postMessage(interpretedInput);
          else pendingWorkerInputsRef.current.push(interpretedInput);
        }
      } catch {
        // The original text remains the deterministic offline fallback.
      } finally {
        clearTimeout(timeout);
      }
    }
  };

  useEffect(() => {
    statusRef.current = result?.status;
  }, [result?.status]);

  useEffect(() => {
    // Readiness must resolve to a definite state: a failed or hung check shows
    // "미연결 · 로컬 분석" instead of staying on "확인 중" forever, and an
    // unavailable API is re-checked periodically so the badge can recover.
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const check = async (): Promise<void> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      try {
        const ready = await requestAiReadiness(controller.signal);
        if (disposed) return;
        setAiStatus(ready ? "ready" : "unavailable");
        if (!ready) retryTimer = setTimeout(() => void check(), 30_000);
      } catch {
        if (disposed) return;
        setAiStatus("unavailable");
        retryTimer = setTimeout(() => void check(), 30_000);
      } finally {
        clearTimeout(timeout);
      }
    };
    void check();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    const worker = new Worker(
      new URL("./clinical-engine.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (!("output" in event.data)) {
        if (processingTimerRef.current)
          clearTimeout(processingTimerRef.current);
        processingTimerRef.current = null;
        setProcessing(false);
        setEngineError(
          "입력을 안전하게 처리하지 못했어요. 표현을 바꿔 다시 입력해 주세요.",
        );
        return;
      }
      if (
        event.data.output.sequence === sequenceRef.current &&
        !(sessionRef.current.criticalLocked && !sessionRef.current.acknowledged)
      ) {
        if (processingTimerRef.current)
          clearTimeout(processingTimerRef.current);
        processingTimerRef.current = setTimeout(() => {
          setProcessing(false);
          processingTimerRef.current = null;
        }, 350);
        setEngineError("");
        const localOutput = event.data.output;
        const commitOutput = (output: RuntimeOutput) => {
          setResult(output);
          // A retraction removes the retracted symptom turn from the visible
          // record so it stops appearing as a patient fact.
          const baseHistory = output.decision.reason_codes.includes(
            "RETRACT_TURN",
          )
            ? withoutRetractedTurns(historyRef.current, output.sequence)
            : historyRef.current;
          const nextHistory = upsertCounselorTurn(
            baseHistory,
            output.sequence,
            outputText(output),
          );
          historyRef.current = nextHistory;
          setHistory(nextHistory);
        };
        if (
          shouldRequestAiRefinement(
            navigator.onLine,
            localOutput.mode,
            localOutput.decision.status,
          )
        ) {
          const input = inputsRef.current.get(event.data.output.sequence);
          if (input) {
            const refinementHistory = historyRef.current;
            // Optimistic UI: render the deterministic local answer immediately.
            // The AI result replaces this same sequence when it arrives.
            commitOutput(localOutput);
            aiAbortRef.current?.abort();
            const controller = new AbortController();
            aiAbortRef.current = controller;
            setAiInterpreting(true);
            void requestAiFallback(
              input,
              localOutput,
              refinementHistory,
              controller.signal,
            )
              .then((refined) => {
                if (
                  refined?.sequence === sequenceRef.current &&
                  refined.session_id === sessionIdRef.current
                ) {
                  commitOutput(refined);
                }
              })
              .catch(() => undefined)
              .finally(() => {
                if (aiAbortRef.current === controller) {
                  aiAbortRef.current = null;
                  setAiInterpreting(false);
                }
              });
          } else commitOutput(localOutput);
        } else commitOutput(localOutput);
        if (
          event.data.output.mode === "escalate" ||
          (event.data.output.status === "blocked" &&
            event.data.output.red_flags.length > 0)
        )
          applySession({
            type: "CRITICAL_LOCK",
            cardId: event.data.output.intent ?? "CRITICAL",
          });
        setConfirmedCritical(false);
      }
    };
    worker.onerror = () => {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
      setProcessing(false);
      setEngineError(
        "상담 엔진을 시작하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
    };
    workerRef.current = worker;
    for (const pendingInput of pendingWorkerInputsRef.current)
      worker.postMessage(pendingInput);
    pendingWorkerInputsRef.current = [];
    const updateOnline = () => setOnline(navigator.onLine);
    addEventListener("online", updateOnline);
    addEventListener("offline", updateOnline);
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key.toLowerCase() === "f" && statusRef.current === "blocked") {
        setConfirmedCritical(true);
        applySession({ type: "ACKNOWLEDGE_CRITICAL" });
      }
    };
    addEventListener("keydown", keyboard);
    return () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
      aiAbortRef.current?.abort();
      realtimeAbortRef.current?.abort();
      transcriptionPeerRef.current?.close();
      browserSpeechRef.current?.abort();
      if (finalizationTimerRef.current)
        clearTimeout(finalizationTimerRef.current);
      mediaRef.current?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current?.stop();
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      removeEventListener("online", updateOnline);
      removeEventListener("offline", updateOnline);
      removeEventListener("keydown", keyboard);
    };
  }, []);

  const consult = () => {
    submitText(query);
  };

  const resetConsult = () => {
    const previousSessionId = sessionIdRef.current;
    workerRef.current?.postMessage({
      type: "reset",
      sessionId: previousSessionId,
    });
    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;
    sequenceRef.current = 0;
    pendingWorkerInputsRef.current = [];
    const next: SessionState = {
      sessionId,
      sequence: 0,
      frozen: false,
      criticalLocked: false,
      acknowledged: false,
    };
    sessionRef.current = next;
    setSession(next);
    setHistory([]);
    historyRef.current = [];
    setQuery("");
    setResult(undefined);
    setProcessing(false);
    setEngineError("");
    setConfirmedCritical(false);
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    setAiInterpreting(false);
    inputsRef.current.clear();
    inputRef.current?.focus();
  };

  const startPtt = async () => {
    try {
      realtimeAbortRef.current?.abort();
      transcriptionPeerRef.current?.close();
      pttReleasedRef.current = false;
      setVoiceMessage("");
      const brokerUrl = import.meta.env["VITE_REALTIME_BROKER_URL"] as
        string | undefined;
      if (brokerUrl) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: microphoneId
            ? {
                deviceId: { exact: microphoneId },
                echoCancellation: true,
                noiseSuppression: true,
              }
            : { echoCancellation: true, noiseSuppression: true },
        });
        const devices = (
          await navigator.mediaDevices.enumerateDevices()
        ).filter((device) => device.kind === "audioinput");
        setMicrophones(devices);
        mediaRef.current = stream;
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = recorder;
        recordedChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) recordedChunksRef.current.push(event.data);
        };
        recorder.onerror = () => {
          setListening(false);
          setVoiceMessage("녹음을 시작하지 못했어요.");
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          mediaRef.current = null;
          mediaRecorderRef.current = null;
          setListening(false);
          const blob = new Blob(recordedChunksRef.current, {
            type: "audio/webm",
          });
          recordedChunksRef.current = [];
          if (blob.size < 100) {
            setVoiceMessage("음성이 들리지 않았어요. 다시 말해주세요.");
            return;
          }
          setVoiceMessage("음성을 글자로 바꾸는 중이에요…");
          const endpoint = brokerUrl.replace(
            "/v1/realtime/session",
            "/v1/audio/transcribe",
          );
          void fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "audio/webm",
              "x-app-passcode":
                sessionStorage.getItem("pharmassist_access") ?? "",
            },
            body: blob,
          })
            .then(async (response) => {
              if (!response.ok)
                throw new Error(`TRANSCRIBE_${response.status}`);
              const body = (await response.json()) as { transcript?: string };
              if (!body.transcript) throw new Error("TRANSCRIPT_EMPTY");
              setQuery(body.transcript);
              submitText(body.transcript, "voice_final");
              setVoiceMessage("");
            })
            .catch((cause: unknown) => {
              const code = cause instanceof Error ? cause.message : "UNKNOWN";
              setVoiceMessage(
                code === "TRANSCRIBE_422"
                  ? "소리가 감지되지 않았어요. 마이크를 바꾸거나 조금 더 가까이 말해주세요."
                  : "음성 인식에 실패했어요. 다시 눌러주세요.",
              );
            });
        };
        recorder.start(250);
        setListening(true);
        recordingTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current?.state === "recording")
            mediaRecorderRef.current.stop();
        }, 8_000);
        return;
      }

      const speechWindow = window as typeof window & {
        SpeechRecognition?: BrowserSpeechRecognitionConstructor;
        webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
      };
      const Recognition =
        speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!Recognition) {
        setVoiceMessage("이 브라우저에서는 음성 입력을 지원하지 않아요.");
        return;
      }
      const recognition = new Recognition();
      browserSpeechRef.current = recognition;
      recognition.lang = "ko-KR";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let transcript = "";
        let finalTranscript = "";
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          const text = result?.[0]?.transcript ?? "";
          transcript += text;
          if (result?.isFinal) finalTranscript += text;
        }
        setQuery(transcript.trim());
        if (finalTranscript.trim()) {
          submitText(finalTranscript, "voice_final");
          setVoiceMessage("");
        }
      };
      recognition.onerror = (event) => {
        setListening(false);
        browserSpeechRef.current = null;
        setVoiceMessage(
          event.error === "not-allowed"
            ? "주소창의 마이크를 허용한 뒤 다시 눌러주세요."
            : event.error === "no-speech"
              ? "음성이 들리지 않았어요. 다시 말해주세요."
              : "음성 인식을 시작하지 못했어요.",
        );
      };
      recognition.onend = () => {
        setListening(false);
        browserSpeechRef.current = null;
        inputRef.current?.focus();
      };
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setVoiceMessage("마이크를 시작하지 못했어요.");
      inputRef.current?.focus();
    }
  };
  const stopPtt = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
      mediaRecorderRef.current.stop();
      return;
    }
    if (browserSpeechRef.current) {
      browserSpeechRef.current.stop();
      return;
    }
    pttReleasedRef.current = true;
    transcriptionPeerRef.current?.commit();
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    if (listening) setQuery("");
    setListening(false);
    if (finalizationTimerRef.current)
      clearTimeout(finalizationTimerRef.current);
    finalizationTimerRef.current = setTimeout(() => {
      transcriptionPeerRef.current?.close();
      transcriptionPeerRef.current = null;
      realtimeAbortRef.current?.abort();
      realtimeAbortRef.current = null;
    }, 2_000);
  };
  const critical =
    result?.mode === "escalate" || Boolean(result?.red_flags.length);
  const latestCustomerMessage = [...history]
    .reverse()
    .find((turn) => turn.speaker === "customer")?.text;
  const customerSummary = buildCustomerSummary(history);
  const conversationTurn = Boolean(
    result?.decision.reason_codes.includes("CONVERSATION_TURN"),
  );
  const topicLabels = result
    ? result.topic_results.map((topic) => topicLabel(topic.symptom_category))
    : [];
  const provisionalCandidateTopics = result
    ? result.ask_next.length > 0
      ? result.topic_results.filter(
          (topic) =>
            !isSyntheticDecision(topic.decision) &&
            topic.decision.product_candidates.length > 0,
        )
      : []
    : [];
  const visibleLines = result
    ? provisionalCandidateTopics.length > 0
      ? result.ask_next.map((question) => question.question)
      : patientVisibleLines(result)
    : [];

  if (!accessGranted) {
    const unlock = () => {
      if (passcode !== "0903") {
        setPasscodeError(true);
        return;
      }
      sessionStorage.setItem("pharmassist_access", "0903");
      setAccessGranted(true);
    };
    return (
      <main className="login-shell">
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-logo" aria-hidden="true">
            약
          </div>
          <p className="login-eyebrow">약국 상담 도우미</p>
          <h1 id="login-title">상담 도우미에 로그인</h1>
          <p className="login-copy">
            허용된 사용자만 상담 기능을 이용할 수 있어요.
          </p>
          <label htmlFor="access-passcode">비밀번호</label>
          <input
            id="access-passcode"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            value={passcode}
            onChange={(event) => {
              setPasscode(event.target.value);
              setPasscodeError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") unlock();
            }}
            placeholder="비밀번호를 입력하세요"
            aria-invalid={passcodeError}
          />
          {passcodeError && (
            <p className="login-error" role="alert">
              비밀번호가 맞지 않아요.
            </p>
          )}
          <button className="login-button" onClick={unlock}>
            로그인
          </button>
          <small>공식 조사 후보 데이터 · 약사 검토 전</small>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="demo-banner" role="note">
        공식 조사 후보 데이터 · 약사 검토 전
      </div>
      <header>
        <div>
          <p className="eyebrow">약사를 위한 실시간 상담 지원</p>
          <h1>약국 상담 도우미</h1>
        </div>
        <div className="header-actions">
          <span className={`badge ${online ? "online" : "offline"}`}>
            {!online
              ? "오프라인 · 로컬 사용 가능"
              : aiInterpreting
                ? "AI 해석 중"
                : aiStatus === "ready"
                  ? "AI 연결됨"
                  : aiStatus === "unavailable"
                    ? "AI 미연결 · 로컬 분석"
                    : "AI 연결 확인 중"}
          </span>
          {history.length > 0 && (
            <button className="reset-button" onClick={resetConsult}>
              새 상담
            </button>
          )}
        </div>
      </header>
      <div className={`consult-workspace${result ? " has-sidebar" : ""}`}>
        <div className="consult-main">
          <section className="query-panel" aria-label="상담 입력">
            <label htmlFor="consult-query">
              손님이 말한 증상이나 질문을 입력하세요
            </label>
            <div className="query-row">
              <input
                ref={inputRef}
                id="consult-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onCompositionEnd={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing)
                    consult();
                }}
                placeholder="예: 기침이 3일째예요"
                autoFocus
                maxLength={2000}
              />
              <button onClick={consult} aria-disabled={session.criticalLocked}>
                확인
              </button>
            </div>
            <button
              className={`ptt ${listening ? "active" : ""}`}
              onClick={() => (listening ? stopPtt() : void startPtt())}
              aria-pressed={listening}
              aria-label="누르는 동안 음성 입력"
            >
              {listening ? "● 듣는 중 · 눌러서 종료" : "🎙 말하기"}
            </button>
            {voiceMessage && (
              <p className="voice-message" role="status">
                {voiceMessage}
              </p>
            )}
            {microphones.length > 1 && (
              <label className="microphone-picker">
                마이크
                <select
                  value={microphoneId}
                  onChange={(event) => setMicrophoneId(event.target.value)}
                >
                  <option value="">기본 마이크</option>
                  {microphones.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `마이크 ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="privacy">
              음성은 이 데모에서 저장되지 않습니다. 음성 인식 연결 전에는 직접
              입력을 사용하세요.
            </p>
          </section>
          {processing && (
            <section className="engine-status" role="status" aria-live="polite">
              <span className="loading-spinner" aria-hidden="true" />
              <span>
                <strong>입력을 확인하고 있어요</strong>
                <small>
                  안전 기준과 상담 프로토콜을 로컬에서 적용하고 있어요.
                </small>
              </span>
            </section>
          )}
          {engineError && (
            <p className="engine-error" role="alert">
              {engineError}
            </p>
          )}
          {result ? (
            <section
              className={`result ${critical ? "critical" : ""} ${aiInterpreting ? "refining" : ""}`}
              aria-live="polite"
              aria-busy={aiInterpreting}
            >
              {critical && !confirmedCritical ? (
                <div className="critical-lock">
                  <h2>먼저 위험 신호를 확인하세요</h2>
                  <p>{result.say_now.join(" ")}</p>
                  <button
                    onClick={() => {
                      setConfirmedCritical(true);
                      applySession({ type: "ACKNOWLEDGE_CRITICAL" });
                    }}
                  >
                    확인했습니다 <kbd>F</kbd>
                  </button>
                </div>
              ) : (
                <>
                  {aiInterpreting && (
                    <div className="refinement-status" role="status">
                      <span className="loading-spinner" aria-hidden="true" />
                      <span>
                        <strong>결정은 유지하고 문장만 다듬고 있어요</strong>
                        <small>
                          성분·제품·근거는 로컬 결정엔진에서 이미 고정됐어요.
                        </small>
                      </span>
                    </div>
                  )}
                  {latestCustomerMessage && (
                    <div className="latest-customer-message">
                      <span>손님이 한 말</span>
                      <p>{latestCustomerMessage}</p>
                    </div>
                  )}
                  <article className="primary-guidance">
                    <p className="result-kicker">
                      {result.ask_next.length > 0
                        ? "손님에게 이렇게 물어보세요"
                        : "손님에게 이렇게 말해보세요"}
                    </p>
                    {visibleLines.map((line) => (
                      <p
                        className={
                          result.ask_next.some((item) => item.question === line)
                            ? "ask"
                            : result.ask_next.length > 0
                              ? "say supporting-suggestion"
                              : "say"
                        }
                        key={line}
                      >
                        {line}
                      </p>
                    ))}
                  </article>
                  {!conversationTurn && result.ask_next.length === 0 && (
                    <section
                      className={`decision-summary decision-${result.decision.status}${result.ask_next.length > 0 ? " decision-open-question" : ""}`}
                      aria-label="OTC 결정 결과"
                    >
                      <div className="decision-heading">
                        <div>
                          <p>결정 상태</p>
                          <strong>
                            {result.decision.status === "recommend" &&
                            result.ask_next.length > 0
                              ? "현재 후보"
                              : decisionLabel[result.decision.status]}
                          </strong>
                        </div>
                      </div>
                      {result.topic_results.length > 1 && (
                        <div className="multi-topic-overview">
                          <h2>함께 확인 중인 증상</h2>
                          <p>{topicLabels.join(" · ")}</p>
                          <small>
                            각 증상의 후보를 따로 유지하며 질문은 한 번에 하나씩
                            이어갑니다.
                          </small>
                        </div>
                      )}
                      {result.topic_results.map((topic) => (
                        <TopicDecisionBlock
                          key={topic.protocol_id}
                          topic={topic}
                          multiple={result.topic_results.length > 1}
                        />
                      ))}
                    </section>
                  )}
                  {!conversationTurn && (
                    <details className="supporting-details">
                      <summary>근거·주의사항</summary>
                      <div className="supporting-content">
                        {result.avoid
                          .filter(
                            (item) => !/임의로 진단하지 않습니다/u.test(item),
                          )
                          .map((item) => (
                            <p key={item}>{item}</p>
                          ))}
                        {result.decision.source_refs.length > 0 && (
                          <p className="evidence-note">
                            제품별 출처와 공식 연결 여부는 제품 카드에서 확인할
                            수 있습니다.
                          </p>
                        )}
                        <p>
                          상태 {result.status} · 신뢰도{" "}
                          {Math.round(result.confidence * 100)}%
                        </p>
                        <p>
                          지식팩 {result.knowledge_version} · 처리{" "}
                          {result.latency.total_ms.toFixed(1)}ms
                        </p>
                        <p>
                          공식 출처 조사 후보 기반 미리보기이며 약사 검토와 운영
                          승격은 미완료입니다.
                        </p>
                      </div>
                    </details>
                  )}
                </>
              )}
            </section>
          ) : null}
        </div>
        {result ? (
          <div className="consult-sidebar">
            {provisionalCandidateTopics.length > 0 && (
              <ProvisionalCandidateSidebar
                topics={provisionalCandidateTopics}
              />
            )}
            <aside className="patient-summary" aria-label="이번 손님 정보">
              <div className="summary-heading">
                <p>이번 손님 정보</p>
                <span>{customerSummary.facts.length}개 확인</span>
              </div>
              {customerSummary.symptoms.length > 0 && (
                <div className="summary-row">
                  <span>증상</span>
                  <strong>{customerSummary.symptoms.join(", ")}</strong>
                </div>
              )}
              {customerSummary.duration && (
                <div className="summary-row">
                  <span>시작</span>
                  <strong>{customerSummary.duration}</strong>
                </div>
              )}
              <div className="summary-facts">
                {customerSummary.facts.map((fact) => (
                  <p key={fact}>{fact}</p>
                ))}
              </div>
              {customerSummary.risks.length > 0 && (
                <p className="summary-risk">위험 관련 표현 확인 필요</p>
              )}
              <small>
                현재 상담 중에만 유지되며 새 상담을 누르면 지워집니다.
              </small>
            </aside>
          </div>
        ) : null}
      </div>
      <footer>
        개인정보를 입력하지 마세요. 진단·처방 변경·확정 용량을 생성하지
        않습니다.
      </footer>
    </main>
  );
}
