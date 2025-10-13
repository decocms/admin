import { MCPClient } from "../fetcher.ts";
import type { CreateTriggerInput } from "../models/trigger.ts";
import { ProjectLocator } from "../locator.ts";

export const getTrigger = (
  locator: ProjectLocator,
  id: string,
): Promise<unknown> =>
  MCPClient.forLocator(locator).TRIGGERS_GET({ id }) as Promise<unknown>;

export const listAllTriggers = (
  locator: ProjectLocator,
  agentId?: string,
): Promise<{ triggers: unknown[] }> =>
  MCPClient.forLocator(locator).TRIGGERS_LIST({ agentId }) as Promise<{
    triggers: unknown[];
  }>;

export const createTrigger = (
  locator: ProjectLocator,
  trigger: CreateTriggerInput,
): Promise<unknown> =>
  MCPClient.forLocator(locator).TRIGGERS_CREATE({
    trigger,
  }) as Promise<unknown>;

export const deleteTrigger = (
  locator: ProjectLocator,
  triggerId: string,
): Promise<{ success: boolean }> =>
  MCPClient.forLocator(locator).TRIGGERS_DELETE({ id: triggerId }) as Promise<{
    success: boolean;
  }>;

export const activateTrigger = (
  locator: ProjectLocator,
  triggerId: string,
): Promise<{ success: boolean }> =>
  MCPClient.forLocator(locator).TRIGGERS_ACTIVATE({
    id: triggerId,
  }) as Promise<{ success: boolean }>;

export const deactivateTrigger = (
  locator: ProjectLocator,
  triggerId: string,
): Promise<{ success: boolean }> =>
  MCPClient.forLocator(locator).TRIGGERS_DEACTIVATE({
    id: triggerId,
  }) as Promise<{ success: boolean }>;

export const updateTrigger = (
  locator: ProjectLocator,
  triggerId: string,
  trigger: CreateTriggerInput,
): Promise<unknown> =>
  MCPClient.forLocator(locator).TRIGGERS_UPDATE({
    id: triggerId,
    data: trigger,
  }) as Promise<unknown>;
