import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "well-known/models": "src/well-known/models.ts",
    "well-known/collections": "src/well-known/collections.ts",
  },
  format: ["esm"],
  target: "es2022",
  bundle: true,
  sourcemap: true,
  clean: true,
  dts: true,
  minify: false,
  splitting: true,
  treeshake: true,
  shims: true,
  // Keep all dependencies as external since this is a library
  external: ["node:*", "zod"],
});
