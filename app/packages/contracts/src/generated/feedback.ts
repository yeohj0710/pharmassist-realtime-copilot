/* Generated from feedback.schema.json. Do not edit. */

export interface Feedback {
  session_id: string;
  sequence: number;
  card_id: string;
  outcome: "accepted" | "edited" | "rejected" | "escalated";
  /**
   * @minItems 1
   * @maxItems 5
   */
  reason_codes:
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string];
  knowledge_version: string;
  latency_bucket: "0-50" | "50-100" | "100-250" | "250-500" | "500+";
}
