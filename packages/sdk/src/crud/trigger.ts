import { MCPClient } from "../fetcher.ts";
import {
  CreateTriggerInput,
} from "../models/trigger.ts";

export const listTriggers = async (workspace: string, agentId: string) => {
  const response = await MCPClient.forWorkspace(workspace).TRIGGERS_LIST(
    { agentId },
  );

  if (response.ok) {
    return response.data
  }

  throw new Error("Failed to list triggers");
};

export const listAllTriggers = async (workspace: string) => {
  const response = await MCPClient.forWorkspace(workspace).TRIGGERS_LIST({});

  if (response.ok) {
    return response.data
  }

  throw new Error("Failed to list triggers");
};

export const createTrigger = async (
  workspace: string,
  agentId: string,
  trigger: CreateTriggerInput,
) => {
  const response = await MCPClient.forWorkspace(workspace).TRIGGERS_CREATE(
    { agentId, data: trigger },
  );

  if (response.ok) {
    return response.data
  }

  throw new Error("Failed to create trigger");
};

export const deleteTrigger = async (
  workspace: string,
  agentId: string,
  triggerId: string,
) => {
  const response = await MCPClient.forWorkspace(workspace).TRIGGERS_DELETE(
    { agentId, triggerId },
  );

  if (!response.ok) {
    throw new Error("Failed to delete trigger");
  }
};
