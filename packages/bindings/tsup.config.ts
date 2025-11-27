import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    models: "src/well-known/models.ts",
    collections: "src/well-known/collections.ts",
    "language-model": "src/well-known/language-model.ts",
    connection: "src/core/connection.ts",
    client: "src/core/client/index.ts",
  },
  format: ["esm"],
  target: "es2022",
  bundle: true,
  sourcemap: true,
  clean: true,
  dts: {
    resolve: true,
  },
  minify: false,
  splitting: false,
  treeshake: true,
  shims: true,
  // Keep all dependencies as external since this is a library
  external: ["node:*", "zod", "@modelcontextprotocol/sdk"],
});
