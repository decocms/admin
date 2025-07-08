import type { CreateTriggerInput, ListTriggersOutput } from "@deco/sdk";

export type TriggerData = CreateTriggerInput & {
  id: string;
  resourceId?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: {
    id: string;
    name: string;
    email: string;
    avatar: string;
  };
};

export interface TriggerListResult {
  success: boolean;
  message: string;
  triggers: ListTriggersOutput["triggers"];
}

export interface TriggerRun {
  id: string;
  triggerId: string;
  timestamp: string;
  result: Record<string, unknown> | null;
  status: string;
  metadata: Record<string, unknown> | null;
}

export interface TriggerRunListResult {
  success: boolean;
  message: string;
  runs: TriggerRun[] | undefined;
}
