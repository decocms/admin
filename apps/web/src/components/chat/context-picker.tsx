import {
  useIntegrations,
  useDocuments,
  useWorkflowNames,
  useIntegrationViews,
} from "@deco/sdk";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  type RefObject,
} from "react";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { useAgentSettingsToolsSet } from "../../hooks/use-agent-settings-tools-set.ts";
import { useThreadContext } from "../decopilot/thread-context-provider.tsx";
import type { ToolsetContextItem, ResourceContextItem } from "./types.ts";

interface ContextItem {
  id: string;
  title: string;
  description?: string;
  icon: string;
  type: "mcp" | "document" | "tool" | "workflow" | "view";
  integration?: {
    id: string;
    name: string;
    icon?: string;
  };
  tools?: Array<{
    name: string;
    description?: string;
  }>;
  resourceUri?: string;
  resourceType?: "DOCUMENT" | "WORKFLOW" | "VIEW";
  toolName?: string;
  toolIntegrationId?: string;
}

interface ContextPickerProps {
  open: boolean;
  onClose: () => void;
  anchorRef?: RefObject<HTMLElement>;
  // Optional: provide items directly instead of fetching
  items?: ContextItem[];
  // Optional: callback when tools are added (for @ mentions in editor)
  onAddTools?: (toolIds: string[]) => void;
  // Optional: callback when a single tool/resource is selected (for @ mentions)
  onSelectItem?: (itemId: string, type: "tool" | "resource") => void;
}

