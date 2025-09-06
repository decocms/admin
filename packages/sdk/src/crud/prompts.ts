import { MCPClient } from "../fetcher.ts";
import type { Prompt, PromptVersion } from "../models/index.ts";
import { Workspace } from "../workspace.ts";

export const listPrompts = (
  workspace: Workspace,
  input?: {
    ids?: string[];
    resolveMentions?: boolean;
    excludeIds?: string[];
  },
  init?: RequestInit,
  client?: ReturnType<(typeof MCPClient)["forWorkspace"]>,
): Promise<Prompt[]> =>
  (client ?? MCPClient.forWorkspace(workspace))
    .PROMPTS_LIST(input || {}, init)
    .then((res) => res.items) as Promise<Prompt[]>;

export const getPrompt = (
  workspace: Workspace,
  id: string,
  init?: RequestInit,
): Promise<Prompt> =>
  MCPClient.forWorkspace(workspace).PROMPTS_GET(
    { id },
    init,
  ) as Promise<Prompt>;

export interface CreatePromptInput {
  name: string;
  description?: string;
  content: string;
  [key: string]: unknown;
}

export const createPrompt = (
  workspace: Workspace,
  input: CreatePromptInput,
  init?: RequestInit,
): Promise<Prompt> =>
  MCPClient.forWorkspace(workspace).PROMPTS_CREATE(
    input,
    init,
  ) as Promise<Prompt>;

export interface UpdatePromptInput {
  id: string;
  data: Partial<Pick<Prompt, "name" | "description" | "content">>;
  versionName?: string;
  [key: string]: unknown;
}

export const updatePrompt = (
  workspace: Workspace,
  input: UpdatePromptInput,
  init?: RequestInit,
): Promise<Prompt> =>
  MCPClient.forWorkspace(workspace).PROMPTS_UPDATE(
    input,
    init,
  ) as Promise<Prompt>;

export const deletePrompt = (
  workspace: Workspace,
  id: string,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forWorkspace(workspace).PROMPTS_DELETE({ id }, init) as Promise<{
    success: boolean;
  }>;

interface SearchPromptsInput {
  query: string;
  limit?: number;
  offset?: number;
}

export const searchPrompts = (
  workspace: Workspace,
  input: SearchPromptsInput,
  init?: RequestInit,
): Promise<Prompt[]> =>
  MCPClient.forWorkspace(workspace).PROMPTS_SEARCH(input, init) as Promise<
    Prompt[]
  >;

interface GetPromptVersionsInput {
  id: string;
  limit?: number;
  offset?: number;
}

export const getPromptVersions = (
  workspace: Workspace,
  input: GetPromptVersionsInput,
  init?: RequestInit,
): Promise<PromptVersion[]> =>
  MCPClient.forWorkspace(workspace).PROMPTS_GET_VERSIONS(
    input,
    init,
  ) as Promise<PromptVersion[]>;

interface RenamePromptVersionInput {
  id: string;
  versionName: string;
}

export const renamePromptVersion = (
  workspace: Workspace,
  input: RenamePromptVersionInput,
  init?: RequestInit,
): Promise<PromptVersion> =>
  MCPClient.forWorkspace(workspace).PROMPTS_RENAME_VERSION(
    input,
    init,
  ) as Promise<PromptVersion>;
