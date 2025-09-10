import type { QuickJSContext, QuickJSHandle } from "quickjs-emscripten-core";
import { Scope } from "quickjs-emscripten-core";

export function base64Encode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof (globalThis as any).btoa === "function") {
    return (globalThis as any).btoa(binary);
  }
  return Buffer.from(binary, "binary").toString("base64");
}

export function base64Decode(input: string): string {
  let binary: string;
  if (typeof (globalThis as any).atob === "function") {
    binary = (globalThis as any).atob(input);
  } else {
    binary = Buffer.from(input, "base64").toString("binary");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function installBuffer(ctx: QuickJSContext) {
  Scope.withScope((scope) => {
    const atobFn = scope.manage(ctx.newFunction("atob", (input: QuickJSHandle) => {
      return Scope.withScope((fnScope) => {
        try {
          const text = String(ctx.dump(input) ?? "");
          const decoded = base64Decode(text);
          return fnScope.manage(ctx.newString(decoded));
        } finally {
          input.dispose();
        }
      });
    }));
    
    const btoaFn = scope.manage(ctx.newFunction("btoa", (input: QuickJSHandle) => {
      return Scope.withScope((fnScope) => {
        try {
          const text = String(ctx.dump(input) ?? "");
          const encoded = base64Encode(text);
          return fnScope.manage(ctx.newString(encoded));
        } finally {
          input.dispose();
        }
      });
    }));

    const bufferObj = scope.manage(ctx.newObject());
    ctx.setProp(bufferObj, "atob", atobFn);
    ctx.setProp(bufferObj, "btoa", btoaFn);
    ctx.setProp(ctx.global, "Buffer", bufferObj);
  });
}

