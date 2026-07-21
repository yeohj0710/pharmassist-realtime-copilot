// Vercel serverless readiness probe for the static research-preview deploy.
// Mirrors the API contract the web client checks: components.openai_responses
// is "ready" only when an OpenAI key is configured and the feature is on.
export default function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const ready =
    Boolean(process.env["OPENAI_API_KEY"]) &&
    process.env["FEATURE_AI_INTERPRETATION"] !== "false";
  response.status(200).json({
    status: "ok",
    components: { openai_responses: ready ? "ready" : "degraded" },
  });
}
