import { z } from "zod";

export const ChannelSchema = z.object({
  id: z.string().describe("The ID of the channel"),
  discriminator: z.string().describe("The discriminator of the channel"),
  agentId: z.string().nullable().describe("The ID of the agent the channel is linked to"),
  createdAt: z.string().describe("The date and time the channel was created"),
  updatedAt: z.string().describe("The date and time the channel was last updated"),
  workspace: z.string().describe("The workspace the channel belongs to"),
  active: z.boolean().describe("Whether the channel is active"),
});

export type Channel = z.infer<typeof ChannelSchema>;