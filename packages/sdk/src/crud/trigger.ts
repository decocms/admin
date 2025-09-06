import { MCPClient } from "../fetcher.ts";
import type { CreateTriggerInput } from "../models/trigger.ts";
import { Workspace } from "../workspace.ts";

export const getTrigger = (workspace: Workspace, id: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_GET({ id });

export const listAllTriggers = (workspace: Workspace, agentId?: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_LIST({ agentId });

export const createTrigger = (workspace: Workspace, trigger: CreateTriggerInput) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_CREATE({ trigger });

export const deleteTrigger = (workspace: Workspace, triggerId: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_DELETE({ id: triggerId });

export const activateTrigger = (workspace: Workspace, triggerId: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_ACTIVATE({ id: triggerId });

export const deactivateTrigger = (workspace: Workspace, triggerId: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_DEACTIVATE({ id: triggerId });

export const updateTrigger = (
  workspace: Workspace,
  triggerId: string,
  trigger: CreateTriggerInput,
) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_UPDATE({
    id: triggerId,
    data: trigger,
  });
