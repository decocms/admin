import { z } from "zod";
import { callToolFor } from "../fetcher.ts";
import {
  CreateTriggerInput,
  CreateTriggerOutputSchema,
  ListTriggersOutputSchema,
} from "../models/trigger.ts";

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
    return response.json() as Promise<
      z.infer<typeof CreateTriggerOutputSchema>
    >;
  }

  throw new Error("Failed to create trigger");
};

export const deleteTrigger = async (
  context: string,
  agentId: string,
  triggerId: string,
) => {
  const response = await callToolFor(
    context,
    "TRIGGERS_DELETE",
    { agentId, triggerId },
  );

  if (!response.ok) {
    throw new Error("Failed to delete trigger");
  }
};
