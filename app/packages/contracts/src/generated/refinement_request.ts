/* Generated from refinement_request.schema.json. Do not edit. */

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

export interface RefinementRequestEnvelope {
  runtime_input: RuntimeInput;
  instant_output: RuntimeOutput;
  /**
   * @maxItems 3
   */
  candidate_card_ids: [] | [string] | [string, string] | [string, string, string];
  /**
   * @maxItems 12
   */
  conversation_history?:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string, string];
  knowledge_version: string;
}
export interface RuntimeInput {
  request_id: string;
  session_id: string;
  sequence: number;
  input_type: "typed" | "voice_partial" | "voice_final" | "card_action";
  text: string;
  intent_hint?: string;
  is_partial: boolean;
  locale: "ko-KR";
  domain: "human_otc" | "prescription_counseling" | "supplement" | "animal_medicine";
  patient_context: {
    age_years?: number | null;
    weight_kg?: number | null;
    sex_at_birth?: "female" | "male" | "intersex" | "unknown" | null;
    pregnancy_status?: "not_pregnant" | "pregnant" | "possible" | "postpartum" | "unknown" | null;
    gestational_weeks?: number | null;
    lactating?: boolean | null;
    symptom_duration_text?: string | null;
    allergies?: string[];
    current_medications?: string[];
    conditions?: string[];
    product_name?: string | null;
    product_concentration?: string | null;
  };
  asr?: {
    confidence?: number | null;
    alternatives?: string[];
    stable_prefix_chars?: number;
  } | null;
  client_timestamp: string;
}
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
  /**
   * @maxItems 8
   */
  topic_results:
    | []
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          decision: RecommendationDecision;
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
        }
      ];
}
