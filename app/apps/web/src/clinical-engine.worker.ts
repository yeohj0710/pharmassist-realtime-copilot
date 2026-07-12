import type { RuntimeInput, RuntimeOutput } from "@pharmassist/contracts";
import { validateContract } from "@pharmassist/contracts";
import { syntheticPack } from "@pharmassist/test-fixtures";
import { StatefulConsultFlow } from "./consult-flow.js";

const profile = import.meta.env["VITE_APP_PROFILE"] ?? "local-demo";
if (profile === "production")
  throw new Error(
    "Production web build requires a verified remote pack loader; synthetic worker startup blocked.",
  );
const flow = new StatefulConsultFlow(syntheticPack);

self.addEventListener(
  "message",
  (
    event: MessageEvent<RuntimeInput | { type: "reset"; sessionId: string }>,
  ) => {
    if ("type" in event.data && event.data.type === "reset") {
      flow.reset(event.data.sessionId);
      return;
    }
    const input = validateContract<RuntimeInput>("runtimeInput", event.data);
    if (!input.ok || !input.value) {
      self.postMessage({ error: "INVALID_INPUT" });
      return;
    }
    const result = flow.run(input.value);
    const output = validateContract<RuntimeOutput>(
      "runtimeOutput",
      result.output,
    );
    if (!output.ok || !output.value) {
      self.postMessage({ error: "INTERNAL_SAFE_FAILURE" });
      return;
    }
    self.postMessage({ ...result, output: output.value });
  },
);
