import type { DrizzleConfig } from "drizzle-orm";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import { QueryResult } from "./mcp.ts";

const mapGetResult = ({ result: [page] }: { result: QueryResult[] }) => {
  return page.results ?? [];
};

const mapPostResult = ({ result }: { result: QueryResult[] }) => {
  return result.map((page) => page.results ?? []);
};

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
  TEnv extends { DATABASES: { DATABASES_RUN_SQL: any } } = any,
>(
  { DATABASES }: TEnv,
  config?: DrizzleConfig<TSchema>,
) {
  return drizzleProxy((sql, params, method) => {
    // https://orm.drizzle.team/docs/connect-drizzle-proxy says
    // Drizzle always waits for {rows: string[][]} or {rows: string[]} for the return value.
    // When the method is get, you should return a value as {rows: string[]}.
    // Otherwise, you should return {rows: string[][]}.
    const asRows = method === "get" ? mapGetResult : mapPostResult;
    return DATABASES.DATABASES_RUN_SQL({
      sql,
      params,
    }).then((result: { result: QueryResult[] }) => ({ rows: asRows(result) }));
  }, config);
}
