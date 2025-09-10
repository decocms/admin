import {
  type QuickJSContext,
  type QuickJSHandle,
  QuickJSRuntime,
  type QuickJSWASMModule,
  Scope,
} from "quickjs-emscripten-core";
import { installBuffer } from "./builtins/buffer.ts";
import { installConsole, Log } from "./builtins/console.ts";
import { getQuickJS } from "./quickjs.ts";

export { Scope } from "quickjs-emscripten-core";

/**
 * Creates a timing function that measures execution time and logs the result.
 * @param msg - The message to include in the log output
 * @returns A function that when called, logs the elapsed time
 */
function timings(msg: string): () => void {
  const start = performance.now();
  return () => {
    const elapsed = Math.round(performance.now() - start);
    console.log(`[${elapsed}ms] ${msg}`);
  };
}

export interface SandboxRuntimeOptions {
  /**
   * The memory limit for the tenant sandbox in bytes.
   */
  memoryLimitBytes?: number;
  /**
   * The stack size for the tenant sandbox in bytes.
   */
  stackSizeBytes?: number;
}

export interface SandboxContextOptions {
  interruptAfterMs?: number;
  globals?: Record<string, unknown>;
}

export interface EvaluationResult<T = unknown> {
  value?: T;
  error?: unknown;
  logs: Array<{ type: "log" | "warn" | "error"; content: string }>;
}

export interface HostFunctionDefinition {
  name: string;
  /** Synchronous host function. Values are converted via ctx.dump. */
  fn: (...args: unknown[]) => unknown;
}

export interface SandboxRuntime {
  tenantId: string;
  addHostFunction: (def: HostFunctionDefinition) => void;
  createContext: (options?: SandboxContextOptions) => SandboxContext;
  [Symbol.dispose]: () => void;
}

export interface SandboxContext {
  /**
   * Creates a function that will be run in the sandbox context
   * This function uses the same signature of new Function in JavaScript
   * with the difference that it is always async in nature.
   *
   * @example
   * const fn = context.createFunction("a", "b", "return a + b");
   * const result = await fn(1, 2);
   * console.log(result.value); // 3
   */
  createFunction: <T = unknown>(
    ...args: string[]
  ) => (...args: unknown[]) => Promise<EvaluationResult<T>>;

  [Symbol.dispose]: () => void;
}

type TenantRuntime = {
  runtime: QuickJSRuntime;
  hostFns: HostFunctionDefinition[];
};

const tenants = new Map<string, Promise<TenantRuntime>>();

async function getOrCreateTenant(
  tenantId: string,
  options: SandboxRuntimeOptions,
): Promise<TenantRuntime> {
  let promise = tenants.get(tenantId);
  if (!promise) {
    promise = (async () => {
      const endTenantCreation = timings(
        `Creating tenant runtime for ${tenantId}`,
      );
      const QuickJS = await getQuickJS();
      const runtime = QuickJS.newRuntime({
        maxStackSizeBytes: options.stackSizeBytes,
        memoryLimitBytes: options.memoryLimitBytes,
      });
      endTenantCreation();
      return { runtime, hostFns: [] } as TenantRuntime;
    })();
    tenants.set(tenantId, promise);
  }
  return promise;
}

// builtins moved to ./builtins

function installGlobals(
  ctx: QuickJSContext,
  globals?: Record<string, unknown>,
) {
  if (!globals) return;
  for (const [key, value] of Object.entries(globals)) {
    const handle = toQuickJS(ctx, value);
    ctx.setProp(ctx.global, key, handle);
  }
}

