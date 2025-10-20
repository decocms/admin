/* oxlint-disable no-explicit-any */
import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";

export const contextStorage = new AsyncLocalStorage<{
  env: any;
  ctx: ExecutionContext;
  sql?: postgres.Sql;
}>();
