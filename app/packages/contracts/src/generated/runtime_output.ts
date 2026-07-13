/* Generated from runtime_output.schema.json. Do not edit. */

export type RecommendationDecision = {
  [k: string]: unknown;
} & {
  decision_id: string;
  status: "recommend" | "ask" | "refer" | "insufficient";
  pack_id: string;
  protocol_id: string | null;
  intent: string | null;
  tenant_inventory_connected: boolean;
  /**
   * @maxItems 3
   */
  ingredient_options:
    | []
    | [
        {
          option_id: string;
          ingredient_id: string;
          ingredient_name: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          clinical_score: number;
          safety_score: number;
        }
      ]
    | [
        {
          option_id: string;
          ingredient_id: string;
          ingredient_name: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          clinical_score: number;
          safety_score: number;
        },
        {
          option_id: string;
          ingredient_id: string;
          ingredient_name: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          clinical_score: number;
          safety_score: number;
        }
      ]
    | [
        {
          option_id: string;
          ingredient_id: string;
          ingredient_name: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          clinical_score: number;
          safety_score: number;
        },
        {
          option_id: string;
          ingredient_id: string;
          ingredient_name: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          clinical_score: number;
          safety_score: number;
        },
        {
          option_id: string;
          ingredient_id: string;
          ingredient_name: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          clinical_score: number;
          safety_score: number;
        }
      ];
  /**
   * @maxItems 5
   */
  product_candidates:
    | []
    | [
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        }
      ]
    | [
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        },
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        }
      ]
    | [
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        },
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        },
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        }
      ]
    | [
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        },
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        },
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        },
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        }
      ]
    | [
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        },
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        },
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        },
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        },
        {
          product_id: string;
          display_name: string;
          ingredient_id: string;
          /**
           * @minItems 1
           */
          claim_ids: [string, ...string[]];
          /**
           * @minItems 1
           */
          source_refs: [
            {
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            },
            ...{
              claim_id: string;
              source_id: string;
              source_snapshot_id: string;
              locator: string;
              verified_at: string;
            }[]
          ];
          formulary_active: boolean;
          inventory_status: "in_stock" | "out_of_stock" | "not_connected" | "unknown";
          available_quantity: number | null;
          sales_rank: number | null;
        }
      ];
  question: {
    question: string;
    reason: string;
    slot: string;
  } | null;
  referral: {
    urgency: "emergency" | "same_day" | "doctor" | "pharmacist_review";
    reason: string;
    action: string;
  } | null;
  source_refs: {
    claim_id: string;
    source_id: string;
    source_snapshot_id: string;
    locator: string;
    verified_at: string;
  }[];
  /**
   * @minItems 1
   */
  reason_codes: [string, ...string[]];
};

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
   * @maxItems 1
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
    source_snapshot_id: string;
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
  decision: RecommendationDecision;
}