function toQuickJS(ctx: QuickJSContext, value: unknown): QuickJSHandle {
  switch (typeof value) {
    case "string":
      return ctx.newString(value);
    case "number":
      return ctx.newNumber(value);
    case "boolean":
      return value ? ctx.true : ctx.false;
    case "undefined":
      return ctx.undefined;
    case "object":
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
    case "function":
      // Create a host function bridge that can be called from guest context
      const functionId = `__hostFn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
            const result = (value as Function)(...jsArgs);

            // Handle promises returned by host functions
            if (result && typeof result.then === 'function') {
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
                    const errorMsg = e instanceof Error ? e.message : String(e);
                    const errorHandle = ctx.newString(`Promise resolution error: ${errorMsg}`);
                    deferredPromise.reject(errorHandle);
                    errorHandle.dispose();
                    // Execute pending jobs to propagate the promise rejection
                    ctx.runtime.executePendingJobs();
                  }
                })
                .catch((error: unknown) => {
                  const errorMsg = error instanceof Error ? error.message : String(error);
                  const errorHandle = ctx.newString(`Promise rejection: ${errorMsg}`);
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
            const msg = e instanceof Error ? e.message : String(e);
            return ctx.newString(`HostFunctionError: ${msg}`);
          }
        },
      );

      return proxyFn;
    case "bigint":
      // Convert BigInt to string for serialization
      return ctx.newString(value.toString());
    case "symbol":
      // Convert Symbol to string description
      return ctx.newString(value.toString());
    default:
      // For any other type, try to convert to string
      try {
        return ctx.newString(String(value));
      } catch {
        return ctx.undefined;
      }
  }
}

function applyHostFunctions(
  ctx: QuickJSContext,
  defs: HostFunctionDefinition[],
) {
  for (const { name, fn } of defs) {
    const qjsFn = ctx.newFunction(name, (...args: QuickJSHandle[]) => {
      try {
        const jsArgs = args.map((h) => ctx.dump(h));
        const result = fn(...jsArgs);
        return toQuickJS(ctx, result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return ctx.newString(`HostError: ${msg}`);
      }
    });
    ctx.setProp(ctx.global, name, qjsFn);
  }
}

export async function createSandboxRuntime(
  tenantId: string,
  options: SandboxRuntimeOptions = {},
): Promise<SandboxRuntime> {
  const endSandboxCreation = timings(
    `Creating sandbox runtime for ${tenantId}`,
  );
  const tenant = await getOrCreateTenant(tenantId, options);

  const addHostFunction = (def: HostFunctionDefinition) => {
    tenant.hostFns.push(def);
  };

  const createContext = (
    ctxOptions: SandboxContextOptions = {},
  ): SandboxContext => {
    const endContextCreation = timings(
      `Creating context for tenant ${tenantId}`,
    );
    const ctx = tenant.runtime.newContext();

    // Builtin modules
    const [logs] = [installConsole, installBuffer].map((h) => h(ctx)) as [
      Log[],
      void,
    ];

    // Interrupt control (per-execution deadline)
    let deadline = 0;
    const setDeadline = (ms?: number) => {
      deadline = ms ? Date.now() + ms : 0;
    };
    tenant.runtime.setInterruptHandler(() => {
      const shouldInterrupt = deadline > 0 && Date.now() > deadline;
      if (shouldInterrupt) {
        console.warn(
          `[cf-sandbox] Execution interrupted due to deadline for tenantId: ${tenantId}`,
        );
      }
      return shouldInterrupt;
    });

    applyHostFunctions(ctx, tenant.hostFns);
    installGlobals(ctx, ctxOptions.globals);
    endContextCreation();

    const createFunction = <T = unknown>(
      ...args: string[]
    ): ((...args: unknown[]) => Promise<EvaluationResult<T>>) => {
      const fnBody = args.pop();
      const argNames = args;

      if (!fnBody) {
        throw new Error("Function body is required");
      }

      const endCompilation = timings(
        `Compiling function for tenant ${tenantId}`,
      );
      setDeadline(ctxOptions.interruptAfterMs);

      // Create the bridge function code
      const bridgeFunctionName = `__bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const bridgeCode = `
        function ${bridgeFunctionName}(${argNames.join(", ")}) {
          return (async (${argNames.join(", ")}) => {
            ${fnBody}
          })(${argNames.join(", ")});
        }
      `;

      // Compile the bridge function to validate syntax
      const compileResult = ctx.evalCode(bridgeCode, "bridge.js", {
        strict: true,
        strip: true,
        compileOnly: true,
      });

      if (compileResult.error) {
        const errorMsg = ctx.dump(compileResult.error);
        compileResult.error.dispose();
        throw new Error(`Compilation error: ${errorMsg}`);
      }

      compileResult.value.dispose();
      endCompilation();

      return async (...hostArgs: unknown[]): Promise<EvaluationResult<T>> => {
        const endEvaluation = timings(
          `Evaluating function for tenant ${tenantId}`,
        );
        setDeadline(ctxOptions.interruptAfterMs);

        try {
          // Evaluate the bridge function (now we know it compiles)
          const bridgeEvalResult = ctx.evalCode(bridgeCode, "bridge.js", {
            strict: true,
            strip: true,
          });
          const bridgeUnwrapped = ctx.unwrapResult(bridgeEvalResult);

          // Get the bridge function from the global scope
          const bridgeFn = ctx.getProp(ctx.global, bridgeFunctionName);
          if (ctx.typeof(bridgeFn) === "undefined") {
            throw new Error("Failed to create bridge function");
          }

          // Convert host arguments to QuickJS values
          const quickJSArgs: QuickJSHandle[] = [];
          for (const arg of hostArgs) {
            const qjsArg = toQuickJS(ctx, arg);
            quickJSArgs.push(qjsArg);
          }

          // Call the bridge function with the converted arguments
          const callResult = ctx.callFunction(
            bridgeFn,
            ctx.undefined,
            ...quickJSArgs,
          );

          if (callResult.error) {
            const errorMsg = ctx.dump(callResult.error);
            throw new Error(`Guest execution error: ${errorMsg}`);
          }

          const unwrappedResult = ctx.unwrapResult(callResult);

          // Handle the promise result
          const promise = ctx.resolvePromise(unwrappedResult);

          ctx.runtime.executePendingJobs();

          const awaited = await promise;
          if (awaited.error) {
            const errorMsg = ctx.dump(awaited.error);
            throw new Error(`Promise rejection: ${errorMsg}`);
          }

          const resolvedPromise = ctx.unwrapResult(awaited);

          const value = ctx.dump(resolvedPromise);

          // Clean up the bridge function from global scope
          ctx.setProp(ctx.global, bridgeFunctionName, ctx.undefined);

          endEvaluation();
          return { value, logs };
        } catch (e) {
          console.error(e);
          throw e;
        } finally {
          // Pump any pending jobs (Promises)
          tenant.runtime.executePendingJobs();
          setDeadline(0);
        }
      };
    };

    const dispose = () => ctx.dispose();

    return {
      createFunction,

      [Symbol.dispose]: dispose,
    };
  };

  const dispose = () => {
    tenant.runtime.dispose();
    tenants.delete(tenantId);
  };

  endSandboxCreation();
  return {
    tenantId,
    addHostFunction,
    createContext: createContext,
    [Symbol.dispose]: dispose,
  };
}

export type { QuickJSWASMModule };
