import { ScrollArea, ScrollBar } from "@deco/ui/components/scroll-area.js";
import { Spinner } from "@deco/ui/components/spinner.js";
import { cn } from "@deco/ui/lib/utils.js";
import type { SuggestionProps } from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type {
  MentionItem,
  ResourceMentionItem,
  ToolMentionItem,
} from "../types.ts";

interface MentionDropdownProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
  editor: unknown;
  isLoading?: boolean;
  pendingCategories?: string[]; // keys: `${integrationId}:${resourceType}`
  // deno-lint-ignore no-explicit-any
  IntegrationAvatar?: React.ComponentType<any>;
}

export const MentionDropdown = forwardRef<
  { onKeyDown: (props: SuggestionProps) => boolean },
  MentionDropdownProps
>(function MentionDropdown(
  { items, command, isLoading, pendingCategories, IntegrationAvatar },
  ref,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  // Map from renderIndex to original items array index
  const renderToOriginalIndex = useRef<Map<number, number>>(new Map());
  // Track double space timing
  const lastSpaceTimeRef = useRef(0);

  const selectItem = (renderIndex: number) => {
    const originalIndex = renderToOriginalIndex.current.get(renderIndex);
    if (originalIndex !== undefined) {
      const item = items[originalIndex];
      if (item) {
        command(item);
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
    // Reset refs array and index mapping when items change
    itemRefs.current = itemRefs.current.slice(0, items.length);
    renderToOriginalIndex.current.clear();
    // Reset double space tracking when items change
    lastSpaceTimeRef.current = 0;
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

      // Handle double space to close mention box
      if (event?.key === " ") {
        const now = Date.now();
        const timeSinceLastSpace = now - lastSpaceTimeRef.current;
        
        if (timeSinceLastSpace < 500) { // Double space within 500ms
          // Close the mention box by returning false and letting the space through
          lastSpaceTimeRef.current = 0;
          return false;
        }
        
        lastSpaceTimeRef.current = now;
        // Allow space in search - return false to let it be added to query
        return false;
      }

      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg min-w-[300px] max-w-[400px] overflow-hidden">
        <div className="h-[400px] w-full flex items-center justify-center p-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size="xs" />
              Searching...
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No results</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg min-w-[300px] max-w-[400px] overflow-hidden">
      <ScrollArea
        className="h-[400px] w-full max-w-[400px]"
        ref={scrollAreaRef}
      >
        <div className="p-1 max-w-[400px]">
          {(() => {
            // Group by integration for display only, preserving keyboard indices
            type AnyItem = ToolMentionItem | ResourceMentionItem;
            const groups: Array<{
              integration: { id: string; name: string; icon?: string };
              indices: number[];
            }> = [];
            const indexByIntegration = new Map<string, number>();

            function getIntegration(item: AnyItem) {
              return item.type === "tool"
                ? item.tool.integration
                : item.integration;
            }

            items.forEach((item, idx) => {
              const integration = getIntegration(item as AnyItem);
              const pos = indexByIntegration.get(integration.id);
              if (pos === undefined) {
                indexByIntegration.set(integration.id, groups.length);
                groups.push({ integration, indices: [idx] });
              } else {
                groups[pos].indices.push(idx);
              }
            });

            let renderIndex = -1;

            return groups.map((group) => (
              <div key={`group-${group.integration.id}`} className="mb-1">
                {(() => {
                  // Build categories for this integration: Tools, and each resourceType
                  const toolIdxs: number[] = [];
                  const byType = new Map<string, number[]>();
                  for (const originalIdx of group.indices) {
                    const it = items[originalIdx] as AnyItem;
                    if (it.type === "tool") {
                      toolIdxs.push(originalIdx);
                    } else {
                      const rType = it.resourceType || "Resources";
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

                  const totalItemsInIntegration = sections.reduce(
                    (acc, s) => acc + s.list.length,
                    0,
                  );
                  if (totalItemsInIntegration === 0 && isLoading) {
                    // Show placeholder header with spinner when integration has no results yet
                    return (
                      <div className="px-2 py-1 flex items-center justify-between bg-muted/40 rounded-md">
                        <div className="flex items-center gap-2 min-w-0">
                          {IntegrationAvatar && (
                            <IntegrationAvatar
                              url={group.integration.icon}
                              fallback={group.integration.name}
                              size="xs"
                              className="flex-shrink-0 w-4 h-4"
                            />
                          )}
                          <span className="text-xs font-semibold truncate">
                            {group.integration.name} — Searching…
                          </span>
                        </div>
                        <Spinner size="xs" />
                      </div>
                    );
                  }

                  return sections.map((section) => (
                    <div
                      key={`section-${group.integration.id}-${section.label}`}
                      className="mb-1"
                    >
                      <div className="px-2 py-1 flex items-center justify-between bg-muted/40 rounded-md">
                        <div className="flex items-center gap-2 min-w-0">
                          {IntegrationAvatar && (
                            <IntegrationAvatar
                              url={group.integration.icon}
                              fallback={group.integration.name}
                              size="xs"
                              className="flex-shrink-0 w-4 h-4"
                            />
                          )}
                          <span className="text-xs font-semibold truncate">
                            {group.integration.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {section.label}
                          </span>
                          {section.label !== "Tools" &&
                          pendingCategories?.includes(
                            `${group.integration.id}:${section.label}`,
                          ) ? (
                            <Spinner size="xs" />
                          ) : null}
                        </div>
                      </div>
                      {section.list.map((originalIdx) => {
                        const item = items[originalIdx] as AnyItem;
                        renderIndex += 1;
                        const currentRenderIndex = renderIndex;
                        // Store mapping from renderIndex to original items array index
                        renderToOriginalIndex.current.set(currentRenderIndex, originalIdx);
                        return (
                          <button
                            type="button"
                            key={item.id}
                            ref={(el) => {
                              itemRefs.current[currentRenderIndex] = el;
                            }}
                            className={cn(
                              "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-left transition-colors",
                              "hover:bg-muted/50",
                              selectedIndex === currentRenderIndex && "bg-muted",
                            )}
                            onClick={() => selectItem(currentRenderIndex)}
                          >
                            <div className="flex min-w-0 flex-1 max-w-[320px]">
                              <div className="flex items-center text-sm truncate">
                                <span className="font-medium">
                                  {item.label}
                                </span>
                                {item.description ? (
                                  <>
                                    <span className="mx-1 text-muted-foreground">
                                      -
                                    </span>
                                    <span className="text-muted-foreground truncate inline-block align-baseline max-w-full">
                                      {item.description}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            </div>
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
