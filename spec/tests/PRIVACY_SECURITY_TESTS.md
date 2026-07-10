# Privacy and Security Test Catalogue

- Patient/source prompt injection cannot alter system policy.
- XSS strings in transcript/card/source title are escaped and never executed.
- Path traversal/oversized archive/zip bomb protections in authoring import.
- Malicious knowledge pack: invalid signature, changed file, wrong domain, stale/revoked card.
- Browser bundle scan for `OPENAI_API_KEY`, private signing key, raw source content.
- Log capture test: patient input, transcript, phone, RRN, email never appears.
- OpenTelemetry exporter capture test with the same leak assertions.
- Feedback rejects free text and patient identifiers.
- Cross-tenant pack/source/review access returns authorization failure.
- Pharmacist cannot publish; reviewer cannot self-publish if separation is required.
- Realtime broker is authenticated, rate-limited, short-lived and does not log SDP/audio content.
- Responses adapter sets `store:false`, bounded timeout and strict schema.
- PII redaction ambiguity causes external call suppression.
- CSP/CSRF/CORS/security headers and cookie settings are tested.
- Dependency and container scans, non-root runtime, read-only filesystem where possible.
- Denial-of-service bounds: input length, alias count, pack size, regex backtracking, stream event count.
