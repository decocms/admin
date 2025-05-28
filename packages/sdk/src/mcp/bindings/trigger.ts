import { z } from "zod";
import type { Binder } from "../index.ts";

const callbacksSchema = z.object({
  stream: z.string(),
  generate: z.string(),
  generateObject: z.string(),
});

const inputBindingSchema = z.object({
  callbacks: callbacksSchema,
  triggerId: z.string(),
  workspace: z.string(),
});

export type Callbacks = z.infer<typeof callbacksSchema>;
export type InputBindingPayload = z.infer<typeof inputBindingSchema>;

export const TRIGGER_INPUT_BINDING_SCHEMA = [{
  name: "ON_BINDING_DELETED" as const,
  inputSchema: z.object({
    triggerId: z.string(),
    workspace: z.string(),
  }),
  outputSchema: z.any(),
}, {
  name: "ON_BINDING_CREATED" as const,
  inputSchema: inputBindingSchema,
  outputSchema: z.any(),
}] as const satisfies Binder;
