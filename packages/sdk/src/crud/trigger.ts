import { MCPClient } from "../fetcher.ts";
import type { CreateTriggerInput } from "../models/trigger.ts";
import { ProjectLocator } from "../locator.ts";

export const getTrigger = (workspace: ProjectLocator, id: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_GET({ id });

export const listAllTriggers = (workspace: ProjectLocator, agentId?: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_LIST({ agentId });

export const createTrigger = (
  workspace: ProjectLocator,
  trigger: CreateTriggerInput,
) => MCPClient.forWorkspace(workspace).TRIGGERS_CREATE({ trigger });

export const deleteTrigger = (workspace: ProjectLocator, triggerId: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_DELETE({ id: triggerId });

export const activateTrigger = (workspace: ProjectLocator, triggerId: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_ACTIVATE({ id: triggerId });

export const deactivateTrigger = (workspace: ProjectLocator, triggerId: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_DEACTIVATE({ id: triggerId });

export const updateTrigger = (
  workspace: ProjectLocator,
  triggerId: string,
  trigger: CreateTriggerInput,
) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_UPDATE({
    id: triggerId,
    data: trigger,
  });
