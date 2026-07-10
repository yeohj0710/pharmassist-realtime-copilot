import pg from "pg";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = await readFile(
  resolve(import.meta.dirname, "migrations/001_initial.sql"),
  "utf8",
);
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(sql);
  console.log("migration 001 applied");
} finally {
  await client.end();
}
