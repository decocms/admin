export * from "./vector-storage.ts";
export * from "./supabase/index.ts";

export interface Thread {
  threadId: string;
  resourceId: string;
  title?: string;
  metadata?: Record<string, unknown>;
}
