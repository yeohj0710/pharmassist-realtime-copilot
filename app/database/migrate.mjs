import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const migrationsDirectory = resolve(import.meta.dirname, "migrations");
const files = (await readdir(migrationsDirectory))
  .filter((name) => /^\d+_.+\.sql$/u.test(name))
  .sort((left, right) => left.localeCompare(right));
if (files.length === 0) throw new Error("No database migrations found");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      sha256 char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  for (const filename of files) {
    const raw = await readFile(resolve(migrationsDirectory, filename), "utf8");
    const checksum = createHash("sha256").update(raw).digest("hex");
    const prior = await client.query(
      "SELECT sha256 FROM schema_migrations WHERE filename = $1",
      [filename],
    );
    if (prior.rowCount) {
      if (prior.rows[0]?.sha256 !== checksum)
        throw new Error(`Applied migration changed: ${filename}`);
      console.log(`migration ${filename} already applied`);
      continue;
    }
    const sql = raw
      .replace(/^\s*BEGIN\s*;?/iu, "")
      .replace(/COMMIT\s*;?\s*$/iu, "");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(filename, sha256) VALUES($1, $2)",
        [filename, checksum],
      );
      await client.query("COMMIT");
      console.log(`migration ${filename} applied`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}
