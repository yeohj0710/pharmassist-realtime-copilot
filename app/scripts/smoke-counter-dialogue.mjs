const baseUrl = `http://127.0.0.1:${process.env.API_PORT ?? "8080"}`;
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
  sequence: 3,
  input_type: "typed",
  text: "아니 전자라고요",
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
const response = await fetch(`${baseUrl}/v1/consult/refine`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    runtime_input: input,
    instant_output: instant,
    candidate_card_ids: [],
    knowledge_version: instant.knowledge_version,
    conversation_history: [
      "환자: 배가 아파요.",
      "상담 도우미: 언제부터 아팠나요?",
      "환자: 오늘 아침부터고 열은 없어요.",
      "상담 도우미: 묽은 변이 나오는 쪽인가요, 마려운데 잘 안 나오는 쪽인가요?",
      "환자: 아니 전자라고요",
    ],
  }),
});
const sse = await response.text();
const completedLine = sse
  .split("\n")
  .find(
    (line) => line.startsWith("data: ") && line.includes('"type":"completed"'),
  );
const completed = completedLine
  ? JSON.parse(completedLine.slice(6))
  : undefined;
const spoken = [
  ...(completed?.output?.say_now ?? []),
  ...(completed?.output?.ask_next ?? []).map((item) => item.question),
].join(" ");
console.log(JSON.stringify({ status: response.status, spoken }));
if (
  !completed ||
  spoken.length > 180 ||
  /묽은 변이 나오는 쪽인가요|마려운데 잘 안 나오는 쪽인가요/u.test(spoken)
)
  process.exitCode = 1;
