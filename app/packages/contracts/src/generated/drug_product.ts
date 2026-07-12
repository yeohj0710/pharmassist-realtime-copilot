/* Generated from drug_product.schema.json. Do not edit. */

export interface DrugProduct {
  product_id: string;
  display_name: string;
  manufacturer?: string | null;
  jurisdiction: "KR";
  product_code?: string | null;
  /**
   * @minItems 1
   */
  active_ingredients: [
    {
      ingredient_id: string;
      name: string;
      strength_text: string;
      normalized_amount?: number | null;
      normalized_unit?: string | null;
    },
    ...{
      ingredient_id: string;
      name: string;
      strength_text: string;
      normalized_amount?: number | null;
      normalized_unit?: string | null;
    }[]
  ];
  dosage_form?: string | null;
  route?: string | null;
  label_source: {
    source_id: string;
    retrieved_at: string;
    sha256: string;
  };
  status: "active" | "discontinued" | "withdrawn" | "unknown";
  dur_flags?: {
    type: "duplicate" | "age" | "pregnancy" | "coadministration" | "elderly" | "dose" | "duration" | "other";
    code: string;
    description: string;
    effective_date?: string | null;
  }[];
}
