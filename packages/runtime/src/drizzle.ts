import type { DrizzleConfig } from "drizzle-orm";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import { DefaultEnv } from "./index.ts";

export function drizzle<TSchema extends Record<string, unknown> = Record<string, never>>(
  { DECO_CHAT_WORKSPACE_DB }: DefaultEnv,
  config?: DrizzleConfig<TSchema>
) {

  return drizzleProxy((sql, params) => {
    // https://orm.drizzle.team/docs/connect-drizzle-proxy says
    // Drizzle always waits for {rows: string[][]} or {rows: string[]} for the return value.
    // When the method is get, you should return a value as {rows: string[]}.
    // Otherwise, you should return {rows: string[][]}.
    //
    return DECO_CHAT_WORKSPACE_DB.query({
      sql,
      params,
    }).then(({ result: [page] }) => ({ rows: page.results ?? [] }));
  }, config)
}