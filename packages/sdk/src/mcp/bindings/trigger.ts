import { z } from "zod";

const callbacksSchema = z.object({
  stream: z.string(),
  generate: z.string(),
  generateObject: z.string(),
});

const inputBindingSchema = z.object({
  payload: z.any(),
  callbacks: callbacksSchema,
});

const outputBindingSchema = z.object({
  callbacks: callbacksSchema,
});
export type Callbacks = z.infer<typeof callbacksSchema>;
export type InputBindingPayload = z.infer<typeof inputBindingSchema>;
export type OutputBindingPayload = z.infer<typeof outputBindingSchema>;

export const TRIGGER_INPUT_BINDING_DEFINITION = [{
  name: "ON_AGENT_INPUT" as const,
  inputSchema: inputBindingSchema,
  outputSchema: z.any(),
}] as const;

export const TRIGGER_OUTPUT_BINDING_DEFINITION = [{
  name: "ON_AGENT_OUTPUT" as const,
  inputSchema: outputBindingSchema,
  outputSchema: z.any(),
}] as const;
