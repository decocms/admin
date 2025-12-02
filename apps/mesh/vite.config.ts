import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import deco from "@decocms/vite-plugin";

function customServerMessage(): Plugin {
  return {
    name: "custom-server-message",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          const green = "\x1b[32m";
          const cyan = "\x1b[36m";
          const reset = "\x1b[0m";
          const bold = "\x1b[1m";
          const dim = "\x1b[2m";

          const configuredPort = server.config.server?.port;
          const port =
            typeof configuredPort === "number" ? configuredPort : 3000;

          console.log("");
          console.log(
            `${bold}${green}  Powered by DecoCMS${reset} ${dim}→ https://decocms.com${reset}`,
          );
          console.log("");
          console.log(`  ${bold}🚀 MCP Mesh Client${reset}`);
          console.log(
            `  ${dim}➜${reset}  ${bold}Local:${reset}     ${cyan}http://0.0.0.0:${port}/${reset}`,
          );
          console.log("");
        }, 200);
      });
    },
  };
}

export default defineConfig({
  server: {
    port: 4000,
  },
  clearScreen: false,
  logLevel: "warn",
  plugins: [
    customServerMessage(),
    react(),
    tailwindcss(),
    tsconfigPaths({ root: "." }),
    deco({
      target: "bun",
    }),
  ],
});
