import { MCPClient } from "../fetcher.ts";
import type { CreateTriggerInput } from "../models/trigger.ts";
import { ProjectLocator } from "../locator.ts";

export const getTrigger = (locator: ProjectLocator, id: string) =>
  MCPClient.forLocator(locator).TRIGGERS_GET({ id });

export const listAllTriggers = (locator: ProjectLocator, agentId?: string) =>
  MCPClient.forLocator(locator).TRIGGERS_LIST({ agentId });

export const createTrigger = (
  locator: ProjectLocator,
  trigger: CreateTriggerInput,
) => MCPClient.forLocator(locator).TRIGGERS_CREATE({ trigger });

export const deleteTrigger = (locator: ProjectLocator, triggerId: string) =>
  MCPClient.forLocator(locator).TRIGGERS_DELETE({ id: triggerId });

export const activateTrigger = (locator: ProjectLocator, triggerId: string) =>
  MCPClient.forLocator(locator).TRIGGERS_ACTIVATE({ id: triggerId });

export const deactivateTrigger = (
  locator: ProjectLocator,
  triggerId: string,
) => MCPClient.forLocator(locator).TRIGGERS_DEACTIVATE({ id: triggerId });

export const updateTrigger = (
  locator: ProjectLocator,
  triggerId: string,
  trigger: CreateTriggerInput,
) =>
  MCPClient.forLocator(locator).TRIGGERS_UPDATE({
    id: triggerId,
    data: trigger,
  });
