import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { analyzeLinks } from "./analyze";
import { analyzeLinksCached } from "./cached";
import type { CacheLayerEnv } from "../cache";

// Factory in the same style used by other deco tools (accept env even if unused)
export const createLinkAnalyzerTool = (env: CacheLayerEnv) =>
  createTool({
    id: "LINK_ANALYZER",
    description: "Analyze links for SEO purposes",
    inputSchema: z.object({
      url: z.string().url(),
      noCache: z.boolean().optional().default(false),
    }),
    outputSchema: z.object({
      status: z.number(),
      linksFound: z.number(),
      brokenLinks: z.number(),
      internalLinks: z.number(),
      externalLinks: z.number(),
      images: z.number(),
      imagesMissingAlt: z.number(),
      h1Count: z.number(),
      title: z.string().optional(),
      titleLength: z.number(),
      metaDescription: z.string().optional(),
      metaDescriptionLength: z.number(),
      wordCount: z.number(),
      canonical: z.string().optional(),
      seoScore: z.number(),
      links: z.array(z.string()),
      notes: z.string().optional(),
    }),
    execute: async ({ context }) => {
      const { url, noCache } = context;
      if (noCache) return analyzeLinks(url);
      return analyzeLinksCached(env, url);
    },
  });

// Backwards compatibility (in case it was already imported elsewhere during transition)
export const linkAnalyzerTool = createLinkAnalyzerTool({});
export * from "./analyze";
