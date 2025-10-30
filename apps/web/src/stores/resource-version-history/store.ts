import { MCPClient, notifyResourceUpdate, type ProjectLocator } from "@deco/sdk";
import { toast } from "sonner";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { parseToolName } from "../../utils/tool-namespace.ts";
import type { VersionEntry, VersionHistoryStore } from "./types.ts";
import { hashContent } from "./utils.ts";

const MAX_VERSIONS_PER_RESOURCE = 30;
const EMPTY_VERSIONS: VersionEntry[] = [];

function coercePersistedToolCall(
  // oxlint-disable-next-line no-explicit-any
  toolCall: any,
): VersionEntry["toolCall"] {
  if (!toolCall || typeof toolCall !== "object") return undefined;
  const { toolCallId, toolName, input } = toolCall as {
    toolCallId?: string;
    toolName?: string;
    // oxlint-disable-next-line no-explicit-any
    input?: any;
  };
  return { toolCallId, toolName, input };
}

export const createResourceVersionHistoryStore = create<VersionHistoryStore>()(
  persist(
    (set, get) => ({
      history: {},

      actions: {
        async addVersion(uri, content, toolCall, threadId) {
          const hash = await hashContent(content);
          const version: VersionEntry = {
            uri,
            hash,
            timestamp: Date.now(),
            threadId,
            content,
            toolCall: coercePersistedToolCall(toolCall),
          };

          set((state) => {
            const current = state.history[uri] ?? [];
            const next = current.length >= MAX_VERSIONS_PER_RESOURCE
              ? [...current.slice(1), version]
              : [...current, version];
            return { history: { ...state.history, [uri]: next } };
          });

          return version;
        },

        getVersions(uri) {
          return get().history[uri] ?? [];
        },

        findByHash(hash) {
          const entries = get().history;
          for (const [uri, versions] of Object.entries(entries)) {
            const found = versions.find((v) => v.hash === hash);
            if (found) return { uri, version: found };
          }
          return null;
        },

        async revertToVersion(hash, locator: ProjectLocator) {
          const match = get().actions.findByHash(hash);
          if (!match) {
            toast.error("Version not found");
            return;
          }

          const { uri, version } = match;
          const parsed = safeParseJSON(version.content);
          if (parsed === undefined) {
            toast.error("Invalid version content");
            return;
          }

          // Prefer the original toolName if present; fallback to generic UPDATE pattern
          const toolName = version.toolCall?.toolName ?? inferUpdateToolNameFromUri(uri);

          if (!toolName) {
            toast.error("Unable to infer update tool");
            return;
          }

          try {
            // Re-execute the stored tool call exactly as it was, but ensure data is the stored content
            const inputBase = (version.toolCall?.input && typeof version.toolCall.input === "object")
              ? { ...(version.toolCall.input as Record<string, unknown>) }
              : { uri };

            // Ensure required shape { uri, data }
            const payload = {
              ...inputBase,
              uri: (inputBase as { uri?: string }).uri ?? uri,
              data: parsed,
            } as Record<string, unknown>;

            // oxlint-disable-next-line no-explicit-any
            const client = MCPClient.forLocator<any>(locator, "/mcp");
            
            // Handle namespaced tool names (e.g., "i:workspace-management__DECO_RESOURCE_XXX_UPDATE")
            const parsedToolName = parseToolName(toolName);
            let result;

            if (parsedToolName) {
              // Tool name is namespaced, call via INTEGRATIONS_CALL_TOOL
              result = await client.INTEGRATIONS_CALL_TOOL({
                id: parsedToolName.integrationId,
                params: {
                  name: parsedToolName.toolName,
                  arguments: payload,
                },
              });
            } else {
              // Tool name is not namespaced, use old direct call method
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              result = await (client as any)[toolName](payload);
            }

            // Notify and toast on success
            notifyResourceUpdate(uri);
            toast.success("Resource reverted");

            return result;
          } catch (error) {
            console.error("Failed to revert resource version", error);
            toast.error("Failed to revert resource");
            throw error;
          }
        },

        clearUri(uri) {
          set((state) => {
            if (!(uri in state.history)) return state;
            const next = { ...state.history };
            delete next[uri];
            return { history: next };
          });
        },
      },
    }),
    {
      name: "resource-version-history",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ history: state.history }),
      version: 1,
      migrate: (persisted, _version) => persisted,
    },
  ),
);

function safeParseJSON(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function inferUpdateToolNameFromUri(_uri: string): string | null {
  // We cannot safely infer the resource-specific update tool name from a URI alone
  // because the resource type is not encoded in a standardized segment position for tools.
  // Rely on persisted toolCall.toolName when available.
  return null;
}

// Convenience re-exports for store consumers (atomic selectors)
export function useVersionHistoryActions() {
  return createResourceVersionHistoryStore((s) => s.actions);
}

export function useVersions(uri: string) {
  return createResourceVersionHistoryStore(
    (s) => s.history[uri] ?? EMPTY_VERSIONS,
  );
}


