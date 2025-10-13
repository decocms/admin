import { MCPClient } from "../fetcher.ts";
import type { CreateTriggerInput } from "../models/trigger.ts";
import { ProjectLocator } from "../locator.ts";

export interface TriggerData {
  id: string;
  type: "cron" | "webhook";
  workspace: string;
  user: {
    id: string;
    metadata: {
      email: string;
      full_name: string;
      avatar_url: string;
    };
  };
  data:
    | {
        type: "cron";
        title: string;
        agentId: string;
        prompt: {
          messages: Array<{
            content: string;
            role: "user" | "assistant" | "system";
          }>;
          threadId?: string;
          resourceId?: string;
        };
        cronExp: string;
        description?: string;
        url?: string;
      }
    | {
        type: "webhook";
        title: string;
        agentId: string;
        prompt: {
          messages: Array<{
            content: string;
            role: "user" | "assistant" | "system";
          }>;
          threadId?: string;
          resourceId?: string;
        };
        url: string;
        description?: string;
      };
  createdAt: string;
  updatedAt: string;
  active?: boolean;
}

export const getTrigger = (
  locator: ProjectLocator,
  id: string,
): Promise<TriggerData> =>
  MCPClient.forLocator(locator).TRIGGERS_GET({ id }) as Promise<TriggerData>;

export const listAllTriggers = (
  locator: ProjectLocator,
  agentId?: string,
): Promise<{ triggers: TriggerData[] }> =>
  MCPClient.forLocator(locator).TRIGGERS_LIST({ agentId }) as Promise<{
    triggers: TriggerData[];
  }>;

export const createTrigger = (
  locator: ProjectLocator,
  trigger: CreateTriggerInput,
): Promise<TriggerData> =>
  MCPClient.forLocator(locator).TRIGGERS_CREATE({
    trigger,
  }) as Promise<TriggerData>;

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
): Promise<TriggerData> =>
  MCPClient.forLocator(locator).TRIGGERS_UPDATE({
    id: triggerId,
    data: trigger,
  }) as Promise<TriggerData>;
