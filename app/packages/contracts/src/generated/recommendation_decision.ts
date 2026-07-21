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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
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
          manufacturer?: string | null;
          specification?: string;
          displayed_price_krw?: number | null;
          price_recorded_at?: string | null;
          image_url?: string | null;
          image_source_url?: string | null;
          image_rights_status?: string | null;
          image_kind?: string | null;
          image_checked_at?: string | null;
          official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
          official_source_url?: string | null;
          indication_summary?: string;
          dosage_summary?: string;
          precaution_summary?: string;
          dosage_form?: string | null;
          route?: string | null;
          clinical_group_key?: string;
          same_group_product_count?: number;
          selection_guidance?: {
            choose_when: string;
            /**
             * @minItems 1
             */
            differentiators: [string, ...string[]];
            comparison_note: string;
            practical_points: string[];
            evidence_source: string;
          };
        }
      ];
  /**
   * @maxItems 2
   */
  combination_candidates?:
    | []
    | [
        {
          primary_product_id: string;
          primary_product_name: string;
          supportive_product_id: string;
          supportive_product_name: string;
          /**
           * @minItems 1
           */
          primary_mechanisms: [string, ...string[]];
          /**
           * @minItems 1
           */
          supportive_mechanisms: [string, ...string[]];
          rationale: string;
        }
      ]
    | [
        {
          primary_product_id: string;
          primary_product_name: string;
          supportive_product_id: string;
          supportive_product_name: string;
          /**
           * @minItems 1
           */
          primary_mechanisms: [string, ...string[]];
          /**
           * @minItems 1
           */
          supportive_mechanisms: [string, ...string[]];
          rationale: string;
        },
        {
          primary_product_id: string;
          primary_product_name: string;
          supportive_product_id: string;
          supportive_product_name: string;
          /**
           * @minItems 1
           */
          primary_mechanisms: [string, ...string[]];
          /**
           * @minItems 1
           */
          supportive_mechanisms: [string, ...string[]];
          rationale: string;
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
