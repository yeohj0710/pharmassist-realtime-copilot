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
