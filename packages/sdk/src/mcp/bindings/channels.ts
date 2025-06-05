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

const joinChannelSchema = channelBindingSchema.extend({
  callbacks: callbacksSchema,
});

export type Callbacks = z.infer<typeof callbacksSchema>;
export type JoinedChannelPayload = z.infer<typeof joinChannelSchema>;

export const CHANNEL_BINDING_SCHEMA = [{
  name: "JOIN_CHANNEL" as const,
  inputSchema: joinChannelSchema,
  outputSchema: z.any(),
}, {
  name: "LEAVE_CHANNEL" as const,
  inputSchema: channelIdSchema,
  outputSchema: z.any(),
}] as const satisfies Binder;
