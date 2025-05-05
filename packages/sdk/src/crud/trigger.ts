import { API_HEADERS, LEGACY_API_SERVER_URL } from "../constants.ts";
import { z } from "zod";
import { Agent } from "../models/agent.ts";

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
  agent?: Agent;
  author?: {
    id: string;
    name: string;
    avatar: string;
  };
}

export interface ListTriggersResult {
  success: boolean;
  message: string;
  actions?: Trigger[];
}

export interface Run {
  id: string;
  result: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: string;
  status: string;
}

export interface ListRunsResult {
  success: boolean;
  message: string;
  runs?: Run[];
}

const toPath = (segments: string[]) => segments.join("/");

const fetchAPI = (path: string, init?: RequestInit) =>
  fetch(new URL(path, LEGACY_API_SERVER_URL), {
    ...init,
    credentials: "include",
    headers: { ...API_HEADERS, ...init?.headers },
  });

export const listTriggers = async (context: string, agentId: string) => {
  const response = await fetchAPI(
    toPath([context, "agent", agentId, "actions"]),
  );

  if (response.ok) {
    return response.json() as Promise<ListTriggersResult>;
  }

  throw new Error("Failed to list actions");
};

export const listAllTriggers = async (context: string) => {
  const response = await fetchAPI(
    toPath([context, "actions"]),
  );

  if (response.ok) {
    return response.json() as Promise<ListTriggersResult>;
  }

  throw new Error("Failed to list actions");
};

export const listRuns = async (
  context: string,
  agentId: string,
  triggerId: string,
) => {
  const response = await fetchAPI(
    toPath([context, "agent", agentId, "action", triggerId, "runs"]),
  );

  if (response.ok) {
    return response.json() as Promise<ListRunsResult>;
  }

  throw new Error("Failed to list runs");
};

export const createTrigger = async (
  context: string,
  agentId: string,
  trigger: CreateTriggerInput,
) => {
  const response = await fetchAPI(
    toPath([context, "agent", agentId, "action"]),
    {
      method: "POST",
      body: JSON.stringify({ trigger }),
    },
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
