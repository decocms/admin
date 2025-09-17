import type { QuickJSContext, QuickJSHandle } from "quickjs-emscripten-core";
import { toQuickJS } from "./to-quickjs.ts";

export function callFunction(
  ctx: QuickJSContext,
  fn: QuickJSHandle,
  thisArg?: unknown,
  ...args: unknown[]
) {
  // Convert thisArg and args to QuickJS handles
  const thisArgHandle = thisArg ? toQuickJS(ctx, thisArg) : ctx.undefined;
  const argHandles = args.map((arg) => toQuickJS(ctx, arg));

  // Call the function
  const result = ctx.unwrapResult(
    ctx.callFunction(fn, thisArgHandle, ...argHandles),
  );

  // Wrap function result in a promise
  const resultPromise = ctx.newPromise();
  resultPromise.resolve(result);

  // Resolve the promise
  const toAwait = ctx.resolvePromise(resultPromise.handle);

  // Execute pending jobs to avoid deadlocks
  if (ctx.runtime.hasPendingJob()) {
    ctx.runtime.executePendingJobs();
  }

  // Return the promise
  return toAwait;
}
