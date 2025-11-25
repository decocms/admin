/**
 * Chat Threads System Types
 * Extracted from apps/web ThreadProvider for reusability across apps
 */

import type { UIMessage } from "ai";

export type ContextItemType = "rule" | "file" | "toolset" | "resource";

export interface BaseContextItem {
  id: string;
  type: ContextItemType;
}

export interface RuleContextItem extends BaseContextItem {
  type: "rule";
  text: string;
}

export interface FileContextItem extends BaseContextItem {
  type: "file";
  file: File;
  url?: string;
  status: "uploading" | "success" | "error";
  error?: Error;
}

export interface ToolsetContextItem extends BaseContextItem {
  type: "toolset";
  integrationId: string;
  enabledTools: string[];
}

export interface ResourceContextItem extends BaseContextItem {
  type: "resource";
  uri: string; // Format: rsc://integration-id/resource-name/resource-id
  name?: string;
  resourceType?: string; // "tool", "workflow", "agent", "document", "view"
  icon?: string;
}

export type ContextItem =
  | RuleContextItem
  | FileContextItem
  | ToolsetContextItem
  | ResourceContextItem;

/**
 * Canvas tab - represents a tab in the canvas/view area
 */
export interface CanvasTab {
  id: string;
  type: "list" | "detail" | "page";
  resourceUri: string; // Required: uniquely identifies the tab
  title: string;
  icon?: string;
  rules?: string[]; // View-specific rules to include in AI context
  integrationId?: string; // Integration ID for views with rules
}

/**
 * Thread data - stores ID, timestamps, visibility, tabs, context items, and messages
 */
export interface ThreadData {
  id: string;
  createdAt: number;
  updatedAt: number;
  hidden?: boolean;
  tabs: CanvasTab[];
  activeTabId: string | null;
  contextItems?: ContextItem[]; // Only serializable items (rules, toolsets)
  messages?: UIMessage[]; // Chat history for this thread (using AI SDK format)
}

/**
 * Thread manager state stored in localStorage
 */
export interface ThreadManagerState {
  threads: Record<string, ThreadData>;
  activeThreadId: string;
}
