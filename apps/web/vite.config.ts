import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type PluginOption } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react() as PluginOption[], tailwindcss() as PluginOption[]],
  server: { port: 3000, allowedHosts: [".deco.host"] },
  build: {
    target: ["es2022", "chrome89", "firefox89", "safari15"],
  },
  esbuild: {
    target: "es2022",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
  },
});
