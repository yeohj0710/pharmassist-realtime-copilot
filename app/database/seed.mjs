import pg from "pg";
import { randomUUID } from "node:crypto";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
if (process.env.APP_PROFILE === "production")
  throw new Error("synthetic seed is blocked in production");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(
    "INSERT INTO audit_events(id,tenant_id,actor_id,action,resource_type,resource_id,reason_code) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      randomUUID(),
      "demo-tenant",
      "seed-script",
      "seed",
      "synthetic_fixture",
      "demo",
      "LOCAL_DEMO_ONLY",
    ],
  );
  console.log("synthetic audit seed inserted; clinical use prohibited");
} finally {
  await client.end();
}
