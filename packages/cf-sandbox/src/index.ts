import {
  DefaultIntrinsics,
  Intrinsics,
  type QuickJSContext,
  QuickJSRuntime,
} from "quickjs-emscripten-core";
import { getQuickJS } from "./quickjs.ts";

// Export utilities
export { callFunction } from "./utils/call-function.ts";
export { inspect } from "./utils/error-handling.ts";
export { toQuickJS } from "./utils/to-quickjs.ts";

// Export built-ins
export { installConsole, installFetch } from "./builtins/index.ts";

// Export types
export type { EvaluationResult, Log } from "./types.ts";

// Export QuickJS types
export type {
  DefaultIntrinsics,
  Intrinsics,
  JSValue,
  JSValueConst,
  JSValueConstPointer,
  JSValuePointer,
  QuickJSContext,
  QuickJSHandle,
  QuickJSRuntime,
  QuickJSWASMModule,
} from "quickjs-emscripten-core";

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

export interface SandboxContextOptions extends Intrinsics {
  interruptAfterMs?: number;
}

// EvaluationResult is now imported from types.ts

export interface SandboxRuntime {
  runtimeId: string;
  newContext: (options?: SandboxContextOptions) => SandboxContext;
  [Symbol.dispose]: () => void;
}

export type SandboxContext = QuickJSContext;

const runtimes = new Map<string, Promise<QuickJSRuntime>>();

function getOrCreateRuntime(runtimeId: string, options: SandboxRuntimeOptions) {
  let promise = runtimes.get(runtimeId);
  if (!promise) {
    promise = (async () => {
      const QuickJS = await getQuickJS();
      const runtime = QuickJS.newRuntime({
        maxStackSizeBytes: options.stackSizeBytes,
        memoryLimitBytes: options.memoryLimitBytes,
      });

      return runtime;
    })();
    runtimes.set(runtimeId, promise);
  }
  return promise;
}

export async function createSandboxRuntime(
  runtimeId: string,
  options: SandboxRuntimeOptions = {},
): Promise<SandboxRuntime> {
  const endSandboxCreation = timings(
    `Creating sandbox runtime for ${runtimeId}`,
  );
  const runtime = await getOrCreateRuntime(runtimeId, options);

  const createContext = ({
    interruptAfterMs,
    ...intrinsics
  }: SandboxContextOptions = {}): SandboxContext => {
    const ctx = runtime.newContext({
      intrinsics: { ...DefaultIntrinsics, ...intrinsics },
    });

    // Interrupt control (per-execution deadline)
    let deadline = 0;
    const setDeadline = (ms?: number) => {
      deadline = ms ? Date.now() + ms : 0;
    };

    // Set up interrupt handler for this context
    runtime.setInterruptHandler(() => {
      const shouldInterrupt = deadline > 0 && Date.now() > deadline;
      if (shouldInterrupt) {
        console.warn(
          `[cf-sandbox] Execution interrupted due to deadline for runtimeId: ${runtimeId}`,
        );
      }
      return shouldInterrupt;
    });

    // Set initial deadline if provided
    if (interruptAfterMs) {
      setDeadline(interruptAfterMs);
    }

    return ctx;
  };

  const dispose = () => {
    runtime.dispose();
    runtimes.delete(runtimeId);
  };

  endSandboxCreation();
  return {
    runtimeId,
    newContext: createContext,
    [Symbol.dispose]: dispose,
  };
}
