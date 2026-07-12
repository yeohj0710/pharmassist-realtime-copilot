/* Generated from consultation_card.schema.json. Do not edit. */

export interface ConsultationCard {
  card_id: string;
  version: string;
  status: "draft" | "review" | "published" | "stale" | "retired";
  domain: "human_otc" | "prescription_counseling" | "supplement" | "animal_medicine";
  intent: string;
  display_title?: string;
  triggers: {
    exact: string[];
    synonyms: string[];
    phonetic?: string[];
    negative: string[];
  };
  required_slots: {
    slot: string;
    when: string;
    blocking: boolean;
    question: string;
    validation?: string | null;
  }[];
  red_flags: {
    flag_id: string;
    patterns: string[];
    negation_aware: boolean;
    action: "emergency" | "same_day" | "doctor" | "stop_and_verify";
    say: string;
  }[];
  /**
   * @minItems 1
   * @maxItems 3
   */
  say_now: [string] | [string, string] | [string, string, string];
  /**
   * @maxItems 5
   */
  ask_next:
    | []
    | [
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        }
      ]
    | [
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        },
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        }
      ]
    | [
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        },
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        },
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        }
      ]
    | [
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        },
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        },
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        },
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        }
      ]
    | [
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        },
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        },
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        },
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        },
        {
          priority: number;
          question: string;
          reason: string;
          slot: string;
        }
      ];
  actions: {
    type: "self_care" | "ingredient_category" | "administration" | "monitor" | "refer" | "verify_product";
    text: string;
    claim_ids: string[];
  }[];
  avoid: string[];
  /**
   * @minItems 1
   */
  source_refs: [
    {
      claim_id: string;
      source_id: string;
      locator: string;
      trust_tier: "A" | "B";
    },
    ...{
      claim_id: string;
      source_id: string;
      locator: string;
      trust_tier: "A" | "B";
    }[]
  ];
  review: {
    pharmacist_approved: boolean;
    medical_safety_approved: boolean;
    reviewer_ids?: string[];
    approved_at: string;
    expires_at: string;
    notes?: string;
  };
  ui?: {
    priority?: number;
    color_token?: string;
    hotkey?: string | null;
  };
}
