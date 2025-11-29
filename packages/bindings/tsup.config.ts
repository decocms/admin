import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "es2022",
  platform: "neutral",
  bundle: false,
  sourcemap: true,
  clean: true,
  dts: true,
  minify: false,
  shims: true,
});
