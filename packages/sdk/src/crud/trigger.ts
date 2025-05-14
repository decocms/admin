import { API_HEADERS, API_SERVER_URL } from "../constants.ts";
import { z } from "zod";
import { Agent } from "../models/agent.ts";
import { callToolFor } from "../fetcher.ts";
import { ListTriggersOutputSchema } from "../models/trigger.ts";

export interface Trigger {
  id: string;
  title: string;
  type: string;
  cronExp?: string;
  description?: string;
  threadId?: string;
  resourceId?: string;
  cronExpFormatted?: string;
  schema?: JSON;
  url?: string;
  prompt?: string;
  passphrase?: string;
  createdAt?: string;
  updatedAt?: string;
  agent?: Agent;
  author?: {
    id: string;
    name: string;
    avatar: string;
  };
}

const toPath = (segments: string[]) => segments.join("/");

const fetchAPI = (path: string, init?: RequestInit) =>
  fetch(new URL(path, API_SERVER_URL), {
    ...init,
    credentials: "include",
    headers: { ...API_HEADERS, ...init?.headers },
  });

export const listTriggers = async (context: string, agentId: string) => {
  const response = await callToolFor(
    context,
    "TRIGGERS_LIST",
    { agentId },
  );

  if (response.ok) {
    return (await response.json()) as {
      data: z.infer<typeof ListTriggersOutputSchema>;
    };
  }

  throw new Error("Failed to list triggers");
};

export const listAllTriggers = async (context: string) => {
  const response = await callToolFor(
    context,
    "TRIGGERS_LIST",
    {},
  );

  if (response.ok) {
    return (await response.json()) as {
      data: z.infer<typeof ListTriggersOutputSchema>;
    };
  }

  throw new Error("Failed to list triggers");
};

export const createTrigger = async (
  context: string,
  agentId: string,
  trigger: CreateTriggerInput,
) => {
  const response = await callToolFor(
    context,
    "TRIGGERS_CREATE",
    { agentId, data: trigger },
  );

  if (response.ok) {
    return response.json() as Promise<Trigger>;
  }

  throw new Error("Failed to create trigger");
};

export const deleteTrigger = async (
  context: string,
  agentId: string,
  triggerId: string,
) => {
  const response = await fetchAPI(
    toPath([context, "agent", agentId, "action", triggerId]),
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error("Failed to delete trigger");
  }
};

export const PromptSchema = z.object({
  threadId: z.string().optional().describe(
    "if not provided, the same conversation thread will be used, you can pass any string you want to use",
  ),
  resourceId: z.string().optional().describe(
    "if not provided, the same resource will be used, you can pass any string you want to use",
  ),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })).describe("The messages to send to the LLM"),
});

export const webhookTriggerSchema = z.object({
  title: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  passphrase: z.string().optional(),
  schema: z.any().optional(),
  type: z.literal("webhook"),
});

export const cronTriggerSchema = z.object({
  title: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  cronExp: z.string().min(5, "Frequency is required"),
  prompt: PromptSchema,
  type: z.literal("cron"),
});

export type CreateTriggerInput =
  | z.infer<typeof cronTriggerSchema>
  | z.infer<typeof webhookTriggerSchema>;
