/* Generated from runtime_input.schema.json. Do not edit. */

export interface RuntimeInput {
  request_id: string;
  session_id: string;
  sequence: number;
  input_type: "typed" | "voice_partial" | "voice_final" | "card_action";
  text: string;
  intent_hint?: string;
  answers_pending_slot?: string;
  /**
   * Pack-defined select-rule id the interpreter chose as the meaning of the customer's answer to the pending question. The engine honors it only when it names a select rule of the open question's field in the active protocol.
   */
  answered_option_key?: string;
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
