import { type Tool } from "../rich-text.tsx";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import tippy, { type Instance, type Props } from "tippy.js";
import { callTool } from "@deco/sdk";

export interface ToolOption {
  id: string;
  type: "tool";
  label: string;
  description?: string;
  tool: Tool;
}

export interface ResourceOption {
  id: string;
  type: "resource";
  label: string;
  description?: string;
  resource: {
    name: string;
    title?: string;
    description?: string;
    uri: string;
    mimeType?: string;
    annotations?: Record<string, string>;
  };
  integration: { id: string; name: string; icon?: string };
  resourceType: string;
  connection: unknown;
}

type SuggestionItem = ToolOption | ResourceOption;

export const suggestion: (args: {
  tools: Tool[];
  resourceSearchers: Array<{
    integration: { id: string; name: string; icon?: string };
    connection: unknown;
    searchToolNames: string[];
  }>;
}) => Partial<SuggestionOptions<SuggestionItem>> = ({
  tools,
  resourceSearchers,
}) => {
  return {
    char: "@",
    items: (props) => {
      const { query } = props;
      const ql = query?.toLowerCase() ?? "";
      const filteredTools = tools.filter((tool) => {
        return (
          tool.name.toLowerCase().includes(ql) ||
          tool.description?.toLowerCase().includes(ql) ||
          tool.integration.name.toLowerCase().includes(ql)
        );
      });
      const toolItems: ToolOption[] = filteredTools
        .map(
          (tool): ToolOption => ({
            id: tool.id,
            type: "tool",
            label: tool.name,
            description: tool.description,
            tool,
          }),
        )
        .slice(0, 10);
      return toolItems as SuggestionItem[];
    },
    render: () => {
      let component: ReactRenderer | null = null;
      let popup: Instance<Props>[] | null = null;
      let activeSerial = 0;
      let debounceTimer: number | undefined;

      const perIntegrationLimit = 5;
      const updateProgressively = (
        baseProps: Record<string, unknown>,
        baseItems: SuggestionItem[],
        query: string,
      ) => {
        const mySerial = ++activeSerial;
        const q = query.trim();
        if (!q || q.length < 2 || resourceSearchers.length === 0) {
          component?.updateProps({
            ...baseProps,
            items: baseItems,
            isLoading: false,
            pendingCategories: [],
          });
          return;
        }

        // Seed with base items immediately
        component?.updateProps({
          ...baseProps,
          items: baseItems,
          isLoading: true,
        });

        const accum: ResourceOption[] = [];
        const pendingCount = new Map<string, number>(); // key = `${serverId}:${resourceType}`

        // Prime pending counts
        component?.updateProps({
          ...baseProps,
          items: baseItems,
          isLoading: true,
          pendingCategories: Array.from(pendingCount.keys()),
        });

        const searches = resourceSearchers.flatMap((searcher) =>
          searcher.searchToolNames.map((toolName) => {
            const resourceType =
              toolName.match(/^DECO_CHAT_RESOURCES_SEARCH_([A-Z]+)$/)?.[1] ??
              "";
            const pendingKey = `${searcher.integration.id}:${resourceType}`;
            return callTool(searcher.connection as never, {
              name: toolName,
              // NOTE: we no longer know resourceType from tool name; this path likely needs updated
              arguments: {
                name: resourceType,
                term: q,
                limit: perIntegrationLimit,
              },
            })
              .then((result: unknown) => {
                if (mySerial !== activeSerial) return; // cancelled
                const structured = result as {
                  structuredContent?: { items?: unknown[] };
                };
                const items = structured?.structuredContent?.items ?? [];
                if (!Array.isArray(items)) return;
                const mapped = items
                  .slice(0, perIntegrationLimit)
                  .map((r: unknown): ResourceOption => {
                    const resource = r as Record<string, unknown>;
                    return {
                      id:
                        (resource?.uri as string) ??
                        `${searcher.integration.id}:${
                          (resource?.name as string) ?? ""
                        }`,
                      type: "resource",
                      label:
                        (resource?.title as string) ??
                        (resource?.name as string) ??
                        (resource?.uri as string) ??
                        "Unknown",
                      description: resource?.description as string | undefined,
                      resource: {
                        name: resource?.name as string,
                        title: resource?.title as string | undefined,
                        description: resource?.description as
                          | string
                          | undefined,
                        uri: resource?.uri as string,
                        mimeType: resource?.mimeType as string | undefined,
                        annotations: resource?.annotations as
                          | Record<string, string>
                          | undefined,
                      },
                      integration: searcher.integration,
                      resourceType,
                      connection: searcher.connection,
                    };
                  });
                accum.push(...mapped);
                if (mySerial !== activeSerial) return; // cancelled
                const combined = [...accum, ...baseItems].slice(0, 12);
                component?.updateProps({
                  ...baseProps,
                  items: combined,
                  isLoading: true,
                  pendingCategories: Array.from(pendingCount.keys()),
                });
              })
              .catch(() => {
                // ignore
              })
              .finally(() => {
                if (mySerial !== activeSerial) return;
                const remaining = (pendingCount.get(pendingKey) ?? 1) - 1;
                if (remaining <= 0) pendingCount.delete(pendingKey);
                else pendingCount.set(pendingKey, remaining);
                component?.updateProps({
                  ...baseProps,
                  items: [...accum, ...baseItems].slice(0, 12),
                  isLoading: pendingCount.size > 0,
                  pendingCategories: Array.from(pendingCount.keys()),
                });
              });
          }),
        );
        // Finalize loading state once all searches have settled
        Promise.allSettled(searches).then(() => {
          if (mySerial !== activeSerial) return; // cancelled
          const combined = [...accum, ...baseItems].slice(0, 12);
          component?.updateProps({
            ...baseProps,
            items: combined,
            isLoading: false,
            pendingCategories: Array.from(pendingCount.keys()),
          });
        });
      };

      const computeBaseItems = (
        query: string,
        toolsArg: Tool[],
      ): SuggestionItem[] => {
        const ql = query?.toLowerCase() ?? "";
        const filtered = toolsArg.filter(
          (tool) =>
            tool.name.toLowerCase().includes(ql) ||
            tool.description?.toLowerCase().includes(ql) ||
            tool.integration.name.toLowerCase().includes(ql),
        );
        return filtered
          .map(
            (tool): ToolOption => ({
              id: tool.id,
              type: "tool",
              label: tool.name,
              description: tool.description,
              tool,
            }),
          )
          .slice(0, 10);
      };

      return {
        onStart: async (props) => {
          if (component) {
            component.destroy();
          }

          const { default: ToolMentionDropdown } = await import(
            "./tool-mention-dropdown.tsx"
          );

          component = new ReactRenderer(ToolMentionDropdown, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          // @ts-expect-error - tippy is not well typed
          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component?.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "top-start",
            maxWidth: 400,
          });

          // Progressive update kick-off
          const baseItems = computeBaseItems(props.query ?? "", tools);
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = globalThis.setTimeout(() => {
            updateProgressively(
              props as unknown as Record<string, unknown>,
              baseItems,
              props.query ?? "",
            );
          }, 150) as unknown as number;
        },

        onUpdate(props) {
          popup?.[0]?.setProps({
            // @ts-expect-error - tippy is not well typed
            getReferenceClientRect: props.clientRect,
          });

          const baseItems = computeBaseItems(props.query ?? "", tools);
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = globalThis.setTimeout(() => {
            updateProgressively(
              props as unknown as Record<string, unknown>,
              baseItems,
              props.query ?? "",
            );
          }, 150) as unknown as number;
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }

          // @ts-expect-error - component.ref is not typed
          return component?.ref?.onKeyDown(props);
        },

        onExit() {
          popup?.[0]?.destroy?.();
          component?.destroy?.();
        },
      };
    },
  };
};
