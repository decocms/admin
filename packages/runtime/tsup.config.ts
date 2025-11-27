import { defineConfig, type Options } from "tsup";

const config: Options = {
  entry: {
    index: "src/index.ts",
    proxy: "src/proxy.ts",
    admin: "src/admin.ts",
    client: "src/client.ts",
    mastra: "src/mastra.ts",
    drizzle: "src/drizzle.ts",
    "d1-store": "src/d1-store.ts",
    resources: "src/resources.ts",
    views: "src/views.ts",
    "mcp-client": "src/mcp-client.ts",
    "bindings/index": "src/bindings/index.ts",
    "bindings/deconfig/index": "src/bindings/deconfig/index.ts",
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
  external: [
    "node:*",
    "@cloudflare/workers-types",
    "@deco/mcp",
    "@mastra/core",
    "@modelcontextprotocol/sdk",
    "bidc",
    "drizzle-orm",
    "jose",
    "mime-db",
    "zod",
    "zod-from-json-schema",
    "zod-to-json-schema",
  ],
  esbuildPlugins: [
    {
      name: "cloudflare-externals",
      setup(build) {
        // Mark all cloudflare:* imports as external
        build.onResolve({ filter: /^cloudflare:/ }, (args) => ({
          path: args.path,
          external: true,
        }));
      },
    },
  ],
};

export default defineConfig(config);
