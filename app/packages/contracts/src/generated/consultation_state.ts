/* Generated from consultation_state.schema.json. Do not edit. */

export interface ConsultationState {
  session_id: string;
  tenant_id: string;
  sequence: number;
  pack_id: string;
  answered_slots: {
    [k: string]: unknown;
  };
  asked_slots: string[];
  active_protocol_id: string | null;
  active_intent: string | null;
  last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
  updated_at: string;
  pending_question_slot: string | null;
}
