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
  const [result, setResult] = useState<RuntimeOutput>();
  const [online, setOnline] = useState(navigator.onLine);
  const [listening, setListening] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [confirmedCritical, setConfirmedCritical] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const sequenceRef = useRef(0);
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
    applySession({ type: "INPUT", sequence: sequenceRef.current });
    workerRef.current?.postMessage(
      newInput(
        normalized,
        sequenceRef.current,
        sessionIdRef.current,
        inputType,
      ),
    );
  };

  useEffect(() => {
    statusRef.current = result?.status;
  }, [result?.status]);

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
        setQuery("");
        setResult(undefined);
        applySession({ type: "CLEAR" });
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
        <span className={`badge ${online ? "online" : "offline"}`}>
          {online ? "로컬 준비됨" : "오프라인 · 로컬 사용 가능"}
        </span>
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
        <section
          className={`result ${critical ? "critical" : ""}`}
          aria-live="polite"
        >
          <div className="result-heading">
            <span className={`state state-${result.status}`}>
              {result.status === "stable"
                ? "안정"
                : result.status === "provisional"
                  ? "임시"
                  : result.status === "blocked"
                    ? "중단·확인"
                    : "최종"}
            </span>
            <span>신뢰도 {Math.round(result.confidence * 100)}%</span>
          </div>
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
              <article>
                <h2>지금 말할 내용</h2>
                {result.say_now.map((line) => (
                  <p className="say" key={line}>
                    {line}
                  </p>
                ))}
              </article>
              <article>
                <h2>다음 질문</h2>
                {result.ask_next.length ? (
                  result.ask_next.map((item) => (
                    <div key={item.slot}>
                      <p className="ask">{item.question}</p>
                      <small>{item.reason}</small>
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    추가 질문보다 즉시 안전 조치가 우선입니다.
                  </p>
                )}
              </article>
              <div className="two-col">
                <article>
                  <h2>조치</h2>
                  {result.actions.length ? (
                    result.actions.map((item) => (
                      <p key={item.text}>{item.text}</p>
                    ))
                  ) : (
                    <p className="muted">필수 정보를 확인한 뒤 판단하세요.</p>
                  )}
                </article>
                <article>
                  <h2>피할 것</h2>
                  {result.avoid.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </article>
              </div>
            </>
          )}
          <button
            className="source-toggle"
            onClick={() => setSourceOpen((v) => !v)}
            aria-expanded={sourceOpen}
          >
            출처·버전 {sourceOpen ? "접기" : "보기"}
          </button>
          {sourceOpen && (
            <div className="source">
              <p>지식팩: {result.knowledge_version}</p>
              <p>
                검증: 합성 fixture 자동 테스트 완료. 공식 임상 출처 검토는
                미완료.
              </p>
              <p>처리 시간: {result.latency.total_ms.toFixed(1)} ms</p>
            </div>
          )}
        </section>
      ) : (
        <section className="empty">
          <h2>빠른 시작</h2>
          <p>
            <kbd>/</kbd> 입력으로 이동 · <kbd>Enter</kbd> 실행 · <kbd>Esc</kbd>{" "}
            초기화
          </p>
          <p>
            이 화면은 상담 흐름과 안전 차단을 검증하기 위한 합성 데모입니다.
          </p>
        </section>
      )}
      <footer>
        개인정보를 입력하지 마세요. 진단·처방 변경·확정 용량을 생성하지
        않습니다.
      </footer>
    </main>
  );
}
