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
  /**
   * @maxItems 8
   */
  topics:
    | []
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        }
      ]
    | [
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        },
        {
          protocol_id: string;
          intent: string;
          symptom_category: string;
          answered_slots: {
            [k: string]: unknown;
          };
          asked_slots: string[];
          pending_question_slot: string | null;
          pending_question: null | {
            question: string;
            reason: string;
            slot: string;
          };
          last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
          updated_at: string;
        }
      ];
  active_protocol_id: string | null;
  active_intent: string | null;
  last_decision_status: "recommend" | "ask" | "refer" | "insufficient" | null;
  updated_at: string;
  pending_question_slot: string | null;
}
