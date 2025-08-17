// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  server: {
    port: 4000,
  },
  site: "https://seo-ecommercex.deco.page",
  outDir: "../server/view-build/",
  output: "server",
  adapter: cloudflare({ mode: "directory" }),
  vite: {
    define: {
      __BUILD_ID__: JSON.stringify(
        process.env.BUILD_ID || Date.now().toString(36),
      ),
    },
  },
  integrations: [
    starlight({
      title: "SEO Ecommerce Tools",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/withastro/starlight",
        },
      ],
      sidebar: [
        { label: "Início", items: [{ label: "Home", slug: "index" }] },
        {
          label: "Ferramentas",
          items: [{ label: "Link Analyzer", slug: "tools/link-analyzer" }],
        },
        { label: "Referência", autogenerate: { directory: "reference" } },
        {
          label: "Conta",
          items: [{ label: "Minhas Análises", slug: "minhas-analises" }],
        },
      ],
      customCss: ["./src/styles/global.css"],
    }),
  ],
});
