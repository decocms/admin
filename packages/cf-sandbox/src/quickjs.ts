import variant from "@jitl/quickjs-wasmfile-release-sync";
import wasmModule from "@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm";
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
  type QuickJSWASMModule,
} from "quickjs-emscripten-core";

let quickJSSingleton: Promise<QuickJSWASMModule> | undefined;

export function getQuickJS() {
  quickJSSingleton ??= newQuickJSWASMModuleFromVariant(
    newVariant(variant, { wasmModule }),
  );
  return quickJSSingleton;
}
