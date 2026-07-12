// Contract sketch only. Verify current official OpenAI SDK/API during implementation.
import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";

export interface ApprovedClaimContext {
  readonly claimId: string;
  readonly safeSummary: string;
  readonly structuredValue: unknown;
  readonly sourceRef: Readonly<{sourceId: string; locator: string; verifiedAt: string}>;
}

export interface RefinementRequest {
  readonly input: RuntimeInput;
  readonly instant: RuntimeOutput;
  readonly allowedCardIds: readonly string[];
  readonly allowedClaims: readonly ApprovedClaimContext[];
  readonly redactedMinimalText?: string;
  readonly currentSequence: number;
}

export type RefinementEvent =
  | {readonly type: "started"; readonly sequence: number}
  | {readonly type: "candidate"; readonly output: RuntimeOutput}
  | {readonly type: "rejected"; readonly code: string}
  | {readonly type: "completed"; readonly output: RuntimeOutput};

export interface ResponsesRefiner {
  refine(request: RefinementRequest, signal: AbortSignal): AsyncIterable<RefinementEvent>;
}

export interface RealtimeTranscriptionBroker {
  createBrowserSession(input: {
    readonly pharmacistPseudonym: string;
    readonly language: "ko";
    readonly approvedVocabulary: readonly string[];
    readonly clientSdp: string;
  }): Promise<{readonly answerSdp: string; readonly expiresAt: string}>;
}

// Invariants are enforced outside the provider:
// 1) store:false, strict RuntimeOutput schema, timeout, no persistent conversation.
// 2) output claim/source allowlist subset, safety monotonicity, number/entity gate.
// 3) stale sequence rejected and instant result retained on every failure.
