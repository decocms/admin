import { z } from "zod";
import type { Binder } from "../index.ts";

const callbacksSchema = z.object({
  stream: z.string(),
  generate: z.string(),
  generateObject: z.string(),
});

const channelIdSchema = z.object({
  workspace: z.string(),
  discriminator: z.string(),
});

const channelBindingSchema = channelIdSchema.extend({
  agentId: z.string(),
});

const linkedChannelSchema = channelBindingSchema.extend({
  callbacks: callbacksSchema,
});

export type Callbacks = z.infer<typeof callbacksSchema>;
export type ChannelLinkedPayload = z.infer<typeof linkedChannelSchema>;

export const CHANNEL_BINDING_SCHEMA = [{
  name: "ON_CHANNEL_LINKED" as const,
  inputSchema: linkedChannelSchema,
  outputSchema: z.any(),
}, {
  name: "ON_CHANNEL_UNLINKED" as const,
  inputSchema: channelIdSchema,
  outputSchema: z.any(),
}] as const satisfies Binder;
