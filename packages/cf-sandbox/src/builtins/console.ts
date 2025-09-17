import type { QuickJSContext, QuickJSHandle } from "quickjs-emscripten-core";
import type { Log } from "../types.ts";

export interface ConsoleBuiltin {
  readonly logs: Log[];
  [Symbol.dispose]: () => void;
}

export function installConsole(ctx: QuickJSContext): ConsoleBuiltin {
  const logs: Log[] = [];
  const handles: QuickJSHandle[] = [];

  const makeLog = (level: string) => {
    const logFn = ctx.newFunction(level, (...args: QuickJSHandle[]) => {
      try {
        const parts = args.map((h) => ctx.dump(h));
        logs.push({
          type: (level as "log" | "warn" | "error") ?? "log",
          content: parts.map(String).join(" "),
        });
      } finally {
        args.forEach((h) => h.dispose());
      }
      return ctx.undefined;
    });
    handles.push(logFn);
    return logFn;
  };

  const consoleObj = ctx.newObject();
  handles.push(consoleObj);

  const log = makeLog("log");
  const warn = makeLog("warn");
  const error = makeLog("error");

  ctx.setProp(consoleObj, "log", log);
  ctx.setProp(consoleObj, "warn", warn);
  ctx.setProp(consoleObj, "error", error);
  ctx.setProp(ctx.global, "console", consoleObj);

  return {
    logs,
    [Symbol.dispose]() {
      handles.forEach((handle) => handle.dispose());
    },
  };
}
