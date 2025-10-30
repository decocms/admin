import type { ToolUIPart } from "ai";
import type { ProjectLocator } from "@deco/sdk";

// Minimal representation of a tool call payload we want to persist for replay
export interface PersistedToolCall {
  toolCallId?: string;
  toolName?: string;
  // oxlint-disable-next-line no-explicit-any
  input?: Record<string, any> | unknown;
}

export interface VersionEntry {
  uri: string;
  hash: string;
  timestamp: number; // epoch ms
  threadId: string;
  content: string; // serialized JSON string used for hashing and replay
  toolCall?: PersistedToolCall; // original tool call snapshot
}

export interface VersionHistoryState {
  // Keyed by resource URI
  history: Record<string, VersionEntry[]>;
}

export interface VersionHistoryActions {
  addVersion: (
    uri: string,
    content: string,
    toolCall: PersistedToolCall | ToolUIPart | undefined,
    threadId: string,
  ) => Promise<VersionEntry>;
  getVersions: (uri: string) => VersionEntry[];
  findByHash: (hash: string) => { uri: string; version: VersionEntry } | null;
  revertToVersion: (hash: string, locator: ProjectLocator) => Promise<void>;
  clearUri: (uri: string) => void;
}

export interface VersionHistoryStore extends VersionHistoryState {
  actions: VersionHistoryActions;
}
