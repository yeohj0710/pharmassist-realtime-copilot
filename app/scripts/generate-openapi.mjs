import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
const schemaDir = join(root, "packages", "contracts", "schemas");
const outDir = join(root, "packages", "contracts", "openapi");
await mkdir(outDir, { recursive: true });
const schemaHash = createHash("sha256");
for (const filename of (await readdir(schemaDir))
  .filter((name) => name.endsWith(".schema.json"))
  .sort())
  schemaHash.update(await readFile(join(schemaDir, filename)));
const sourceSchemaHash = schemaHash.digest("hex");
const load = async (name) =>
  JSON.parse(await readFile(join(schemaDir, name), "utf8"));
const components = {
  RuntimeInput: await load("runtime_input.schema.json"),
  RuntimeOutput: await load("runtime_output.schema.json"),
  Feedback: await load("feedback.schema.json"),
  ErrorEnvelope: await load("error_envelope.schema.json"),
  PackManifest: await load("pack_manifest.schema.json"),
  RefinementRequest: await load("refinement_request.schema.json"),
};
for (const value of Object.values(components)) {
  delete value.$schema;
  delete value.$id;
}
components.RefinementRequest = JSON.parse(
  JSON.stringify(components.RefinementRequest)
    .replaceAll(
      '"runtime_input.schema.json"',
      '"#/components/schemas/RuntimeInput"',
    )
    .replaceAll(
      '"runtime_output.schema.json"',
      '"#/components/schemas/RuntimeOutput"',
    ),
);
const jsonBody = (schema) => ({
  required: true,
  content: { "application/json": { schema } },
});
const jsonResponse = (schema, description = "Success") => ({
  description,
  content: { "application/json": { schema } },
});
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const paths = {
  "/v1/consult/instant": {
    post: {
      operationId: "consultInstant",
      requestBody: jsonBody(ref("RuntimeInput")),
      responses: {
        200: jsonResponse(ref("RuntimeOutput")),
        400: jsonResponse(ref("ErrorEnvelope"), "Invalid input"),
      },
    },
  },
  "/v1/consult/refine": {
    post: {
      operationId: "consultRefine",
      requestBody: jsonBody(ref("RefinementRequest")),
      responses: {
        200: {
          description: "SSE refinement stream",
          content: { "text/event-stream": { schema: { type: "string" } } },
        },
      },
    },
  },
  "/v1/realtime/session": {
    post: {
      operationId: "createRealtimeSession",
      requestBody: {
        required: true,
        content: {
          "application/sdp": { schema: { type: "string", maxLength: 128000 } },
        },
      },
      responses: {
        200: {
          description: "WebRTC SDP answer",
          content: { "application/sdp": { schema: { type: "string" } } },
        },
        400: jsonResponse(ref("ErrorEnvelope"), "Invalid SDP"),
        403: jsonResponse(ref("ErrorEnvelope"), "Forbidden"),
        503: jsonResponse(ref("ErrorEnvelope")),
      },
    },
  },
  "/v1/knowledge/manifest": {
    get: {
      operationId: "getKnowledgeManifest",
      responses: { 200: jsonResponse(ref("PackManifest")) },
    },
  },
  "/v1/knowledge/packs/{version}": {
    get: {
      operationId: "getKnowledgePack",
      parameters: [
        {
          in: "path",
          name: "version",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: jsonResponse({ type: "object" }),
        404: jsonResponse(ref("ErrorEnvelope")),
      },
    },
  },
  "/v1/feedback": {
    post: {
      operationId: "createFeedback",
      requestBody: jsonBody(ref("Feedback")),
      responses: {
        204: { description: "Recorded" },
        400: jsonResponse(ref("ErrorEnvelope")),
      },
    },
  },
  "/v1/health/live": {
    get: {
      operationId: "healthLive",
      responses: { 200: jsonResponse({ type: "object" }) },
    },
  },
  "/v1/health/ready": {
    get: {
      operationId: "healthReady",
      responses: {
        200: jsonResponse({ type: "object" }),
        503: jsonResponse({ type: "object" }),
      },
    },
  },
};
for (const path of [
  "sources",
  "claims/import",
  "cards",
  "reviews",
  "packs/build",
  "packs/{version}/publish",
  "packs/{version}/rollback",
  "revocations",
]) {
  paths[`/v1/admin/${path}`] = {
    post: {
      operationId: `admin_${path.replaceAll(/[/{}/]/g, "_")}`,
      responses: {
        200: jsonResponse({ type: "object" }),
        403: jsonResponse(ref("ErrorEnvelope")),
      },
    },
  };
}
paths["/v1/admin/claims/{id}"] = {
  patch: {
    operationId: "admin_patch_claim",
    parameters: [
      { in: "path", name: "id", required: true, schema: { type: "string" } },
    ],
    requestBody: jsonBody({
      type: "object",
      additionalProperties: true,
      required: ["reason_code"],
      properties: {
        reason_code: { type: "string", pattern: "^[A-Z0-9_]{2,64}$" },
      },
    }),
    responses: {
      200: jsonResponse({ type: "object" }),
      400: jsonResponse(ref("ErrorEnvelope")),
      403: jsonResponse(ref("ErrorEnvelope")),
    },
  },
};
const document = {
  openapi: "3.1.0",
  info: {
    title: "Pharmassist API",
    version: "0.1.0",
    description: "Synthetic-demo contract. Not clinical production approval.",
  },
  servers: [{ url: "http://127.0.0.1:8080" }],
  paths,
  components: { schemas: components },
};
const serialized = JSON.stringify(document, null, 2) + "\n";
await writeFile(join(outDir, "openapi.json"), serialized, "utf8");
await writeFile(
  join(outDir, "manifest.json"),
  `${JSON.stringify({ sha256: createHash("sha256").update(serialized).digest("hex"), sourceSchemaHash, paths: Object.keys(paths).sort() }, null, 2)}\n`,
  "utf8",
);
console.log(`Generated OpenAPI with ${Object.keys(paths).length} paths.`);
