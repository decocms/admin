import type { Workspace } from "@deco/sdk/path";
import type {
  CreateTriggerInput,
  TriggerData,
  TriggerRun,
} from "../triggers/services.ts";

export interface WorkspaceScopedTriggersStorage {
  list(agentId?: string): Promise<TriggerData[]>;
  get(id: string): Promise<TriggerData>;
  create(
    trigger: CreateTriggerInput,
    agentId: string,
    userId?: string,
  ): Promise<TriggerData>;
  delete(id: string): Promise<void>;
  run(run: Omit<TriggerRun, "id" | "timestamp">): Promise<TriggerRun>;
  listRuns(id: string): Promise<TriggerRun[]>;
}

export interface TriggersStorage {
  for(workspace: Workspace): WorkspaceScopedTriggersStorage;
}

export interface DecoChatStorage {
  triggers?: TriggersStorage;
}

export { AgentNotFoundError, IntegrationNotFoundError } from "./error.ts";

export * from "@deco/sdk";

export { createSupabaseStorage } from "./supabaseStorage.ts";
