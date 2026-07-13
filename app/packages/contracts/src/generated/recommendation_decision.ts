/* Generated from recommendation_decision.schema.json. Do not edit. */

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
