import { IntegrationIcon } from "@/web/components/integration-icon.tsx";
import {
  ListHeader,
  ListItemRow,
  SelectableList,
} from "@/web/components/selectable-list.tsx";
import { useConnections } from "@/web/hooks/collections/use-connection";
import { Input } from "@deco/ui/components/input.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { ChevronRight, Search } from "lucide-react";
import { useMemo } from "react";

export interface ToolSelectorProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedConnectionId: string | null;
  onConnectionSelect: (connectionId: string | null) => void;
  selectedToolName: string | null;
  onToolNameChange: (toolName: string | null) => void;
}

export function ToolSelector({
  searchQuery,
  onSearchChange,
  selectedConnectionId,
  onConnectionSelect,
  selectedToolName,
  onToolNameChange,
}: ToolSelectorProps) {
  // Load all connections once, filter client-side to avoid re-fetch flicker
  const allConnections = useConnections();

  // Client-side search filtering
  const connections = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return allConnections;
    return allConnections.filter(
      (c) =>
        c.title.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term),
    );
  }, [allConnections, searchQuery]);

  // Keep selected connection even if filtered out of search results
  const selectedConnection = useMemo(
    () => allConnections.find((c) => c.id === selectedConnectionId) ?? null,
    [allConnections, selectedConnectionId],
  );

  const connectionTools = useMemo(
    () => selectedConnection?.tools ?? [],
    [selectedConnection],
  );

  const isToolSelected = (toolName: string) => selectedToolName === toolName;

  return (
    <div className="flex flex-col">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search connections..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 rounded-none border-0 border-b border-border h-10 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      <SelectableList
        items={connections}
        maxHeight="140px"
        emptyMessage={
          searchQuery ? "No connections found" : "No connections available"
        }
        header={
          connections.length > 0 && (
            <ListHeader label="Connections" count={connections.length} />
          )
        }
        renderItem={(connection) => (
          <ListItemRow
            selected={selectedConnectionId === connection.id}
            onClick={() => onConnectionSelect(connection.id)}
          >
            <IntegrationIcon
              icon={connection.icon}
              name={connection.title}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {connection.title}
              </p>
            </div>
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                selectedConnectionId === connection.id
                  ? "text-foreground"
                  : "text-muted-foreground/50",
              )}
            />
          </ListItemRow>
        )}
      />

      {selectedConnection && (
        <div className="border-t border-border">
          <SelectableList
            items={connectionTools.map((t) => ({ ...t, id: t.name }))}
            maxHeight="200px"
            emptyMessage="No tools available"
            header={
              <ListHeader
                label="Tools"
                count={connectionTools.length}
                trailing={
                  <div className="flex items-center gap-1.5">
                    <IntegrationIcon
                      icon={selectedConnection.icon}
                      name={selectedConnection.title}
                      size="sm"
                      className="size-4"
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedConnection.title}
                    </span>
                  </div>
                }
              />
            }
            renderItem={(tool) => {
              const selected = isToolSelected(tool.name);
              return (
                <ListItemRow
                  className={cn(
                    "flex items-start gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer",
                    selected && "bg-primary/10 hover:bg-primary/20",
                  )}
                  onClick={() => onToolNameChange(tool.name)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground block">
                      {tool.name}
                    </span>
                    {tool.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {tool.description}
                      </p>
                    )}
                  </div>
                </ListItemRow>
              );
            }}
          />
        </div>
      )}

      {/* Empty state when no connection selected */}
      {!selectedConnection && connections.length > 0 && (
        <div className="border-t border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Select a connection to view tools
          </p>
        </div>
      )}
    </div>
  );
}
