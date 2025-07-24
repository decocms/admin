// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import mdx from "@astrojs/mdx";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  server: {
    port: 4000,
  },
  outDir: "../server/view-build/",
  i18n: {
    locales: ["en", "pt-br"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: true,
    },
  },
  integrations: [mdx(), react()],
  vite: {
    plugins: [
      // @ts-ignore
      tailwindcss(),
    ],
  },
});