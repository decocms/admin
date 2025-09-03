import { z } from "zod";

export const ViewsListOutputSchema = z.object({
  views: z.array(
    z.object({
      title: z.string(),
      icon: z.string(),
      url: z.string(),
      tools: z.array(z.string()).optional().default([]),
      rules: z.array(z.string()).optional().default([]),
    }),
  ),
});

export type ViewsListOutput = z.infer<typeof ViewsListOutputSchema>;
