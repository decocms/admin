import { ScrollArea, ScrollBar } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { SuggestionProps } from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useAgentSettingsToolsSet } from "../../../hooks/use-agent-settings-tools-set.ts";
import { IntegrationAvatar } from "../../common/avatar/integration.tsx";
import { type ResourceOption, type ToolOption } from "./tool-suggestion.ts";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { callTool } from "@deco/sdk";
import {
  dispatchResourceError,
  dispatchResourceLoaded,
  dispatchResourceLoading,
} from "../../../utils/events.ts";

interface ToolMentionDropdownProps {
  items: Array<ToolOption | ResourceOption>;
  command: (item: ToolOption | ResourceOption) => void;
  editor: unknown;
  isLoading?: boolean;
  pendingCategories?: string[]; // keys: `${serverId}:${resourceType}`
}

export default forwardRef<
  { onKeyDown: (props: SuggestionProps) => boolean },
  ToolMentionDropdownProps
>(function ToolMentionDropdown(
  { items, command, isLoading, pendingCategories },
  ref,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { appendIntegrationTool } = useAgentSettingsToolsSet();
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) {
      command(item);
      if ((item as ToolOption).type === "tool") {
        const toolItem = item as ToolOption;
        // Add the specific tool to the existing tools for this integration
        appendIntegrationTool(toolItem.tool.integration.id, toolItem.tool.name);
      } else {
        // Resource: show loading in ContextResources, then read and append
        const resource = item as ResourceOption;
        const clientId =
          `${resource.integration.id}:${resource.resource.uri}:${Date.now()}`;
        dispatchResourceLoading({
          clientId,
          name: resource.resource.name || resource.label ||
            resource.resource.uri,
          contentType: resource.resource.mimeType,
        });
        // Fire-and-forget to avoid blocking selection UX
        (async () => {
          try {
            const result = (await callTool(resource.connection as never, {
              name: "DECO_CHAT_RESOURCES_READ",
              arguments: {
                name: resource.resourceType,
                uri: resource.resource.uri,
              },
            })) as { structuredContent?: unknown };

            const sc = result?.structuredContent as
              | { mimeType?: string; data?: string; type?: "text" | "blob" }
              | { mimeType?: string; text?: string }
              | { mimeType?: string; blob?: string };
            if (!sc) {
              dispatchResourceError({ clientId, error: "No content returned" });
              return;
            }

            let dataUrl: string | null = null;
            let contentType = (sc as { mimeType?: string })?.mimeType;
            if ("text" in sc && typeof sc.text === "string") {
              const ct = contentType || "text/plain";
              // Encode text content as base64 to satisfy consumers that require base64 media
              const base64 = btoa(unescape(encodeURIComponent(sc.text)));
              dataUrl = `data:${ct};base64,${base64}`;
              contentType = ct;
            } else if ("blob" in sc && typeof sc.blob === "string") {
              const ct = contentType || "application/octet-stream";
              dataUrl = `data:${ct};base64,${sc.blob}`;
              contentType = ct;
            }

            if (dataUrl) {
              dispatchResourceLoaded({
                clientId,
                url: dataUrl,
                name: resource.resource.name ||
                  resource.label ||
                  resource.resource.uri,
                contentType,
              });
            } else {
              dispatchResourceError({
                clientId,
                error: "Unsupported content format",
              });
            }
          } catch (err) {
            // swallow errors to avoid breaking mention UX
            console.error("Failed to read resource", err);
            dispatchResourceError({
              clientId,
              error: err instanceof Error ? err.message : "Failed to read",
            });
          }
        })();
      }
    }
  };

  const scrollSelectedIntoView = (index: number) => {
    const selectedElement = itemRefs.current[index];
    if (selectedElement && scrollAreaRef.current) {
      selectedElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  };

  const upHandler = () => {
    const newIndex = (selectedIndex + items.length - 1) % items.length;
    setSelectedIndex(newIndex);
    scrollSelectedIntoView(newIndex);
  };

  const downHandler = () => {
    const newIndex = (selectedIndex + 1) % items.length;
    setSelectedIndex(newIndex);
    scrollSelectedIntoView(newIndex);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => {
    setSelectedIndex(0);
    // Reset refs array when items change
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (props: SuggestionProps) => {
      const event = (props as { event?: KeyboardEvent }).event;

      if (event?.key === "ArrowUp") {
        event.preventDefault();
        upHandler();
        return true;
      }

      if (event?.key === "ArrowDown") {
        event.preventDefault();
        downHandler();
        return true;
      }

      if (event?.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[300px] overflow-hidden">
        {isLoading
          ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size="xs" />
              Searching...
            </div>
          )
          : <div className="text-sm text-muted-foreground">No results</div>}
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg min-w-[300px] max-w-[400px] overflow-hidden">
      <ScrollArea
        className="h-[300px] w-full max-w-[400px]"
        ref={scrollAreaRef}
      >
        <div className="p-1 max-w-[400px]">
          {isLoading && (
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <Spinner size="xs" />
              Searching...
            </div>
          )}

          {(() => {
            // Group by server for display only, preserving keyboard indices
            type AnyItem = ToolOption | ResourceOption;
            const groups: Array<{
              server: { id: string; name: string; icon?: string };
              indices: number[];
            }> = [];
            const indexByServer = new Map<string, number>();

            function getServer(item: AnyItem) {
              return (item as ToolOption).type === "tool"
                ? (item as ToolOption).tool.integration
                : (item as ResourceOption).integration;
            }

            items.forEach((item, idx) => {
              const server = getServer(item as AnyItem);
              const pos = indexByServer.get(server.id);
              if (pos === undefined) {
                indexByServer.set(server.id, groups.length);
                groups.push({ server, indices: [idx] });
              } else {
                groups[pos].indices.push(idx);
              }
            });

            let renderIndex = -1;

            return groups.map((group) => (
              <div key={`group-${group.server.id}`} className="mb-1">
                {(() => {
                  // Build categories for this server: Tools, and each resourceType
                  const toolIdxs: number[] = [];
                  const byType = new Map<string, number[]>();
                  for (const originalIdx of group.indices) {
                    const it = items[originalIdx] as AnyItem;
                    if ((it as ToolOption).type === "tool") {
                      toolIdxs.push(originalIdx);
                    } else {
                      const rType = (it as ResourceOption).resourceType ||
                        "Resources";
                      const arr = byType.get(rType) ?? [];
                      arr.push(originalIdx);
                      byType.set(rType, arr);
                    }
                  }

                  const sections: Array<{ label: string; list: number[] }> = [];
                  if (toolIdxs.length) {
                    sections.push({ label: "Tools", list: toolIdxs });
                  }
                  // Sort resource categories by label for consistency
                  for (const label of Array.from(byType.keys()).sort()) {
                    const list = byType.get(label)!;
                    sections.push({ label, list });
                  }

                  const totalItemsInServer = sections.reduce(
                    (acc, s) =>
                      acc + s.list.length,
                    0,
                  );
                  if (totalItemsInServer === 0 && isLoading) {
                    // Show placeholder header with spinner when server has no results yet
                    return (
                      <div className="px-2 py-1 flex items-center justify-between bg-muted/40 rounded-md">
                        <div className="flex items-center gap-2 min-w-0">
                          <IntegrationAvatar
                            url={group.server.icon}
                            fallback={group.server.name}
                            size="xs"
                            className="flex-shrink-0 w-4 h-4"
                          />
                          <span className="text-xs font-semibold truncate">
                            {group.server.name} — Searching…
                          </span>
                        </div>
                        <Spinner size="xs" />
                      </div>
                    );
                  }

                  return sections.map((section) => (
                    <div
                      key={`section-${group.server.id}-${section.label}`}
                      className="mb-1"
                    >
                      <div className="px-2 py-1 flex items-center justify-between bg-muted/40 rounded-md">
                        <div className="flex items-center gap-2 min-w-0">
                          <IntegrationAvatar
                            url={group.server.icon}
                            fallback={group.server.name}
                            size="xs"
                            className="flex-shrink-0 w-4 h-4"
                          />
                          <span className="text-xs font-semibold truncate">
                            {group.server.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {section.label}
                          </span>
                          {section.label !== "Tools" &&
                              pendingCategories?.includes(
                                `${group.server.id}:${section.label}`,
                              )
                            ? <Spinner size="xs" />
                            : null}
                        </div>
                      </div>
                      {section.list.map((originalIdx) => {
                        const item = items[originalIdx] as AnyItem;
                        renderIndex += 1;
                        return (
                          <button
                            type="button"
                            key={item.id}
                            ref={(el) => {
                              itemRefs.current[renderIndex] = el;
                            }}
                            className={cn(
                              "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-left transition-colors",
                              "hover:bg-muted/50",
                              selectedIndex === renderIndex && "bg-muted",
                            )}
                            onClick={() => selectItem(renderIndex)}
                          >
                            {(item as ToolOption).type === "tool"
                              ? (
                                <div className="flex min-w-0 flex-1 max-w-[320px]">
                                  <div className="flex items-center text-sm truncate">
                                    <span className="font-medium">
                                      {(item as ToolOption).tool.name}
                                    </span>
                                    {(item as ToolOption).tool.description
                                      ? (
                                        <>
                                          <span className="mx-1 text-muted-foreground">
                                            -
                                          </span>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="text-muted-foreground truncate inline-block align-baseline max-w-full">
                                                {(item as ToolOption).tool
                                                  .description}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {(item as ToolOption).tool
                                                .description}
                                            </TooltipContent>
                                          </Tooltip>
                                        </>
                                      )
                                      : null}
                                  </div>
                                </div>
                              )
                              : (
                                <div className="flex min-w-0 flex-1 max-w-[320px]">
                                  <div className="flex items-center text-sm truncate">
                                    <span className="font-medium">
                                      {(item as ResourceOption).label}
                                    </span>
                                    {(item as ResourceOption).description
                                      ? (
                                        <>
                                          <span className="mx-1 text-muted-foreground">
                                            -
                                          </span>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="text-muted-foreground truncate inline-block align-baseline max-w-full">
                                                {(item as ResourceOption)
                                                  .description}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {(item as ResourceOption)
                                                .description}
                                            </TooltipContent>
                                          </Tooltip>
                                        </>
                                      )
                                      : null}
                                  </div>
                                </div>
                              )}
                          </button>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            ));
          })()}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
});
