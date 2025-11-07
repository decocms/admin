import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    deconfig: "src/deconfig.ts",
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
  // Bundle everything except these native/external packages
  noExternal: [/@deco\/sdk/],
  external: [
    // Native Node.js modules
    "node:*",
    // Keep these as external dependencies
    "@deco-cx/warp-node",
    "@modelcontextprotocol/sdk",
    "@supabase/ssr",
    "@supabase/supabase-js",
    "chalk",
    "commander",
    "glob",
    "ignore",
    "inquirer",
    "inquirer-search-checkbox",
    "inquirer-search-list",
    "jose",
    "json-schema-to-typescript",
    "object-hash",
    "prettier",
    "semver",
    "smol-toml",
    "ws",
    "zod",
  ],
});
