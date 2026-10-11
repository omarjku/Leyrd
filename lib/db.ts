import "server-only";
import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __leyrdSql: ReturnType<typeof postgres> | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, { max: 10, idle_timeout: 30, onnotice: () => {} });
}

/** Lazily-created shared pool (survives dev hot reloads). */
export function db() {
  if (!globalThis.__leyrdSql) globalThis.__leyrdSql = create();
  return globalThis.__leyrdSql;
}
