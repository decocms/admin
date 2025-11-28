import * as z from "zod/v3";

export const PromptSchema = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    content: z.string(),
    readonly: z.boolean().nullish(),
    created_at: z.string(),
    updated_at: z.string().nullish(),
  }),
);

export type Prompt = z.infer<typeof PromptSchema>;
