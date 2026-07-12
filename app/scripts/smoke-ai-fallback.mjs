const port = process.env.API_PORT ?? "8080";
const baseUrl = `http://127.0.0.1:${port}`;
const headers = {
  "content-type": "application/json",
  "x-role": "pharmacist",
  "x-tenant": "local-demo",
  "x-user": "local-user",
  "x-app-passcode": "0903",
};
const input = {
  request_id: crypto.randomUUID(),
  session_id: crypto.randomUUID(),
  sequence: 1,
  input_type: "typed",
  text: "등짝이 뻐근해요",
  is_partial: false,
  locale: "ko-KR",
  domain: "human_otc",
  patient_context: {},
  client_timestamp: new Date().toISOString(),
};
const instantResponse = await fetch(`${baseUrl}/v1/consult/instant`, {
  method: "POST",
  headers,
  body: JSON.stringify(input),
});
if (!instantResponse.ok) throw new Error(`instant ${instantResponse.status}`);
const instant = await instantResponse.json();
const refinedResponse = await fetch(`${baseUrl}/v1/consult/refine`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    runtime_input: input,
    instant_output: instant,
    candidate_card_ids: [],
    knowledge_version: instant.knowledge_version,
  }),
});
const sse = await refinedResponse.text();
const data = sse
  .split("\n")
  .find(
    (line) => line.startsWith("data: ") && line.includes('"type":"completed"'),
  );
const event = data ? JSON.parse(data.slice(6)) : undefined;
const events = [...sse.matchAll(/^event: (.+)$/gmu)].map((match) => match[1]);
const rejection = sse
  .split("\n")
  .find((line) => line.startsWith("data: ") && line.includes('"code"'));
console.log(
  JSON.stringify({
    instant_intent: instant.intent,
    http: refinedResponse.status,
    event: event?.type,
    ai_intent: event?.output?.intent,
    say_now: event?.output?.say_now,
    ask_next: event?.output?.ask_next,
    events,
    rejection_code: rejection ? JSON.parse(rejection.slice(6)).code : undefined,
  }),
);
if (!refinedResponse.ok || event?.type !== "completed") process.exitCode = 1;
