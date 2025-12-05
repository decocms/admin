import { IntegrationIcon } from "@/web/components/integration-icon.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useConnections } from "@/web/hooks/collections/use-connection";

export interface ToolSetSelectorProps {
  toolSet: Record<string, string[]>;
  onToolSetChange: (toolSet: Record<string, string[]>) => void;
}

export function ToolSetSelector({
  toolSet,
  onToolSetChange,
}: ToolSetSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const initialOrder = useRef<Set<string>>(new Set(Object.keys(toolSet)));

  const connections = useConnections({
    searchTerm: searchQuery.trim() || undefined,
  });

  const sortedConnections = useMemo(() => {
    const toolSet = initialOrder.current;

    // selected first
    const selected = [...toolSet.values()]
      .map((id) => connections.find((c) => c.id === id))
      .filter((c) => c !== undefined);

    // then not selected
    const notSelected = connections.filter((c) => !toolSet.has(c.id));

    return [...selected, ...notSelected];
  }, [connections, initialOrder.current]);

  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(sortedConnections[0]?.id ?? null);

  // Get selected connection
  const selectedConnection = useMemo(() => {
    if (!selectedConnectionId) return null;
    return sortedConnections.find((c) => c.id === selectedConnectionId) ?? null;
  }, [sortedConnections, selectedConnectionId]);

  // Get tools for selected connection
  const connectionTools = useMemo(() => {
    return selectedConnection?.tools ?? [];
  }, [selectedConnection]);

  // Check if connection has any tools enabled
  const isConnectionSelected = (connectionId: string): boolean => {
    const enabledTools = toolSet[connectionId];
    return enabledTools !== undefined && enabledTools.length > 0;
  };

  // Check if specific tool is enabled
  const isToolSelected = (connectionId: string, toolName: string): boolean => {
    return toolSet[connectionId]?.includes(toolName) ?? false;
  };

  // Toggle a single tool
  const toggleTool = (connectionId: string, toolName: string) => {
    const currentTools = toolSet[connectionId] ?? [];
    const isSelected = currentTools.includes(toolName);

    const newToolSet = { ...toolSet };

    if (isSelected) {
      // Remove tool
      const updatedTools = currentTools.filter((t) => t !== toolName);
      if (updatedTools.length === 0) {
        // Remove connection entry if no tools left
        delete newToolSet[connectionId];
      } else {
        newToolSet[connectionId] = updatedTools;
      }
    } else {
      // Add tool
      newToolSet[connectionId] = [...currentTools, toolName];
    }

    onToolSetChange(newToolSet);
  };

  // Toggle all tools for a connection
  const toggleConnection = (connectionId: string) => {
    const connection = sortedConnections.find((c) => c.id === connectionId);
    if (!connection?.tools) return;

    const currentTools = toolSet[connectionId] ?? [];
    const allToolNames = connection.tools.map((t) => t.name);
    const allSelected =
      currentTools.length > 0 &&
      allToolNames.every((name) => currentTools.includes(name));

    const newToolSet = { ...toolSet };

    if (allSelected) {
      // Deselect all tools
      delete newToolSet[connectionId];
    } else {
      // Select all tools
      newToolSet[connectionId] = allToolNames;
      // Set this connection as the selected connection
      setSelectedConnectionId(connectionId);
    }

    onToolSetChange(newToolSet);
  };

  return (
    <div className="flex h-full border-t border-border">
      {/* Left Column - Connections List */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Search Input */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search connections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Connections List */}
        <div className="flex-1 overflow-auto">
          {sortedConnections.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {searchQuery
                ? "No connections found"
                : "No connections available"}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sortedConnections.map((connection) => {
                const isSelected = selectedConnectionId === connection.id;
                const hasToolsEnabled = isConnectionSelected(connection.id);

                return (
                  <div
                    key={connection.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg transition-colors",
                      isSelected ? "bg-accent" : "hover:bg-muted/50",
                    )}
                  >
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => setSelectedConnectionId(connection.id)}
                    >
                      <IntegrationIcon
                        icon={connection.icon}
                        name={connection.title}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {connection.title}
                          </p>
                        </div>
                        {connection.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {connection.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {connection.tools && connection.tools.length > 0 && (
                      <Checkbox
                        checked={hasToolsEnabled}
                        onCheckedChange={() => toggleConnection(connection.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Tools List */}
      <div className="flex-1 flex flex-col">
        {selectedConnection ? (
          <>
            {/* Connection Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <IntegrationIcon
                  icon={selectedConnection.icon}
                  name={selectedConnection.title}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-foreground">
                    {selectedConnection.title}
                  </h3>
                  {selectedConnection.description && (
                    <p className="text-sm text-muted-foreground">
                      {selectedConnection.description}
                    </p>
                  )}
                </div>
                {connectionTools.length > 0 && (
                  <div className="flex items-center shrink-0 pr-3">
                    <Checkbox
                      checked={isConnectionSelected(selectedConnection.id)}
                      onCheckedChange={() =>
                        toggleConnection(selectedConnection.id)
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Tools List */}
            <div className="flex-1 overflow-auto p-4">
              {connectionTools.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  This connection has no tools available
                </div>
              ) : (
                <div className="space-y-2">
                  {connectionTools.map((tool) => {
                    const isSelected = isToolSelected(
                      selectedConnection.id,
                      tool.name,
                    );

                    return (
                      <label
                        key={tool.name}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer group"
                        htmlFor={`tool-${selectedConnection.id}-${tool.name}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={cn(
                                "text-sm font-medium",
                                isSelected
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {tool.name}
                            </span>
                          </div>
                          {tool.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {tool.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center shrink-0">
                          <Checkbox
                            id={`tool-${selectedConnection.id}-${tool.name}`}
                            checked={isSelected}
                            onCheckedChange={() =>
                              toggleTool(selectedConnection.id, tool.name)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-sm text-muted-foreground text-center">
              Select a connection to view its tools
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
