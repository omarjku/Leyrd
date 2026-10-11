// Applies db/schema.sql (idempotent). Runs before `next start`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set; skipping migrations");
  process.exit(0);
}
const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.unsafe(schema);
  console.log("[migrate] schema applied");
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
