import type { QuickJSContext, QuickJSHandle } from "quickjs-emscripten-core";
import { inspect } from "./error-handling.ts";

// Symbol to identify lazy env proxies (must match the one in utils.ts)
const LAZY_ENV_PROXY = Symbol.for("LAZY_ENV_PROXY");

/**
 * Check if a value is marked as a lazy env proxy
 */
function isLazyEnvProxy(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return LAZY_ENV_PROXY in value;
}

/**
 * Create a lazy env proxy object in QuickJS that properly handles nested property access
 * like: ctx.env['i:agent-management'].AGENTS_LIST({})
 *
 * This creates a Proxy in the guest context that delegates property access to the host.
 */
function createLazyEnvProxyObject(
  ctx: QuickJSContext,
  hostProxy: unknown,
): QuickJSHandle {
  // Get the accessor function attached to the proxy
  // deno-lint-ignore ban-types
  const envAccessor = (hostProxy as Record<symbol, Function>)[LAZY_ENV_PROXY];

  if (typeof envAccessor !== "function") {
    throw new Error("Lazy env proxy is missing accessor function");
  }

  // Convert the envAccessor to a QuickJS function
  const envAccessorQJS = toQuickJS(ctx, envAccessor);

  // Create a Proxy in the guest context that intercepts property access
  // This is the code we'll evaluate in the guest context
  const proxyCode = `
    (function(envAccessor) {
      return new Proxy({}, {
        get(_, integrationId) {
          return new Proxy({}, {
            get(_, toolName) {
              return envAccessor(integrationId, toolName);
            }
          });
        }
      });
    })
  `;

  // Evaluate the proxy creation code
  const proxyFactoryResult = ctx.evalCode(proxyCode, "env-proxy.js", {
    strict: true,
    strip: true,
  });

  const proxyFactory = ctx.unwrapResult(proxyFactoryResult);

  // Call the factory with the envAccessor
  const envProxyResult = ctx.callFunction(
    proxyFactory,
    ctx.undefined,
    envAccessorQJS,
  );
  const envProxy = ctx.unwrapResult(envProxyResult);

  // Clean up
  proxyFactory.dispose();
  envAccessorQJS.dispose();

  return envProxy;
}

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

      // Check if it's a marked lazy env proxy
      if (isLazyEnvProxy(value)) {
        return createLazyEnvProxyObject(ctx, value);
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
      const functionId = `__hostFn_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

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
