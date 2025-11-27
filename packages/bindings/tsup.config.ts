import { defineConfig } from "tsup";
import { polyfillNode } from "esbuild-plugin-polyfill-node";

const sharedEntry = {
  index: "src/index.ts",
  collections: "src/well-known/collections.ts",
  "language-model": "src/well-known/language-model.ts",
  agents: "src/well-known/agents.ts",
  connection: "src/core/connection.ts",
  client: "src/core/client/index.ts",
};

export default defineConfig([
  // Browser build with polyfills
  {
    entry: sharedEntry,
    outDir: "dist/browser",
    format: ["esm"],
    target: "es2022",
    platform: "browser",
    bundle: true,
    sourcemap: true,
    clean: true,
    dts: false, // Only generate dts once
    minify: false,
    splitting: true,
    treeshake: true,
    shims: true,
    esbuildPlugins: [
      polyfillNode({ polyfills: { buffer: true, process: true } }),
    ],
    external: ["zod"],
    noExternal: ["json-schema-diff", "zod-to-json-schema"],
  },
  // Node.js build without polyfills
  {
    entry: sharedEntry,
    outDir: "dist/node",
    format: ["esm"],
    target: "es2022",
    platform: "node",
    bundle: true,
    sourcemap: true,
    clean: true,
    dts: true, // Generate dts with node build
    minify: false,
    splitting: true,
    treeshake: true,
    shims: true,
    external: ["zod"],
    noExternal: ["json-schema-diff", "zod-to-json-schema"],
  },
]);
