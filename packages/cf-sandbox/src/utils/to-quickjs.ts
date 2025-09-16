import type { QuickJSContext, QuickJSHandle } from "quickjs-emscripten-core";
import { inspect } from "./error-handling.ts";

export function toQuickJS(ctx: QuickJSContext, value: unknown): QuickJSHandle {
  switch (typeof value) {
    case "string": {
      return ctx.newString(value);
    }
    case "number": {
      return ctx.newNumber(value);
    }
    case "boolean": {
      return value ? ctx.true : ctx.false;
    }
    case "undefined": {
      return ctx.undefined;
    }
    case "object": {
      if (value === null) return ctx.null;
      if (Array.isArray(value)) {
        const arr = ctx.newArray();
        value.forEach((v, i) => {
          const hv = toQuickJS(ctx, v);
          ctx.setProp(arr, String(i), hv);
        });
        return arr;
      }
      // plain object
      const obj = ctx.newObject();
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const hv = toQuickJS(ctx, v);
        ctx.setProp(obj, k, hv);
      }
      return obj;
    }
    case "function": {
      // Create a host function bridge that can be called from guest context
      const functionId = `__hostFn_${Date.now()}_${
        Math.random()
          .toString(36)
          .substr(2, 9)
      }`;

      // Store the function in a way that can be accessed from guest context
      // We'll create a proxy function that calls the original function
      const proxyFn = ctx.newFunction(
        functionId,
        (...args: QuickJSHandle[]) => {
          try {
            // Convert QuickJS arguments back to JavaScript values
            const jsArgs = args.map((h) => {
              const dumped = ctx.dump(h);
              return dumped;
            });

            // Call the original function
            const result = value(...jsArgs);

            // Handle promises returned by host functions
            if (result && typeof result.then === "function") {
              // The function returned a promise, we need to handle it asynchronously
              // Create a deferred promise that will be resolved in the guest context
              const deferredPromise = ctx.newPromise();

              // Start the async operation
              result
                .then((resolvedValue: unknown) => {
                  try {
                    const quickJSValue = toQuickJS(ctx, resolvedValue);
                    deferredPromise.resolve(quickJSValue);
                    quickJSValue.dispose();
                    // Execute pending jobs to propagate the promise resolution
                    ctx.runtime.executePendingJobs();
                  } catch (e) {
                    const errorMsg = inspect(e);
                    const errorHandle = ctx.newString(
                      `Promise resolution error: ${errorMsg}`,
                    );
                    deferredPromise.reject(errorHandle);
                    errorHandle.dispose();
                    // Execute pending jobs to propagate the promise rejection
                    ctx.runtime.executePendingJobs();
                  }
                })
                .catch((error: unknown) => {
                  const errorMsg = inspect(error);
                  const errorHandle = ctx.newString(
                    `Promise rejection: ${errorMsg}`,
                  );
                  deferredPromise.reject(errorHandle);
                  errorHandle.dispose();
                  // Execute pending jobs to propagate the promise rejection
                  ctx.runtime.executePendingJobs();
                });

              return deferredPromise.handle;
            } else {
              // The function returned a synchronous value
              return toQuickJS(ctx, result);
            }
          } catch (e) {
            const msg = inspect(e);
            return ctx.newString(`HostFunctionError: ${msg}`);
          }
        },
      );

      return proxyFn;
    }
    case "bigint": {
      // Convert BigInt to string for serialization
      return ctx.newString(value.toString());
    }
    case "symbol": {
      // Convert Symbol to string description
      return ctx.newString(value.toString());
    }
    default: {
      // For any other type, try to convert to string
      try {
        return ctx.newString(String(value));
      } catch {
        return ctx.undefined;
      }
    }
  }
}
