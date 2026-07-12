/* Generated from runtime_output.schema.json. Do not edit. */

export interface RuntimeOutput {
  request_id: string;
  session_id: string;
  sequence: number;
  mode: "instant" | "refined" | "escalate" | "clarify" | "no_match";
  status: "provisional" | "stable" | "blocked" | "final";
  intent: string | null;
  /**
   * @maxItems 3
   */
  say_now: [] | [string] | [string, string] | [string, string, string];
  /**
   * @maxItems 3
   */
  ask_next:
    | []
    | [
        {
          question: string;
          reason: string;
          priority: number;
          slot: string;
        }
      ]
    | [
        {
          question: string;
          reason: string;
          priority: number;
          slot: string;
        },
        {
          question: string;
          reason: string;
          priority: number;
          slot: string;
        }
      ]
    | [
        {
          question: string;
          reason: string;
          priority: number;
          slot: string;
        },
        {
          question: string;
          reason: string;
          priority: number;
          slot: string;
        },
        {
          question: string;
          reason: string;
          priority: number;
          slot: string;
        }
      ];
  red_flags: {
    flag_id: string;
    label: string;
    action: "emergency" | "same_day" | "doctor" | "stop_and_verify";
    matched: boolean;
    negated?: boolean;
  }[];
  actions: {
    type: string;
    text: string;
    requires_confirmation: boolean;
  }[];
  avoid: string[];
  missing_slots: string[];
  confidence: number;
  /**
   * @maxItems 3
   */
  candidate_intents?:
    | []
    | [
        {
          intent: string;
          score: number;
        }
      ]
    | [
        {
          intent: string;
          score: number;
        },
        {
          intent: string;
          score: number;
        }
      ]
    | [
        {
          intent: string;
          score: number;
        },
        {
          intent: string;
          score: number;
        },
        {
          intent: string;
          score: number;
        }
      ];
  source_refs: {
    claim_id: string;
    source_id: string;
    locator: string;
    verified_at: string;
  }[];
  latency: {
    total_ms: number;
    normalize_ms: number;
    safety_ms: number;
    retrieve_ms: number;
    refine_ms: number;
  };
  knowledge_version: string;
  model?: string | null;
  generated_at: string;
  stale_response_dropped?: boolean;
}
