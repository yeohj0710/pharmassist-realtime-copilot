/* Generated from error_envelope.schema.json. Do not edit. */

export interface ErrorEnvelope {
  error: {
    code:
      | "INVALID_INPUT"
      | "DOMAIN_DISABLED"
      | "KNOWLEDGE_STALE"
      | "CARD_REVOKED"
      | "MISSING_BLOCKING_SLOT"
      | "PRODUCT_AMBIGUOUS"
      | "UNSUPPORTED_CLAIM"
      | "MODEL_SCHEMA_INVALID"
      | "MODEL_TIMEOUT"
      | "REALTIME_UNAVAILABLE"
      | "STALE_SEQUENCE"
      | "RATE_LIMITED"
      | "PRIVACY_REDACTION_FAILED"
      | "FORBIDDEN"
      | "INTERNAL_SAFE_FAILURE";
    message: string;
    request_id: string;
    retryable: boolean;
    safe_fallback: "instant" | "typed_input" | "clarify_or_refer" | "previous_pack" | "none";
  };
}
