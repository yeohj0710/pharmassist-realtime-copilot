import { describe, expect, it } from "vitest";
import {
  buildApp,
  cardsForAiRefinement,
  shouldUseContextModel,
} from "./app.js";
import { syntheticPack } from "@pharmassist/test-fixtures";
import { MockResponsesRefiner } from "@pharmassist/openai-adapter";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
process.env["AUTH_MODE"] = "mock-local";
const input = {
  request_id: "9b1deb4d-3b7d-4ca4-9e2a-77d62f095349",
  session_id: "c5beed71-acde-4a33-8c5a-a33ffdd81f6d",
  sequence: 1,
  input_type: "typed",
  text: "숨이 안 쉬어져요",
  is_partial: false,
  locale: "ko-KR",
  domain: "human_otc",
  patient_context: {},
  client_timestamp: "2026-07-10T00:00:00Z",
};
describe("API", () => {
  it("routes only context-dependent short replies to the stronger model", () => {
    const dialogue = [
      { role: "user" as const, content: "배가 아파요" },
      { role: "assistant" as const, content: "설사인가요, 변비인가요?" },
      { role: "user" as const, content: "그건 아니고 앞에 거요" },
    ];
    expect(shouldUseContextModel(dialogue, null)).toBe(true);
    expect(shouldUseContextModel(dialogue, "abdominal_pain_general")).toBe(
      false,
    );
    expect(shouldUseContextModel([dialogue[0]!], null)).toBe(false);
    expect(
      shouldUseContextModel(
        [...dialogue.slice(0, -1), { role: "user", content: "가".repeat(31) }],
        null,
      ),
    ).toBe(false);
  });
  it("lets AI compare the full active domain catalog instead of the provisional local intent", () => {
    const cards = cardsForAiRefinement(syntheticPack.cards, "cough_general");
    expect(cards.map((card) => card.intent)).toContain("cough_general");
    expect(cards.map((card) => card.intent)).toContain(
      "abdominal_pain_general",
    );
  });
  it("serves deterministic no-store output", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/consult/instant",
      payload: input,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.json().mode).toBe("escalate");
    await app.close();
  });
  it("separates roles and degraded readiness", async () => {
    const app = await buildApp();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/admin/packs/build",
          headers: { "x-role": "pharmacist" },
          payload: { reason_code: "TEST" },
        })
      ).statusCode,
    ).toBe(403);
    expect((await app.inject("/v1/health/ready")).json().status).toBe(
      "degraded",
    );
    await app.close();
  });
  it("rejects free-text feedback and missing publisher reason", async () => {
    const app = await buildApp();
    const feedback = await app.inject({
      method: "POST",
      url: "/v1/feedback",
      payload: { transcript: "patient text" },
    });
    expect(feedback.statusCode).toBe(400);
    const publish = await app.inject({
      method: "POST",
      url: "/v1/admin/packs/v1/publish",
      headers: { "x-role": "publisher" },
      payload: {},
    });
    expect(publish.statusCode).toBe(400);
    await app.close();
  });
  it("serves immutable packs with ETag and typed realtime fallback", async () => {
    const app = await buildApp();
    const pack = await app.inject("/v1/knowledge/packs/0.1.0-synthetic-dev");
    expect(pack.statusCode).toBe(200);
    expect(pack.headers["cache-control"]).toContain("immutable");
    const cached = await app.inject({
      method: "GET",
      url: "/v1/knowledge/packs/0.1.0-synthetic-dev",
      headers: { "if-none-match": String(pack.headers["etag"]) },
    });
    expect(cached.statusCode).toBe(304);
    const realtime = await app.inject({
      method: "POST",
      url: "/v1/realtime/session",
      headers: { "content-type": "application/sdp" },
      payload: "v=0\r\no=offer",
    });
    expect(realtime.statusCode).toBe(503);
    expect(realtime.headers["cache-control"]).toBe("no-store");
    expect(realtime.json().error.safe_fallback).toBe("typed_input");
    await app.close();
  });
  it("keeps instant output when external refinement is disabled", async () => {
    const app = await buildApp();
    const instant = (
      await app.inject({
        method: "POST",
        url: "/v1/consult/instant",
        payload: input,
      })
    ).json();
    const response = await app.inject({
      method: "POST",
      url: "/v1/consult/refine",
      payload: {
        runtime_input: input,
        instant_output: instant,
        candidate_card_ids: [],
        knowledge_version: instant.knowledge_version,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toContain("MOCK_LOCAL_ONLY");
    expect(response.body).toContain('"fallback":"instant"');
    await app.close();
  });
  it("returns AI refinement events with CORS headers to the browser", async () => {
    const priorKey = process.env["OPENAI_API_KEY"];
    const priorFeature = process.env["FEATURE_LLM_REFINEMENT"];
    process.env["OPENAI_API_KEY"] = "test-only";
    process.env["FEATURE_LLM_REFINEMENT"] = "true";
    const app = await buildApp({
      responsesRefiner: new MockResponsesRefiner("success"),
    });
    try {
      const instant = (
        await app.inject({
          method: "POST",
          url: "/v1/consult/instant",
          payload: input,
        })
      ).json();
      const response = await app.inject({
        method: "POST",
        url: "/v1/consult/refine",
        headers: { origin: "http://127.0.0.1:4173" },
        payload: {
          runtime_input: input,
          instant_output: instant,
          candidate_card_ids: [],
          knowledge_version: instant.knowledge_version,
        },
      });
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://127.0.0.1:4173",
      );
      expect(response.body).toContain("refinement.completed");
    } finally {
      await app.close();
      if (priorKey === undefined) delete process.env["OPENAI_API_KEY"];
      else process.env["OPENAI_API_KEY"] = priorKey;
      if (priorFeature === undefined)
        delete process.env["FEATURE_LLM_REFINEMENT"];
      else process.env["FEATURE_LLM_REFINEMENT"] = priorFeature;
    }
  });
  it("redacts PII from prior conversation before external refinement", async () => {
    const priorKey = process.env["OPENAI_API_KEY"];
    const priorFeature = process.env["FEATURE_LLM_REFINEMENT"];
    process.env["OPENAI_API_KEY"] = "test-only";
    process.env["FEATURE_LLM_REFINEMENT"] = "true";
    let providerPrompt = "";
    const app = await buildApp({
      responsesRefiner: {
        async *refine(context) {
          providerPrompt = [
            context.promptDeveloper,
            context.promptDeveloperOverride ?? "",
            ...(context.conversation ?? []).map((turn) => turn.content),
          ].join("\n");
          yield { type: "started" as const, sequence: 1 };
        },
      },
    });
    try {
      const instant = (
        await app.inject({
          method: "POST",
          url: "/v1/consult/instant",
          payload: { ...input, text: "기침이 나요" },
        })
      ).json();
      const response = await app.inject({
        method: "POST",
        url: "/v1/consult/refine",
        payload: {
          runtime_input: { ...input, text: "기침이 나요" },
          instant_output: instant,
          candidate_card_ids: [],
          knowledge_version: instant.knowledge_version,
          conversation_history: [
            "환자: 제 번호는 010-1234-5678이에요",
            "환자: 기침이 나요",
          ],
        },
      });
      expect(response.body).toContain("refinement.started");
      expect(providerPrompt).not.toContain("010-1234-5678");
      expect(providerPrompt).toContain("[REDACTED_PHONE]");
    } finally {
      await app.close();
      if (priorKey === undefined) delete process.env["OPENAI_API_KEY"];
      else process.env["OPENAI_API_KEY"] = priorKey;
      if (priorFeature === undefined)
        delete process.env["FEATURE_LLM_REFINEMENT"];
      else process.env["FEATURE_LLM_REFINEMENT"] = priorFeature;
    }
  });
  it("passes every dialogue turn to the model with its real role", async () => {
    const priorKey = process.env["OPENAI_API_KEY"];
    const priorFeature = process.env["FEATURE_LLM_REFINEMENT"];
    process.env["OPENAI_API_KEY"] = "test-only";
    process.env["FEATURE_LLM_REFINEMENT"] = "true";
    let capturedConversation: readonly Readonly<{
      role: "user" | "assistant";
      content: string;
    }>[] = [];
    let capturedQuestionBudget = true;
    let capturedCounterPolicy = "";
    const app = await buildApp({
      responsesRefiner: {
        async *refine(context) {
          capturedConversation = context.conversation ?? [];
          capturedQuestionBudget = context.allowFollowUpQuestion ?? true;
          capturedCounterPolicy = `${context.promptSystem}\n${context.promptDeveloperOverride ?? ""}`;
          yield { type: "started" as const, sequence: 3 };
        },
      },
    });
    try {
      const ellipticalInput = {
        ...input,
        sequence: 3,
        text: "아니 전자라고요",
      };
      const instant = (
        await app.inject({
          method: "POST",
          url: "/v1/consult/instant",
          payload: ellipticalInput,
        })
      ).json();
      await app.inject({
        method: "POST",
        url: "/v1/consult/refine",
        payload: {
          runtime_input: ellipticalInput,
          instant_output: instant,
          candidate_card_ids: [],
          knowledge_version: instant.knowledge_version,
          conversation_history: [
            "환자: 배가 아파요",
            "상담 도우미: 묽은 변인가요, 잘 안 나오는 변인가요?",
            "환자: 아니 전자라고요",
          ],
        },
      });
      expect(capturedConversation).toEqual([
        { role: "user", content: "배가 아파요" },
        {
          role: "assistant",
          content: "묽은 변인가요, 잘 안 나오는 변인가요?",
        },
        { role: "user", content: "아니 전자라고요" },
      ]);
      expect(capturedQuestionBudget).toBe(true);
      expect(capturedCounterPolicy).toContain("active ingredient");
      expect(capturedCounterPolicy).toContain("what to do now");
      expect(capturedCounterPolicy).toContain(
        "Never output a speculative cause by itself",
      );
    } finally {
      await app.close();
      if (priorKey === undefined) delete process.env["OPENAI_API_KEY"];
      else process.env["OPENAI_API_KEY"] = priorKey;
      if (priorFeature === undefined)
        delete process.env["FEATURE_LLM_REFINEMENT"];
      else process.env["FEATURE_LLM_REFINEMENT"] = priorFeature;
    }
  });
  it("rejects oversized JSON bodies", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/consult/instant",
      payload: { ...input, text: "가".repeat(40_000) },
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe("INVALID_INPUT");
    await app.close();
  });
  it("fails closed when production starts with synthetic knowledge", async () => {
    const prior = process.env["APP_PROFILE"];
    process.env["APP_PROFILE"] = "production";
    await expect(buildApp()).rejects.toThrow(
      /signed official pack|non-synthetic approved pack/u,
    );
    if (prior === undefined) delete process.env["APP_PROFILE"];
    else process.env["APP_PROFILE"] = prior;
  });
  it("applies tenant-scoped card revocation immediately", async () => {
    const app = await buildApp();
    const payload = { ...input, text: "기침약 주세요" };
    const tenantA = { "x-tenant-id": "tenant-a" };
    const tenantB = { "x-tenant-id": "tenant-b" };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/consult/instant",
          headers: tenantA,
          payload,
        })
      ).json().intent,
    ).toBe("cough_general");
    const revoked = await app.inject({
      method: "POST",
      url: "/v1/admin/revocations",
      headers: { ...tenantA, "x-role": "publisher" },
      payload: { reason_code: "SAFETY_KILL", card_id: "CARD-SYN-COUGH" },
    });
    expect(revoked.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/consult/instant",
          headers: tenantA,
          payload,
        })
      ).json().intent,
    ).not.toBe("cough_general");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/consult/instant",
          headers: tenantB,
          payload,
        })
      ).json().intent,
    ).toBe("cough_general");
    await app.close();
  });
  it("never trusts mock headers outside the explicit local-demo profile", async () => {
    const prior = process.env["APP_PROFILE"];
    process.env["APP_PROFILE"] = "local-live";
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/revocations",
      headers: { "x-role": "publisher", "x-tenant-id": "victim" },
      payload: { reason_code: "ATTACK", card_id: "CARD-SYN-COUGH" },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
    if (prior === undefined) delete process.env["APP_PROFILE"];
    else process.env["APP_PROFILE"] = prior;
  });
  it("accepts only identities returned by the verified auth provider outside demo", async () => {
    const prior = process.env["APP_PROFILE"];
    process.env["APP_PROFILE"] = "local-live";
    const app = await buildApp({
      authProvider: {
        authenticate: async () => ({
          subject: "verified-user",
          role: "pharmacist",
          tenant: "verified-tenant",
        }),
      },
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/consult/instant",
          payload: input,
        })
      ).statusCode,
    ).toBe(200);
    await app.close();
    if (prior === undefined) delete process.env["APP_PROFILE"];
    else process.env["APP_PROFILE"] = prior;
  });
  it("keeps every generated OpenAPI path registered in Fastify", async () => {
    const app = await buildApp();
    const document = JSON.parse(
      readFileSync(
        resolve(
          import.meta.dirname,
          "../../../packages/contracts/openapi/openapi.json",
        ),
        "utf8",
      ),
    ) as Readonly<{
      paths: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
    }>;
    for (const [path, operations] of Object.entries(document.paths)) {
      for (const method of Object.keys(operations))
        expect(
          app.hasRoute({
            method: method.toUpperCase(),
            url: path
              .replaceAll("{version}", ":version")
              .replaceAll("{id}", ":id"),
          }),
          `${method} ${path}`,
        ).toBe(true);
    }
    await app.close();
  });
  it("fails consultations closed after active version revocation", async () => {
    const app = await buildApp();
    const revoked = await app.inject({
      method: "POST",
      url: "/v1/admin/revocations",
      headers: { "x-role": "publisher" },
      payload: { reason_code: "PACK_KILL", version: "0.1.0-synthetic-dev" },
    });
    expect(revoked.statusCode).toBe(200);
    const consult = await app.inject({
      method: "POST",
      url: "/v1/consult/instant",
      payload: input,
    });
    expect(consult.statusCode).toBe(503);
    expect(consult.json().error.code).toBe("KNOWLEDGE_STALE");
    await app.close();
  });
  it("publishes only a signed artifact whose payload version matches the route", async () => {
    const app = await buildApp();
    const headers = { "x-role": "publisher" };
    const built = await app.inject({
      method: "POST",
      url: "/v1/admin/packs/build",
      headers,
      payload: { reason_code: "SIGNED_BUILD" },
    });
    expect(built.statusCode).toBe(200);
    const version = String(built.json().candidate_version);
    const published = await app.inject({
      method: "POST",
      url: `/v1/admin/packs/${version}/publish`,
      headers,
      payload: { reason_code: "SIGNED_PUBLISH" },
    });
    expect(published.statusCode).toBe(200);
    const pack = (await app.inject(`/v1/knowledge/packs/${version}`)).json();
    expect(pack.payload.version).toBe(version);
    expect(pack.sha256).toBe(built.json().sha256);
    await app.close();
  });
});
