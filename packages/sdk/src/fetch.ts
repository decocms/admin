// deno-lint-ignore-file no-explicit-any
import { AsyncLocalStorage } from "node:async_hooks";

export const contextStorage = new AsyncLocalStorage<
  { env: any; ctx: ExecutionContext; isLocal?: boolean }
>();

export const isLocal = () => contextStorage.getStore()?.isLocal;
