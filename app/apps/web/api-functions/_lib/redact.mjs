// PII gates ported from @pharmassist/normalizer redactPii, shared by every
// function that sends customer wording upstream so the two paths cannot drift:
// resident numbers, payment numbers, and explicit name prompts fail closed;
// phone, email, and address spans are masked before any text leaves.
const phonePattern =
  /(?<!\d)(?:01[016789][ -]?\d{3,4}[ -]?\d{4}|0\d{1,2}[ -]?\d{3,4}[ -]?\d{4})(?!\d)/gu;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const rrnPattern = /(?<!\d)\d{6}[ -]?[1-8]\d{6}(?!\d)/gu;
const paymentPattern = /(?<!\d)(?:\d[ -]?){15,19}(?!\d)/gu;
const addressPattern =
  /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\s,]{0,12}(?:로|길|동)\s?\d{1,4}(?:-\d{1,4})?/gu;
const namePromptPattern = /성함|환자명/u;

/** Returns null when the text must not leave at all. */
export const redactForModel = (text) => {
  if (rrnPattern.test(text) || paymentPattern.test(text)) return null;
  rrnPattern.lastIndex = 0;
  paymentPattern.lastIndex = 0;
  if (namePromptPattern.test(text)) return null;
  return text
    .replace(phonePattern, "[REDACTED_PHONE]")
    .replace(emailPattern, "[REDACTED_EMAIL]")
    .replace(addressPattern, "[REDACTED_ADDRESS]");
};
