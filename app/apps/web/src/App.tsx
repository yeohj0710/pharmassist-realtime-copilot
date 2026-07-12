import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
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
  requestAiReadiness,
  shouldRequestAiRefinement,
} from "./ai-fallback.js";
import {
  buildPatientSummary,
  outputText,
  patientVisibleLines,
  upsertAssistantTurn,
} from "./consult-memory.js";

interface EngineMessage {
  output: RuntimeOutput;
  ruleIds: readonly string[];
  externalRefinementAllowed: boolean;
}
type WorkerMessage = EngineMessage | { readonly error: string };

const newInput = (
  text: string,
  sequence: number,
  sessionId: string,
  inputType: RuntimeInput["input_type"] = "typed",
): RuntimeInput => ({
  request_id: crypto.randomUUID(),
  session_id: sessionId,
  sequence,
  input_type: inputType,
  text,
  is_partial: inputType === "voice_partial",
  locale: "ko-KR",
  domain: "human_otc",
  patient_context: {},
  client_timestamp: new Date().toISOString(),
});

export function App() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<readonly string[]>([]);
  const [result, setResult] = useState<RuntimeOutput>();
  const [online, setOnline] = useState(navigator.onLine);
  const [listening, setListening] = useState(false);
  const [confirmedCritical, setConfirmedCritical] = useState(false);
  const [aiInterpreting, setAiInterpreting] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const sequenceRef = useRef(0);
  const inputsRef = useRef(new Map<number, RuntimeInput>());
  const historyRef = useRef<readonly string[]>([]);
  const aiAbortRef = useRef<AbortController | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const statusRef = useRef<RuntimeOutput["status"] | undefined>(undefined);
  const realtimeAbortRef = useRef<AbortController | null>(null);
  const transcriptionPeerRef = useRef<TranscriptionPeer | null>(null);
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

  const submitText = (
    text: string,
    inputType: RuntimeInput["input_type"] = "typed",
  ) => {
    const normalized = text.trim();
    if (
      !normalized ||
      (sessionRef.current.criticalLocked && !sessionRef.current.acknowledged)
    )
      return;
    sequenceRef.current += 1;
    const nextHistory = [...historyRef.current, `환자: ${normalized}`];
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    setQuery("");
    applySession({ type: "INPUT", sequence: sequenceRef.current });
    const input = newInput(
      normalized,
      sequenceRef.current,
      sessionIdRef.current,
      inputType,
    );
    inputsRef.current.set(input.sequence, input);
    workerRef.current?.postMessage(input);
  };

  useEffect(() => {
    statusRef.current = result?.status;
  }, [result?.status]);

  useEffect(() => {
    const controller = new AbortController();
    void requestAiReadiness(controller.signal)
      .then(setAiReady)
      .catch(() => setAiReady(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const worker = new Worker(
      new URL("./clinical-engine.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (!("output" in event.data)) return;
      if (
        event.data.output.sequence === sequenceRef.current &&
        !(sessionRef.current.criticalLocked && !sessionRef.current.acknowledged)
      ) {
        setResult(event.data.output);
        const localHistory = upsertAssistantTurn(
          historyRef.current,
          event.data.output.sequence,
          outputText(event.data.output),
        );
        historyRef.current = localHistory;
        setHistory(localHistory);
        if (
          shouldRequestAiRefinement(navigator.onLine, event.data.output.mode)
        ) {
          const input = inputsRef.current.get(event.data.output.sequence);
          if (input) {
            aiAbortRef.current?.abort();
            const controller = new AbortController();
            aiAbortRef.current = controller;
            setAiInterpreting(true);
            void requestAiFallback(
              input,
              event.data.output,
              localHistory,
              controller.signal,
            )
              .then((refined) => {
                if (
                  refined?.sequence === sequenceRef.current &&
                  refined.session_id === sessionIdRef.current
                ) {
                  setResult(refined);
                  const refinedHistory = upsertAssistantTurn(
                    historyRef.current,
                    refined.sequence,
                    outputText(refined),
                  );
                  historyRef.current = refinedHistory;
                  setHistory(refinedHistory);
                }
              })
              .catch(() => undefined)
              .finally(() => {
                if (aiAbortRef.current === controller) {
                  aiAbortRef.current = null;
                  setAiInterpreting(false);
                }
              });
          }
        }
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
    workerRef.current = worker;
    const updateOnline = () => setOnline(navigator.onLine);
    addEventListener("online", updateOnline);
    addEventListener("offline", updateOnline);
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== inputRef.current) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && !sessionRef.current.criticalLocked) {
        resetConsult();
      }
      if (event.key.toLowerCase() === "f" && statusRef.current === "blocked") {
        setConfirmedCritical(true);
        applySession({ type: "ACKNOWLEDGE_CRITICAL" });
      }
    };
    addEventListener("keydown", keyboard);
    return () => {
      worker.terminate();
      aiAbortRef.current?.abort();
      realtimeAbortRef.current?.abort();
      transcriptionPeerRef.current?.close();
      if (finalizationTimerRef.current)
        clearTimeout(finalizationTimerRef.current);
      mediaRef.current?.getTracks().forEach((track) => track.stop());
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      setListening(true);
      const brokerUrl = import.meta.env["VITE_REALTIME_BROKER_URL"] as
        string | undefined;
      if (brokerUrl) {
        const controller = new AbortController();
        realtimeAbortRef.current = controller;
        void connectTranscriptionPeer(
          stream,
          brokerUrl,
          (event) => {
            if (event && typeof event === "object") {
              const value = event as Readonly<Record<string, unknown>>;
              if (
                value["type"] ===
                  "conversation.item.input_audio_transcription.completed" &&
                typeof value["transcript"] === "string"
              ) {
                submitText(value["transcript"], "voice_final");
                setQuery("");
                transcriptionPeerRef.current?.close();
                transcriptionPeerRef.current = null;
                if (finalizationTimerRef.current)
                  clearTimeout(finalizationTimerRef.current);
              }
            }
          },
          controller.signal,
        )
          .then((peer) => {
            transcriptionPeerRef.current = peer;
            if (pttReleasedRef.current) peer.commit();
          })
          .catch(() => {
            stream.getTracks().forEach((track) => track.stop());
            setListening(false);
            inputRef.current?.focus();
          });
      }
    } catch {
      setListening(false);
      inputRef.current?.focus();
    }
  };
  const stopPtt = () => {
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
  const patientSummary = buildPatientSummary(history);

  return (
    <main className="shell">
      <div className="demo-banner" role="note">
        합성 데이터 데모 · 임상 사용 금지
      </div>
      <header>
        <div>
          <p className="eyebrow">PHARMACIST LOCAL COPILOT</p>
          <h1>지금 확인할 상담</h1>
        </div>
        <div className="header-actions">
          <span className={`badge ${online ? "online" : "offline"}`}>
            {aiInterpreting
              ? "AI 해석 중"
              : aiReady
                ? "AI 연결됨"
                : online
                  ? "AI 연결 확인 중"
                  : "오프라인 · 로컬 사용 가능"}
          </span>
          {history.length > 0 && (
            <button className="reset-button" onClick={resetConsult}>
              새 상담
            </button>
          )}
        </div>
      </header>
      <section className="query-panel" aria-label="상담 입력">
        <label htmlFor="consult-query">증상이나 질문을 입력하세요</label>
        <div className="query-row">
          <input
            ref={inputRef}
            id="consult-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onCompositionEnd={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) consult();
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
          onPointerDown={() => void startPtt()}
          onPointerUp={stopPtt}
          onPointerCancel={stopPtt}
          aria-pressed={listening}
          aria-label="누르는 동안 음성 입력"
        >
          {listening ? "● 듣는 중 — 놓으면 중지" : "🎙 누르고 말하기"}
        </button>
        <p className="privacy">
          음성은 이 데모에서 저장되지 않습니다. 음성 인식 연결 전에는 직접
          입력을 사용하세요.
        </p>
      </section>
      {result ? (
        <div className="consult-layout">
          <section
            className={`result ${critical ? "critical" : ""}`}
            aria-live="polite"
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
                <article className="primary-guidance">
                  <p className="result-kicker">지금 말할 내용</p>
                  {patientVisibleLines(result).map((line, index) => (
                    <p
                      className={index < result.say_now.length ? "say" : "ask"}
                      key={line}
                    >
                      {line}
                    </p>
                  ))}
                </article>
                <details className="supporting-details">
                  <summary>근거·주의사항</summary>
                  <div className="supporting-content">
                    {result.avoid.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                    <p>
                      상태 {result.status} · 신뢰도{" "}
                      {Math.round(result.confidence * 100)}%
                    </p>
                    <p>
                      지식팩 {result.knowledge_version} · 처리{" "}
                      {result.latency.total_ms.toFixed(1)}ms
                    </p>
                    <p>
                      합성 fixture 기반 데모이며 공식 임상 출처 검토는
                      미완료입니다.
                    </p>
                  </div>
                </details>
              </>
            )}
          </section>
          <aside className="patient-summary" aria-label="누적 환자 정보">
            <div className="summary-heading">
              <p>누적 환자 정보</p>
              <span>{patientSummary.facts.length}개 확인</span>
            </div>
            {patientSummary.symptoms.length > 0 && (
              <div className="summary-row">
                <span>증상</span>
                <strong>{patientSummary.symptoms.join(", ")}</strong>
              </div>
            )}
            {patientSummary.duration && (
              <div className="summary-row">
                <span>시작</span>
                <strong>{patientSummary.duration}</strong>
              </div>
            )}
            <div className="summary-facts">
              {patientSummary.facts.map((fact) => (
                <p key={fact}>{fact}</p>
              ))}
            </div>
            {patientSummary.risks.length > 0 && (
              <p className="summary-risk">위험 관련 표현 확인 필요</p>
            )}
            <small>
              현재 상담 중에만 유지되며 새 상담을 누르면 지워집니다.
            </small>
          </aside>
        </div>
      ) : null}
      <footer>
        개인정보를 입력하지 마세요. 진단·처방 변경·확정 용량을 생성하지
        않습니다.
      </footer>
    </main>
  );
}
