// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import mdx from "@astrojs/mdx";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  redirects: {
    "/": "/en/introduction",
  },
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
  integrations: [
    mdx({
      rehypePlugins: [
        // rehype-mdx-code-props must run last according to docs
      ],
    }),
    react(),
  ],
  vite: {
    plugins: [
      // @ts-ignore: tailwindcss plugin type issue
      tailwindcss(),
    ],
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      defaultColor: "light",
    },
  },
});
