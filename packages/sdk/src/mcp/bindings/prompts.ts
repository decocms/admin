import { z } from "zod";
import { Binder } from "./binder.ts";

const getPromptSchema = z.object({
  promptId: z.string(),
});

const createPromptSchema = z.object({
  prompt: z.string(),
});

const updatePromptSchema = z.object({
  promptId: z.string(),
  prompt: z.string(),
});

const deletePromptSchema = z.object({
  promptId: z.string(),
});

const listPromptsSchema = z.object({
  promptId: z.string(),
});

const searchPromptsSchema = z.object({
  query: z.string(),
});

export const PROMPT_BINDING_SCHEMA = [{
  name: "DECO_PROMPT_GET" as const,
  inputSchema: getPromptSchema,
  outputSchema: z.any(),
}, {
  name: "DECO_PROMPT_CREATE" as const,
  inputSchema: createPromptSchema,
  outputSchema: z.any(),
}, {
  name: "DECO_PROMPT_UPDATE" as const,
  inputSchema: updatePromptSchema,
  outputSchema: z.any(),
}, {
  name: "DECO_PROMPT_DELETE" as const,
  inputSchema: deletePromptSchema,
  outputSchema: z.any(),
}, {
  name: "DECO_PROMPTS_LIST" as const,
  inputSchema: listPromptsSchema,
  outputSchema: z.any(),
  opt: true,
}, {
  name: "DECO_PROMPT_SEARCH" as const,
  inputSchema: searchPromptsSchema,
  outputSchema: z.any(),
  opt: true,
}] as const satisfies Binder;
