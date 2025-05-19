import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type PluginOption } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react() as PluginOption[], tailwindcss() as PluginOption[]],
  server: { port: 3000, allowedHosts: [".deco.host"] },
});
