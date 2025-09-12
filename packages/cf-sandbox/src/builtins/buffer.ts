import type { QuickJSContext, QuickJSHandle } from "quickjs-emscripten-core";

export interface BufferBuiltin {
  [Symbol.dispose]: () => void;
}

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

export function installBuffer(ctx: QuickJSContext): BufferBuiltin {
  const handles: QuickJSHandle[] = [];

  const atobFn = ctx.newFunction("atob", (input: QuickJSHandle) => {
    try {
      const text = String(ctx.dump(input) ?? "");
      const decoded = base64Decode(text);
      return ctx.newString(decoded);
    } finally {
      input.dispose();
    }
  });
  handles.push(atobFn);
  
  const btoaFn = ctx.newFunction("btoa", (input: QuickJSHandle) => {
    try {
      const text = String(ctx.dump(input) ?? "");
      const encoded = base64Encode(text);
      return ctx.newString(encoded);
    } finally {
      input.dispose();
    }
  });
  handles.push(btoaFn);

  const bufferObj = ctx.newObject();
  handles.push(bufferObj);
  
  ctx.setProp(bufferObj, "atob", atobFn);
  ctx.setProp(bufferObj, "btoa", btoaFn);
  ctx.setProp(ctx.global, "Buffer", bufferObj);

  return {
    [Symbol.dispose]() {
      handles.forEach(handle => handle.dispose());
    }
  };
}

