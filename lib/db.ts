import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __leyrdSql: Sql | undefined;
}

/**
 * True when no DATABASE_URL is configured and the app runs on an embedded,
 * in-process Postgres (PGlite). Data then lives only as long as the instance.
 */
export const isDemoDb = () => !process.env.DATABASE_URL;

function create(): Sql {
  const url = process.env.DATABASE_URL;
  if (url) return postgres(url, { max: 10, idle_timeout: 30, onnotice: () => {} });
  if (process.env.NODE_ENV === "production" && process.env.LEYRD_DEMO !== "1") {
    throw new Error("DATABASE_URL is not set (set LEYRD_DEMO=1 to run on the embedded demo database)");
  }
  console.warn("[db] DATABASE_URL not set: using embedded PGlite (demo mode, data is not persistent)");
  return createPglite();
}

/** Lazily-created shared pool (survives dev hot reloads). */
export function db(): Sql {
  if (!globalThis.__leyrdSql) globalThis.__leyrdSql = create();
  return globalThis.__leyrdSql;
}

// --- Embedded fallback ------------------------------------------------------
// Implements the small subset of the postgres.js API this app uses:
// tagged-template queries, sql.json(), sql.begin(), sql.unsafe(), result.count.

const JSON_MARK = Symbol("json");
interface JsonParam {
  [JSON_MARK]: true;
  value: unknown;
}
interface Queryable {
  query<T>(q: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(q: string): Promise<unknown>;
}

function toQuery(strings: TemplateStringsArray, values: unknown[]) {
  let text = strings[0];
  const params: unknown[] = [];
  values.forEach((v, i) => {
    params.push(v && typeof v === "object" && JSON_MARK in v ? JSON.stringify((v as JsonParam).value) : v);
    text += `$${params.length}` + strings[i + 1];
  });
  return { text, params };
}

function makeTag(getConn: () => Promise<Queryable>) {
  const tag = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const conn = await getConn();
    const { text, params } = toQuery(strings, values);
    const r = await conn.query(text, params);
    const rows = r.rows as unknown[] & { count?: number };
    rows.count = r.affectedRows || r.rows.length;
    return rows;
  };
  return tag;
}

function createPglite(): Sql {
  let ready: Promise<Queryable & { transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> }> | null = null;
  const getDb = () =>
    (ready ??= (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const pg = new PGlite(process.env.PGLITE_DIR || undefined);
      const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
      await pg.exec(schema);
      return pg as never;
    })());

  const sql = makeTag(getDb) as unknown as Record<string, unknown>;
  sql.json = (value: unknown): JsonParam => ({ [JSON_MARK]: true, value });
  sql.unsafe = async (q: string) => (await getDb()).exec(q);
  sql.begin = async (fn: (tx: unknown) => Promise<unknown>) => {
    const pg = await getDb();
    return pg.transaction(async (tx) => fn(makeTag(async () => tx)));
  };
  sql.end = async () => {};
  return sql as unknown as Sql;
}
