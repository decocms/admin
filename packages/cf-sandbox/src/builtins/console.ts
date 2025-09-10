import type { QuickJSContext, QuickJSHandle } from "quickjs-emscripten-core";
import { Scope } from "quickjs-emscripten-core";

export type Log = { type: "log" | "warn" | "error"; content: string };

export function installConsole(ctx: QuickJSContext): Log[] {
  const logs: Log[] = [];

  return Scope.withScope((scope) => {
    const makeLog = (level: string) =>
      scope.manage(
        ctx.newFunction(level, (...args: QuickJSHandle[]) => {
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
        }),
      );

    const consoleObj = scope.manage(ctx.newObject());
    const log = makeLog("log");
    const warn = makeLog("warn");
    const error = makeLog("error");
    ctx.setProp(consoleObj, "log", log);
    ctx.setProp(consoleObj, "warn", warn);
    ctx.setProp(consoleObj, "error", error);
    ctx.setProp(ctx.global, "console", consoleObj);

    return logs;
  });
}
