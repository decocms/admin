import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

export const collections = {
  docs: defineCollection({
    loader: glob({ pattern: "**/*.mdx", base: "./src/content" }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      icon: z.string().optional(),
    }),
  }),
};
