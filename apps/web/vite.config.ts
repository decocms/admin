import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import inspect from "vite-plugin-inspect";

const fourMB = 4 * 1024 * 1024;

// Vite plugin to warn if using production API
function warnProductionAPI(mode: string): PluginOption {
  const env = loadEnv(mode, process.cwd(), "");
  const useLocalBackend = env.VITE_USE_LOCAL_BACKEND !== "false";

  return {
    name: "warn-production-api",
    configResolved() {
      if (!useLocalBackend) {
        function showWarningBanner() {
          console.log("\n");
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m╔═══════════════════════════════════════════════════════════════════╗\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║                                                                   ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║                      ⚠️  WARNING  ⚠️                              ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║                                                                   ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║   YOU ARE USING PRODUCTION API (VITE_USE_LOCAL_BACKEND=false)     ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║                                                                   ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║   • This impacts REAL data in production                          ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║   • API logs will NOT appear in your console                      ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║   • All changes affect the live environment                       ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║                                                                   ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║   Set VITE_USE_LOCAL_BACKEND=true or run 'bun dev' instead        ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m║                                                                   ║\x1b[0m",
          );
          console.log(
            "\x1b[41m\x1b[1m\x1b[37m╚═══════════════════════════════════════════════════════════════════╝\x1b[0m",
          );
          console.log("\n");
        }

        // Show warning after 2 seconds (after initial Vite startup logs)
        setTimeout(showWarningBanner, 2000);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    warnProductionAPI(mode),
    inspect(),
    react() as PluginOption[],
    tailwindcss() as PluginOption[],
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,ico,png,svg}"],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: fourMB,
      },
      // Force update on chunk loading errors
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: { host: "0.0.0.0", port: 4001, allowedHosts: [".deco.host"] },
  resolve: {
    conditions: ["source", "import", "module", "browser", "default"],
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
    // TODO: fix export of packages/sdk export files to not include these packages, then remove this
    exclude: ["@deco/cf-sandbox", "cloudflare:workers"],
  },
  build: {
    rollupOptions: {
      // TODO: fix export of packages/sdk export files to not include these packages, then remove this
      external: ["@deco/cf-sandbox", "cloudflare:workers"],
    },
  },
}));
