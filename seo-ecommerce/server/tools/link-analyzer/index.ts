import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { analyzeLinks } from "./analyze";

// Factory in the same style used by other deco tools (accept env even if unused)
export const createLinkAnalyzerTool = (_env: unknown) =>
  createTool({
    id: "LINK_ANALYZER",
    description: "Analyze links for SEO purposes",
    inputSchema: z.object({
      url: z.string().url(),
    }),
    outputSchema: z.object({
      linksFound: z.number(),
      brokenLinks: z.number(),
      seoScore: z.number(),
    }),
    execute: async ({ context }) => {
      const { url } = context;
      const { linksFound, brokenLinks, seoScore } = analyzeLinks(url);
      return { linksFound, brokenLinks, seoScore };
    },
  });

// Backwards compatibility (in case it was already imported elsewhere during transition)
export const linkAnalyzerTool = createLinkAnalyzerTool(undefined);
export * from './analyze';
