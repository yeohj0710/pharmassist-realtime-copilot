/* Generated from drug_product.schema.json. Do not edit. */

export interface DrugProduct {
  product_id: string;
  display_name: string;
  manufacturer?: string | null;
  jurisdiction: "KR";
  item_seq: string;
  permit_number?: string | null;
  product_code?: string | null;
  otc_status: "otc" | "prescription" | "unknown";
  dosage_form?: string | null;
  route?: string | null;
  permit_status?: string | null;
  supply_performance?: boolean;
  active_ingredients?: {
    ingredient_id: string;
    name: string;
    strength_text: string;
    normalized_amount?: number | null;
    normalized_unit?: string | null;
  }[];
  official_match_status?: "confirmed" | "review_required" | "not_found" | "not_applicable";
  official_product_key?: string;
  official_source_url?: string;
  retail_offer?: {
    sku_id: string;
    display_name: string;
    specification: string;
    displayed_price_krw: number;
    recorded_at: string;
    price_status: string;
    image_url?: string | null;
    image_source_url?: string | null;
    image_rights_status?: string | null;
    image_kind?: string | null;
    image_checked_at?: string | null;
  };
  protocol_ids?: string[];
  pathway_profiles?: {
    protocol_id: string;
    /**
     * @minItems 1
     */
    mechanisms: [string, ...string[]];
    combination_role: "primary" | "supportive";
    compatible_roles: string[];
    score: number;
    source: string;
  }[];
  selection_profiles?: {
    protocol_id: string;
    fit_score: number;
    choose_when: string;
    /**
     * @minItems 1
     */
    differentiators: [string, ...string[]];
    comparison_note: string;
    practical_points: string[];
    evidence_source: string;
  }[];
  clinical_group_key?: string;
  indication_summary?: string;
  dosage_summary?: string;
  precaution_summary?: string;
  medication_guide?: string;
  classification_code?: string;
  atc_code?: string;
  kpic_atc?: string;
  storage?: string;
  valid_term?: string;
  insurance?: string;
  interactions?: string[];
  same_ingredient_products?: string[];
  permit_cancelled?: boolean;
  status: "active" | "discontinued" | "withdrawn" | "blocked" | "unknown";
  /**
   * @minItems 1
   */
  source_snapshot_ids: [string, ...string[]];
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
  dur_flags?: {
    type: "duplicate" | "age" | "pregnancy" | "coadministration" | "elderly" | "dose" | "duration" | "split" | "other";
    code: string;
    description: string;
    effective_date?: string | null;
    blocking?: boolean;
  }[];
}
