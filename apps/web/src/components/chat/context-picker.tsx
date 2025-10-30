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
  icon?: string;
  avatar?: string;
  type: "mcp" | "integration" | "document" | "tool" | "workflow" | "view";
  integration?: {
    id: string;
    name: string;
    icon?: string;
  };
  tools?: Array<{
    name: string;
    description?: string;
    // For mentions: includes the original MentionItem to insert into editor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item?: any;
  }>;
  resourceUri?: string;
  resourceType?: "DOCUMENT" | "WORKFLOW" | "VIEW";
  // For individual tool items
  toolName?: string;
  toolIntegrationId?: string;
}

interface ContextPickerProps {
  open: boolean;
  onClose: () => void;
  onAddTools?: (toolIds: string[]) => void;
  anchorRef?: RefObject<HTMLElement>;
  // Optional: provide items directly instead of fetching
  items?: ContextItem[];
  // Optional: callback when a single tool/resource is selected (for mentions)
  onSelectItem?: (itemId: string, type: "tool" | "resource") => void;
}

export function ContextPicker({
  open,
  onClose,
  onAddTools,
  anchorRef,
  items: providedItems,
  onSelectItem,
}: ContextPickerProps) {
  const { data: integrations = [] } = useIntegrations();
  const { data: documents = [] } = useDocuments();
  const workflowNamesQuery = useWorkflowNames();
  const { data: viewsData = [] } = useIntegrationViews({ enabled: true });
  const { appendIntegrationTool } = useAgentSettingsToolsSet();
  const { addContextItem } = useThreadContext();

  // Extract workflow names safely
  const workflowNames = workflowNamesQuery?.data?.workflowNames ?? [];

  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(null);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Build context items from integrations and documents, or use provided items
  const contextItems = useMemo(() => {
    if (providedItems) return providedItems;

    const items: ContextItem[] = [];

    // Add MCPS (integrations with tools)
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

      // Add individual tools as searchable items
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
      const documentName = document.data?.name || "Untitled Document";
      const documentId = document.uri;
      items.push({
        id: `document-${documentId}`,
        title: documentName,
        description: document.data?.description || undefined,
        icon: "description",
        type: "document",
        resourceUri: documentId,
        resourceType: "DOCUMENT",
      });
    }

    // Add workflows
    for (const workflowName of workflowNames) {
      const workflowUri = `rsc://i:workflows-management/workflow/${workflowName}`;
      items.push({
        id: `workflow-${workflowName}`,
        title: workflowName,
        icon: "account_tree",
        type: "workflow",
        resourceUri: workflowUri,
        resourceType: "WORKFLOW",
      });
    }

    // Add views
    for (const view of viewsData) {
      const viewUri = view.url ?? `view://${view.name ?? ""}`;
      items.push({
        id: `view-${view.name}`,
        title: view.title ?? view.name ?? "Untitled View",
        description: undefined, // Views don't have description in the type
        icon: "visibility",
        type: "view",
        resourceUri: viewUri,
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
  }, [integrations, documents, workflowNames, viewsData, providedItems]);

  // Filter context items based on search query
  const filteredContextItems = useMemo(() => {
    if (!searchQuery.trim()) {
      // When no search, only show MCPs and resources (not individual tools)
      return contextItems.filter(
        (item) =>
          item.type === "mcp" ||
          item.type === "document" ||
          item.type === "workflow" ||
          item.type === "view",
      );
    }

    const query = searchQuery.toLowerCase();

    // Find integrations that match the query
    const matchingIntegrationIds = new Set<string>();
    for (const item of contextItems) {
      if (item.type === "mcp" && item.integration?.id) {
        const matchesIntegration =
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query);
        if (matchesIntegration) {
          matchingIntegrationIds.add(item.integration.id);
        }
      }
    }

    return contextItems.filter((item) => {
      // Match by title or description
      const directMatch =
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query);

      // For tools: also include if their parent integration matches
      if (item.type === "tool" && item.toolIntegrationId) {
        return (
          directMatch || matchingIntegrationIds.has(item.toolIntegrationId)
        );
      }

      return directMatch;
    });
  }, [contextItems, searchQuery]);

  // Get selected integration details (must be before filteredTools)
  const selectedIntegration = useMemo(() => {
    if (!selectedIntegrationId) return null;
    return contextItems.find(
      (item) => item.integration?.id === selectedIntegrationId,
    );
  }, [selectedIntegrationId, contextItems]);

  // Filter tools in sidebar based on search query
  const filteredTools = useMemo(() => {
    if (!selectedIntegration?.tools) {
      return [];
    }

    // Always filter if there's a search query
    if (!searchQuery.trim()) {
      return selectedIntegration.tools;
    }

    const query = searchQuery.toLowerCase();
    return selectedIntegration.tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query),
    );
  }, [selectedIntegration?.tools, searchQuery]);

  const handleToolToggle = (toolName: string, integrationId: string) => {
    const toolId = `${integrationId}:${toolName}`;

    // If onSelectItem is provided and this is a mention context (has item property),
    // inline the tool immediately instead of toggling selection
    if (onSelectItem && selectedIntegration) {
      const tool = selectedIntegration.tools?.find((t) => t.name === toolName);
      if (tool?.item) {
        onSelectItem(toolId, "tool");
        onClose();
        return;
      }
    }

    // Otherwise, toggle selection for multi-select
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const handleAddTools = useCallback(() => {
    if (selectedTools.size === 0) return;

    // Group tools by integration
    const toolsByIntegration = new Map<string, string[]>();
    for (const toolId of selectedTools) {
      // Split on last colon: "i:triggers-management:TRIGGERS_CREATE" -> ["i:triggers-management", "TRIGGERS_CREATE"]
      const lastColonIndex = toolId.lastIndexOf(":");
      if (lastColonIndex === -1) continue;

      const integrationId = toolId.substring(0, lastColonIndex);
      const toolName = toolId.substring(lastColonIndex + 1);

      if (integrationId && toolName) {
        if (!toolsByIntegration.has(integrationId)) {
          toolsByIntegration.set(integrationId, []);
        }
        toolsByIntegration.get(integrationId)!.push(toolName);
      }
    }

    // Add all selected tools to agent settings and context
    for (const [integrationId, toolNames] of toolsByIntegration) {
      // Add to agent settings
      for (const toolName of toolNames) {
        appendIntegrationTool(integrationId, toolName);
      }

      // Add toolset context item
      if (addContextItem && toolNames.length > 0) {
        addContextItem({
          type: "toolset",
          integrationId,
          enabledTools: toolNames,
        } as Omit<ToolsetContextItem, "id">);
      }
    }

    // Call callback if provided
    onAddTools?.(Array.from(selectedTools));

    // Reset and close
    setSelectedTools(new Set());
    setSelectedIntegrationId(null);
    setSelectedIndex(0);
    onClose();

    // Refocus the chat input
    setTimeout(() => {
      const editor = document.querySelector(".ProseMirror") as HTMLElement;
      if (editor) {
        editor.focus();
      }
    }, 0);
  }, [
    selectedTools,
    appendIntegrationTool,
    addContextItem,
    onAddTools,
    onClose,
  ]);

  // Scroll selected item into view (like command palette - no animation)
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex, selectedIntegrationId]);

  // Focus search input when opened
  useEffect(() => {
    if (open && searchInputRef.current) {
      // Small delay to ensure the component is mounted
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedIndex(0);
      setSelectedIntegrationId(null);
      setSelectedTools(new Set());
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIntegrationId) {
          // Navigate tools in sidebar - don't wrap around
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        } else {
          // Navigate items in main list - don't wrap around
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        }
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedIntegrationId) {
          // Navigate tools in sidebar - don't wrap around
          const toolCount = filteredTools.length;
          setSelectedIndex((prev) => Math.min(toolCount - 1, prev + 1));
        } else {
          // Navigate items in main list - don't wrap around
          setSelectedIndex((prev) =>
            Math.min(filteredContextItems.length - 1, prev + 1),
          );
        }
      }

      if (e.key === "ArrowRight" && !selectedIntegrationId) {
        e.preventDefault();
        // Expand selected integration
        const item = filteredContextItems[selectedIndex];
        if (item?.integration?.id) {
          setSelectedIntegrationId(item.integration.id);
          setSelectedIndex(0);
        }
      }

      if (e.key === "ArrowLeft" && selectedIntegrationId) {
        e.preventDefault();
        // Go back to list
        setSelectedIntegrationId(null);
        setSelectedIndex(0);
      }

      if (e.key === "Enter" && selectedIntegrationId) {
        // Check for ⌘+Enter first (add selected tools)
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          console.log("⌘+Enter pressed, selected tools:", selectedTools);
          handleAddTools();
          return;
        } else {
          // Just Enter (toggle tool selection)
          e.preventDefault();
          const tool = filteredTools[selectedIndex];
          if (tool && selectedIntegration?.integration?.id) {
            // If onSelectItem is provided and tool has item property, inline it
            if (onSelectItem && tool.item) {
              onSelectItem(
                `${selectedIntegration.integration.id}:${tool.name}`,
                "tool",
              );
              onClose();
            } else {
              // Otherwise, toggle tool selection
              handleToolToggle(tool.name, selectedIntegration.integration.id);
            }
          }
        }
      }

      if (
        e.key === "Enter" &&
        !selectedIntegrationId &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        // Select integration or tool/document from main list
        const item = filteredContextItems[selectedIndex];
        if (item?.type === "mcp" && item.integration?.id) {
          // Add ALL tools from the integration to context immediately
          const allTools = item.tools ?? [];
          const integrationId = item.integration.id;
          const toolIds = allTools.map(
            (tool) => `${integrationId}:${tool.name}`,
          );

          // Add all tools
          for (const toolId of toolIds) {
            const [iId, toolName] = toolId.split(":");
            if (iId && toolName) {
              appendIntegrationTool(iId, toolName);
            }
          }

          // Add toolset context item
          if (addContextItem && allTools.length > 0) {
            addContextItem({
              type: "toolset",
              integrationId,
              enabledTools: allTools.map((t) => t.name),
            } as Omit<ToolsetContextItem, "id">);
          }

          onClose();
        } else if (
          item?.type === "tool" &&
          item.toolName &&
          item.toolIntegrationId
        ) {
          // Add individual tool to context
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
          (item?.type === "document" ||
            item?.type === "workflow" ||
            item?.type === "view") &&
          item.resourceUri &&
          item.resourceType
        ) {
          // Add resource (document/workflow/view) as context
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
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (selectedIntegrationId) {
          // Go back to main list
          setSelectedIntegrationId(null);
          setSelectedIndex(0);
        } else {
          // Close the picker and refocus input
          setSelectedTools(new Set());
          setSelectedIntegrationId(null);
          setSelectedIndex(0);
          onClose();

          // Refocus the chat input (ProseMirror editor)
          setTimeout(() => {
            const editor = document.querySelector(
              ".ProseMirror",
            ) as HTMLElement;
            if (editor) {
              editor.focus();
            }
          }, 0);
        }
        return; // Don't process any other handlers
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    open,
    selectedIntegrationId,
    selectedIndex,
    filteredContextItems,
    selectedIntegration,
    selectedTools,
    filteredTools,
    handleAddTools,
    onClose,
    onSelectItem,
    addContextItem,
  ]);

  // Calculate position - always position on top of chat area, centered
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const pickerWidth = 550;
      const pickerHeight = 450;
      const gap = 16;
      const padding = 16; // Viewport padding

      // Find the chat input area (ProseMirror editor or form)
      const chatInput =
        document.querySelector('[data-chat-input="true"]') ||
        document.querySelector(".ProseMirror")?.parentElement;

      if (chatInput) {
        const rect = chatInput.getBoundingClientRect();

        // Position above the chat input, centered
        let top = rect.top - pickerHeight - gap;
        let left = rect.left + rect.width / 2 - pickerWidth / 2;

        // Check if it goes off-screen horizontally
        if (left < padding) {
          left = padding;
        } else if (left + pickerWidth > window.innerWidth - padding) {
          left = window.innerWidth - pickerWidth - padding;
        }

        // If it goes off-screen at the top, position below instead
        if (top < padding) {
          top = rect.bottom + gap;
        }

        // Ensure it doesn't go off-screen at the bottom either
        if (top + pickerHeight > window.innerHeight - padding) {
          top = window.innerHeight - pickerHeight - padding;
        }

        setPosition({ top, left });
      } else {
        // Fallback: center on screen
        const top = (window.innerHeight - pickerHeight) / 2;
        const left = (window.innerWidth - pickerWidth) / 2;
        setPosition({ top, left });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  // Focus container when opened
  useEffect(() => {
    if (open && containerRef.current) {
      containerRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const pickerContent = (
    <div
      className="bg-background border border-border rounded-xl shadow-lg w-[550px] h-[450px] flex flex-col overflow-hidden pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (selectedIntegrationId) {
            setSelectedIntegrationId(null);
            setSelectedIndex(0);
          } else {
            onClose();
            // Refocus the chat input
            setTimeout(() => {
              const editor = document.querySelector(
                ".ProseMirror",
              ) as HTMLElement;
              if (editor) {
                editor.focus();
              }
            }, 0);
          }
        }
      }}
      tabIndex={0}
    >
      {/* Search Input */}
      <div className="flex h-[54px] items-center gap-2 border-b border-border px-3 shrink-0">
        <Icon
          name="search"
          className="size-5 shrink-0 text-foreground"
          size={20}
        />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={(e) => {
            // Don't let the input consume navigation keys or command keys
            if (
              e.key === "ArrowUp" ||
              e.key === "ArrowDown" ||
              e.key === "ArrowLeft" ||
              e.key === "ArrowRight" ||
              e.key === "Escape" ||
              (e.key === "Enter" && (e.metaKey || e.ctrlKey))
            ) {
              // Prevent default and let the global handler deal with it
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }}
          placeholder="Type a command or search"
          className="placeholder:text-muted-foreground flex h-[54px] w-full bg-transparent text-base outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto pt-1 px-1.5 pb-0 flex flex-col gap-[2px]">
            {/* MCPS Section */}
            {filteredContextItems.filter((item) => item.type === "mcp").length >
              0 && (
              <div className="p-0! **:[[cmdk-group-heading]]:px-0! **:[[cmdk-group-heading]]:py-0! **:[[cmdk-group-heading]]:m-0!">
                <div className="flex items-center h-[30px] px-3 text-xs font-mono uppercase text-muted-foreground">
                  MCPS
                </div>
                {filteredContextItems
                  .filter((item) => item.type === "mcp")
                  .map((item, idx) => {
                    const isSelected =
                      !selectedIntegrationId && selectedIndex === idx;
                    return (
                      <button
                        key={item.id}
                        ref={isSelected ? selectedItemRef : null}
                        onClick={() => {
                          setSelectedIntegrationId(
                            item.integration?.id ?? null,
                          );
                          setSelectedIndex(0);
                        }}
                        className={cn(
                          "flex items-center gap-2 h-[46px] px-3 py-0 rounded-xl cursor-pointer w-full text-left transition-colors group",
                          selectedIntegrationId === item.integration?.id &&
                            "bg-accent",
                          isSelected && "bg-accent",
                          !isSelected &&
                            selectedIntegrationId !== item.integration?.id &&
                            "hover:bg-accent/50",
                        )}
                      >
                        {item.integration && (
                          <IntegrationAvatar
                            size="xs"
                            url={item.integration.icon}
                            fallback={item.integration.name}
                            className="rounded-md! shrink-0"
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
                        {isSelected && (
                          <>
                            <kbd className="pointer-events-none inline-flex select-none items-center justify-center rounded-md border border-border bg-transparent size-5 p-0.5">
                              <Icon
                                name="arrow_forward"
                                size={14}
                                className="text-muted-foreground"
                              />
                            </kbd>
                            <kbd className="pointer-events-none inline-flex select-none items-center justify-center rounded-md border border-border bg-transparent size-5 p-0.5">
                              <Icon
                                name="subdirectory_arrow_left"
                                size={14}
                                className="text-muted-foreground"
                              />
                            </kbd>
                          </>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Tools Section */}
            {filteredContextItems.filter((item) => item.type === "tool")
              .length > 0 && (
              <div className="p-0! **:[[cmdk-group-heading]]:px-0! **:[[cmdk-group-heading]]:py-0! **:[[cmdk-group-heading]]:m-0!">
                <div className="flex items-center h-[30px] px-3 text-xs font-mono uppercase text-muted-foreground">
                  TOOLS
                </div>
                {filteredContextItems
                  .filter((item) => item.type === "tool")
                  .map((item, idx) => {
                    const mcpCount = filteredContextItems.filter(
                      (i) => i.type === "mcp",
                    ).length;
                    const globalIdx = mcpCount + idx;
                    const isSelected =
                      !selectedIntegrationId && selectedIndex === globalIdx;
                    return (
                      <button
                        key={item.id}
                        ref={isSelected ? selectedItemRef : null}
                        onClick={() => {
                          // Add individual tool to context
                          if (item.toolName && item.toolIntegrationId) {
                            appendIntegrationTool(
                              item.toolIntegrationId,
                              item.toolName,
                            );

                            if (addContextItem) {
                              addContextItem({
                                type: "toolset",
                                integrationId: item.toolIntegrationId,
                                enabledTools: [item.toolName],
                              } as Omit<ToolsetContextItem, "id">);
                            }

                            onClose();
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 h-[46px] px-3 py-0 rounded-xl cursor-pointer w-full text-left transition-colors",
                          isSelected && "bg-accent",
                          !isSelected && "hover:bg-accent/50",
                        )}
                      >
                        <Icon
                          name="build"
                          size={20}
                          className="text-muted-foreground shrink-0"
                        />
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="font-normal text-sm text-foreground shrink-0">
                            {item.title}
                          </span>
                          {item.integration && (
                            <span className="text-xs text-muted-foreground truncate">
                              {item.integration.name}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <kbd className="pointer-events-none inline-flex select-none items-center justify-center rounded-md border border-border bg-transparent size-5 p-0.5">
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
            )}

            {/* Documents Section */}
            {filteredContextItems.filter((item) => item.type === "document")
              .length > 0 && (
              <div className="p-0! **:[[cmdk-group-heading]]:px-0! **:[[cmdk-group-heading]]:py-0! **:[[cmdk-group-heading]]:m-0!">
                <div className="flex items-center h-[30px] px-3 text-xs font-mono uppercase text-muted-foreground">
                  DOCUMENTS
                </div>
                {filteredContextItems
                  .filter((item) => item.type === "document")
                  .map((item, idx) => {
                    const mcpCount = filteredContextItems.filter(
                      (i) => i.type === "mcp",
                    ).length;
                    const toolCount = filteredContextItems.filter(
                      (i) => i.type === "tool",
                    ).length;
                    const globalIdx = mcpCount + toolCount + idx;
                    const isSelected =
                      !selectedIntegrationId && selectedIndex === globalIdx;
                    return (
                      <button
                        key={item.id}
                        ref={isSelected ? selectedItemRef : null}
                        onClick={() => {
                          // Add document as resource context
                          if (item.resourceUri && addContextItem) {
                            addContextItem({
                              type: "resource",
                              uri: item.resourceUri,
                              name: item.title,
                              resourceType: "DOCUMENT",
                            } as Omit<ResourceContextItem, "id">);
                            onClose();
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 h-[46px] px-3 py-0 rounded-xl cursor-pointer w-full text-left transition-colors",
                          isSelected && "bg-accent",
                          !isSelected && "hover:bg-accent/50",
                        )}
                      >
                        <Icon
                          name="description"
                          size={20}
                          className="text-muted-foreground shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-normal text-sm truncate text-foreground">
                            {item.title}
                          </span>
                        </div>
                        {isSelected && (
                          <kbd className="pointer-events-none inline-flex select-none items-center justify-center rounded-md border border-border bg-transparent size-5 p-0.5">
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
            )}

            {/* Workflows Section */}
            {filteredContextItems.filter((item) => item.type === "workflow")
              .length > 0 && (
              <div className="p-0! **:[[cmdk-group-heading]]:px-0! **:[[cmdk-group-heading]]:py-0! **:[[cmdk-group-heading]]:m-0!">
                <div className="flex items-center h-[30px] px-3 text-xs font-mono uppercase text-muted-foreground">
                  WORKFLOWS
                </div>
                {filteredContextItems
                  .filter((item) => item.type === "workflow")
                  .map((item, idx) => {
                    const mcpCount = filteredContextItems.filter(
                      (i) => i.type === "mcp",
                    ).length;
                    const toolCount = filteredContextItems.filter(
                      (i) => i.type === "tool",
                    ).length;
                    const documentCount = filteredContextItems.filter(
                      (i) => i.type === "document",
                    ).length;
                    const globalIdx =
                      mcpCount + toolCount + documentCount + idx;
                    const isSelected =
                      !selectedIntegrationId && selectedIndex === globalIdx;
                    return (
                      <button
                        key={item.id}
                        ref={isSelected ? selectedItemRef : null}
                        onClick={() => {
                          // Add workflow as resource context
                          if (item.resourceUri && addContextItem) {
                            addContextItem({
                              type: "resource",
                              uri: item.resourceUri,
                              name: item.title,
                              resourceType: "WORKFLOW",
                            } as Omit<ResourceContextItem, "id">);
                            onClose();
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 h-[46px] px-3 py-0 rounded-xl cursor-pointer w-full text-left transition-colors",
                          isSelected && "bg-accent",
                          !isSelected && "hover:bg-accent/50",
                        )}
                      >
                        <Icon
                          name="account_tree"
                          size={20}
                          className="text-muted-foreground shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-normal text-sm truncate text-foreground">
                            {item.title}
                          </span>
                        </div>
                        {isSelected && (
                          <kbd className="pointer-events-none inline-flex select-none items-center justify-center rounded-md border border-border bg-transparent size-5 p-0.5">
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
            )}

            {/* Views Section */}
            {filteredContextItems.filter((item) => item.type === "view")
              .length > 0 && (
              <div className="p-0! **:[[cmdk-group-heading]]:px-0! **:[[cmdk-group-heading]]:py-0! **:[[cmdk-group-heading]]:m-0!">
                <div className="flex items-center h-[30px] px-3 text-xs font-mono uppercase text-muted-foreground">
                  VIEWS
                </div>
                {filteredContextItems
                  .filter((item) => item.type === "view")
                  .map((item, idx) => {
                    const mcpCount = filteredContextItems.filter(
                      (i) => i.type === "mcp",
                    ).length;
                    const toolCount = filteredContextItems.filter(
                      (i) => i.type === "tool",
                    ).length;
                    const documentCount = filteredContextItems.filter(
                      (i) => i.type === "document",
                    ).length;
                    const workflowCount = filteredContextItems.filter(
                      (i) => i.type === "workflow",
                    ).length;
                    const globalIdx =
                      mcpCount +
                      toolCount +
                      documentCount +
                      workflowCount +
                      idx;
                    const isSelected =
                      !selectedIntegrationId && selectedIndex === globalIdx;
                    return (
                      <button
                        key={item.id}
                        ref={isSelected ? selectedItemRef : null}
                        onClick={() => {
                          // Add view as resource context
                          if (item.resourceUri && addContextItem) {
                            addContextItem({
                              type: "resource",
                              uri: item.resourceUri,
                              name: item.title,
                              resourceType: "VIEW",
                            } as Omit<ResourceContextItem, "id">);
                            onClose();
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 h-[46px] px-3 py-0 rounded-xl cursor-pointer w-full text-left transition-colors",
                          isSelected && "bg-accent",
                          !isSelected && "hover:bg-accent/50",
                        )}
                      >
                        <Icon
                          name="visibility"
                          size={20}
                          className="text-muted-foreground shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-normal text-sm truncate text-foreground">
                            {item.title}
                          </span>
                        </div>
                        {isSelected && (
                          <kbd className="pointer-events-none inline-flex select-none items-center justify-center rounded-md border border-border bg-transparent size-5 p-0.5">
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
            )}
          </div>
        </div>

        {/* Right Sidebar - Tools */}
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

            <div className="flex-1 overflow-y-auto p-3 min-h-0 flex flex-col">
              {/* Select All - shrink-0 to keep it visible */}
              <button
                onClick={() => {
                  if (!selectedIntegration.integration?.id) return;
                  // Use filteredTools instead of all tools
                  const allToolIds = filteredTools.map(
                    (tool) =>
                      `${selectedIntegration.integration!.id}:${tool.name}`,
                  );
                  if (allToolIds.every((id) => selectedTools.has(id))) {
                    // Deselect all
                    setSelectedTools((prev) => {
                      const next = new Set(prev);
                      allToolIds.forEach((id) => next.delete(id));
                      return next;
                    });
                  } else {
                    // Select all
                    setSelectedTools((prev) => {
                      const next = new Set(prev);
                      allToolIds.forEach((id) => next.add(id));
                      return next;
                    });
                  }
                }}
                className="bg-accent flex items-center gap-2 h-[46px] px-3 py-0 rounded-xl cursor-pointer w-full text-left mb-2 shrink-0"
              >
                <Icon
                  name="build"
                  size={20}
                  className="text-muted-foreground shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="font-normal text-sm text-foreground">
                    Select all tools
                  </span>
                </div>
                <kbd className="pointer-events-none inline-flex select-none items-center justify-center rounded-md border border-border bg-transparent size-5 p-0.5">
                  <Icon
                    name="subdirectory_arrow_left"
                    size={14}
                    className="text-muted-foreground"
                  />
                </kbd>
              </button>

              {/* Tools List - allow scrolling in this section only */}
              <div className="space-y-[2px] overflow-y-auto min-h-0">
                {filteredTools.map((tool, idx) => {
                  const toolId = `${selectedIntegration.integration!.id}:${tool.name}`;
                  const isSelected = selectedTools.has(toolId);

                  return (
                    <div
                      key={tool.name}
                      ref={
                        selectedIntegrationId && selectedIndex === idx
                          ? (selectedItemRef as unknown as React.RefObject<HTMLDivElement>)
                          : null
                      }
                      onClick={() =>
                        handleToolToggle(
                          tool.name,
                          selectedIntegration.integration!.id,
                        )
                      }
                      className={cn(
                        "flex items-center gap-2 h-[46px] px-3 py-[16px] rounded-xl cursor-pointer w-full text-left transition-colors",
                        isSelected && "bg-accent",
                        !isSelected && selectedIndex === idx && "bg-accent/50",
                        !isSelected &&
                          selectedIndex !== idx &&
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
                        checked={isSelected}
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
      <div className="border-t border-border h-10 flex items-center px-1 shrink-0">
        <div className="flex items-center gap-4 px-2 text-xs text-muted-foreground flex-1">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
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
            </div>
            <span>Navigate</span>
          </div>

          {!selectedIntegrationId &&
            filteredContextItems.length > 0 &&
            filteredContextItems[selectedIndex]?.type === "mcp" && (
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
            <kbd className="inline-flex items-center justify-center border border-border rounded-md h-[18px] px-1.5 font-normal text-[10px]">
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
                <kbd className="inline-flex items-center justify-center border border-border rounded-md h-[18px] px-1.5 font-normal text-[10px]">
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

  // If anchorRef is provided (+ button), position ourselves; otherwise TipTap positions us (@ mentions)
  if (anchorRef) {
    return (
      <>
        {/* Overlay */}
        <div className="fixed inset-0 z-50" onClick={onClose} />

        {/* Picker */}
        <div
          ref={containerRef}
          className="fixed z-50 pointer-events-none"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
          tabIndex={-1}
        >
          {pickerContent}
        </div>
      </>
    );
  }

  // For TipTap positioning (@ mentions) - let tippy.js handle it
  return pickerContent;
}
