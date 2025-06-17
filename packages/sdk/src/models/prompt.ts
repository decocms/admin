import { z } from "zod";

/**
 * Schema for prompt validation
 */
export const PromptValidationSchema = z.object({
  id: z.string().describe("The prompt ID"),
  name: z.string().describe("The prompt name"),
  description: z.string().nullable().describe("The prompt description"),
  content: z.string().describe("The prompt content"),
  created_at: z.string().describe("The prompt creation date"),
  updated_at: z.string().nullable().describe("The prompt update date"),
});

export type Prompt = z.infer<typeof PromptValidationSchema>;
