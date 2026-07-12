import { access, readFile } from "node:fs/promises";
const required = [
  "../README.md",
  "IMPLEMENTATION_REPORT.md",
  "docs/ARCHITECTURE.md",
  "docs/DECISIONS.md",
  "docs/TRACEABILITY_MATRIX.md",
  "docs/THREAT_MODEL.md",
  "docs/PRIVACY_AND_DATA_FLOW.md",
  "docs/OPENAI_INTEGRATION.md",
  "docs/KNOWLEDGE_AUTHORING.md",
  "docs/INCIDENT_AND_ROLLBACK.md",
  "docs/OPERATIONS_RUNBOOK.md",
  "docs/BENCHMARKS.md",
  "docs/INTENDED_USE_AND_LIMITATIONS.md",
  "docs/LEGAL_REVIEW_CHECKLIST.md",
];
for (const file of required)
  await access(new URL(`../${file}`, import.meta.url));
const combined = (
  await Promise.all(
    required.map((file) =>
      readFile(new URL(`../${file}`, import.meta.url), "utf8"),
    ),
  )
).join("\n");
if (/(?:is|are|현재|완전한)\s+(?:임상\s*)?production[- ]ready/iu.test(combined))
  throw new Error("prohibited readiness claim found");
console.log(`documentation check passed: ${required.length} required files`);
