import { z } from "zod";
import type { Binder } from "../index.ts";

const callbacksSchema = z.object({
  stream: z.string(),
  generate: z.string(),
  generateObject: z.string(),
});

const inputBindingSchema = z.object({
  payload: z.any(),
  callbacks: callbacksSchema,
  headers: z.record(z.string(), z.string()).optional(),
  url: z.string().optional(),
});

const outputBindingSchema = z.object({
  callbacks: callbacksSchema,
});
export type Callbacks = z.infer<typeof callbacksSchema>;
export type InputBindingPayload = z.infer<typeof inputBindingSchema>;
export type OutputBindingPayload = z.infer<typeof outputBindingSchema>;

export const TRIGGER_INPUT_BINDING_SCHEMA = [{
  name: "ON_AGENT_INPUT" as const,
  inputSchema: inputBindingSchema,
  outputSchema: z.any(),
}] as const satisfies Binder;

export const TRIGGER_OUTPUT_BINDING_SCHEMA = [{
  name: "ON_AGENT_OUTPUT" as const,
  inputSchema: outputBindingSchema,
  outputSchema: z.any(),
}] as const satisfies Binder;
