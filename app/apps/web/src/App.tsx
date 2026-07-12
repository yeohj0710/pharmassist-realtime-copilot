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
  const [accessGranted, setAccessGranted] = useState(
    sessionStorage.getItem("pharmassist_access") === "0903",
  );
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<readonly string[]>([]);
  const [result, setResult] = useState<RuntimeOutput>();
  const [online, setOnline] = useState(navigator.onLine);
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [microphones, setMicrophones] = useState<readonly MediaDeviceInfo[]>([]);
  const [microphoneId, setMicrophoneId] = useState("");
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
    setResult(undefined);
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
        const localOutput = event.data.output;
        const commitOutput = (output: RuntimeOutput) => {
          setResult(output);
          const nextHistory = upsertAssistantTurn(
            historyRef.current,
            output.sequence,
            outputText(output),
          );
          historyRef.current = nextHistory;
          setHistory(nextHistory);
        };
        if (shouldRequestAiRefinement(navigator.onLine, localOutput.mode)) {
          const input = inputsRef.current.get(event.data.output.sequence);
          if (input) {
            aiAbortRef.current?.abort();
            const controller = new AbortController();
            aiAbortRef.current = controller;
            setAiInterpreting(true);
            void requestAiFallback(
              input,
              localOutput,
              historyRef.current,
              controller.signal,
            )
              .then((refined) => {
                if (
                  refined?.sequence === sequenceRef.current &&
                  refined.session_id === sessionIdRef.current
                ) {
                  commitOutput(refined);
                } else if (localOutput.sequence === sequenceRef.current)
                  commitOutput(localOutput);
              })
              .catch(() => {
                if (localOutput.sequence === sequenceRef.current)
                  commitOutput(localOutput);
              })
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
      setVoiceMessage("");
      const brokerUrl = import.meta.env["VITE_REALTIME_BROKER_URL"] as
        string | undefined;
      if (brokerUrl) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: microphoneId
            ? { deviceId: { exact: microphoneId }, echoCancellation: true, noiseSuppression: true }
            : { echoCancellation: true, noiseSuppression: true },
        });
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
          (device) => device.kind === "audioinput",
        );
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
          const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
          recordedChunksRef.current = [];
          if (blob.size < 100) {
            setVoiceMessage("음성이 들리지 않았어요. 다시 말해주세요.");
            return;
          }
          setVoiceMessage("음성을 글자로 바꾸는 중이에요…");
          const endpoint = brokerUrl.replace("/v1/realtime/session", "/v1/audio/transcribe");
          void fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "audio/webm",
              "x-app-passcode": sessionStorage.getItem("pharmassist_access") ?? "",
            },
            body: blob,
          }).then(async (response) => {
            if (!response.ok) throw new Error(`TRANSCRIBE_${response.status}`);
            const body = await response.json() as { transcript?: string };
            if (!body.transcript) throw new Error("TRANSCRIPT_EMPTY");
            setQuery(body.transcript);
            submitText(body.transcript, "voice_final");
            setVoiceMessage("");
          }).catch((cause: unknown) => {
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
          if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
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
  const patientSummary = buildPatientSummary(history);

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
          <div className="login-logo" aria-hidden="true">P</div>
          <p className="login-eyebrow">PHARMASSIST</p>
          <h1 id="login-title">상담 도우미에 로그인</h1>
          <p className="login-copy">허용된 사용자만 상담 기능을 이용할 수 있어요.</p>
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
          {passcodeError && <p className="login-error" role="alert">비밀번호가 맞지 않아요.</p>}
          <button className="login-button" onClick={unlock}>로그인</button>
          <small>합성 데이터 데모 · 임상 사용 금지</small>
        </section>
      </main>
    );
  }

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
          onClick={() => (listening ? stopPtt() : void startPtt())}
          aria-pressed={listening}
          aria-label="누르는 동안 음성 입력"
        >
          {listening ? "● 듣는 중 · 눌러서 종료" : "🎙 말하기"}
        </button>
        {voiceMessage && (
          <p className="voice-message" role="status">{voiceMessage}</p>
        )}
        {microphones.length > 1 && (
          <label className="microphone-picker">
            마이크
            <select value={microphoneId} onChange={(event) => setMicrophoneId(event.target.value)}>
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
