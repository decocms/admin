import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type PluginOption } from "vite";

const BLOG_URL = "https://decochatweb.deco.site";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react() as PluginOption[], tailwindcss() as PluginOption[]],
  server: {
    port: 3000,
    allowedHosts: [".deco.host"],
    proxy: {
      "/about": {
        target: BLOG_URL,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/about/, ""),
      },
      "/styles.css": {
        target: BLOG_URL,
        changeOrigin: true,
      },
      "/live/invoke": {
        target: BLOG_URL,
        changeOrigin: true,
      },
      "/blog": {
        target: BLOG_URL,
        changeOrigin: true,
      },
    },
  },
});