export function ContextPicker({
  open,
  onClose,
  anchorRef,
  items: providedItems,
  onAddTools,
  onSelectItem,
}: ContextPickerProps) {
  const { data: integrations = [] } = useIntegrations();
  const { data: documents = [] } = useDocuments();
  const workflowNamesQuery = useWorkflowNames();
  const { data: viewsData = [] } = useIntegrationViews({ enabled: true });
  const { appendIntegrationTool } = useAgentSettingsToolsSet();
  const { addContextItem } = useThreadContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(null);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build all context items
  const allItems = useMemo(() => {
    // If items are provided (e.g., from mention dropdown), use those
    if (providedItems) return providedItems;

    const items: ContextItem[] = [];

    // Add MCPs (integrations with tools)
    for (const integration of integrations) {
      if (integration.id.startsWith("a:")) continue;
      const tools = integration.tools ?? [];
      if (tools.length === 0) continue;

      items.push({
        id: `mcp-${integration.id}`,
        title: integration.name,
        description: integration.description,
        icon: "grid_view",
        type: "mcp",
        integration: {
          id: integration.id,
          name: integration.name,
          icon: integration.icon,
        },
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
        })),
      });

      // Add individual tools for search
      for (const tool of tools) {
        items.push({
          id: `tool-${integration.id}:${tool.name}`,
          title: tool.name,
          description: tool.description,
          icon: "build",
          type: "tool",
          toolName: tool.name,
          toolIntegrationId: integration.id,
          integration: {
            id: integration.id,
            name: integration.name,
            icon: integration.icon,
          },
        });
      }
    }

    // Add documents
    for (const document of documents) {
      items.push({
        id: `document-${document.uri}`,
        title: document.data?.name || "Untitled Document",
        description: document.data?.description,
        icon: "description",
        type: "document",
        resourceUri: document.uri,
        resourceType: "DOCUMENT",
      });
    }

    // Add workflows
    const workflows =
      workflowNamesQuery?.data && "workflowNames" in workflowNamesQuery.data
        ? workflowNamesQuery.data.workflowNames
        : [];
    for (const workflowName of workflows) {
      items.push({
        id: `workflow-${workflowName}`,
        title: workflowName,
        icon: "account_tree",
        type: "workflow",
        resourceUri: `rsc://i:workflows-management/workflow/${workflowName}`,
        resourceType: "WORKFLOW",
      });
    }

    // Add views
    for (const view of viewsData) {
      items.push({
        id: `view-${view.name}`,
        title: view.title ?? view.name ?? "Untitled View",
        icon: "visibility",
        type: "view",
        resourceUri: view.url ?? `view://${view.name ?? ""}`,
        resourceType: "VIEW",
        integration: view.integration
          ? {
              id: view.integration.id,
              name: view.integration.name,
              icon: view.integration.icon,
            }
          : undefined,
      });
    }

    return items;
  }, [
    providedItems,
    integrations,
    documents,
    workflowNamesQuery?.data,
    viewsData,
  ]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      // When no search, only show MCPs and resources (not individual tools)
      return allItems.filter(
        (item) =>
          item.type === "mcp" ||
          item.type === "document" ||
          item.type === "workflow" ||
          item.type === "view",
      );
    }

    const query = searchQuery.toLowerCase();

    // Find matching integration IDs
    const matchingIntegrationIds = new Set<string>();
    for (const item of allItems) {
      if (item.type === "mcp" && item.integration?.id) {
        const matches =
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query);
        if (matches) {
          matchingIntegrationIds.add(item.integration.id);
        }
      }
    }

    return allItems.filter((item) => {
      const directMatch =
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query);

      // Include tools if parent integration matches
      if (item.type === "tool" && item.toolIntegrationId) {
        return (
          directMatch || matchingIntegrationIds.has(item.toolIntegrationId)
        );
      }

      return directMatch;
    });
  }, [allItems, searchQuery]);

  // Group items by type for rendering
  const groupedItems = useMemo(() => {
    const groups = new Map<string, ContextItem[]>();
    for (const item of filteredItems) {
      const key = item.type.toUpperCase();
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }
    return groups;
  }, [filteredItems]);

  // Get selected integration details for right panel
  const selectedIntegration = useMemo(() => {
    if (!selectedIntegrationId) return null;
    return allItems.find(
      (item) => item.integration?.id === selectedIntegrationId,
    );
  }, [selectedIntegrationId, allItems]);

  // Filter tools in right panel based on search
  const filteredTools = useMemo(() => {
    if (!selectedIntegration?.tools) return [];
    if (!searchQuery.trim()) return selectedIntegration.tools;

    const query = searchQuery.toLowerCase();
    return selectedIntegration.tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query),
    );
  }, [selectedIntegration?.tools, searchQuery]);

  // Handle tool toggle in right panel
  const handleToolToggle = useCallback(
    (toolName: string, integrationId: string) => {
      const toolId = `${integrationId}:${toolName}`;
      setSelectedTools((prev) => {
        const next = new Set(prev);
        if (next.has(toolId)) {
          next.delete(toolId);
        } else {
          next.add(toolId);
        }
        return next;
      });
    },
    [],
  );

  // Handle ⌘+Enter to add selected tools
  const handleAddTools = useCallback(() => {
    if (selectedTools.size === 0) return;

    // If onAddTools callback is provided (@ mentions), use it
    if (onAddTools) {
      onAddTools(Array.from(selectedTools));
      setSelectedTools(new Set());
      setSelectedIntegrationId(null);
      setSelectedIndex(0);
      onClose();
      return;
    }

    // Otherwise, add to context (+ button behavior)
    const toolsByIntegration = new Map<string, string[]>();
    for (const toolId of selectedTools) {
      const lastColonIndex = toolId.lastIndexOf(":");
      if (lastColonIndex === -1) continue;

      const integrationId = toolId.substring(0, lastColonIndex);
      const toolName = toolId.substring(lastColonIndex + 1);

      if (!toolsByIntegration.has(integrationId)) {
        toolsByIntegration.set(integrationId, []);
      }
      toolsByIntegration.get(integrationId)!.push(toolName);
    }

    // Add all selected tools to context
    for (const [integrationId, toolNames] of toolsByIntegration) {
      for (const toolName of toolNames) {
        appendIntegrationTool(integrationId, toolName);
      }

      if (addContextItem) {
        addContextItem({
          type: "toolset",
          integrationId,
          enabledTools: toolNames,
        } as Omit<ToolsetContextItem, "id">);
      }
    }

    // Reset and close
    setSelectedTools(new Set());
    setSelectedIntegrationId(null);
    setSelectedIndex(0);
    onClose();

    // Refocus chat input
    setTimeout(() => {
      document.querySelector<HTMLElement>(".ProseMirror")?.focus();
    }, 0);
  }, [
    selectedTools,
    onAddTools,
    appendIntegrationTool,
    addContextItem,
    onClose,
  ]);

  // Handle item selection from left panel
  const handleSelectItem = useCallback(
    (item: ContextItem) => {
      if (item.type === "mcp" && item.integration?.id) {
        // Open right panel to select tools
        setSelectedIntegrationId(item.integration.id);
        setSelectedIndex(0);
      } else if (
        item.type === "tool" &&
        item.toolName &&
        item.toolIntegrationId
      ) {
        // If onSelectItem callback is provided (@ mentions), use it
        if (onSelectItem) {
          onSelectItem(`${item.toolIntegrationId}:${item.toolName}`, "tool");
          onClose();
          return;
        }

        // Otherwise, add single tool to context (+ button behavior)
        appendIntegrationTool(item.toolIntegrationId, item.toolName);

        if (addContextItem) {
          addContextItem({
            type: "toolset",
            integrationId: item.toolIntegrationId,
            enabledTools: [item.toolName],
          } as Omit<ToolsetContextItem, "id">);
        }
        onClose();
      } else if (
        (item.type === "document" ||
          item.type === "workflow" ||
          item.type === "view") &&
        item.resourceUri &&
        item.resourceType
      ) {
        // If onSelectItem callback is provided (@ mentions), use it
        if (onSelectItem) {
          onSelectItem(item.resourceUri, "resource");
          onClose();
          return;
        }

        // Otherwise, add resource to context (+ button behavior)
        if (addContextItem) {
          addContextItem({
            type: "resource",
            uri: item.resourceUri,
            name: item.title,
            resourceType: item.resourceType,
          } as Omit<ResourceContextItem, "id">);
        }
        onClose();
      }
    },
    [onSelectItem, appendIntegrationTool, addContextItem, onClose],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘+Enter to add selected tools
      if (
        e.key === "Enter" &&
        (e.metaKey || e.ctrlKey) &&
        selectedIntegrationId
      ) {
        e.preventDefault();
        handleAddTools();
        return;
      }

      // Arrow down
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedIntegrationId) {
          // Navigate tools in right panel
          setSelectedIndex((prev) =>
            Math.min(filteredTools.length - 1, prev + 1),
          );
        } else {
          // Navigate items in left panel
          setSelectedIndex((prev) =>
            Math.min(filteredItems.length - 1, prev + 1),
          );
        }
      }

      // Arrow up
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIntegrationId) {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        } else {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        }
      }

      // Arrow right - open integration tools panel
      if (e.key === "ArrowRight" && !selectedIntegrationId) {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item?.type === "mcp" && item.integration?.id) {
          setSelectedIntegrationId(item.integration.id);
          setSelectedIndex(0);
        }
      }

      // Arrow left - go back to main list
      if (e.key === "ArrowLeft" && selectedIntegrationId) {
        e.preventDefault();
        setSelectedIntegrationId(null);
        setSelectedIndex(0);
      }

      // Enter
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (selectedIntegrationId) {
          // In right panel - toggle or insert tool
          const tool = filteredTools[selectedIndex];
          if (tool && selectedIntegration?.integration?.id) {
            // If onSelectItem is provided (@ mentions), insert immediately
            if (onSelectItem) {
              onSelectItem(
                `${selectedIntegration.integration.id}:${tool.name}`,
                "tool",
              );
              onClose();
            } else {
              // Otherwise, toggle checkbox (+ button behavior)
              handleToolToggle(tool.name, selectedIntegration.integration.id);
            }
          }
        } else {
          // Select item from left panel
          const item = filteredItems[selectedIndex];
          if (item) handleSelectItem(item);
        }
      }

      // Escape
      if (e.key === "Escape") {
        e.preventDefault();
        if (selectedIntegrationId) {
          // Go back to main list
          setSelectedIntegrationId(null);
          setSelectedIndex(0);
        } else {
          // Close picker
          onClose();
          setTimeout(() => {
            document.querySelector<HTMLElement>(".ProseMirror")?.focus();
          }, 0);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    open,
    filteredItems,
    filteredTools,
    selectedIndex,
    selectedIntegrationId,
    selectedIntegration,
    handleSelectItem,
    handleToolToggle,
    handleAddTools,
    onSelectItem,
    onClose,
  ]);

  // Scroll selected item into view
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Focus search input when opened, reset state when closed
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
      setSelectedIndex(0);
      setSelectedIntegrationId(null);
      setSelectedTools(new Set());
    }
  }, [open]);

  // Position above chat input
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef?.current) return;

    const updatePosition = () => {
      const pickerWidth = 550;
      const pickerHeight = 450;
      const gap = 16;
      const rect = anchorRef.current!.getBoundingClientRect();

      let top = rect.top - pickerHeight - gap;
      let left = rect.left + rect.width / 2 - pickerWidth / 2;

      // Keep within viewport
      left = Math.max(16, Math.min(left, window.innerWidth - pickerWidth - 16));

      // If off top, position below
      if (top < 16) {
        top = rect.bottom + gap;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [open, anchorRef]);

  if (!open) return null;

  const pickerContent = (
    <div
      ref={containerRef}
      className="bg-background border border-border rounded-xl shadow-lg w-[550px] h-[450px] flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Input */}
      <div className="flex h-[54px] items-center gap-2 border-b border-border px-3">
        <Icon name="search" className="size-5 text-foreground" size={20} />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedIndex(0);
          }}
          placeholder="Search integrations, documents, workflows..."
          className="flex h-[54px] w-full bg-transparent text-base outline-hidden placeholder:text-muted-foreground"
        />
      </div>

      {/* Main Content Area - Two Panel Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Main List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto pt-1 px-1.5 pb-1">
            {Array.from(groupedItems.entries()).map(([groupName, items]) => (
              <div key={groupName} className="mb-2">
                <div className="flex items-center h-[30px] px-3 text-xs font-mono uppercase text-muted-foreground">
                  {groupName}
                </div>
                <div className="space-y-[2px]">
                  {items.map((item) => {
                    const globalIndex = filteredItems.indexOf(item);
                    const isSelected =
                      !selectedIntegrationId && selectedIndex === globalIndex;
                    const isExpanded =
                      selectedIntegrationId === item.integration?.id;
                    return (
                      <button
                        key={item.id}
                        ref={isSelected ? selectedItemRef : null}
                        onClick={() => handleSelectItem(item)}
                        className={cn(
                          "flex items-center gap-2 h-[46px] px-3 rounded-xl cursor-pointer w-full text-left transition-colors",
                          isExpanded && "bg-accent",
                          isSelected && !isExpanded && "bg-accent",
                          !isSelected && !isExpanded && "hover:bg-accent/50",
                        )}
                      >
                        {item.integration ? (
                          <IntegrationAvatar
                            size="xs"
                            url={item.integration.icon}
                            fallback={item.integration.name}
                            className="rounded-md! shrink-0"
                          />
                        ) : (
                          <Icon
                            name={item.icon}
                            size={20}
                            className="text-muted-foreground shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="font-normal text-sm text-foreground shrink-0">
                            {item.title}
                          </span>
                          {item.description && (
                            <span className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </span>
                          )}
                        </div>
                        {isSelected && item.type === "mcp" && (
                          <>
                            <kbd className="inline-flex items-center justify-center border border-border rounded-md size-5 p-0.5">
                              <Icon
                                name="arrow_forward"
                                size={14}
                                className="text-muted-foreground"
                              />
                            </kbd>
                            <kbd className="inline-flex items-center justify-center border border-border rounded-md size-5 p-0.5">
                              <Icon
                                name="subdirectory_arrow_left"
                                size={14}
                                className="text-muted-foreground"
                              />
                            </kbd>
                          </>
                        )}
                        {isSelected && item.type !== "mcp" && (
                          <kbd className="inline-flex items-center justify-center border border-border rounded-md size-5 p-0.5">
                            <Icon
                              name="subdirectory_arrow_left"
                              size={14}
                              className="text-muted-foreground"
                            />
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Tools Selector */}
        {selectedIntegration && (
          <div className="border-l border-border flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                {selectedIntegration.integration && (
                  <IntegrationAvatar
                    size="lg"
                    url={selectedIntegration.integration.icon}
                    fallback={selectedIntegration.integration.name}
                    className="rounded-md! shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-lg text-foreground">
                    {selectedIntegration.title}
                  </div>
                  {selectedIntegration.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {selectedIntegration.description}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 min-h-0">
              <div className="space-y-[2px]">
                {filteredTools.map((tool, idx) => {
                  const toolId = `${selectedIntegration.integration!.id}:${tool.name}`;
                  const isToolSelected = selectedTools.has(toolId);
                  const isHighlighted = selectedIndex === idx;

                  return (
                    <div
                      key={tool.name}
                      ref={
                        isHighlighted
                          ? (selectedItemRef as unknown as React.RefObject<HTMLDivElement>)
                          : null
                      }
                      onClick={() => {
                        // If onSelectItem is provided (@ mentions), insert immediately
                        if (onSelectItem) {
                          onSelectItem(toolId, "tool");
                          onClose();
                        } else {
                          // Otherwise, toggle checkbox (+ button behavior)
                          handleToolToggle(
                            tool.name,
                            selectedIntegration.integration!.id,
                          );
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 h-[46px] px-3 rounded-xl cursor-pointer w-full text-left transition-colors",
                        isToolSelected && "bg-accent",
                        !isToolSelected && isHighlighted && "bg-accent/50",
                        !isToolSelected &&
                          !isHighlighted &&
                          "hover:bg-accent/50",
                      )}
                    >
                      <Icon
                        name="build"
                        size={20}
                        className="text-muted-foreground shrink-0"
                      />
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="font-normal text-sm text-foreground shrink-0">
                          {tool.name}
                        </span>
                        {tool.description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {tool.description}
                          </span>
                        )}
                      </div>
                      <Checkbox
                        checked={isToolSelected}
                        onCheckedChange={() => {}}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border h-10 flex items-center px-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
              <Icon
                name="arrow_upward"
                size={14}
                className="text-muted-foreground"
              />
            </kbd>
            <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
              <Icon
                name="arrow_downward"
                size={14}
                className="text-muted-foreground"
              />
            </kbd>
            <span>Navigate</span>
          </div>

          {!selectedIntegrationId &&
            filteredItems.length > 0 &&
            filteredItems[selectedIndex]?.type === "mcp" && (
              <>
                <div className="flex items-center gap-1.5">
                  <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
                    <Icon
                      name="arrow_forward"
                      size={14}
                      className="text-muted-foreground"
                    />
                  </kbd>
                  <span>Select tools</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
                    <Icon
                      name="subdirectory_arrow_left"
                      size={14}
                      className="text-muted-foreground"
                    />
                  </kbd>
                  <span>Add all</span>
                </div>
              </>
            )}

          {!selectedIntegrationId &&
            filteredItems[selectedIndex]?.type !== "mcp" && (
              <div className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
                  <Icon
                    name="subdirectory_arrow_left"
                    size={14}
                    className="text-muted-foreground"
                  />
                </kbd>
                <span>Select</span>
              </div>
            )}

          {selectedIntegrationId && (
            <div className="flex items-center gap-1.5">
              <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
                <Icon
                  name="subdirectory_arrow_left"
                  size={14}
                  className="text-muted-foreground"
                />
              </kbd>
              <span>Toggle</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center border border-border rounded-md h-[18px] px-1.5 text-[10px]">
              esc
            </kbd>
            <span>Close</span>
          </div>

          {selectedIntegrationId && (
            <>
              <div className="flex items-center gap-1.5 ml-auto">
                <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
                  <Icon
                    name="arrow_back"
                    size={14}
                    className="text-muted-foreground"
                  />
                </kbd>
                <span>Back</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center justify-center border border-border rounded-md h-[18px] px-1.5 text-[10px]">
                  ⌘
                </kbd>
                <kbd className="inline-flex items-center justify-center border border-border rounded-md size-[18px] p-0.5">
                  <Icon
                    name="subdirectory_arrow_left"
                    size={14}
                    className="text-muted-foreground"
                  />
                </kbd>
                <span>Add tools</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (!anchorRef) return pickerContent;

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        className="fixed z-50 pointer-events-none"
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
      >
        <div className="pointer-events-auto">{pickerContent}</div>
      </div>
    </>
  );
}
