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

const decisionLabel: Readonly<
  Record<RuntimeOutput["decision"]["status"], string>
> = {
  recommend: "검증된 후보",
  ask: "한 가지 확인",
  refer: "직접 평가 우선",
  insufficient: "근거 부족",
};

const inventoryLabel = (
  value: RuntimeOutput["decision"]["product_candidates"][number]["inventory_status"],
): string =>
  value === "in_stock"
    ? "재고 있음"
    : value === "out_of_stock"
      ? "재고 없음"
      : value === "not_connected"
        ? "재고 미연결"
        : "재고 확인 필요";

const isSyntheticDecision = (decision: RuntimeOutput["decision"]): boolean =>
  decision.ingredient_options.some((item) =>
    /^(검토용|합성|synthetic)/iu.test(item.ingredient_name),
  ) ||
  decision.product_candidates.some((item) =>
    /^(검토용|합성|synthetic)/iu.test(item.display_name),
  );

interface ConsultationPresentation {
  readonly title: string;
  readonly direction: string;
  readonly fallbackOptions: readonly string[];
  readonly checks: readonly string[];
}

const consultationPresentation = (
  intent: string | null,
): ConsultationPresentation => {
  if (intent?.includes("cough"))
    return {
      title: "일반 기침 상담 경로",
      direction: "기침 양상에 맞는 완화 성분군을 우선 검토하세요.",
      fallbackOptions: [
        "마른기침: 진해 성분군",
        "가래기침: 거담·점액용해 성분군",
        "양상이 불분명하면 단일 성분·짧은 기간 우선",
      ],
      checks: [
        "호흡곤란·흉통·고열 등 새 위험 신호",
        "복용 중인 약과 기저질환",
        "연령·임신 여부와 증상 지속 기간",
      ],
    };
  if (intent?.includes("abdominal"))
    return {
      title: "복통 완화 상담 경로",
      direction:
        "위험 신호가 없다면 통증 위치와 양상에 맞춰 위장 증상 완화 성분군을 우선 검토하세요.",
      fallbackOptions: [
        "쓰림·신물: 제산·위산 관련 완화 성분군",
        "더부룩함·가스: 가스 완화·소화 보조 성분군",
        "양상이 불분명하면 복합제보다 단일 성분·짧은 기간 우선",
      ],
      checks: [
        "갑자기 심해지는 통증·오른쪽 아랫배 통증",
        "발열·구토·혈변 또는 검은 변",
        "임신 가능성·복용 중인 약과 기저질환",
      ],
    };
  if (intent?.includes("bowel") || intent?.includes("diarrhea"))
    return {
      title: "배변 증상 상담 경로",
      direction: "설사·변비 양상과 탈수 위험을 구분해 성분군을 검토하세요.",
      fallbackOptions: [
        "묽은 변: 수분·전해질 보충 우선, 필요 시 지사 성분군 검토",
        "변비: 삼투성·팽창성 완화 성분군 검토",
        "양상이 불분명하면 수분 보충과 짧은 경과 관찰 우선",
      ],
      checks: ["혈변·심한 복통·발열", "수분 섭취와 배변 횟수", "최근 복용약"],
    };
  if (intent?.includes("musculoskeletal"))
    return {
      title: "근골격 통증 상담 경로",
      direction:
        "손상 여부와 통증 범위를 확인한 뒤 국소·경구 완화 방안을 검토하세요.",
      fallbackOptions: [
        "국소 통증: 외용 진통·소염 성분군 우선 검토",
        "넓거나 지속되는 통증: 병력·병용약 확인 후 경구 성분 검토",
      ],
      checks: ["외상·부종·열감", "움직임 제한", "진통제 복용 이력"],
    };
  return {
    title: "일반 증상 상담 경로",
    direction: "확인된 증상과 안전 기준에 맞는 일반의약품 성분군을 검토하세요.",
    fallbackOptions: [
      "가장 불편한 증상 하나를 기준으로 단일 성분 우선",
      "최소 용량·짧은 사용 기간으로 시작",
    ],
    checks: [
      "새로 생긴 위험 신호",
      "복용 중인 약과 기저질환",
      "증상 지속 기간",
    ],
  };
};

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
  const [microphones, setMicrophones] = useState<readonly MediaDeviceInfo[]>(
    [],
  );
  const [microphoneId, setMicrophoneId] = useState("");
  const [confirmedCritical, setConfirmedCritical] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [aiInterpreting, setAiInterpreting] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingWorkerInputsRef = useRef<RuntimeInput[]>([]);
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    setEngineError("");
    setProcessing(true);
    if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
    processingTimerRef.current = setTimeout(() => {
      setProcessing(false);
      setEngineError(
        "상담 엔진 응답이 지연되고 있어요. 잠시 후 다시 입력해 주세요.",
      );
    }, 8_000);
    applySession({ type: "INPUT", sequence: sequenceRef.current });
    const input = newInput(
      normalized,
      sequenceRef.current,
      sessionIdRef.current,
      inputType,
    );
    inputsRef.current.set(input.sequence, input);
    if (workerRef.current) workerRef.current.postMessage(input);
    else pendingWorkerInputsRef.current.push(input);
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
  const patientSummary = buildPatientSummary(history);
  const syntheticDecision = result
    ? isSyntheticDecision(result.decision)
    : false;
  const presentation = result
    ? consultationPresentation(result.decision.intent)
    : null;
  const guidedDecision = Boolean(
    result &&
    !critical &&
    ((syntheticDecision && result.decision.status === "recommend") ||
      (result.decision.status === "insufficient" && result.decision.intent)),
  );
  const visibleLines = result
    ? guidedDecision
      ? presentation
        ? [`${presentation.title}로 분류했습니다. ${presentation.direction}`]
        : ["증상 분류와 안전 확인을 마쳤습니다."]
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
          <p className="eyebrow">약사를 위한 실시간 상담 지원</p>
          <h1>약국 상담 도우미</h1>
        </div>
        <div className="header-actions">
          <span className={`badge ${online ? "online" : "offline"}`}>
            {!online
              ? "오프라인 · 로컬 사용 가능"
              : aiInterpreting
                ? "AI 해석 중"
                : aiReady
                  ? "AI 연결됨"
                  : "AI 연결 확인 중"}
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
            <small>안전 기준과 상담 프로토콜을 로컬에서 적용하고 있어요.</small>
          </span>
        </section>
      )}
      {engineError && (
        <p className="engine-error" role="alert">
          {engineError}
        </p>
      )}
      {result ? (
        <div className="consult-layout">
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
                <article className="primary-guidance">
                  <p className="result-kicker">지금 말할 내용</p>
                  {visibleLines.map((line, index) => (
                    <p
                      className={index < result.say_now.length ? "say" : "ask"}
                      key={line}
                    >
                      {line}
                    </p>
                  ))}
                </article>
                <section
                  className={`decision-summary decision-${result.decision.status}`}
                  aria-label="OTC 결정 결과"
                >
                  <div className="decision-heading">
                    <div>
                      <p>결정 상태</p>
                      <strong>
                        {guidedDecision
                          ? "참고 추천"
                          : decisionLabel[result.decision.status]}
                      </strong>
                    </div>
                    <code>{result.decision.decision_id}</code>
                  </div>
                  {guidedDecision && (
                    <div className="decision-block synthetic-decision-notice">
                      <h2>상담 결과</h2>
                      <strong className="consultation-result-title">
                        {presentation?.title}
                      </strong>
                      <p>{presentation?.direction}</p>
                      <h3>우선 검토할 성분군</h3>
                      <ul className="consultation-checks">
                        {presentation?.fallbackOptions.map((option) => (
                          <li key={option}>{option}</li>
                        ))}
                      </ul>
                      <h3>약사 확인사항</h3>
                      <ul className="consultation-checks">
                        {presentation?.checks.map((check) => (
                          <li key={check}>{check}</li>
                        ))}
                      </ul>
                      <small>
                        현재 근거의 신뢰도가 낮거나 합성 데이터인 경우 참고
                        추천으로 표시됩니다. 구체 제품은 약사가 환자 상태와
                        재고를 확인해 선택하세요.
                      </small>
                    </div>
                  )}
                  {!syntheticDecision &&
                    result.decision.ingredient_options.length > 0 && (
                      <div className="decision-block">
                        <h2>검증된 성분 선택지</h2>
                        <ul className="ingredient-options">
                          {result.decision.ingredient_options.map((option) => (
                            <li key={option.option_id}>
                              <strong>{option.ingredient_name}</strong>
                              <span>
                                임상 {Math.round(option.clinical_score * 100)} ·
                                안전 {Math.round(option.safety_score * 100)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  {!syntheticDecision &&
                    result.decision.product_candidates.length > 0 && (
                      <div className="decision-block">
                        <h2>약국 제품 후보</h2>
                        <div className="product-candidates">
                          {result.decision.product_candidates.map((product) => (
                            <article key={product.product_id}>
                              <strong>{product.display_name}</strong>
                              <span>
                                {inventoryLabel(product.inventory_status)}
                              </span>
                              <small>
                                {product.available_quantity === null
                                  ? "수량 미연결"
                                  : `가용 ${product.available_quantity}`}
                                {product.sales_rank === null
                                  ? ""
                                  : ` · 90일 판매순위 ${product.sales_rank}`}
                              </small>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  {result.decision.status === "ask" &&
                    result.decision.question && (
                      <div className="decision-block decision-question">
                        <h2>선택을 바꾸는 질문</h2>
                        <p>{result.decision.question.question}</p>
                        <small>{result.decision.question.reason}</small>
                      </div>
                    )}
                  {result.decision.status === "refer" &&
                    result.decision.referral && (
                      <div className="decision-block decision-referral">
                        <h2>제품 없이 전환</h2>
                        <p>{result.decision.referral.reason}</p>
                        <small>{result.decision.referral.action}</small>
                      </div>
                    )}
                </section>
                <details className="supporting-details">
                  <summary>근거·주의사항</summary>
                  <div className="supporting-content">
                    {result.avoid.map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                    {result.decision.source_refs.length > 0 && (
                      <div className="evidence-refs">
                        <strong>검증 근거</strong>
                        {result.decision.source_refs.slice(0, 8).map((ref) => (
                          <code
                            key={`${ref.claim_id}:${ref.source_snapshot_id}:${ref.locator}`}
                          >
                            {ref.claim_id} · {ref.source_snapshot_id} ·{" "}
                            {ref.locator}
                          </code>
                        ))}
                      </div>
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
